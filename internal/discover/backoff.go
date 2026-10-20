package discover

import (
	"time"
)

// A repo that GitHub is failing on is skipped outright for a while rather
// than re-attempted every cycle. Separate from the page-size ladder in
// retry.go: the ladder survives one expensive query inside a single call,
// this survives a repo that is simply down, across sweeps.

// Backoff bounds, deliberately not configurable: they are a property of how
// GitHub misbehaves, not of any one deployment. Doubling from 2m caps at 30m,
// so a repo that is genuinely down costs two sweeps an hour rather than twelve,
// and a single transient blip (already absorbed by runGH's retries) expires
// before the next cycle would have run anyway.
const (
	backoffBase = 2 * time.Minute
	backoffMax  = 30 * time.Minute
)

func backoffFor(failures int) time.Duration {
	d := backoffBase
	for i := 1; i < failures; i++ {
		if d >= backoffMax {
			break
		}
		d *= 2
	}
	if d > backoffMax {
		d = backoffMax
	}
	return d
}

// The backoff state is the repo's health record (status.go), not a map of
// its own. It used to be both, kept equal by hand at every call site, and the
// copy the dashboard and doctor read could drift from the one that actually
// decided the skip.

// inBackoff reports whether repo is still inside the window a previous
// failure opened, with the failure count and expiry for the log line.
func (d *Discoverer) inBackoff(repo string, now time.Time) (time.Time, int, bool) {
	d.mu.Lock()
	defer d.mu.Unlock()
	h := d.health[repo]
	if !now.Before(h.BackoffUntil) {
		return time.Time{}, 0, false
	}
	return h.BackoffUntil, h.Failures, true
}

// noteFailure records one failed listing and returns the new consecutive
// failure count and the window it opens.
func (d *Discoverer) noteFailure(repo string, now time.Time, err error) (fails int, wait time.Duration) {
	d.updateHealth(repo, func(h *RepoStatus) {
		h.Failures++
		fails, wait = h.Failures, backoffFor(h.Failures)
		h.BackoffUntil = now.Add(wait)
		h.LastError, h.LastErrorAt = err.Error(), now
	})
	return fails, wait
}

// noteSuccess records a listing that got through, clears any backoff, and
// returns how many failures it forgave, so the caller can log a recovery
// exactly once.
func (d *Discoverer) noteSuccess(repo string, now time.Time, listed int) (forgiven int) {
	d.updateHealth(repo, func(h *RepoStatus) {
		forgiven = h.Failures
		h.LastSuccess, h.Listed = now, listed
		h.Failures, h.BackoffUntil = 0, time.Time{}
	})
	return forgiven
}
