package review

import (
	"context"
	"io"
	"slices"
	"strings"
	"testing"

	"github.com/shhac/crew-code-review/internal/config"
	"github.com/shhac/lib-agent-harness/native"
)

// Reduced telemetry is ours to default, since a review hands the agent a
// private diff; only an explicit "standard" restores the CLI's own behaviour.
// An empty tools list means Grok's default set, never "no tools", which the
// harness refuses rather than guessing.
func TestResolveGrok(t *testing.T) {
	for _, tc := range []struct {
		telemetry string
		want      native.GrokTelemetryPolicy
	}{
		{"", native.GrokTelemetryReduced},
		{"reduced", native.GrokTelemetryReduced},
		{"standrad", native.GrokTelemetryReduced},
		{"standard", native.GrokTelemetryDefault},
	} {
		got := resolveGrok(config.GrokSettings{Telemetry: tc.telemetry, Tools: []string{}})
		if got.Grok.Telemetry != tc.want || got.Grok.Tools != nil {
			t.Errorf("telemetry %q resolved to %+v", tc.telemetry, got.Grok)
		}
	}
}

// Left empty, a review runs in the least permissive mode headless grok does
// not cancel at its first gh call, inside the sandbox that parallels codex's
// workspace-write. Configured values still win.
func TestResolveGrokDefaultsPermissionsAndSandbox(t *testing.T) {
	got := resolveGrok(config.GrokSettings{}).Grok
	if got.PermissionMode != "auto" || got.Sandbox != "workspace" {
		t.Errorf("defaults = %+v, want auto permissions in the workspace sandbox", got)
	}
	got = resolveGrok(config.GrokSettings{PermissionMode: "bypassPermissions", Sandbox: "off"}).Grok
	if got.PermissionMode != "bypassPermissions" || got.Sandbox != "off" {
		t.Errorf("configured values were overridden: %+v", got)
	}
}

func TestGrokSendsItsConfiguration(t *testing.T) {
	e := newGrok(config.GrokSettings{
		EngineCommon:   config.EngineCommon{Model: "grok-code", Effort: "high", Args: []string{"--no-subagents"}},
		Sandbox:        "strict",
		PermissionMode: "dontAsk",
		Tools:          []string{"read", "bash"},
	}, "NUDGE")
	wd := t.TempDir()
	args := sent(t, e, Request{WorkDir: wd, Prompt: "PROMPT"})[0].args
	for _, want := range []string{
		"--model=grok-code", "--reasoning-effort=high", "--sandbox=strict",
		"--permission-mode=dontAsk", "--tools=read,bash", "--cwd=" + wd, "--no-subagents",
	} {
		if !slices.Contains(args, want) {
			t.Errorf("args missing %q: %v", want, args)
		}
	}
	if !slices.ContainsFunc(args, func(a string) bool { return strings.HasPrefix(a, "--json-schema=") }) {
		t.Errorf("the verdict schema must travel inline: %v", args)
	}
}

// The harness keeps the provider's own words out of its errors; the driver
// puts them back, because an ERROR row that says only "turn failed" sends you
// to the transcript for the one line that explains it.
func TestReviewErrorCarriesTheProvidersFailure(t *testing.T) {
	zero := 0
	e := newGrok(config.GrokSettings{EngineCommon: config.EngineCommon{MaxResumes: &zero}}, "NUDGE")
	e.cfg.RunCommand = func(_ context.Context, _ []string, _ string, stdout, _ io.Writer) error {
		_, _ = io.WriteString(stdout, `{"type":"end","stopReason":"max_tokens","sessionId":"s","usage":{"input_tokens":1,"output_tokens":1}}`+"\n")
		return nil
	}
	v, err := e.Review(context.Background(), Request{WorkDir: t.TempDir(), Prompt: "P"})
	if err == nil || v.Decision != DecisionError {
		t.Fatalf("verdict = %+v, err = %v; want an ERROR", v, err)
	}
	// The failure is whatever the transcript rendered under its error marker.
	_, rendered, ok := strings.Cut(v.Raw, "\nerror\n")
	failure, _, _ := strings.Cut(rendered, "\n")
	if !ok || failure == "" {
		t.Fatalf("the transcript must render the failure:\n%s", v.Raw)
	}
	if !strings.HasPrefix(err.Error(), "grok --single: ") || !strings.HasSuffix(err.Error(), ": "+failure) {
		t.Errorf("error = %q, want the provider's reason %q after the engine's own", err, failure)
	}
}
