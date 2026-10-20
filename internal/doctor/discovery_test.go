package doctor

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/shhac/crew-code-review/internal/config"
	"github.com/shhac/crew-code-review/internal/discover"
)

func discoveryCfg() config.Config {
	cfg := config.Config{Repos: []string{"o/sick", "o/well", "o/new"}}
	cfg.Discovery.Interval = "5m"
	return cfg
}

var sweptAt = time.Date(2026, 10, 20, 11, 0, 0, 0, time.UTC)

func TestDiscoveryCheckNamesAFailingRepo(t *testing.T) {
	st := discover.Status{WrittenAt: sweptAt, Repos: []discover.RepoStatus{
		{Repo: "o/sick", LastAttempt: sweptAt, Failures: 3, BackoffUntil: sweptAt.Add(8 * time.Minute), LastError: "HTTP 502: 502 Bad Gateway"},
		{Repo: "o/well", LastAttempt: sweptAt, LastSuccess: sweptAt, Listed: 40},
	}}
	c := discoveryCheck(st, true, nil, discoveryCfg(), sweptAt.Add(time.Minute))
	if c.OK || c.Blocking {
		t.Fatalf("check = %+v, want a non-blocking failure", c)
	}
	for _, want := range []string{"o/sick: 3 consecutive failure(s)", "HTTP 502", "o/new: not swept yet"} {
		if !strings.Contains(c.Detail, want) {
			t.Errorf("detail %q missing %q", c.Detail, want)
		}
	}
	if strings.Contains(c.Detail, "o/well") {
		t.Errorf("a healthy repo is not news: %q", c.Detail)
	}
}

func TestDiscoveryCheckPassesAHealthyRecord(t *testing.T) {
	st := discover.Status{WrittenAt: sweptAt, Repos: []discover.RepoStatus{
		{Repo: "o/sick", LastAttempt: sweptAt, LastSuccess: sweptAt, Degraded: "pages shrunk to 50"},
		{Repo: "o/well", LastAttempt: sweptAt, LastSuccess: sweptAt},
		{Repo: "o/new", LastAttempt: sweptAt, LastSuccess: sweptAt},
	}}
	c := discoveryCheck(st, true, nil, discoveryCfg(), sweptAt.Add(time.Minute))
	if !c.OK {
		t.Fatalf("check = %+v, want OK", c)
	}
	// A degraded listing still found PRs: worth saying, not worth failing.
	if !strings.Contains(c.Detail, "pages shrunk to 50") {
		t.Errorf("detail %q should carry the degraded note", c.Detail)
	}
}

// Two missed sweeps means the record can no longer speak for now.
func TestDiscoveryCheckFlagsAStaleRecord(t *testing.T) {
	st := discover.Status{WrittenAt: sweptAt}
	c := discoveryCheck(st, true, nil, discoveryCfg(), sweptAt.Add(16*time.Minute))
	if c.OK || !strings.Contains(c.Detail, "is `serve` running?") {
		t.Fatalf("check = %+v, want a stale-record failure", c)
	}
	if c := discoveryCheck(st, true, nil, discoveryCfg(), sweptAt.Add(14*time.Minute)); strings.Contains(c.Detail, "serve") {
		t.Errorf("under three intervals is not stale: %q", c.Detail)
	}
}

func TestDiscoveryCheckWithoutARecord(t *testing.T) {
	if c := discoveryCheck(discover.Status{}, false, nil, discoveryCfg(), sweptAt); !c.OK {
		t.Errorf("no record yet = %+v, want OK: there is nothing wrong to report", c)
	}
	if c := discoveryCheck(discover.Status{}, false, errors.New("parse: bad json"), discoveryCfg(), sweptAt); c.OK {
		t.Errorf("unreadable record = %+v, want a failure", c)
	}
}
