package config

import (
	"testing"
	"time"
)

func TestSeasideCalendarAndOverrides(t *testing.T) {
	zone := time.FixedZone("local", 1*60*60)
	for _, theme := range []string{"", ThemeAuto} {
		for _, tc := range []struct {
			at   time.Time
			want string
		}{
			{time.Date(2027, 7, 31, 23, 59, 0, 0, zone), seasonalThemes[time.July]},
			{time.Date(2027, 8, 1, 0, 0, 0, 0, zone), ThemeSeaside},
			{time.Date(2027, 8, 15, 12, 0, 0, 0, zone), ThemeSeaside},
			{time.Date(2027, 8, 31, 23, 59, 0, 0, zone), ThemeSeaside},
			{time.Date(2027, 9, 1, 0, 0, 0, 0, zone), seasonalThemes[time.September]},
		} {
			want := tc.want
			if want == "" {
				want = ThemeNone
			}
			if got := (Config{Dashboard: DashboardSettings{Theme: theme}}).DashboardTheme(tc.at); got != want {
				t.Fatalf("%q at %v: %q, want %q", theme, tc.at, got, want)
			}
		}
	}
	for _, month := range []time.Month{time.January, time.August, time.October} {
		if got := (Config{Dashboard: DashboardSettings{Theme: ThemeSeaside}}).DashboardTheme(time.Date(2026, month, 15, 0, 0, 0, 0, zone)); got != ThemeSeaside {
			t.Fatalf("seaside forced in %v: %q", month, got)
		}
	}
	if got := (Config{Dashboard: DashboardSettings{Theme: ThemeNone}}).DashboardTheme(time.Date(2027, 8, 15, 0, 0, 0, 0, zone)); got != ThemeNone {
		t.Fatalf("none in August: %q", got)
	}
	if !ValidTheme(ThemeSeaside) || len((Config{Dashboard: DashboardSettings{Theme: ThemeSeaside}}).ValidateDashboard()) != 0 {
		t.Fatal("seaside must be accepted")
	}
}
