package review

import (
	"os"
	"strings"
	"testing"
	"time"

	harness "github.com/shhac/lib-agent-harness"
	"github.com/shhac/lib-agent-harness/native"
)

// goldenGrokTranscript is the grok third of the cross-language log contract:
// this package writes it, and the dashboard's parser test
// (internal/dashboard/ui/src/lib/agentlog.test.ts) parses it. Regenerate with
// `go test ./internal/review -update-golden`.
const goldenGrokTranscript = "testdata/grok-transcript.golden"

// TestGrokTranscodeGoldenTranscript pins the bytes a grok review tees into
// agent.log, so the dashboard's claim to read a grok log (its agent kind is
// "grok") is a test rather than an assumption. The event sequence follows
// grok's streaming-json shape as the harness's own fixtures record it.
func TestGrokTranscodeGoldenTranscript(t *testing.T) {
	var out strings.Builder
	tr, err := native.NewStream(harness.Grok, &out, native.StreamOptions{Clock: fixedClock(500 * time.Millisecond), Structured: true})
	if err != nil {
		t.Fatal(err)
	}
	tr.UserPrompt("Review pull request owner/repo#42.")
	for _, line := range []string{
		`{"type":"thought","data":"Reading the diff first."}`,
		`{"type":"text","data":"Checking the diff against the linked issue."}`,
		`{"type":"tool_call","toolCallId":"call_1","title":"gh pr diff 42","kind":"execute","status":"in_progress","toolName":"bash","rawInput":{"command":"gh pr diff 42"},"content":[],"locations":[]}`,
		`{"type":"tool_call_update","toolCallId":"call_1","status":"completed","content":[],"rawOutput":"diff --git a/main.go b/main.go\n+ added a line","locations":[]}`,
		`{"type":"end","stopReason":"end_turn","sessionId":"0199aa00-grok-4c1e-9d2b-5e6f7a8b9c0d","usage":{"input_tokens":4000,"cache_read_input_tokens":30000,"cache_creation_input_tokens":0,"output_tokens":800,"reasoning_tokens":120},"total_cost_usd_ticks":123400000,"structuredOutput":{"decision":"COMMENTED","summary":"Left two inline notes about error handling."}}`,
	} {
		if _, err := tr.Write([]byte(line + "\n")); err != nil {
			t.Fatal(err)
		}
	}
	tr.Close()
	got := out.String()

	if *updateGolden {
		if err := os.WriteFile(goldenGrokTranscript, []byte(got), 0o644); err != nil {
			t.Fatal(err)
		}
		t.Logf("wrote %s", goldenGrokTranscript)
		return
	}
	want, err := os.ReadFile(goldenGrokTranscript)
	if err != nil {
		t.Fatalf("%v (regenerate with: go test ./internal/review -update-golden)", err)
	}
	if got != string(want) {
		t.Errorf("transcript drifted from the fixture the UI parser reads.\n--- got ---\n%s\n--- want ---\n%s", got, want)
	}
	// Grok names its session only when the turn ends, so the banner trails
	// the transcript; an interrupted review must still find it to resume.
	dir := t.TempDir()
	if err := os.WriteFile(LogPath(dir), []byte(got), 0o600); err != nil {
		t.Fatal(err)
	}
	if id := SessionFromLog(dir); id != "0199aa00-grok-4c1e-9d2b-5e6f7a8b9c0d" {
		t.Errorf("session from a grok log = %q", id)
	}
}
