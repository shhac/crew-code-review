package discover

import (
	"context"
	"errors"
	"fmt"
	"os"
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
	d.noteSuccess("o/gone", fixedNow(), 3, "")
	d.noteSuccess("o/a", fixedNow(), 3, "")

	st := d.Status([]string{"o/a", "o/new"}, fixedNow())
	if len(st.Repos) != 2 || st.Repos[0].Repo != "o/a" || st.Repos[1].Repo != "o/new" {
		t.Fatalf("status repos = %+v, want exactly [o/a o/new]", st.Repos)
	}
	if !st.Repos[1].LastAttempt.IsZero() {
		t.Error("an unreached repo must carry no attempt")
	}
}

// A listing that got through at reduced strength says so, and the sweep both
// warns and records it; the next outcome replaces the note.
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
	var warns []string
	d.warnf = func(f string, a ...any) { warns = append(warns, fmt.Sprintf(f, a...)) }
	if _, err := d.Discover(context.Background()); err != nil {
		t.Fatalf("Discover: %v", err)
	}
	if got := d.Status(cfg.Repos, fixedNow()).Repos[0].Degraded; !strings.Contains(got, "pages shrunk to 50") {
		t.Fatalf("degraded = %q, want the shrunk-page note", got)
	}
	if len(warns) != 1 || !strings.Contains(warns[0], "pages shrunk to 50") {
		t.Errorf("warnings = %v, want one degraded line", warns)
	}

	d.noteFailure("o/a", fixedNow(), errors.New("boom"))
	if got := d.Status(cfg.Repos, fixedNow()).Repos[0].Degraded; got != "" {
		t.Errorf("a failed attempt kept the old note %q", got)
	}
}

func TestReadStatusWithoutARecord(t *testing.T) {
	_, ok, err := ReadStatus(filepath.Join(t.TempDir(), "discovery.json"))
	if ok || err != nil {
		t.Fatalf("ReadStatus on a missing file = %v, %v; want not-ok and no error", ok, err)
	}
}

// doctor and the dashboard are separate readers; the record is not secret,
// so it carries the same mode as the state dir's other atomic write.
func TestWriteStatusIsWorldReadable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "discovery.json")
	if err := WriteStatus(path, Status{}); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if got := info.Mode().Perm(); got != 0o644 {
		t.Errorf("mode = %o, want 644", got)
	}
}

// A sweep that stops on a store error is still recorded: the repos it reached
// before stopping have news, and the record is how anybody finds out.
func TestStatusIsWrittenWhenASweepStopsEarly(t *testing.T) {
	fs := &fakeStore{enqueueErr: errors.New("duckdb: database is locked")}
	cfg := config.Config{Repos: []string{"o/a"}}
	cfg.Candidates.RequireReviewRequest = config.Bool(false)
	d := newDiscoverer(fs)
	d.cfg = staticConfig(cfg)
	d.listPRs = func(context.Context, string) ([]ghPR, string, error) { return []ghPR{readyPR()}, "", nil }
	path := filepath.Join(t.TempDir(), "discovery.json")
	d.WithStatusPath(path)

	if _, err := d.Discover(context.Background()); err == nil {
		t.Fatal("Discover = nil, want the store error")
	}
	st, ok, err := ReadStatus(path)
	if err != nil || !ok {
		t.Fatalf("ReadStatus = %v, %v; want the early-stopped sweep recorded", ok, err)
	}
	if got := st.Repos[0]; got.LastSuccess.IsZero() || got.Listed != 1 {
		t.Errorf("record = %+v, want the listing that happened", got)
	}
}

// Losing the record costs a diagnosis, never a review.
func TestAnUnwritableRecordDoesNotFailTheSweep(t *testing.T) {
	h := newSweepHarness(t, []string{"o/a"})
	blocker := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(blocker, nil, 0o644); err != nil {
		t.Fatal(err)
	}
	h.d.WithStatusPath(filepath.Join(blocker, "discovery.json"))

	if err := h.sweep(t); err != nil {
		t.Fatalf("sweep = %v, want success without its record", err)
	}
	if len(h.warns) != 1 || !strings.Contains(h.warns[0], "recording discovery status") {
		t.Errorf("warnings = %v, want one about the record", h.warns)
	}
}

// Shutdown cutting a listing off says nothing about the repo.
func TestShutdownIsNotARepoFailure(t *testing.T) {
	h := newSweepHarness(t, []string{"o/a", "o/b"})
	ctx, cancel := context.WithCancel(context.Background())
	h.d.listPRs = func(context.Context, string) ([]ghPR, string, error) {
		cancel()
		return nil, "", context.Canceled
	}

	if _, err := h.d.Discover(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("Discover = %v, want context.Canceled", err)
	}
	for _, r := range h.d.Status([]string{"o/a", "o/b"}, h.now).Repos {
		if r.Failures != 0 || r.LastError != "" {
			t.Errorf("%s recorded as failing after a shutdown: %+v", r.Repo, r)
		}
	}
}
