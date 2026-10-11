package config

import (
	"testing"
	"time"
)

func TestHarvestCalendarAndOverrides(t *testing.T) {
	zone := time.FixedZone("local", 2*60*60)
	for _, theme := range []string{"", ThemeAuto} {
		for _, tc := range []struct {
			at   time.Time
			want string
		}{
			{time.Date(2027, 9, 1, 0, 0, 0, 0, zone), ThemeHarvest},
			{time.Date(2027, 9, 15, 12, 0, 0, 0, zone), ThemeHarvest},
			{time.Date(2027, 9, 30, 23, 59, 0, 0, zone), ThemeHarvest},
		} {
			if got := (Config{Dashboard: DashboardSettings{Theme: theme}}).DashboardTheme(tc.at); got != tc.want {
				t.Fatalf("%q at %v: %q, want %q", theme, tc.at, got, tc.want)
			}
		}
		// Either side of September is some other month's, never the harvest's.
		for _, at := range []time.Time{time.Date(2027, 8, 31, 23, 59, 0, 0, zone), time.Date(2027, 10, 1, 0, 0, 0, 0, zone)} {
			if got := (Config{Dashboard: DashboardSettings{Theme: theme}}).DashboardTheme(at); got == ThemeHarvest {
				t.Fatalf("%q at %v: harvest outside September", theme, at)
			}
		}
	}
	for _, month := range []time.Month{time.January, time.April, time.September} {
		if got := (Config{Dashboard: DashboardSettings{Theme: ThemeHarvest}}).DashboardTheme(time.Date(2026, month, 15, 0, 0, 0, 0, zone)); got != ThemeHarvest {
			t.Fatalf("harvest forced in %v: %q", month, got)
		}
	}
	if got := (Config{Dashboard: DashboardSettings{Theme: ThemeNone}}).DashboardTheme(time.Date(2027, 9, 15, 0, 0, 0, 0, zone)); got != ThemeNone {
		t.Fatalf("none in September: %q", got)
	}
	if !ValidTheme(ThemeHarvest) || len((Config{Dashboard: DashboardSettings{Theme: ThemeHarvest}}).ValidateDashboard()) != 0 {
		t.Fatal("harvest must be accepted")
	}
}
