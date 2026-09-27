// Package doctor diagnoses whether this machine can actually run a review.
//
// It exists because every dependency here fails LATE and quietly: a missing
// or logged-out engine CLI surfaces only as repeated ERROR history rows with
// the reason buried in the engine transcript, and a model that the permission
// classifier rejects fails identically on every PR. Reading a queue full of
// ERRORs tells you something is wrong but not what. These checks answer that
// in one command, and the daemon runs them at boot so the answer is in the
// log before the first failed review rather than after the twentieth.
package doctor

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"github.com/shhac/crew-code-review/internal/config"
	"github.com/shhac/crew-code-review/internal/pricing"
	"github.com/shhac/crew-code-review/internal/review"
	"github.com/shhac/crew-code-review/internal/store"
	harness "github.com/shhac/lib-agent-harness"
	"github.com/shhac/lib-agent-harness/account"
	"github.com/shhac/lib-agent-harness/native"
)

// probeTimeout bounds each external command. Generous enough for a cold
// binary, short enough that a wedged CLI cannot hang boot.
const probeTimeout = 15 * time.Second

// Check is one diagnosis. Blocking marks a failure that stops reviews working
// at all, as opposed to one that only degrades something (a usage meter, a
// shell completion).
type Check struct {
	Name     string `json:"check"`
	OK       bool   `json:"ok"`
	Blocking bool   `json:"blocking"`
	Detail   string `json:"detail,omitempty"`
	Hint     string `json:"hint,omitempty"`
}

// Run executes every check against the given config. Never returns an error:
// a failed check IS the result, and the caller decides what a failure means.
func Run(ctx context.Context, cfg config.Config) []Check {
	checks := []Check{
		binaryCheck(ctx, "gh", "gh", "--version", "install the GitHub CLI (brew install gh)"),
		authCheck(ctx, "gh-auth", "gh", []string{"auth", "status"}, "run `gh auth login`"),
		binaryCheck(ctx, "duckdb", store.DuckDBBin(), "--version", "install duckdb (brew install duckdb), or set CREW_CODE_REVIEW_DUCKDB_PATH"),
	}
	// Every engine any author group can route to, not just the configured
	// one: a typo in a rarely-used group would otherwise surface at 3am as an
	// ERROR row. Not every WIRED engine either, which would fail a deploy over
	// an engine nothing references.
	for _, engine := range cfg.ReachableEngines() {
		checks = append(checks, engineChecks(ctx, engine, cfg)...)
	}
	checks = append(checks, pricingCheck(config.PricingCacheDir()))
	// Unknown keys come from the FILE, not from cfg: cfg is exactly the parsed
	// subset that cannot see them. Kept out of ConfigProblems, which stays a
	// pure function of the config it is handed and so tests without a
	// filesystem.
	checks = append(checks, configKeysCheck(config.UnknownKeyProblems()))
	return append(checks, configCheck(ConfigProblems(cfg)))
}

// ConfigProblems is every statically detectable misconfiguration: the author
// groups themselves, plus each engine-settings combination a group can
// actually produce. Preflight's checks are model-and-mode specific (the
// auto-mode model trap), and a group naming its own model is exactly what can
// introduce a bad pairing that the base config does not have.
//
// Exported so boot validation reports the same problems `doctor` does.
func ConfigProblems(cfg config.Config) []string {
	problems := cfg.ValidateReview()
	problems = append(problems, cfg.ValidateAuthors()...)
	// Scoring resolves a bad ruleset to the shipped defaults rather than
	// failing a review, which is right at review time and wrong as the only
	// signal: an inverted bucket ladder would otherwise score every PR at
	// defaults forever and say nothing. This is where it says something.
	problems = append(problems, cfg.ValidateScoring()...)
	problems = append(problems, cfg.ValidateDurations()...)
	for _, rs := range reachableSettings(cfg) {
		for _, p := range review.Preflight(rs.settings) {
			problems = append(problems, rs.where+p)
		}
	}
	return problems
}

// reachableSetting is one engine configuration a review can actually run
// under, with the group or override that introduced it.
type reachableSetting struct {
	where    string
	settings config.ReviewSettings
}

