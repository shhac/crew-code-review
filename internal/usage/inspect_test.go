package usage

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	harness "github.com/shhac/lib-agent-harness"
	"github.com/shhac/lib-agent-harness/session"
)

// window builds one harness quota window as the library reports it: a kind,
// the bucket it belongs to (Scope), and a model for a per-model limit.
func window(kind harness.QuotaKind, scope, model string, used float64, mins int64) harness.QuotaWindow {
	resets := time.Unix(1790175224, 0).UTC()
	return harness.QuotaWindow{Kind: kind, Scope: scope, Model: model, UsedPercent: &used, WindowMinutes: &mins, ResetsAt: &resets}
}

func measured(windows ...harness.QuotaWindow) harness.QuotaSnapshot {
	return harness.QuotaSnapshot{
		Observation: harness.Observation{Quality: harness.Measured, ObservedAt: time.Now()},
		Complete:    true,
		Windows:     windows,
	}
}

func quota(windows ...harness.QuotaWindow) harness.AccountReport {
	return harness.AccountReport{Quota: measured(windows...)}
}

// Inspect reports every window an engine exposes. Only the account-wide pair
// may reach the floor: a scoped window near its limit (a per-model weekly
// cap, or codex's separate review bucket, which the harness's own fixture
// shows past 100%) is not what a review spends from, and letting it through
// would park reviews over it.
func TestFromReportKeepsOnlyTheAccountWindows(t *testing.T) {
	for name, tc := range map[string]struct {
		engine        string
		windows       []harness.QuotaWindow
		primary, week float64
	}{
		"claude": {"claude", []harness.QuotaWindow{
			window(harness.QuotaSession, "", "", 30, 300),
			window(harness.QuotaWeeklyModel, "Fable", "Fable", 99, 10080),
			window(harness.QuotaWeekly, "", "", 40, 10080),
			window(harness.QuotaWeeklyModel, "opus", "opus", 99, 10080),
		}, 30, 40},
		// The review bucket is a model-less session window too, listed first
		// here so only the preference for codex's own bucket can pass.
		"codex": {"codex", []harness.QuotaWindow{
			window(harness.QuotaSession, "review", "", 123, 300),
			window(harness.QuotaSession, "codex", "", 25, 300),
			window(harness.QuotaWeekly, "codex", "", 60, 10080),
		}, 25, 60},
		"codex before per-limit buckets": {"codex", []harness.QuotaWindow{
			window(harness.QuotaSession, "default", "", 10, 300),
			window(harness.QuotaWeekly, "default", "", 20, 10080),
		}, 10, 20},
	} {
		t.Run(name, func(t *testing.T) {
			snap, err := fromReport(Source{Engine: tc.engine}, quota(tc.windows...), nil)
			if err != nil {
				t.Fatal(err)
			}
			if snap.Primary == nil || snap.Primary.UsedPercent != tc.primary || snap.Secondary == nil || snap.Secondary.UsedPercent != tc.week {
				t.Fatalf("snapshot = %+v / %+v, want %v / %v", snap.Primary, snap.Secondary, tc.primary, tc.week)
			}
			if below, why := BelowFloor(snap, 20, 20); below {
				t.Errorf("a scoped window tripped the floor: %s", why)
			}
		})
	}
}

func TestFromReportMapsAWindow(t *testing.T) {
	report := quota(window(harness.QuotaWeekly, "codex", "", 96, 10080))
	report.Account.Plan = "prolite"
	snap, err := fromReport(Source{Engine: "codex"}, report, nil)
	if err != nil {
		t.Fatal(err)
	}
	want := Window{UsedPercent: 96, WindowMins: 10080, ResetsAt: 1790175224}
	if snap.Plan != "prolite" || snap.Secondary == nil || *snap.Secondary != want || snap.Primary != nil || !snap.OK() {
		t.Errorf("snapshot = %+v secondary %+v, want plan prolite and %+v alone", snap, snap.Secondary, want)
	}

	// Unreported percent and reset read as zero, as the old readers did; a
	// window with no duration cannot be placed as 5-hourly or weekly, so it
	// is not mapped at all.
	mins := int64(300)
	bare := quota(
		harness.QuotaWindow{Kind: harness.QuotaSession, WindowMinutes: &mins},
		harness.QuotaWindow{Kind: harness.QuotaWeekly},
	)
	snap, _ = fromReport(Source{Engine: "claude"}, bare, nil)
	if snap.Primary == nil || *snap.Primary != (Window{WindowMins: 300}) || snap.Secondary != nil {
		t.Errorf("bare windows = %+v / %+v", snap.Primary, snap.Secondary)
	}
}

