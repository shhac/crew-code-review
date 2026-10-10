package config

import (
	"testing"
	"time"
)

func TestWimbledonCalendarAndOverrides(t *testing.T) {
	zone := time.FixedZone("local", 2*60*60)
	for _, theme := range []string{"", ThemeAuto} {
		for _, tc := range []struct {
			at   time.Time
			want string
		}{
			{time.Date(2027, 7, 1, 0, 0, 0, 0, zone), ThemeWimbledon},
			{time.Date(2027, 7, 15, 12, 0, 0, 0, zone), ThemeWimbledon},
			{time.Date(2027, 7, 31, 23, 59, 0, 0, zone), ThemeWimbledon},
		} {
			if got := (Config{Dashboard: DashboardSettings{Theme: theme}}).DashboardTheme(tc.at); got != tc.want {
				t.Fatalf("%q at %v: %q, want %q", theme, tc.at, got, tc.want)
			}
		}
		// Either side of July is some other month's, never summer tennis's.
		for _, at := range []time.Time{time.Date(2027, 6, 30, 23, 59, 0, 0, zone), time.Date(2027, 8, 1, 0, 0, 0, 0, zone)} {
			if got := (Config{Dashboard: DashboardSettings{Theme: theme}}).DashboardTheme(at); got == ThemeWimbledon {
				t.Fatalf("%q at %v: wimbledon outside July", theme, at)
			}
		}
	}
	for _, month := range []time.Month{time.January, time.July, time.October} {
		if got := (Config{Dashboard: DashboardSettings{Theme: ThemeWimbledon}}).DashboardTheme(time.Date(2026, month, 15, 0, 0, 0, 0, zone)); got != ThemeWimbledon {
			t.Fatalf("wimbledon forced in %v: %q", month, got)
		}
	}
	if got := (Config{Dashboard: DashboardSettings{Theme: ThemeNone}}).DashboardTheme(time.Date(2027, 7, 15, 0, 0, 0, 0, zone)); got != ThemeNone {
		t.Fatalf("none in July: %q", got)
	}
	if !ValidTheme(ThemeWimbledon) || len((Config{Dashboard: DashboardSettings{Theme: ThemeWimbledon}}).ValidateDashboard()) != 0 {
		t.Fatal("wimbledon must be accepted")
	}
}
