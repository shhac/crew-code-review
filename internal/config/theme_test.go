package config

import (
	"strings"
	"testing"
	"time"
)

// The calendar, a set for every month: what auto shows from the first minute
// of each month to the last.
var calendar = []struct {
	month time.Month
	set   string
}{
	{time.January, ThemeAurora},
	{time.February, ThemeValentine},
	{time.March, ThemeHares},
	{time.April, ThemeEaster},
	{time.May, ThemeBluebells},
	{time.June, ThemeFete},
	{time.July, ThemeWimbledon},
	{time.August, ThemeSeaside},
	{time.September, ThemeHarvest},
	{time.October, ThemeHalloween},
	{time.November, ThemeBonfire},
	{time.December, ThemeChristmas},
}

func themeAt(theme string, at time.Time) string {
	return Config{Dashboard: DashboardSettings{Theme: theme}}.DashboardTheme(at)
}

func TestSeasonalCalendar(t *testing.T) {
	if len(seasonalThemes) != len(calendar) {
		t.Fatalf("seasonalThemes has %d months, the calendar %d", len(seasonalThemes), len(calendar))
	}
	// The month is read in whatever zone the clock is given: the daemon's
	// local time, so each set hands over at the operator's midnight, not
	// UTC's. Ahead of UTC a month's first minute is still the month before
	// there; behind it, the last minute is already the month after.
	zones := []*time.Location{time.FixedZone("AEDT", 11*60*60), time.FixedZone("EST", -5*60*60)}
	seen := map[string]time.Month{}
	for _, c := range calendar {
		if got := seasonalThemes[c.month]; got != c.set {
			t.Errorf("%v is %q, want %q", c.month, got, c.set)
		}
		if !ValidTheme(c.set) || c.set == ThemeAuto || c.set == ThemeNone {
			t.Errorf("%v: %q is not a set", c.month, c.set)
		}
		if p := (Config{Dashboard: DashboardSettings{Theme: c.set}}).ValidateDashboard(); len(p) != 0 {
			t.Errorf("%q: problems = %v, want none", c.set, p)
		}
		if other, ok := seen[c.set]; ok {
			t.Errorf("%q is both %v's and %v's", c.set, other, c.month)
		}
		seen[c.set] = c.month
		for _, zone := range zones {
			// 2028 is a leap year, so February's last minute is on the 29th.
			first := time.Date(2028, c.month, 1, 0, 0, 0, 0, zone)
			last := first.AddDate(0, 1, 0).Add(-time.Minute)
			for _, auto := range []string{"", ThemeAuto} {
				for _, at := range []time.Time{first, first.AddDate(0, 0, 14), last} {
					if got := themeAt(auto, at); got != c.set {
						t.Errorf("%q at %v: %q, want %q", auto, at, got, c.set)
					}
				}
				for _, at := range []time.Time{first.Add(-time.Minute), last.Add(time.Minute)} {
					if got, want := themeAt(auto, at), seasonalThemes[at.Month()]; got != want {
						t.Errorf("%q at %v, beside %v: %q, want %q", auto, at, c.month, got, want)
					}
				}
			}
			mid := first.AddDate(0, 0, 14)
			if got := themeAt(ThemeNone, mid); got != ThemeNone {
				t.Errorf("none in %v: %q", c.month, got)
			}
			for _, named := range calendar {
				if got := themeAt(named.set, mid); got != named.set {
					t.Errorf("%q named in %v: %q", named.set, c.month, got)
				}
			}
		}
	}
}

// Auto shows nothing in a month with no set. Every month has one today, so
// the calendar loses one for the test (restored after it, so the test must
// never run in parallel).
func TestDashboardThemeOffSeason(t *testing.T) {
	saved := seasonalThemes[time.March]
	delete(seasonalThemes, time.March)
	t.Cleanup(func() { seasonalThemes[time.March] = saved })
	at := time.Date(2027, time.March, 15, 0, 0, 0, 0, time.UTC)
	for _, theme := range []string{"", ThemeAuto} {
		if got := themeAt(theme, at); got != ThemeNone {
			t.Errorf("%q with no set for March: %q, want none", theme, got)
		}
	}
	if got := themeAt(ThemeHares, at); got != ThemeHares {
		t.Errorf("hares named with no set for March: %q", got)
	}
}

// An unrecognised value shows nothing, in season or out.
func TestDashboardThemeUnknown(t *testing.T) {
	for _, theme := range []string{"xmas", "Halloween", "typo"} {
		for _, month := range []time.Month{time.October, time.December, time.June} {
			if got := themeAt(theme, time.Date(2026, month, 15, 0, 0, 0, 0, time.UTC)); got != ThemeNone {
				t.Errorf("%q in %v: %q, want none", theme, month, got)
			}
		}
	}
}

func TestValidateDashboard(t *testing.T) {
	for _, ok := range []string{"", ThemeAuto, ThemeNone, ThemeHalloween} {
		if p := (Config{Dashboard: DashboardSettings{Theme: ok}}).ValidateDashboard(); len(p) != 0 {
			t.Errorf("theme %q: problems = %v, want none", ok, p)
		}
	}
	p := (Config{Dashboard: DashboardSettings{Theme: "Halloween"}}).ValidateDashboard()
	if len(p) != 1 || !strings.Contains(p[0], "dashboard.theme") {
		t.Errorf("problems = %v, want one naming dashboard.theme", p)
	}
}
