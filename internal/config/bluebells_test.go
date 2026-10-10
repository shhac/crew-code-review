package config

import (
	"testing"
	"time"
)

func TestBluebellsCalendarAndOverrides(t *testing.T) {
	zone := time.FixedZone("local", 1*60*60)
	for _, theme := range []string{"", ThemeAuto} {
		for _, tc := range []struct {
			at   time.Time
			want string
		}{
			{time.Date(2027, 4, 30, 23, 59, 0, 0, zone), ThemeEaster},
			{time.Date(2027, 5, 1, 0, 0, 0, 0, zone), ThemeBluebells},
			{time.Date(2027, 5, 15, 12, 0, 0, 0, zone), ThemeBluebells},
			{time.Date(2027, 5, 31, 23, 59, 0, 0, zone), ThemeBluebells},
			{time.Date(2027, 6, 1, 0, 0, 0, 0, zone), ThemeFete},
		} {
			if got := (Config{Dashboard: DashboardSettings{Theme: theme}}).DashboardTheme(tc.at); got != tc.want {
				t.Fatalf("%q at %v: %q, want %q", theme, tc.at, got, tc.want)
			}
		}
	}
	for _, month := range []time.Month{time.January, time.May, time.September} {
		if got := (Config{Dashboard: DashboardSettings{Theme: ThemeBluebells}}).DashboardTheme(time.Date(2026, month, 15, 0, 0, 0, 0, zone)); got != ThemeBluebells {
			t.Fatalf("bluebells forced in %v: %q", month, got)
		}
	}
	if got := (Config{Dashboard: DashboardSettings{Theme: ThemeNone}}).DashboardTheme(time.Date(2027, 5, 15, 0, 0, 0, 0, zone)); got != ThemeNone {
		t.Fatalf("none in May: %q", got)
	}
	if !ValidTheme(ThemeBluebells) || len((Config{Dashboard: DashboardSettings{Theme: ThemeBluebells}}).ValidateDashboard()) != 0 {
		t.Fatal("bluebells must be accepted")
	}
}
