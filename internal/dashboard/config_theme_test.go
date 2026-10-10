package dashboard

import (
	"net/http"
	"testing"

	"github.com/shhac/crew-code-review/internal/config"
)

// The page draws whatever set the daemon names, so the response must carry
// the resolved set, not the setting: an unknown value arrives as none rather
// than as a name the page has to second-guess.
func TestHandleConfigNamesTheResolvedTheme(t *testing.T) {
	for configured, want := range map[string]string{
		config.ThemeHalloween: config.ThemeHalloween,
		config.ThemeBonfire:   config.ThemeBonfire,
		config.ThemeChristmas: config.ThemeChristmas,
		config.ThemeAurora:    config.ThemeAurora,
		config.ThemeValentine: config.ThemeValentine,
		config.ThemeEaster:    config.ThemeEaster,
		config.ThemeNone:      config.ThemeNone,
		"xmas":                config.ThemeNone,
	} {
		s := newTestServer(&fakeStore{}, config.Config{Dashboard: config.DashboardSettings{Theme: configured}})
		code, resp := doJSON(t, s.handleConfig, http.MethodGet, "/api/config", "")
		if code != http.StatusOK || resp["theme"] != want {
			t.Errorf("theme %q: code %d, theme = %v, want %q", configured, code, resp["theme"], want)
		}
	}
}
