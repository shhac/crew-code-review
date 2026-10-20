package dashboard

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/shhac/crew-code-review/internal/config"
	"github.com/shhac/crew-code-review/internal/discover"
)

// The Config page shows discovery's record against the watch list as it is
// NOW: a repo added since the last sweep reads as not yet swept, and one
// removed since is gone, rather than either side of a stale file leaking in.
func TestConfigCarriesDiscoveryStatus(t *testing.T) {
	path := filepath.Join(t.TempDir(), "discovery.json")
	when := time.Date(2026, 10, 20, 11, 28, 0, 0, time.UTC)
	if err := discover.WriteStatus(path, discover.Status{
		WrittenAt: when,
		PID:       os.Getpid(),
		Repos: []discover.RepoStatus{
			{Repo: "o/a", LastSuccess: when, Listed: 300},
			{Repo: "o/gone", LastSuccess: when},
		},
	}); err != nil {
		t.Fatal(err)
	}

	s := newTestServer(&fakeStore{}, config.Config{Repos: []string{"o/new", "o/a"}})
	s.discoveryStatus = path
	code, resp := doJSON(t, s.handleConfig, http.MethodGet, "/api/config", "")
	if code != http.StatusOK {
		t.Fatalf("code = %d", code)
	}
	st, ok := resp["discovery_status"].(map[string]any)
	if !ok {
		t.Fatalf("discovery_status missing: %v", resp)
	}
	if st["current"] != true {
		t.Errorf("a record this process wrote must read as current")
	}
	repos := st["repos"].([]any)
	if len(repos) != 2 {
		t.Fatalf("repos = %v, want o/a and o/new only", repos)
	}
	a, fresh := repos[0].(map[string]any), repos[1].(map[string]any)
	if a["repo"] != "o/a" || a["listed"] != float64(300) {
		t.Errorf("first repo = %v, want o/a with its listing", a)
	}
	if fresh["repo"] != "o/new" || fresh["last_attempt"] != nil {
		t.Errorf("second repo = %v, want o/new with no attempt", fresh)
	}
}

func TestConfigWithoutDiscoveryRecord(t *testing.T) {
	s := newTestServer(&fakeStore{}, config.Config{Repos: []string{"o/a"}})
	s.discoveryStatus = filepath.Join(t.TempDir(), "discovery.json")
	_, resp := doJSON(t, s.handleConfig, http.MethodGet, "/api/config", "")
	if _, present := resp["discovery_status"]; present {
		t.Errorf("no recorded sweep must omit discovery_status, got %v", resp["discovery_status"])
	}
}
