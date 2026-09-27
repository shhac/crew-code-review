package review

import (
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

// resolveGrok applies grok's one default of ours: reduced telemetry. A
// review hands the agent a private diff, and the CLI's normal behaviour also
// imports other harnesses' MCP servers, hooks and skills into the run, which
// is configuration this tool never chose. Anything but an explicit "standard"
// reads as reduced, so a typo fails toward sending less. Sandbox, permission
// mode and tools are passed as configured; empty leaves each to the CLI.
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
			Sandbox:        c.Sandbox,
			PermissionMode: c.PermissionMode,
			Tools:          tools,
			Telemetry:      telemetry,
		},
		Args: c.Args,
	}
}
