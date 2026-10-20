package discover

import (
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

// Everything this package does to survive a flaky or overloaded gh call.
// Two policies over the same primitives: ask again for the same thing, or
// -- when the thing itself is what GitHub choked on -- ask for less.

// ghAttempts is how many times runGH will try a call whose failure looks
// transient, and ghRetryDelay the base wait between those tries (linear:
// 1x then 2x). Both are vars so tests can drive the retry path without
// sleeping.
var (
	ghAttempts    = 3
	ghRetryDelay  = 1500 * time.Millisecond
	transientHTTP = regexp.MustCompile(`HTTP 5\d\d`)
)

// transient reports whether a gh failure is worth trying again. GitHub's
// GraphQL endpoint answers an expensive query with a 502 often enough that
// treating one as fatal costs a repo its whole discovery cycle, and the same
// query succeeds on the next attempt. Anything else (404, bad auth, a malformed
// query) will fail identically however many times we ask, so it returns at once.
func transient(msg string) bool {
	if transientHTTP.MatchString(msg) {
		return true
	}
	// "Something went wrong while executing your query" is GitHub's other
	// way of saying a GraphQL query ran out of time, and a timed-out call of
	// ours is the same failure seen from this side.
	for _, s := range []string{"Bad Gateway", "Service Unavailable", "Gateway Timeout", "connection reset by peer", "unexpected EOF", "TLS handshake timeout", "Something went wrong while executing your query", "timed out after"} {
		if strings.Contains(msg, s) {
			return true
		}
	}
	return false
}

// runGH executes the gh CLI and returns stdout, surfacing stderr on failure.
// Transient failures are retried; see transient for what counts.
func runGH(ctx context.Context, args ...string) ([]byte, error) {
	var lastErr error
	for attempt := 1; attempt <= ghAttempts; attempt++ {
		if attempt > 1 {
			if err := sleepOrCancel(ctx, time.Duration(attempt-1)*ghRetryDelay); err != nil {
				return nil, err
			}
		}
		out, err := runGHOnce(ctx, args...)
		if err == nil {
			return out, nil
		}
		lastErr = err
		if !transient(err.Error()) {
			return nil, err
		}
	}
	return nil, lastErr
}

// sleepOrCancel waits out a retry delay, or gives up early if the caller has
// already stopped caring. Both of this package's retry shapes need it -- the
// same-request retry here and the page-size ladder in list.go -- and a
// sweep that is out of budget should not spend its last seconds asleep.
func sleepOrCancel(ctx context.Context, d time.Duration) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(d):
		return nil
	}
}

// ghCallTimeout bounds one gh execution. Nothing else did: a gh call that
// never returned (a stalled connection, a credential prompt) held its sweep
// open forever, and every later tick skipped as "previous sweep still
// running" until somebody restarted the daemon. GitHub itself gives up on a
// GraphQL query after ~10s, so a call still running at a minute is not going
// to answer.
var ghCallTimeout = time.Minute

// runGHOnce is one execution of the gh CLI, with no retry policy of its own.
// A var so tests can drive the retry and page-size ladders without a stub
// binary on PATH.
var runGHOnce = func(ctx context.Context, args ...string) ([]byte, error) {
	callCtx, cancel := context.WithTimeout(ctx, ghCallTimeout)
	defer cancel()
	cmd := exec.CommandContext(callCtx, "gh", args...)
	var stderr strings.Builder
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		// Named, because the kill reads as "signal: killed", which says
		// nothing about why. Only our own timeout: a cancelled parent is a
		// shutdown, not a slow GitHub.
		if callCtx.Err() == context.DeadlineExceeded && ctx.Err() == nil {
			msg = fmt.Sprintf("timed out after %s", ghCallTimeout)
		}
		return nil, fmt.Errorf("gh %s: %s", strings.Join(elideQuery(args), " "), msg)
	}
	return out, nil
}

// elideQuery replaces a GraphQL document in an error's echoed argv with a
// placeholder.
//
// The document is a static multi-line constant, so reproducing it verbatim
// buries the one line that says what went wrong under a dozen that do not. The
// rest of the argv (owner, repo, number) is what a reader needs to reproduce
// the call, and it stays.
func elideQuery(args []string) []string {
	out := make([]string, len(args))
	for i, a := range args {
		if strings.HasPrefix(a, "query=") {
			out[i] = "query=<graphql>"
			continue
		}
		out[i] = a
	}
	return out
}
