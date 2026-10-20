package doctor

import (
	"fmt"
	"strings"
	"time"

	"github.com/shhac/crew-code-review/internal/config"
	"github.com/shhac/crew-code-review/internal/discover"
)

// discoveryCheck reports the daemon's last recorded sweep: which watched repos
// discovery is failing on, and whether the record is recent enough to trust.
//
// A repo discovery skips used to be a log line in the daemon's memory and
// nothing else. The symptom was PRs nobody reviewed, the usual cure was a
// restart, and the restart discarded the evidence. Not blocking: reviews of
// everything else still run, which is exactly why nobody noticed.
func discoveryCheck(st discover.Status, ok bool, readErr error, cfg config.Config, now time.Time) Check {
	const name = "discovery"
	if readErr != nil {
		return Check{Name: name, OK: false, Detail: "cannot read the discovery record: " + readErr.Error()}
	}
	if !ok {
		return Check{Name: name, OK: true, Detail: "no sweep recorded yet; `serve` records one after every sweep"}
	}
	age := now.Sub(st.WrittenAt).Truncate(time.Second)
	// Three intervals is two missed sweeps: one late tick is a slow sweep,
	// two is a daemon that is not running or a sweep that is not finishing.
	stale := age > 3*cfg.DiscoverInterval()

	var problems, notes []string
	for _, r := range st.For(cfg.SortedRepos()) {
		switch {
		case r.LastAttempt.IsZero():
			notes = append(notes, r.Repo+": not swept yet")
		case r.Failures > 0:
			problems = append(problems, fmt.Sprintf("%s: %d consecutive failure(s), skipped until %s, last: %s",
				r.Repo, r.Failures, r.BackoffUntil.Local().Format("15:04"), r.LastError))
		case r.Degraded != "":
			notes = append(notes, r.Repo+": "+r.Degraded)
		}
	}

	when := fmt.Sprintf("last sweep recorded %s ago", age)
	if stale {
		when += fmt.Sprintf(" (discovery runs every %s: is `serve` running?)", cfg.DiscoverInterval())
	}
	detail := strings.Join(append(append([]string{when}, problems...), notes...), "; ")
	if len(problems) == 0 && !stale {
		return Check{Name: name, OK: true, Detail: detail}
	}
	return Check{Name: name, OK: false, Detail: detail,
		Hint: "each failure is GitHub's own answer; the dashboard's Config page shows the same record"}
}
