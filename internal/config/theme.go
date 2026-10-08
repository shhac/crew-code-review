package config

import (
	"fmt"
	"slices"
	"strings"
	"time"
)

// Dashboard themes are decoration sets the web UI layers over its pages. They
// are cosmetic only: nothing about the queue or a review reads them.
const (
	ThemeAuto      = "auto" // the default: whichever set is in season, if any
	ThemeNone      = "none"
	ThemeHalloween = "halloween"
	ThemeBonfire   = "bonfire"
	ThemeChristmas = "christmas"
)

// Themes are the valid values of dashboard.theme.
var Themes = []string{ThemeAuto, ThemeNone, ThemeHalloween, ThemeBonfire, ThemeChristmas}

// seasonalThemes is what auto picks, by month. A set lives here once it
// should switch itself on for its season; one that should only ever be
// chosen by hand belongs in Themes alone.
var seasonalThemes = map[time.Month]string{
	time.October:  ThemeHalloween,
	time.November: ThemeBonfire,
	time.December: ThemeChristmas,
}

// ValidTheme reports whether s names a dashboard theme.
func ValidTheme(s string) bool { return slices.Contains(Themes, s) }

// DashboardTheme is the decoration set to show at now: auto resolved against
// the calendar, a named set as named.
//
// An unrecognised value shows nothing. Scoring reads a typo as its most
// useful mode because silently losing points is the failure nobody notices;
// a misspelt theme costs a missing pumpkin, which is not worth guessing for.
// ValidateDashboard reports it through doctor instead.
func (c Config) DashboardTheme(now time.Time) string {
	theme := c.Dashboard.Theme
	if theme == "" || theme == ThemeAuto {
		if seasonal, ok := seasonalThemes[now.Month()]; ok {
			return seasonal
		}
		return ThemeNone
	}
	if !ValidTheme(theme) {
		return ThemeNone
	}
	return theme
}

// ValidateDashboard reports dashboard settings that will not be read as
// written. `config set` refuses these already; this catches a hand edit.
func (c Config) ValidateDashboard() []string {
	if c.Dashboard.Theme == "" || ValidTheme(c.Dashboard.Theme) {
		return nil
	}
	return []string{fmt.Sprintf("dashboard.theme is %q; valid: %s (showing %q meanwhile)",
		c.Dashboard.Theme, strings.Join(Themes, ", "), ThemeNone)}
}
