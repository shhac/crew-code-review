package review

// This file is the engine-agnostic half of a review driver. Every engine
// reports through the same verdict contract (the output schema and the
// reporting instruction appended to the prompt), tees its transcript into the
// same workdir log, and yields to the same bounded resume policy when a run
// ends before reporting a real outcome. nativeengine.go is the one driver;
// codex.go, claude.go and grok.go supply only its application configuration.
// lib-agent-harness/native owns invocation, stream decoding, session
// identifiers and token accounting.

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"

	harness "github.com/shhac/lib-agent-harness"
	"github.com/shhac/lib-agent-harness/native"
)

// verdictSchema constrains the agent's report. An engine without unconstrained
// progress messages (harness.Support(e, harness.Run, harness.ProgressMessages)
// unsupported: codex) applies the schema to EVERY assistant message in a run,
// not just the final one, so WORKING exists as the honest value for
// intermediate progress notes; without it the agent overloads SKIPPED for "I'm
// still investigating". The others apply it only to the final structured
// output, where WORKING instead means the run stopped early. ERROR is
// deliberately absent: it is a driver's own value for "the invocation failed",
// never something the agent reports.
const verdictSchema = `{
  "type": "object",
  "properties": {
    "decision": {
      "type": "string",
      "enum": ["WORKING", "APPROVED", "COMMENTED", "REQUESTED_CHANGES", "SKIPPED"],
      "description": "WORKING = you are not finished yet (use for every intermediate progress note; NEVER as your final message). The rest report what you actually did: APPROVED = submitted an approving review; COMMENTED = left a review or comments without approving; REQUESTED_CHANGES = submitted a request-changes review; SKIPPED = did not review this PR."
    },
    "summary": {
      "type": "string",
      "description": "One or two sentences: your progress note (WORKING), or what you did and why (final message)."
    }
  },
  "required": ["decision", "summary"],
  "additionalProperties": false
}`

// reportingInstruction is appended to every prompt so the agent knows its final
// message is a machine-read report, not prose.
const reportingInstruction = `

Every message you emit matches the provided output schema. While you are still working, use {"decision": "WORKING", "summary": "<progress note>"} for intermediate updates. When you are completely finished, your FINAL message must report the outcome: {"decision": "APPROVED"|"COMMENTED"|"REQUESTED_CHANGES"|"SKIPPED", "summary": "..."}. The final decision must reflect what you ACTUALLY did on GitHub: APPROVED only if you submitted an approving review, COMMENTED if you left a review or comments without approving, REQUESTED_CHANGES if you submitted a request-changes review, SKIPPED if you did not review this PR (explain why in the summary). Never end on WORKING.`

// agentLogName is the live log file every engine tees its output into inside
// the review workdir; consumers locate it through LogPath.
const agentLogName = "agent.log"

// LogPath locates the review agent's live log inside its workspace. The
// engine tees its output there as the run progresses; the CLI's `queue log`
// and the dashboard's per-review page both tail it through this one contract.
// The harness renders every engine's stream into this one shape.
func LogPath(workDir string) string {
	return filepath.Join(workDir, agentLogName)
}

// newAgentSink builds the writer engine output streams into: an in-memory
// buffer (it feeds Verdict.Raw for error surfacing) teed into the workdir's
// live agent log (see LogPath) as the run progresses, so the CLI's
// `queue log` and the dashboard's per-review page can watch it. A workspace
// that can't hold the log file degrades to buffer-only; diagnostics must
// survive even when the live view can't.
func newAgentSink(workDir string) (io.Writer, *bytes.Buffer, func()) {
	buf := &bytes.Buffer{}
	logFile, err := os.Create(LogPath(workDir))
	if err != nil {
		return buf, buf, func() {}
	}
	return io.MultiWriter(buf, logFile), buf, func() { _ = logFile.Close() }
}

// errEndedOnWorking marks a run whose final report was an intermediate
// WORKING note: the agent yielded early, and the driver may resume it.
var errEndedOnWorking = errors.New("agent ended on an intermediate WORKING report (run truncated?)")

// parseVerdict validates one agent report against the decision vocabulary.
func parseVerdict(data []byte) (Verdict, error) {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return Verdict{}, fmt.Errorf("empty verdict report")
	}
	var v Verdict
	if err := json.Unmarshal(trimmed, &v); err != nil {
		return Verdict{}, fmt.Errorf("parse verdict report: %w", err)
	}
	switch v.Decision {
	case DecisionApproved, DecisionCommented, DecisionRequestedChanges, DecisionSkipped:
		return v, nil
	case DecisionWorking:
		// WORKING is only legal mid-run; ending on it means the run stopped
		// short before a real outcome was reported.
		return Verdict{}, errEndedOnWorking
	default:
		return Verdict{}, fmt.Errorf("verdict report has invalid decision %q", v.Decision)
	}
}

// defaultMaxResumes bounds the resume-on-WORKING nudges per review when an
// engine's max_resumes setting is unset.
const defaultMaxResumes = 2

// resolveMaxResumes applies the shared nil-or-negative-means-default policy to
// an engine's max_resumes setting. Both drivers carry the same *int and the
// same rule, so it lives beside the default it falls back to.
func resolveMaxResumes(configured *int) int {
	if configured != nil && *configured >= 0 {
		return *configured
	}
	return defaultMaxResumes
}

