package config

import (
	"testing"
	"time"
)

func TestValentineCalendarAndOverrides(t *testing.T) {
	zone := time.FixedZone("local", -5*60*60)
	for _, theme := range []string{"", ThemeAuto} {
		for _, tc := range []struct {
			at   time.Time
			want string
		}{
			{time.Date(2027, 1, 31, 23, 59, 0, 0, zone), ThemeAurora},
			{time.Date(2027, 2, 1, 0, 0, 0, 0, zone), ThemeValentine},
			{time.Date(2027, 2, 14, 12, 0, 0, 0, zone), ThemeValentine},
			{time.Date(2027, 2, 28, 23, 59, 0, 0, zone), ThemeValentine},
			// A leap year's last day of February is still February.
			{time.Date(2028, 2, 29, 23, 59, 0, 0, zone), ThemeValentine},
			{time.Date(2027, 3, 1, 0, 0, 0, 0, zone), ThemeHares},
		} {
			if got := (Config{Dashboard: DashboardSettings{Theme: theme}}).DashboardTheme(tc.at); got != tc.want {
				t.Fatalf("%q at %v: %q, want %q", theme, tc.at, got, tc.want)
			}
		}
	}
	for _, month := range []time.Month{time.February, time.July, time.December} {
		if got := (Config{Dashboard: DashboardSettings{Theme: ThemeValentine}}).DashboardTheme(time.Date(2026, month, 15, 0, 0, 0, 0, zone)); got != ThemeValentine {
			t.Fatalf("valentine forced in %v: %q", month, got)
		}
	}
	if got := (Config{Dashboard: DashboardSettings{Theme: ThemeNone}}).DashboardTheme(time.Date(2027, 2, 14, 0, 0, 0, 0, zone)); got != ThemeNone {
		t.Fatalf("none in February: %q", got)
	}
	if !ValidTheme(ThemeValentine) || len((Config{Dashboard: DashboardSettings{Theme: ThemeValentine}}).ValidateDashboard()) != 0 {
		t.Fatal("valentine must be accepted")
	}
}
