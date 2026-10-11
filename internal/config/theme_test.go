package config

import (
	"strings"
	"testing"
	"time"
)

func TestDashboardTheme(t *testing.T) {
	october := time.Date(2026, time.October, 2, 12, 0, 0, 0, time.UTC)
	september := time.Date(2026, time.September, 1, 0, 0, 0, 0, time.UTC)
	// The month is read in whatever zone the clock is given: the daemon's
	// local time, so Halloween hands over to Bonfire Night at the operator's
	// midnight, not UTC's.
	sydney := time.FixedZone("AEDT", 11*60*60)
	lastMinute := time.Date(2026, time.October, 31, 23, 59, 0, 0, sydney)
	firstMinute := time.Date(2026, time.November, 1, 0, 0, 0, 0, sydney)
	for name, tc := range map[string]struct {
		theme string
		now   time.Time
		want  string
	}{
		"unset is auto, in season": {"", october, ThemeHalloween},
		"auto in season":           {ThemeAuto, october, ThemeHalloween},
		"none beats the calendar":  {ThemeNone, october, ThemeNone},
		"named set out of season":  {ThemeHalloween, september, ThemeHalloween},
		"unknown shows nothing":    {"xmas", october, ThemeNone},
		"last minute of october":   {ThemeAuto, lastMinute, ThemeHalloween},
		"first minute of november": {ThemeAuto, firstMinute, ThemeBonfire},
	} {
		t.Run(name, func(t *testing.T) {
			cfg := Config{Dashboard: DashboardSettings{Theme: tc.theme}}
			if got := cfg.DashboardTheme(tc.now); got != tc.want {
				t.Errorf("DashboardTheme(%s) = %q, want %q", tc.now.Month(), got, tc.want)
			}
		})
	}
}

// Out of season, auto shows nothing. Which month is out of season changes
// as each month's set is switched on, so the test finds one; once every
// month has its set there is none left to check.
func TestDashboardThemeOffSeason(t *testing.T) {
	for month := time.January; month <= time.December; month++ {
		if _, ok := seasonalThemes[month]; ok {
			continue
		}
		at := time.Date(2026, month, 1, 0, 0, 0, 0, time.UTC)
		for _, theme := range []string{"", ThemeAuto} {
			if got := (Config{Dashboard: DashboardSettings{Theme: theme}}).DashboardTheme(at); got != ThemeNone {
				t.Errorf("%q in %v: %q, want none", theme, month, got)
			}
		}
		return
	}
	t.Skip("every month has its set")
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
