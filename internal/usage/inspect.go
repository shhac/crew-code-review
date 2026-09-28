package usage

// Headroom is read through lib-agent-harness's account.Inspect, which asks
// each engine's own CLI over its native protocol (codex app-server's
// account/rateLimits/read, claude's get_usage control request) using the login
// that CLI already holds. Nothing here reads, sends, or stores a credential,
// and no model is invoked. This package used to do both halves itself: a
// hand-written codex JSON-RPC client, and a claude path that pulled the OAuth
// token out of the keychain to call an undocumented endpoint.

import (
	"cmp"
	"context"
	"fmt"
	"time"

	"github.com/shhac/crew-code-review/internal/config"
	harness "github.com/shhac/lib-agent-harness"
	"github.com/shhac/lib-agent-harness/account"
)

// inspect is the harness read, a variable so Fetch's own tests never start a
// real CLI.
var inspect = account.Inspect

// Metered lists the engines whose subscription windows can be read at all:
// the ones harness.Support says report quota. An engine outside it (grok has
// no quota windows) is not polled, so it never shows as a permanent error or
// pauses a review; the floor fails open for it exactly as for a failed read.
func Metered(engines []string) []string {
	var out []string
	for _, engine := range engines {
		if harness.Support(harness.Engine(engine), harness.Account, harness.Quota).Usable() {
			out = append(out, engine)
		}
	}
	return out
}

// Fetch reads one snapshot from the source's engine.
func Fetch(ctx context.Context, src Source) (Snapshot, error) {
	engine := harness.Engine(src.Engine)
	if c := harness.Support(engine, harness.Account, harness.Quota); !c.Usable() {
		return Snapshot{}, fmt.Errorf("%s usage: %s", src.Engine, c.Reason)
	}
	report, err := inspect(ctx, harness.Provider{Engine: engine, CLI: harness.CLI{Binary: src.Bin, Home: src.Home}})
	return fromReport(src, report, err)
}

// fromReport maps one read onto a Snapshot. Success is judged by the quota
// alone: Inspect returns whatever it did get beside its error, so a failed
// account read beside a good quota still meters.
func fromReport(src Source, report harness.AccountReport, err error) (Snapshot, error) {
	if !report.Quota.Known() {
		return Snapshot{}, unavailable(src, report, err)
	}
	return Snapshot{
		Plan:      report.Account.Plan,
		Primary:   pick(src.Engine, report.Quota.Windows, harness.QuotaSession),
		Secondary: pick(src.Engine, report.Quota.Windows, harness.QuotaWeekly),
		FetchedAt: time.Now(),
	}, nil
}

// unavailable explains a read that produced no headroom. The harness keeps
// captured CLI output out of its error values, so their text is safe to show
// on the dashboard as it is. A login the CLI reports absent gets the one
// actionable hint.
func unavailable(src Source, report harness.AccountReport, err error) error {
	if report.Account.LoggedIn != nil && !*report.Account.LoggedIn {
		return fmt.Errorf("%s is not logged in; %s", src.Engine, config.LoginHint(src.Engine, src.Bin))
	}
	if facts, ok := harness.ErrorFacts(err); ok && facts.Code == harness.CodeKeychainUnavailable {
		return fmt.Errorf("%s usage: the login keychain is locked; unlock it to read usage", src.Engine)
	}
	if err != nil {
		return fmt.Errorf("%s usage: %w", src.Engine, err)
	}
	return fmt.Errorf("%s reports no rate limits (%s)", src.Engine, cmp.Or(report.Quota.Reason, "no reason given"))
}

// pick returns the account-wide window of one kind. Inspect also reports
// windows these overlap (claude's per-model weekly limits, codex's separate
// limit buckets such as its review allowance); no floor acts on those, and
// letting one reach BelowFloor would pause reviews over a scoped limit the
// review never spends from. A per-model window says so (Model); a separate
// codex bucket does not, so the engine's own bucket is preferred and the
// harness's first otherwise, which is the only one on a CLI that predates
// per-limit buckets. A window without a duration is skipped, since BelowFloor
// tells the 5-hourly window from the weekly one by it.
func pick(engine string, windows []harness.QuotaWindow, kind harness.QuotaKind) *Window {
	var first *harness.QuotaWindow
	for i := range windows {
		w := &windows[i]
		if w.Kind != kind || w.Model != "" || w.WindowMinutes == nil {
			continue
		}
		if w.Scope == engine {
			return toWindow(*w)
		}
		if first == nil {
			first = w
		}
	}
	if first == nil {
		return nil
	}
	return toWindow(*first)
}

func toWindow(w harness.QuotaWindow) *Window {
	out := &Window{WindowMins: int(*w.WindowMinutes)}
	if w.UsedPercent != nil {
		out.UsedPercent = *w.UsedPercent
	}
	if w.ResetsAt != nil {
		out.ResetsAt = w.ResetsAt.Unix()
	}
	return out
}
