package cli

import (
	"bytes"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/spf13/cobra"

	"github.com/shhac/crew-code-review/internal/config"
)

// The cards are embedded files now, so a renamed or emptied file would still
// compile and print nothing. Every usage command in the tree must say
// something, and every group the root card points at must have one.
func TestEveryUsageCardPrints(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	root := newRootCmd("test")
	printed := map[string]bool{}
	var walk func(*cobra.Command)
	walk = func(c *cobra.Command) {
		for _, child := range c.Commands() {
			if child.Name() != "usage" {
				walk(child)
				continue
			}
			var buf bytes.Buffer
			child.SetOut(&buf)
			if err := child.RunE(child, nil); err != nil {
				t.Errorf("%s: %v", child.CommandPath(), err)
			}
			group := strings.TrimSpace(strings.TrimPrefix(c.CommandPath(), root.Name()))
			if strings.TrimSpace(buf.String()) == "" {
				t.Errorf("%q usage printed nothing", group)
			}
			printed[group] = true
		}
	}
	walk(root)

	for _, group := range []string{"", "queue", "repos", "authors", "score", "prompts", "prompts rules", "config"} {
		if !printed[group] {
			t.Errorf("%q has no usage card", group)
		}
	}
}

// The config card is hand-written, so a new theme can land in config.Themes
// and the calendar without the card hearing of it (it once named only
// Halloween and Christmas). It must list every value in order, and say which
// set auto shows in each month that has one.
func TestConfigUsageNamesEveryTheme(t *testing.T) {
	_, rest, ok := strings.Cut(configUsageText, "  dashboard.theme ")
	if !ok {
		t.Fatal("config usage has no dashboard.theme line")
	}
	entry, _, _ := strings.Cut(rest, "  store.path ")
	entry = strings.Join(strings.Fields(entry), " ")
	options, auto, ok := strings.Cut(entry, " (auto: ")
	if !ok {
		t.Fatalf("dashboard.theme entry %q does not explain auto", entry)
	}
	listed := strings.Split(strings.ReplaceAll(options, " ", ""), "|")
	if !slices.Equal(listed, config.Themes) {
		t.Errorf("dashboard.theme lists %v, want config.Themes %v", listed, config.Themes)
	}
	for month := time.January; month <= time.December; month++ {
		theme := config.Config{}.DashboardTheme(time.Date(2026, month, 15, 12, 0, 0, 0, time.UTC))
		if theme == config.ThemeNone {
			continue
		}
		if want := theme + " " + month.String()[:3]; !strings.Contains(auto, want) {
			t.Errorf("auto explanation %q does not say %q", auto, want)
		}
	}
}