// Inspect returns what it got alongside its error, so an account read that
// failed must not blank a quota that arrived.
func TestFromReportMetersDespiteAFailedAccountRead(t *testing.T) {
	snap, err := fromReport(Source{Engine: "claude"}, quota(window(harness.QuotaSession, "", "", 5, 300)), session.ErrProtocol)
	if err != nil || !snap.OK() {
		t.Errorf("snapshot = %+v, err = %v, want a usable snapshot", snap, err)
	}
}

// Every way of getting no headroom is an error, so Poll records it and the
// floor fails open; the text is what the dashboard shows beside the empty
// meter.
func TestFromReportExplainsNoHeadroom(t *testing.T) {
	loggedOut := false
	for name, tc := range map[string]struct {
		src    Source
		report harness.AccountReport
		err    error
		want   string
	}{
		"logged out":           {Source{Engine: "codex"}, harness.AccountReport{Account: harness.AccountSnapshot{LoggedIn: &loggedOut}}, nil, "run `codex login`"},
		"logged out, own bin":  {Source{Engine: "claude", Bin: "/opt/claude"}, harness.AccountReport{Account: harness.AccountSnapshot{LoggedIn: &loggedOut}}, nil, "run `/opt/claude auth login`"},
		"harness error":        {Source{Engine: "claude"}, harness.AccountReport{}, session.ErrUnsupported, "claude usage: harness operation unsupported"},
		"provider had nothing": {Source{Engine: "claude"}, harness.AccountReport{Quota: harness.QuotaSnapshot{Observation: harness.Observation{Reason: "rate limits unavailable"}}}, nil, "rate limits unavailable"},
	} {
		t.Run(name, func(t *testing.T) {
			snap, err := fromReport(tc.src, tc.report, tc.err)
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("err = %v, want it to mention %q", err, tc.want)
			}
			if tc.err != nil && !errors.Is(err, tc.err) {
				t.Errorf("err = %v, want it to wrap %v", err, tc.err)
			}
			if below, _ := BelowFloor(snap, 99, 99); below {
				t.Error("an unavailable meter paused reviews; it must fail open")
			}
		})
	}
}

// Fetch asks the source's own engine, at its own bin and home; an engine the
// harness cannot read quota from is answered without starting anything.
func TestFetchAsksTheSourcesEngine(t *testing.T) {
	var asked []harness.Provider
	was := inspect
	t.Cleanup(func() { inspect = was })
	inspect = func(_ context.Context, p harness.Provider) (harness.AccountReport, error) {
		asked = append(asked, p)
		return quota(window(harness.QuotaSession, "", "", 1, 300)), nil
	}

	for _, src := range []Source{{Engine: "claude", Bin: "/opt/claude", Home: "/srv/claude"}, {Engine: "codex"}} {
		if snap, err := Fetch(t.Context(), src); err != nil || !snap.OK() {
			t.Errorf("Fetch(%+v) = %+v, %v", src, snap, err)
		}
	}
	for _, src := range []Source{{Engine: "grok"}, {Engine: "something-else"}} {
		if _, err := Fetch(t.Context(), src); err == nil {
			t.Errorf("Fetch(%+v) must fail: no quota to read", src)
		}
	}
	if len(asked) != 2 {
		t.Fatalf("asked %d times, want only the two metered engines: %+v", len(asked), asked)
	}
	if asked[0].Engine != harness.Claude || asked[0].CLI != (harness.CLI{Binary: "/opt/claude", Home: "/srv/claude"}) || asked[1].Engine != harness.Codex {
		t.Errorf("asked %+v", asked)
	}
}

func TestMeteredAsksTheHarness(t *testing.T) {
	got := Metered([]string{"codex", "claude", "grok", "gemini"})
	if strings.Join(got, ",") != "codex,claude" {
		t.Errorf("Metered = %v, want the engines that report quota", got)
	}
}
