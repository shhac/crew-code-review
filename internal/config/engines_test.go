package config

import (
	"slices"
	"testing"

	harness "github.com/shhac/lib-agent-harness"
)

// TestEngineCommonIsTheOnlyEngineSwitch pins the property the shared dials
// exist for: adding an engine should be one case in one function, not a hunt
// through every getter that used to write `if engine == "claude"`.
func TestEngineCommonIsTheOnlyEngineSwitch(t *testing.T) {
	c := Config{Review: ReviewSettings{
		Engine: "claude",
		Codex:  CodexSettings{EngineCommon: EngineCommon{Bin: "codex-dev", Model: "gpt", Effort: "low"}},
		Claude: ClaudeSettings{EngineCommon: EngineCommon{Bin: "claude-dev", Model: "opus", Effort: "high"}},
	}}
	// Every "which engine's dial" question routes through the one selector.
	if got := c.Review.EngineCommon(c.Engine()); got.Bin != "claude-dev" || got.Model != "opus" || got.Effort != "high" {
		t.Errorf("EngineCommon(selected) = %+v, want the selected engine's block", *got)
	}
	if got := c.Review.EngineCommon("codex").Bin; got != "codex-dev" {
		t.Errorf("EngineCommon names an engine regardless of selection, got %q", got)
	}
	c.Review.Grok = GrokSettings{EngineCommon: EngineCommon{Bin: "grok-dev"}}
	if got := c.Review.EngineCommon("grok").Bin; got != "grok-dev" {
		t.Errorf("grok has its own block, got %q", got)
	}
}

// The engines offered are the ones the harness can run a native agent on,
// default first; an API endpoint has no native agent, so it is not one.
func TestEngineNamesAreTheRunnableEngines(t *testing.T) {
	if EngineNames[0] != DefaultEngine || DefaultEngine != "codex" {
		t.Errorf("EngineNames = %v, want codex first", EngineNames)
	}
	for _, want := range []string{"codex", "claude", "grok"} {
		if !slices.Contains(EngineNames, want) {
			t.Errorf("EngineNames = %v, missing %s", EngineNames, want)
		}
	}
	if slices.Contains(EngineNames, string(harness.OpenAICompatible)) {
		t.Errorf("EngineNames = %v: an API endpoint cannot run a review", EngineNames)
	}
}

// Provider carries the configured bin and home as they are, leaving an empty
// one to the harness's own default rather than restating it.
func TestProviderCarriesTheEnginesBinAndHome(t *testing.T) {
	r := ReviewSettings{Grok: GrokSettings{EngineCommon: EngineCommon{Bin: "/opt/grok", Home: "/srv/grok"}}}
	want := harness.CLI{Binary: "/opt/grok", Home: "/srv/grok"}
	if got := r.Provider("grok"); got.Engine != harness.Grok || got.CLI != want || got.Problem() != "" {
		t.Errorf("Provider = %+v, want grok at %+v", got, want)
	}
	if got := r.Provider("claude"); got.Engine != harness.Claude || got.CLI != (harness.CLI{}) {
		t.Errorf("an unconfigured engine = %+v, want only its engine", got)
	}
}

func TestLoginHintNamesTheConfiguredBinary(t *testing.T) {
	if got := LoginHint("claude", ""); got != "run `claude auth login`" {
		t.Errorf("LoginHint = %q", got)
	}
	if got := LoginHint("grok", "/opt/grok"); got != "run `/opt/grok login`" {
		t.Errorf("LoginHint = %q", got)
	}
}

func TestDefaultBinResolvesToTheEngineName(t *testing.T) {
	if got := DefaultBin("grok", ""); got != "grok" {
		t.Errorf("DefaultBin = %q: an engine nothing has configured still resolves to its name", got)
	}
	if got := DefaultBin("claude", "/opt/claude"); got != "/opt/claude" {
		t.Errorf("DefaultBin = %q, want the configured binary", got)
	}
}

func TestWithPolicyAppliesOnlyTheResolvedEnginesDials(t *testing.T) {
	base := ReviewSettings{
		Engine: "codex",
		Codex:  CodexSettings{EngineCommon: EngineCommon{Model: "gpt-5.6", Effort: "low"}},
		Claude: ClaudeSettings{EngineCommon: EngineCommon{Model: "sonnet", Effort: "low"}},
	}

	t.Run("switching engine moves the dials to that engine", func(t *testing.T) {
		got := base.WithPolicy(Policy{Engine: "claude", Model: "opus", Effort: "high"})
		if got.Engine != "claude" || got.Claude.Model != "opus" || got.Claude.Effort != "high" {
			t.Errorf("claude settings not applied: %+v", got.Claude)
		}
		if got.Codex.Model != "gpt-5.6" || got.Codex.Effort != "low" {
			t.Errorf("codex settings should be untouched, got %+v", got.Codex)
		}
	})

	t.Run("dials without an engine land on the configured one", func(t *testing.T) {
		got := base.WithPolicy(Policy{Model: "gpt-5.7"})
		if got.Engine != "codex" || got.Codex.Model != "gpt-5.7" {
			t.Errorf("codex model not applied: %+v", got)
		}
		if got.Claude.Model != "sonnet" {
			t.Errorf("claude settings should be untouched, got %+v", got.Claude)
		}
	})

	t.Run("an empty policy changes nothing", func(t *testing.T) {
		got := base.WithPolicy(Policy{})
		if got.Engine != base.Engine ||
			got.Codex.Model != base.Codex.Model || got.Codex.Effort != base.Codex.Effort ||
			got.Claude.Model != base.Claude.Model || got.Claude.Effort != base.Claude.Effort {
			t.Errorf("empty policy mutated settings: %+v", got)
		}
	})

	t.Run("the default engine is used when none is configured", func(t *testing.T) {
		got := ReviewSettings{}.WithPolicy(Policy{Model: "gpt-5.7"})
		if got.Codex.Model != "gpt-5.7" {
			t.Errorf("model should land on the default engine, got %+v", got)
		}
	})
}

func TestReachableEnginesAndTheirUsers(t *testing.T) {
	cfg := groupCfg()
	cfg.Review.Engine = "codex"

	engines := cfg.ReachableEngines()
	if len(engines) != 2 || engines[0] != "codex" {
		t.Fatalf("want [codex claude] with the default first, got %v", engines)
	}
	if !contains(engines, "claude") {
		t.Errorf("claude is reachable via group core, got %v", engines)
	}

	users := cfg.GroupsUsing("claude")
	if len(users) != 1 || users[0] != "group core" {
		t.Errorf("want claude attributed to group core, got %v", users)
	}
	if got := cfg.GroupsUsing("codex"); len(got) != 1 || got[0] != "(default)" {
		t.Errorf("want codex attributed to the default, got %v", got)
	}
}
