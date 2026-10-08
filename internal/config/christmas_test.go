package config

import (
	"testing"
	"time"
)

func TestChristmasCalendarAndOverrides(t *testing.T) {
	zone := time.FixedZone("local", 11*60*60)
	for _, theme := range []string{"", ThemeAuto} {
		for _, tc := range []struct {
			at   time.Time
			want string
		}{
			{time.Date(2026, 11, 30, 23, 59, 0, 0, zone), ThemeBonfire},
			{time.Date(2026, 12, 1, 0, 0, 0, 0, zone), ThemeChristmas},
			{time.Date(2026, 12, 31, 23, 59, 0, 0, zone), ThemeChristmas},
			{time.Date(2027, 1, 1, 0, 0, 0, 0, zone), ThemeNone},
		} {
			if got := (Config{Dashboard: DashboardSettings{Theme: theme}}).DashboardTheme(tc.at); got != tc.want {
				t.Fatalf("%q at %v: %q, want %q", theme, tc.at, got, tc.want)
			}
		}
	}
	for _, theme := range []string{ThemeChristmas, ThemeHalloween, ThemeNone, "typo"} {
		for _, month := range []time.Month{time.November, time.December, time.January} {
			cfg := Config{Dashboard: DashboardSettings{Theme: theme}}
			want := theme
			if theme == "typo" {
				want = ThemeNone
			}
			if got := cfg.DashboardTheme(time.Date(2026, month, 15, 0, 0, 0, 0, zone)); got != want {
				t.Fatalf("%q: %q, want %q", theme, got, want)
			}
		}
	}
	if !ValidTheme(ThemeChristmas) || len((Config{Dashboard: DashboardSettings{Theme: ThemeChristmas}}).ValidateDashboard()) != 0 {
		t.Fatal("Christmas must be accepted")
	}
}
