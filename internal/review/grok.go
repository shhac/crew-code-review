package review

import (
	"cmp"

	"github.com/shhac/crew-code-review/internal/config"
	harness "github.com/shhac/lib-agent-harness"
	"github.com/shhac/lib-agent-harness/native"
)

// newGrok drives `grok --single` non-interactively with the assembled prompt.
func newGrok(c config.GrokSettings, resumePrompt string) *nativeEngine {
	return &nativeEngine{
		label:        "grok --single",
		cfg:          resolveGrok(c),
		maxResumes:   resolveMaxResumes(c.MaxResumes),
		resumePrompt: resumePrompt,
	}
}

// grokAutoPermissionMode is claude's auto for the same reasons, and the least
// permissive mode a review survives. Headless grok has nobody to answer a
// permission prompt, and the prompt does not fail the one call: it CANCELS THE
// WHOLE RUN. Measured on grok 1.0.41 against a scripted provider, the CLI's
// own default, acceptEdits and dontAsk all ended the turn "cancelled" at the
// first `gh --version`, which is every review. auto puts each call outside
// the built-in read-only set to a classifier instead, and a call it refuses is
// reported to the agent while the run carries on. The classifier was shown the
// user turn and the proposed call but not the output of earlier calls, so a
// hostile diff read into the session cannot argue for its own approval.
const grokAutoPermissionMode = "auto"

// grokWorkspaceSandbox is codex's workspace-write for grok: reads everywhere,
// writes only to the working directory (the per-PR workdir), temp and grok's
// own home, kernel-enforced for every child process. It is the narrowest
// built-in profile a review can run under: read-only and strict also block
// child-process network on Linux, and that is gh's only way to GitHub.
const grokWorkspaceSandbox = "workspace"

// resolveGrok applies grok's defaults: auto permissions, the workspace
// sandbox, and reduced telemetry. Telemetry is ours to default because a
// review hands the agent a private diff, and the CLI's normal behaviour also
// imports other harnesses' MCP servers, hooks and skills into the run, which
// is configuration this tool never chose. Anything but an explicit "standard"
// reads as reduced, so a typo fails toward sending less. Tools are passed as
// configured; empty keeps grok's default set.
func resolveGrok(c config.GrokSettings) native.Config {
	telemetry := native.GrokTelemetryReduced
	if c.Telemetry == "standard" {
		telemetry = native.GrokTelemetryDefault
	}
	var tools []string
	if len(c.Tools) > 0 {
		tools = c.Tools
	}
	return native.Config{
		Provider: c.Provider(string(harness.Grok)),
		Model:    c.Model,
		Effort:   c.Effort,
		Grok: native.GrokOptions{
			Sandbox:        cmp.Or(c.Sandbox, grokWorkspaceSandbox),
			PermissionMode: cmp.Or(c.PermissionMode, grokAutoPermissionMode),
			Tools:          tools,
			Telemetry:      telemetry,
		},
		Args: c.Args,
	}
}