// resumableRun is one review expressed as the parts the resume policy needs.
// The invocations and the report are engine-specific; the policy that combines
// them is not, which is the whole reason this lives here instead of in each
// driver. Session, spend, and usage are read off the one stream every
// invocation of the review writes into, because the harness normalises them
// there for every engine: an engine that reports no cost (codex) leaves it
// unknown, which records as 0.
type resumableRun struct {
	engine string // names the engine in error text
	max    int    // resume attempts allowed

	start  func() error                 // the initial invocation; error means the process failed
	resume func(sessionID string) error // one nudge against an existing session
	report func() (Verdict, error)      // latest report; errEndedOnWorking when the agent yielded early
	raw    func() string                // full transcript, for Verdict.Raw and error surfacing
	stream *native.Stream               // spans every invocation: session id, usage, cost
}

// do drives the initial invocation and, when a clean exit's report is WORKING
// (the agent yielded its turn without a tool call and the CLI took that as
// the final answer, so the session is intact and nothing was posted), resumes
// with a nudge up to max times instead of burning the whole run as an ERROR.
// The finished run resolves through resolve, so callers see one ordinary
// (Verdict, error).
func (r resumableRun) do() (Verdict, error) {
	runErr := r.start()
	verdict, parseErr := r.report()
	for resumed := 0; resumed < r.max && runErr == nil && errors.Is(parseErr, errEndedOnWorking); resumed++ {
		sessionID := r.stream.Snapshot().SessionID
		if sessionID == "" {
			break
		}
		runErr = r.resume(sessionID)
		verdict, parseErr = r.report()
	}
	return r.resolve(verdict, parseErr, runErr)
}

// resolve applies the precedence rules for one finished run: a valid report
// wins even over a non-zero exit (a partial run may still have reported its
// outcome); otherwise the process failure, and last a clean exit that never
// produced a report.
// A failed run still carries its spend: the tokens and cost were incurred
// whether or not a report came back, and an ERROR that hides what it cost is
// exactly the row you want to see when the budget looks wrong.
//
// The harness keeps provider text out of its errors, so the provider's own
// account of a failed turn (Result.Failure) is appended here, where the old
// error text used to carry it: an ERROR row that says only "turn failed" sends
// you to the transcript for the one line that explains it.
func (r resumableRun) resolve(verdict Verdict, parseErr, runErr error) (Verdict, error) {
	spent := r.stream.Snapshot()
	raw := r.raw()
	if parseErr == nil {
		verdict.Raw = raw
		verdict.CostUSD = knownUSD(spent.Cost)
		verdict.Tokens = spent.Usage
		verdict.UsageRaw = spent.RawUsage
		return verdict, nil
	}
	failed := Verdict{Decision: DecisionError, Raw: raw, CostUSD: knownUSD(spent.Cost), Tokens: spent.Usage, UsageRaw: spent.RawUsage}
	if runErr != nil {
		if spent.Failure != "" {
			return failed, fmt.Errorf("%s: %w: %s", r.engine, runErr, spent.Failure)
		}
		return failed, fmt.Errorf("%s: %w", r.engine, runErr)
	}
	return failed, fmt.Errorf("%s succeeded but no verdict report: %w", r.engine, parseErr)
}

// knownUSD is the engine's own valuation when it stated a complete one. A
// partial figure is not recorded as the run's cost: 0 lets our own estimate
// stand in (store.Review.EffectiveCostUSD) instead of an understatement.
func knownUSD(c harness.Cost) float64 {
	if !c.Known {
		return 0
	}
	return c.USD
}

// prepareWorkspace resolves the review's workspace, creating a temp one when
// the caller supplied none.
func prepareWorkspace(workDir string) (string, error) {
	if workDir != "" {
		return workDir, nil
	}
	return os.MkdirTemp("", "crew-code-review-")
}

// logSessionPattern matches the session-id banner both transcoders render at
// the top of every invocation.
var logSessionPattern = regexp.MustCompile(`(?m)^session id: (\S+)\s*$`)

// maxLogScan bounds how much of a previous agent log is read looking for a
// session to resume. Generous next to a real review log, and a ceiling either
// way so a runaway log cannot be pulled into memory at claim time.
const maxLogScan = 8 << 20

// SessionFromLog recovers the engine session a previous attempt was running,
// from the transcript it left in workDir. "" when there is nothing to resume:
// no log, no banner, or a log too mangled to read.
//
// This is what lets an interrupted review continue instead of starting over.
// The transcript is the only place the session id survives a daemon death —
// it lives in the transcoder's memory otherwise — which is a good reason for
// every engine to render it into the shared format rather than keep it.
//
// The LAST banner wins: a log that already covers a resume holds several, and
// the most recent names the session still open.
func SessionFromLog(workDir string) string {
	f, err := os.Open(LogPath(workDir))
	if err != nil {
		return ""
	}
	defer func() { _ = f.Close() }()
	data, err := io.ReadAll(io.LimitReader(f, maxLogScan))
	if err != nil {
		return ""
	}
	matches := logSessionPattern.FindAllSubmatch(data, -1)
	if len(matches) == 0 {
		return ""
	}
	return string(matches[len(matches)-1][1])
}