// reachableSettings enumerates the distinct engine configurations a review can
// actually run under: the base settings, then each cohort's and each
// override's patch of them. Deduplicated on the fields Preflight judges, so a
// dozen groups sharing one model report one problem rather than a dozen;
// `where` attributes each to whoever introduced it.
func reachableSettings(cfg config.Config) []reachableSetting {
	seen := map[string]bool{}
	var out []reachableSetting
	add := func(where string, policy config.Policy) {
		settings := cfg.Review.WithPolicy(policy)
		key := fmt.Sprintf("%s|%s|%s|%s|%s|%s",
			settings.Engine, settings.Claude.Model, settings.Claude.Effort,
			settings.Claude.PermissionMode, settings.Codex.Model, settings.Codex.Effort)
		if seen[key] {
			return
		}
		seen[key] = true
		out = append(out, reachableSetting{where: where, settings: settings})
	}
	add("", config.Policy{})
	for _, cohort := range cfg.Cohorts() {
		add("group "+cohort.Name+": ",
			config.Policy{Engine: cohort.Engine, Model: cohort.Model, Effort: cohort.Effort})
	}
	for _, o := range cfg.Authors.Overrides {
		add("override "+o.Handle+": ", config.Policy{Engine: o.Engine, Model: o.Model, Effort: o.Effort})
	}
	return out
}

// pricingCheck reports the model price table. Never blocking: only claude
// values its own runs, so the table is what lets codex spend be estimated at
// all, but a review runs identically without it. The daemon refreshes it in
// the background, so an absent table on a machine that has never run `serve`
// is expected rather than a fault.
func pricingCheck(dir string) Check {
	st := pricing.Open(dir).Status()
	if st.Models == 0 {
		return Check{Name: "pricing", OK: false, Blocking: false,
			Detail: "no model price table cached",
			Hint:   "run `crew-code-review serve` once; it fetches and refreshes it every " + pricing.RefreshInterval.String()}
	}
	age := time.Since(st.FetchedAt).Truncate(time.Minute)
	return Check{Name: "pricing", OK: true, Blocking: false,
		Detail: fmt.Sprintf("%d models, checked %s ago", st.Models, age)}
}

// configCheck folds every static configuration problem into ONE check.
// Check.Name is a unique key everywhere else here — the CLI keys its exit
// message off the first failure, and any consumer reading the NDJSON rows
// reasonably assumes one row per check. Emitting a row per problem broke that
// silently: a config with two problems reported two rows both called
// engine-config, and only the first reached the error message.
func configCheck(problems []string) Check {
	if len(problems) == 0 {
		return Check{Name: "engine-config", OK: true, Blocking: true, Detail: "no conflicting settings"}
	}
	return Check{
		Name: "engine-config", OK: false, Blocking: true,
		Detail: strings.Join(problems, "; "),
		Hint:   "crew-code-review config set ...",
	}
}

// configKeysCheck reports keys the schema has no home for. NOT blocking:
// reviews run exactly as they would without the key, which is the whole
// problem -- the setting is simply not in effect and nothing else says so.
// Blocking is reserved for "reviews would fail on this machine right now",
// and overstating this here would make a typo look like a broken install.
func configKeysCheck(problems []string) Check {
	if len(problems) == 0 {
		return Check{Name: "config-keys", OK: true, Detail: "every key is one this version reads"}
	}
	return Check{
		Name: "config-keys", OK: false,
		Detail: strings.Join(problems, "; "),
		Hint:   "crew-code-review config unset ... (the next write drops them anyway)",
	}
}

// Blocking reports whether any blocking check failed, i.e. whether reviews
// would fail on this machine right now.
func Blocking(checks []Check) []Check {
	var failed []Check
	for _, c := range checks {
		if !c.OK && c.Blocking {
			failed = append(failed, c)
		}
	}
	return failed
}

// engineChecks probes one engine's CLI: present, and logged in. Only engines
// a group can actually route to are probed, so a machine set up for one engine
// isn't told off for lacking the other.
//
// An engine the harness cannot run a review on gets that answer, not a probe:
// a switch whose default meant codex once reported an unknown engine healthy
// on the strength of codex being installed.
func engineChecks(ctx context.Context, engine string, cfg config.Config) []Check {
	if c := harness.Support(harness.Engine(engine), harness.Run, harness.Available); !c.Usable() {
		return []Check{{
			Name: "engine:" + engine, Blocking: true,
			Detail: fmt.Sprintf("engine %q cannot run reviews: %s", engine, c.Reason),
			Hint:   "valid engines: " + strings.Join(config.EngineNames, ", "),
		}}
	}
	provider := cfg.Review.Provider(engine)
	return []Check{
		versionCheck(ctx, engine, provider),
		loginCheck(ctx, engine, provider),
	}
}

