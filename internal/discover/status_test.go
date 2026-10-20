package discover

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/shhac/crew-code-review/internal/config"
)

// The record has to say what the in-memory log said and then lost: which repo
// is being skipped, until when, and why.
func TestSweepRecordsEachReposHealth(t *testing.T) {
	h := newSweepHarness(t, []string{"o/sick", "o/well"})
	h.failing["o/sick"] = true
	path := filepath.Join(t.TempDir(), "state", "discovery.json")
	h.d.WithStatusPath(path)

	if err := h.sweep(t); err != nil {
		t.Fatalf("sweep: %v", err)
	}
	st, ok, err := ReadStatus(path)
	if err != nil || !ok {
		t.Fatalf("ReadStatus = %v, %v; want the sweep recorded", ok, err)
	}
	if len(st.Repos) != 2 {
		t.Fatalf("recorded %d repos, want 2", len(st.Repos))
	}
	sick, well := st.Repos[0], st.Repos[1]
	if sick.Failures != 1 || !sick.BackoffUntil.Equal(h.now.Add(backoffBase)) || !strings.Contains(sick.LastError, "502") {
		t.Errorf("failing repo recorded as %+v, want one failure, its backoff, and the error", sick)
	}
	if !sick.LastSuccess.IsZero() {
		t.Errorf("failing repo has a success at %v", sick.LastSuccess)
	}
	if !well.LastSuccess.Equal(h.now) || well.Failures != 0 {
		t.Errorf("healthy repo recorded as %+v", well)
	}

	// Recovery clears the backoff and keeps the last error: "it failed at
	// 11:40 and is fine now" is the postmortem.
	h.failing["o/sick"] = false
	h.now = h.now.Add(10 * time.Minute)
	if err := h.sweep(t); err != nil {
		t.Fatalf("recovered sweep: %v", err)
	}
	st, _, _ = ReadStatus(path)
	sick = st.Repos[0]
	if sick.Failures != 0 || !sick.BackoffUntil.IsZero() || !sick.LastSuccess.Equal(h.now) {
		t.Errorf("recovered repo recorded as %+v, want no failures, no backoff, a fresh success", sick)
	}
	if sick.LastError == "" {
		t.Error("recovery wiped the last error")
	}
}

// Only watched repos are recorded, and a watched repo no sweep has reached yet
// still appears: a missing row reads as "this repo is not watched".
func TestStatusCoversExactlyTheWatchList(t *testing.T) {
	d := New(staticConfig(config.Config{}), &fakeStore{}, nil)
	d.recordSuccess("o/gone", fixedNow(), 3)
	d.recordSuccess("o/a", fixedNow(), 3)

	st := d.Status([]string{"o/a", "o/new"}, fixedNow())
	if len(st.Repos) != 2 || st.Repos[0].Repo != "o/a" || st.Repos[1].Repo != "o/new" {
		t.Fatalf("status repos = %+v, want exactly [o/a o/new]", st.Repos)
	}
	if !st.Repos[1].LastAttempt.IsZero() {
		t.Error("an unreached repo must carry no attempt")
	}
}

// A listing that got through at reduced strength says so, and the next
// attempt starts clean.
func TestStatusRecordsADegradedListing(t *testing.T) {
	restore := stubRunGHOnce(func(args []string) ([]byte, error) {
		if listArg(args, "n") == "100" {
			return nil, errors.New("gh api graphql: HTTP 502: 502 Bad Gateway")
		}
		return listPage([]int{1}, false, ""), nil
	})
	defer restore()

	cfg := config.Config{Repos: []string{"o/a"}}
	d := New(staticConfig(cfg), &fakeStore{}, nil)
	d.now = fixedNow
	d.prSizes = noSizes
	if _, err := d.Discover(context.Background()); err != nil {
		t.Fatalf("Discover: %v", err)
	}
	if got := d.Status(cfg.Repos, fixedNow()).Repos[0].Degraded; !strings.Contains(got, "pages shrunk to 50") {
		t.Fatalf("degraded = %q, want the shrunk-page note", got)
	}

	d.recordAttempt("o/a", fixedNow())
	if got := d.Status(cfg.Repos, fixedNow()).Repos[0].Degraded; got != "" {
		t.Errorf("a new attempt kept the old note %q", got)
	}
}

func TestReadStatusWithoutARecord(t *testing.T) {
	_, ok, err := ReadStatus(filepath.Join(t.TempDir(), "discovery.json"))
	if ok || err != nil {
		t.Fatalf("ReadStatus on a missing file = %v, %v; want not-ok and no error", ok, err)
	}
}
