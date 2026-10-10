package config

import (
	"testing"
	"time"
)

func TestFeteCalendarAndOverrides(t *testing.T) {
	zone := time.FixedZone("local", 2*60*60)
	for _, theme := range []string{"", ThemeAuto} {
		for _, tc := range []struct {
			at   time.Time
			want string
		}{
			{time.Date(2027, 6, 1, 0, 0, 0, 0, zone), ThemeFete},
			{time.Date(2027, 6, 15, 12, 0, 0, 0, zone), ThemeFete},
			{time.Date(2027, 6, 30, 23, 59, 0, 0, zone), ThemeFete},
		} {
			if got := (Config{Dashboard: DashboardSettings{Theme: theme}}).DashboardTheme(tc.at); got != tc.want {
				t.Fatalf("%q at %v: %q, want %q", theme, tc.at, got, tc.want)
			}
		}
		// Either side of June is some other month's, never the fete's.
		for _, at := range []time.Time{time.Date(2027, 5, 31, 23, 59, 0, 0, zone), time.Date(2027, 7, 1, 0, 0, 0, 0, zone)} {
			if got := (Config{Dashboard: DashboardSettings{Theme: theme}}).DashboardTheme(at); got == ThemeFete {
				t.Fatalf("%q at %v: fete outside June", theme, at)
			}
		}
	}
	for _, month := range []time.Month{time.January, time.June, time.October} {
		if got := (Config{Dashboard: DashboardSettings{Theme: ThemeFete}}).DashboardTheme(time.Date(2026, month, 15, 0, 0, 0, 0, zone)); got != ThemeFete {
			t.Fatalf("fete forced in %v: %q", month, got)
		}
	}
	if got := (Config{Dashboard: DashboardSettings{Theme: ThemeNone}}).DashboardTheme(time.Date(2027, 6, 15, 0, 0, 0, 0, zone)); got != ThemeNone {
		t.Fatalf("none in June: %q", got)
	}
	if !ValidTheme(ThemeFete) || len((Config{Dashboard: DashboardSettings{Theme: ThemeFete}}).ValidateDashboard()) != 0 {
		t.Fatal("fete must be accepted")
	}
}
