package doctor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/shhac/crew-code-review/internal/config"
	harness "github.com/shhac/lib-agent-harness"
)

// claudeAuthStatus is what `claude auth status --json` reports: the one
// structured login probe Claude Code offers. The harness's account read
// covers the logged-in case; this answers the one it cannot (see
// loginFallbacks).
type claudeAuthStatus struct {
	LoggedIn         bool   `json:"loggedIn"`
	AuthMethod       string `json:"authMethod"`
	SubscriptionType string `json:"subscriptionType"`
}

// errClaudeAuthUnreadable means the probe ran but its output did not parse,
// which is a different diagnosis from the probe failing to run at all.
var errClaudeAuthUnreadable = errors.New("claude auth status was not readable JSON")

// readClaudeAuthStatus runs the local auth probe. The CLI exits 0 while
// logged out and reports it in the payload, so callers must check LoggedIn
// rather than trusting the exit code. A configured home is the login it
// reads, exactly as for a review.
func readClaudeAuthStatus(ctx context.Context, provider harness.Provider) (claudeAuthStatus, error) {
	ctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, config.DefaultBin(string(harness.Claude), provider.CLI.Binary), "auth", "status", "--json")
	if home := provider.CLI.Home; home != "" {
		cmd.Env = append(os.Environ(), "CLAUDE_CONFIG_DIR="+home)
	}
	out, err := cmd.Output()
	if err != nil {
		return claudeAuthStatus{}, err
	}
	var status claudeAuthStatus
	if err := json.Unmarshal(out, &status); err != nil {
		return claudeAuthStatus{}, errClaudeAuthUnreadable
	}
	return status, nil
}

// claudeAuthCheck reads the structured status rather than the exit code:
// `claude auth status` exits 0 while logged out and reports it in the JSON.
func claudeAuthCheck(ctx context.Context, provider harness.Provider) Check {
	const name = "engine:claude-auth"
	hint := config.LoginHint(string(harness.Claude), provider.CLI.Binary)
	bin := config.DefaultBin(string(harness.Claude), provider.CLI.Binary)
	if _, err := exec.LookPath(bin); err != nil {
		return Check{Name: name, Blocking: true, Detail: fmt.Sprintf("%q not on PATH", bin), Hint: hint}
	}
	status, err := readClaudeAuthStatus(ctx, provider)
	if err != nil {
		detail := "auth status failed"
		if errors.Is(err, errClaudeAuthUnreadable) {
			detail = "auth status was not readable JSON"
		}
		return Check{Name: name, Blocking: true, Detail: detail, Hint: hint}
	}
	if !status.LoggedIn {
		return Check{Name: name, Blocking: true, Detail: "not logged in", Hint: hint}
	}
	return Check{Name: name, OK: true, Blocking: true,
		Detail: strings.TrimSpace(fmt.Sprintf("%s %s", status.AuthMethod, status.SubscriptionType))}
}
