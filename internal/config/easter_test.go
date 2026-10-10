package config

import (
	"testing"
	"time"
)

func TestEasterCalendarAndOverrides(t *testing.T) {
	zone := time.FixedZone("local", 2*60*60)
	for _, theme := range []string{"", ThemeAuto} {
		for _, tc := range []struct {
			at   time.Time
			want string
		}{
			{time.Date(2027, 4, 1, 0, 0, 0, 0, zone), ThemeEaster},
			{time.Date(2027, 4, 15, 12, 0, 0, 0, zone), ThemeEaster},
			{time.Date(2027, 4, 30, 23, 59, 0, 0, zone), ThemeEaster},
		} {
			if got := (Config{Dashboard: DashboardSettings{Theme: theme}}).DashboardTheme(tc.at); got != tc.want {
				t.Fatalf("%q at %v: %q, want %q", theme, tc.at, got, tc.want)
			}
		}
		// Either side of April is some other month's, never Easter's.
		for _, at := range []time.Time{time.Date(2027, 3, 31, 23, 59, 0, 0, zone), time.Date(2027, 5, 1, 0, 0, 0, 0, zone)} {
			if got := (Config{Dashboard: DashboardSettings{Theme: theme}}).DashboardTheme(at); got == ThemeEaster {
				t.Fatalf("%q at %v: easter outside April", theme, at)
			}
		}
	}
	for _, month := range []time.Month{time.January, time.April, time.October} {
		if got := (Config{Dashboard: DashboardSettings{Theme: ThemeEaster}}).DashboardTheme(time.Date(2026, month, 15, 0, 0, 0, 0, zone)); got != ThemeEaster {
			t.Fatalf("easter forced in %v: %q", month, got)
		}
	}
	if got := (Config{Dashboard: DashboardSettings{Theme: ThemeNone}}).DashboardTheme(time.Date(2027, 4, 15, 0, 0, 0, 0, zone)); got != ThemeNone {
		t.Fatalf("none in April: %q", got)
	}
	if !ValidTheme(ThemeEaster) || len((Config{Dashboard: DashboardSettings{Theme: ThemeEaster}}).ValidateDashboard()) != 0 {
		t.Fatal("easter must be accepted")
	}
}
