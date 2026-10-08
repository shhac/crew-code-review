package config

import (
	"testing"
	"time"
)

func TestBonfireCalendarAndOverrides(t *testing.T) {
	zone := time.FixedZone("local", -5*60*60)
	for _, theme := range []string{"", ThemeAuto} {
		for _, tc := range []struct {
			at   time.Time
			want string
		}{
			{time.Date(2026, 10, 31, 23, 59, 0, 0, zone), ThemeHalloween},
			{time.Date(2026, 11, 1, 0, 0, 0, 0, zone), ThemeBonfire},
			{time.Date(2026, 11, 5, 20, 0, 0, 0, zone), ThemeBonfire},
			{time.Date(2026, 11, 30, 23, 59, 0, 0, zone), ThemeBonfire},
			{time.Date(2026, 12, 1, 0, 0, 0, 0, zone), ThemeChristmas},
		} {
			if got := (Config{Dashboard: DashboardSettings{Theme: theme}}).DashboardTheme(tc.at); got != tc.want {
				t.Fatalf("%q at %v: %q, want %q", theme, tc.at, got, tc.want)
			}
		}
	}
	for _, month := range []time.Month{time.October, time.November, time.December, time.March} {
		if got := (Config{Dashboard: DashboardSettings{Theme: ThemeBonfire}}).DashboardTheme(time.Date(2026, month, 15, 0, 0, 0, 0, zone)); got != ThemeBonfire {
			t.Fatalf("bonfire forced in %v: %q", month, got)
		}
	}
	if !ValidTheme(ThemeBonfire) || len((Config{Dashboard: DashboardSettings{Theme: ThemeBonfire}}).ValidateDashboard()) != 0 {
		t.Fatal("bonfire must be accepted")
	}
}
