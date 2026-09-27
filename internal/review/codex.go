package review

import (
	"cmp"

	"github.com/shhac/crew-code-review/internal/config"
	harness "github.com/shhac/lib-agent-harness"
	"github.com/shhac/lib-agent-harness/native"
)

// newCodex drives `codex exec` non-interactively with the assembled prompt.
func newCodex(c config.CodexSettings, resumePrompt string) *nativeEngine {
	return &nativeEngine{
		label:        "codex exec",
		cfg:          resolveCodex(c),
		maxResumes:   resolveMaxResumes(c.MaxResumes),
		resumePrompt: resumePrompt,
	}
}

// resolveCodex applies codex's defaults: the sandbox. Model and effort have
// none of ours; empty leaves them to codex.
func resolveCodex(c config.CodexSettings) native.Config {
	return native.Config{
		Provider: c.Provider(string(harness.Codex)),
		Model:    c.Model,
		Effort:   c.Effort,
		// The agent needs to write scratch files and run gh; workspace-write
		// scopes that to the per-PR workdir.
		Codex: native.CodexOptions{Sandbox: cmp.Or(c.Sandbox, "workspace-write")},
		Args:  c.Args,
	}
}
