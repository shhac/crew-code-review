package config

// Engine resolution: which engine reviews a candidate, which block of settings
// is that engine's, and which engines a config can reach at all. The raw
// per-engine blocks live in schema.go; the review package applies each
// engine's own defaults on top of what this resolves.

import (
	"slices"

	harness "github.com/shhac/lib-agent-harness"
)

// DefaultEngine reviews a candidate when nothing names another engine.
const DefaultEngine = string(harness.Codex)

// EngineNames lists the review engines, default first: every engine the
// harness can run a native agent on. Asked of harness.Support rather than
// listed, so an engine the library gains is offered without a list here to
// update, and one it cannot run (an API endpoint has no native agent) is never
// offered. It lives here rather than in the review package because config is
// the one package every consumer already imports.
//
// review re-exports this as review.Engines, so existing callers are unchanged.
var EngineNames = runnableEngines()

func runnableEngines() []string {
	names := []string{DefaultEngine}
	for _, e := range harness.Engines() {
		if string(e) != DefaultEngine && harness.Support(e, harness.Run, harness.Available).Usable() {
			names = append(names, string(e))
		}
	}
	return names
}

// ResolvedEngine is the review engine id, defaulting to DefaultEngine.
// On ReviewSettings rather than Config because that is the value the callers
// which need it actually hold.
func (r ReviewSettings) ResolvedEngine() string {
	if r.Engine != "" {
		return r.Engine
	}
	return DefaultEngine
}

// Engine is the review engine id, defaulting to the first wired engine.
func (c Config) Engine() string { return c.Review.ResolvedEngine() }

// EngineCommon selects the named engine's shared dials. THE engine switch:
// the one place that maps a name to its settings block, so adding an engine
// is a case here rather than a hunt through the call sites.
//
// An unknown name falls back to the default engine's block, the long-standing
// behaviour for a name nothing recognises.
func (r *ReviewSettings) EngineCommon(engine string) *EngineCommon {
	switch harness.Engine(engine) {
	case harness.Claude:
		return &r.Claude.EngineCommon
	case harness.Grok:
		return &r.Grok.EngineCommon
	}
	return &r.Codex.EngineCommon
}

// Provider is where the named engine's CLI lives: its binary and login home,
// as the harness takes them. Empty fields keep the harness's own defaults (the
// engine's name on PATH, the CLI's usual home), so this is the one place a
// configured bin or home reaches every mode that launches the CLI.
func (r ReviewSettings) Provider(engine string) harness.Provider {
	return r.EngineCommon(engine).Provider(engine)
}

// Provider is this block's CLI location for the named engine, for the callers
// that hold one engine's settings rather than the whole review block.
func (e EngineCommon) Provider(engine string) harness.Provider {
	return harness.Provider{
		Engine: harness.Engine(engine),
		CLI:    harness.CLI{Binary: e.Bin, Home: e.Home},
	}
}

// loginCommands is how each CLI signs in. The harness reports whether an
// engine is logged in, never how to fix it, so the hint is ours.
var loginCommands = map[string]string{
	string(harness.Codex):  "login",
	string(harness.Claude): "auth login",
	string(harness.Grok):   "login",
}

// LoginHint is the actionable line for an engine found logged out.
func LoginHint(engine, bin string) string {
	sub, ok := loginCommands[engine]
	if !ok {
		return "log in with the " + engine + " CLI"
	}
	return "run `" + DefaultBin(engine, bin) + " " + sub + "`"
}

// DefaultBin resolves a possibly-empty binary against an engine name, for the
// callers that hold only those two strings and no Config.
func DefaultBin(engine, bin string) string {
	if bin != "" {
		return bin
	}
	return engine
}

// defaultUsageFloor is the headroom every engine leaves for interactive work
// unless its block says otherwise: pause at 90% used.
const defaultUsageFloor = 10

// UsageFloors are the remaining-percentage floors for one engine's two
// windows, below which that engine's candidates are held (default 10 each; an
// explicit 0 disables that window's floor).
//
// On ReviewSettings rather than Config so the policy cascade reaches it for
// free: cfg.Review.UsageFloors(engine) is the base floor a panel reports, and
// cfg.Review.WithPolicy(p).UsageFloors(engine) is the one a candidate is
// actually held against.
func (r ReviewSettings) UsageFloors(engine string) (fiveH, oneW int) {
	f := r.EngineCommon(engine).UsageFloor
	return intOr(f.FiveHourPercent, defaultUsageFloor), intOr(f.OneWeekPercent, defaultUsageFloor)
}

// WithPolicy returns these settings with the policy's engine dials applied:
// what the driver for this candidate is actually built from. Only the resolved
// engine's model and effort are touched, so a policy naming claude cannot
// leave a stray model on the codex settings.
func (r ReviewSettings) WithPolicy(p Policy) ReviewSettings {
	if p.Engine != "" {
		r.Engine = p.Engine
	}
	applyFloors(&r, p.UsageFloor)
	applyDials(&r, p)
	return r
}

// applyFloors patches EVERY engine the policy names, not just the resolved
// one -- the deliberate opposite of applyDials below. A cohort's floor is
// keyed by engine precisely so that moving the cohort between engines does
// not change how much headroom it leaves on either.
func applyFloors(r *ReviewSettings, floors map[string]UsageFloorLimits) {
	for engine, f := range floors {
		r.EngineCommon(engine).UsageFloor.merge(f)
	}
}

// applyDials patches only the RESOLVED engine's model and effort, so a policy
// naming claude cannot leave a stray model on the codex settings.
func applyDials(r *ReviewSettings, p Policy) {
	if p.Model == "" && p.Effort == "" {
		return
	}
	e := r.EngineCommon(r.ResolvedEngine())
	if p.Model != "" {
		e.Model = p.Model
	}
	if p.Effort != "" {
		e.Effort = p.Effort
	}
}

// EngineFor is the engine that will actually review a candidate whose author
// resolved to this policy: the policy's own engine when it names one, else the
// configured default. Callers that need to ask something OF that engine (its
// usage headroom, its binary) go through here rather than checking p.Engine
// and forgetting the empty case.
func (c Config) EngineFor(p Policy) string {
	if p.Engine != "" {
		return p.Engine
	}
	return c.Engine()
}

// ReachableEngines lists every engine any candidate could actually be reviewed
// by: the configured default plus every engine a group or override names,
// deduplicated, default first. Doctor and boot validation probe this set
// rather than the configured engine alone (a typo in a rarely-used group would
// otherwise surface at 3am as an ERROR row) or every wired engine (which would
// fail a deploy over an engine nothing references).
func (c Config) ReachableEngines() []string {
	engines := []string{c.Engine()}
	add := func(name string) {
		if name != "" && !slices.Contains(engines, name) {
			engines = append(engines, name)
		}
	}
	for _, cohort := range c.Cohorts() {
		add(cohort.Engine)
	}
	for _, o := range c.Authors.Overrides {
		add(o.Engine)
	}
	return engines
}

// GroupsUsing names the groups and overrides that select engine, so a failing
// engine check can say who depends on it. The default engine is reported as
// "(default)".
func (c Config) GroupsUsing(engine string) []string {
	var users []string
	if c.Engine() == engine {
		users = append(users, "(default)")
	}
	for _, cohort := range c.Cohorts() {
		if cohort.Engine == engine {
			users = append(users, "group "+cohort.Name)
		}
	}
	for _, o := range c.Authors.Overrides {
		if o.Engine == engine {
			users = append(users, "override "+o.Handle)
		}
	}
	return users
}
