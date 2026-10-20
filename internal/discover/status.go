package discover

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"time"
)

// What discovery last managed for each repo, written where something outside
// the sweep can read it.
//
// A repo in backoff used to be visible only as a line in the daemon's
// in-memory log. When stampedeapp/backend's listing failed hard enough to be
// skipped, nothing said so; the symptom was PRs nobody reviewed, and the
// restart that cleared the backoff also discarded the only evidence of it.
// Written to a file after every sweep, it survives the process, reaches
// `doctor` (another process), and feeds the dashboard's Config page.

// RepoStatus is one watched repo's discovery health.
type RepoStatus struct {
	Repo        string    `json:"repo"`
	LastAttempt time.Time `json:"last_attempt,omitzero"`
	LastSuccess time.Time `json:"last_success,omitzero"`
	Listed      int       `json:"listed"`
	// Degraded is set when the last listing got through, but not at full
	// strength (shrunk pages, cut short). Cleared by the next attempt.
	Degraded     string    `json:"degraded,omitempty"`
	Failures     int       `json:"failures,omitempty"`
	BackoffUntil time.Time `json:"backoff_until,omitzero"`
	// The last failure survives a recovery: "it failed at 11:40 and is fine
	// now" is exactly what a postmortem needs.
	LastError   string    `json:"last_error,omitempty"`
	LastErrorAt time.Time `json:"last_error_at,omitzero"`
}

// Status is the whole file: the sweep that wrote it, and every watched repo.
type Status struct {
	WrittenAt time.Time    `json:"written_at"`
	PID       int          `json:"pid"`
	Repos     []RepoStatus `json:"repos"`
}

// WithStatusPath makes every sweep record its outcome at path. Only the daemon
// sets it: a one-shot `run` beside a running daemon would otherwise overwrite
// the daemon's record with its own.
func (d *Discoverer) WithStatusPath(path string) *Discoverer {
	d.statusPath = path
	return d
}

func (d *Discoverer) recordAttempt(repo string, now time.Time) {
	d.updateHealth(repo, func(h *RepoStatus) {
		h.LastAttempt, h.Degraded = now, ""
	})
}

func (d *Discoverer) recordDegraded(repo, note string) {
	d.updateHealth(repo, func(h *RepoStatus) { h.Degraded = note })
}

func (d *Discoverer) updateHealth(repo string, fn func(*RepoStatus)) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.health == nil {
		d.health = map[string]RepoStatus{}
	}
	h := d.health[repo]
	h.Repo = repo
	fn(&h)
	d.health[repo] = h
}

// Status snapshots the health of repos, in the order given. A repo no sweep
// has reached yet still appears, empty, so a watched repo is never missing
// from the record; one that has left the watch list is dropped.
func (d *Discoverer) Status(repos []string, now time.Time) Status {
	d.mu.Lock()
	defer d.mu.Unlock()
	st := Status{WrittenAt: now, PID: os.Getpid(), Repos: make([]RepoStatus, 0, len(repos))}
	for _, repo := range repos {
		h := d.health[repo]
		h.Repo = repo
		st.Repos = append(st.Repos, h)
	}
	return st
}

// writeStatus records the sweep's outcome. Never fatal: losing the record
// costs a diagnosis, never a review.
func (d *Discoverer) writeStatus(repos []string) {
	if d.statusPath == "" {
		return
	}
	if err := WriteStatus(d.statusPath, d.Status(repos, d.now())); err != nil {
		d.warnf("discover: recording discovery status: %v", err)
	}
}

// WriteStatus replaces the file at path atomically: a reader sees the previous
// sweep's record or this one, never half of each.
func WriteStatus(path string, st Status) error {
	body, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return err
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".discovery-*.json")
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(tmp.Name()) }()
	if _, err := tmp.Write(body); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

// ReadStatus reads the last recorded sweep. ok is false when no sweep has been
// recorded at all, which is a fact to report rather than an error.
func ReadStatus(path string) (st Status, ok bool, err error) {
	body, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return Status{}, false, nil
	}
	if err != nil {
		return Status{}, false, err
	}
	if err := json.Unmarshal(body, &st); err != nil {
		return Status{}, false, fmt.Errorf("parse %s: %w", path, err)
	}
	return st, true, nil
}
