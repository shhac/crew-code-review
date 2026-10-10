package config

import (
	"testing"
	"time"
)

func TestAuroraCalendarAndOverrides(t *testing.T) {
	zone := time.FixedZone("local", -5*60*60)
	for _, theme := range []string{"", ThemeAuto} {
		for _, tc := range []struct {
			at   time.Time
			want string
		}{
			{time.Date(2026, 12, 31, 23, 59, 0, 0, zone), ThemeChristmas},
			{time.Date(2027, 1, 1, 0, 0, 0, 0, zone), ThemeAurora},
			{time.Date(2027, 1, 15, 22, 0, 0, 0, zone), ThemeAurora},
			{time.Date(2027, 1, 31, 23, 59, 0, 0, zone), ThemeAurora},
			{time.Date(2027, 2, 1, 0, 0, 0, 0, zone), ThemeValentine},
		} {
			if got := (Config{Dashboard: DashboardSettings{Theme: theme}}).DashboardTheme(tc.at); got != tc.want {
				t.Fatalf("%q at %v: %q, want %q", theme, tc.at, got, tc.want)
			}
		}
	}
	for _, month := range []time.Month{time.January, time.June, time.December} {
		if got := (Config{Dashboard: DashboardSettings{Theme: ThemeAurora}}).DashboardTheme(time.Date(2026, month, 15, 0, 0, 0, 0, zone)); got != ThemeAurora {
			t.Fatalf("aurora forced in %v: %q", month, got)
		}
	}
	if !ValidTheme(ThemeAurora) || len((Config{Dashboard: DashboardSettings{Theme: ThemeAurora}}).ValidateDashboard()) != 0 {
		t.Fatal("aurora must be accepted")
	}
}
