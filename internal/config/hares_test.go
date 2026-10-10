package config

import (
	"testing"
	"time"
)

func TestHaresCalendarAndOverrides(t *testing.T) {
	zone := time.FixedZone("local", 1*60*60)
	for _, theme := range []string{"", ThemeAuto} {
		for _, tc := range []struct {
			at   time.Time
			want string
		}{
			{time.Date(2027, 2, 28, 23, 59, 0, 0, zone), ThemeValentine},
			{time.Date(2027, 3, 1, 0, 0, 0, 0, zone), ThemeHares},
			{time.Date(2027, 3, 15, 12, 0, 0, 0, zone), ThemeHares},
			{time.Date(2027, 3, 31, 23, 59, 0, 0, zone), ThemeHares},
			{time.Date(2027, 4, 1, 0, 0, 0, 0, zone), ThemeEaster},
		} {
			if got := (Config{Dashboard: DashboardSettings{Theme: theme}}).DashboardTheme(tc.at); got != tc.want {
				t.Fatalf("%q at %v: %q, want %q", theme, tc.at, got, tc.want)
			}
		}
	}
	for _, month := range []time.Month{time.January, time.March, time.September} {
		if got := (Config{Dashboard: DashboardSettings{Theme: ThemeHares}}).DashboardTheme(time.Date(2026, month, 15, 0, 0, 0, 0, zone)); got != ThemeHares {
			t.Fatalf("hares forced in %v: %q", month, got)
		}
	}
	if got := (Config{Dashboard: DashboardSettings{Theme: ThemeNone}}).DashboardTheme(time.Date(2027, 3, 15, 0, 0, 0, 0, zone)); got != ThemeNone {
		t.Fatalf("none in March: %q", got)
	}
	if !ValidTheme(ThemeHares) || len((Config{Dashboard: DashboardSettings{Theme: ThemeHares}}).ValidateDashboard()) != 0 {
		t.Fatal("hares must be accepted")
	}
}