// versionCheck asks the harness for the CLI's version, so the detail line
// records exactly which build is in play and a missing binary is told apart
// from one that will not start.
func versionCheck(ctx context.Context, engine string, provider harness.Provider) Check {
	name := "engine:" + engine
	bin := config.DefaultBin(engine, provider.CLI.Binary)
	hint := fmt.Sprintf("install the %s CLI, or set %s.bin", engine, engine)
	ctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()
	version, err := native.Version(ctx, native.Config{Provider: provider})
	if err == nil {
		return Check{Name: name, OK: true, Blocking: true, Detail: firstLine(version)}
	}
	if facts, ok := harness.ErrorFacts(err); ok && facts.Code == native.CodeExecutableNotFound {
		return Check{Name: name, Blocking: true, Detail: fmt.Sprintf("%q not on PATH", bin), Hint: hint}
	}
	return Check{Name: name, Blocking: true, Detail: fmt.Sprintf("%q found but --version failed: %v", bin, err), Hint: hint}
}

// accountTimeout bounds a login read. Longer than probeTimeout: the harness
// starts the CLI's own protocol server and asks it, which is slower than
// printing a version.
const accountTimeout = 30 * time.Second

// inspectAccount is the harness's login read, a variable so tests never
// start a real CLI.
var inspectAccount = account.Inspect

// loginFallbacks answer for an engine whose inspection can say "logged in"
// but never "logged out": Claude's handshake has no logged-in flag, so a
// missing account there is unknown rather than absent. Its own status command
// does say, so it is asked only then.
var loginFallbacks = map[harness.Engine]func(context.Context, harness.Provider) Check{
	harness.Claude: claudeAuthCheck,
}

// loginCheck asks the harness whether the engine's CLI is logged in, without
// inference, through the same login the reviews will use.
func loginCheck(ctx context.Context, engine string, provider harness.Provider) Check {
	name := "engine:" + engine + "-auth"
	hint := config.LoginHint(engine, provider.CLI.Binary)
	if c := harness.Support(provider.Engine, harness.Account, harness.Login); !c.Usable() {
		return Check{Name: name, Detail: "login cannot be checked: " + c.Reason}
	}
	inspectCtx, cancel := context.WithTimeout(ctx, accountTimeout)
	defer cancel()
	report, err := inspectAccount(inspectCtx, provider)
	if loggedIn := report.Account.LoggedIn; loggedIn != nil {
		if !*loggedIn {
			return Check{Name: name, Blocking: true, Detail: "not logged in", Hint: hint}
		}
		return Check{Name: name, OK: true, Blocking: true,
			Detail: strings.TrimSpace(report.Account.AuthMethod + " " + report.Account.Plan)}
	}
	if fallback, ok := loginFallbacks[provider.Engine]; ok {
		return fallback(ctx, provider)
	}
	detail := "login could not be confirmed"
	if err != nil {
		detail += ": " + err.Error()
	} else if report.Account.Reason != "" {
		detail += ": " + report.Account.Reason
	}
	return Check{Name: name, Blocking: true, Detail: detail, Hint: hint}
}

// binaryCheck resolves the binary and reads its version, so the detail line
// records exactly which build is in play.
func binaryCheck(ctx context.Context, name, bin, versionArg, hint string) Check {
	if _, err := exec.LookPath(bin); err != nil {
		return Check{Name: name, Blocking: true, Detail: fmt.Sprintf("%q not on PATH", bin), Hint: hint}
	}
	out, err := run(ctx, bin, versionArg)
	if err != nil {
		return Check{Name: name, Blocking: true, Detail: fmt.Sprintf("%q found but %s failed: %v", bin, versionArg, err), Hint: hint}
	}
	return Check{Name: name, OK: true, Blocking: true, Detail: firstLine(out)}
}

// authCheck treats a zero exit as authenticated, which is the contract
// `gh auth status` follows.
func authCheck(ctx context.Context, name, bin string, args []string, hint string) Check {
	if _, err := exec.LookPath(bin); err != nil {
		return Check{Name: name, Blocking: true, Detail: fmt.Sprintf("%q not on PATH", bin), Hint: hint}
	}
	out, err := run(ctx, bin, args...)
	if err != nil {
		return Check{Name: name, Blocking: true, Detail: "not authenticated", Hint: hint}
	}
	return Check{Name: name, OK: true, Blocking: true, Detail: firstLine(out)}
}

func run(ctx context.Context, bin string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, bin, args...).CombinedOutput()
	return string(out), err
}

func firstLine(s string) string {
	line, _, _ := strings.Cut(strings.TrimSpace(s), "\n")
	return line
}
