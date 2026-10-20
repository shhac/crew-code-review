package discover

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/shhac/crew-code-review/internal/config"
)

// What a sweep COSTS when GitHub is misbehaving, measured in calls we did
// not have to make: the same-request retry, the page-size ladder, the
// cross-cycle backoff those two feed, and the budget that bounds them.

// --- sweep resilience: retry, cross-cycle backoff, and the budget ---

// sweepHarness drives repeated sweeps over a fake gh with a controllable
// clock, recording which repos were actually listed on each one. Every test
// below asks the same question: what does a sweep COST when GitHub is
// misbehaving, measured in calls we did not have to make.
type sweepHarness struct {
	d       *Discoverer
	now     time.Time
	calls   []string // repo per listPRs call, across all sweeps
	failing map[string]bool
	warns   []string
}

func newSweepHarness(t *testing.T, repos []string) *sweepHarness {
	t.Helper()
	h := &sweepHarness{now: fixedNow(), failing: map[string]bool{}}
	cfg := config.Config{Repos: repos}
	cfg.Discovery.Interval = "5m"
	h.d = New(staticConfig(cfg), &fakeStore{}, nil)
	h.d.now = func() time.Time { return h.now }
	h.d.warnf = func(format string, args ...any) {
		h.warns = append(h.warns, fmt.Sprintf(format, args...))
	}
	h.d.listPRs = func(_ context.Context, repo string) ([]ghPR, error) {
		h.calls = append(h.calls, repo)
		if h.failing[repo] {
			return nil, errors.New("gh pr list: HTTP 502: 502 Bad Gateway")
		}
		return nil, nil
	}
	return h
}

func (h *sweepHarness) sweep(t *testing.T) error {
	t.Helper()
	_, err := h.d.Discover(context.Background())
	return err
}

func (h *sweepHarness) callsSince(n int) []string { return h.calls[n:] }

// A failing repo must not be retried on the very next cycle: that is the
// cascade, one 502 becoming a 502 every five minutes forever.
func TestSweepBackoffSkipsNextCycle(t *testing.T) {
	h := newSweepHarness(t, []string{"o/a", "o/b"})
	h.failing["o/a"] = true

	if err := h.sweep(t); err != nil {
		t.Fatalf("first sweep: %v", err)
	}
	if got := len(h.calls); got != 2 {
		t.Fatalf("first sweep made %d calls, want 2 (both repos tried)", got)
	}

	// One minute later, inside o/a's 2m window: it must be skipped, and o/b
	// must be unaffected by its neighbour's failure.
	h.now = h.now.Add(1 * time.Minute)
	mark := len(h.calls)
	if err := h.sweep(t); err != nil {
		t.Fatalf("second sweep: %v", err)
	}
	if got := h.callsSince(mark); len(got) != 1 || got[0] != "o/b" {
		t.Fatalf("second sweep listed %v, want [o/b] only (o/a still in backoff)", got)
	}
	if len(h.warns) == 0 || !strings.Contains(h.warns[len(h.warns)-1], "in backoff") {
		t.Fatalf("expected a backoff log line, got %v", h.warns)
	}
}

// Past the window the repo is tried again, and a success clears the count so
// the next failure starts from the short end of the curve rather than the long.
func TestSweepBackoffExpiresAndRecovers(t *testing.T) {
	h := newSweepHarness(t, []string{"o/a"})
	h.failing["o/a"] = true
	_ = h.sweep(t) // failure 1 → 2m

	h.now = h.now.Add(3 * time.Minute)
	h.failing["o/a"] = false
	mark := len(h.calls)
	if err := h.sweep(t); err != nil {
		t.Fatalf("sweep after window: %v", err)
	}
	if got := h.callsSince(mark); len(got) != 1 {
		t.Fatalf("expected o/a retried once the window passed, got %v", got)
	}

	// Recovered: a fresh failure is failure 1 again (2m), not failure 2 (4m).
	h.failing["o/a"] = true
	h.now = h.now.Add(time.Minute)
	_ = h.sweep(t)
	if _, fails, held := h.d.inBackoff("o/a", h.now); !held || fails != 1 {
		t.Fatalf("after recovery, failure count = %d (held=%v), want 1", fails, held)
	}
}

// Consecutive failures lengthen the window, capped so a dead repo still gets
// retried twice an hour rather than never.
func TestBackoffCurve(t *testing.T) {
	for _, tc := range []struct {
		failures int
		want     time.Duration
	}{
		{1, 2 * time.Minute},
		{2, 4 * time.Minute},
		{3, 8 * time.Minute},
		{4, 16 * time.Minute},
		{5, 30 * time.Minute},
		{50, 30 * time.Minute},
	} {
		if got := backoffFor(tc.failures); got != tc.want {
			t.Errorf("backoffFor(%d) = %s, want %s", tc.failures, got, tc.want)
		}
	}
}

// Repos skipped because they are already backed off must not count as fresh
// failures, or one outage becomes a hard error on every subsequent cycle.
func TestAllReposBackedOffIsNotAnError(t *testing.T) {
	h := newSweepHarness(t, []string{"o/a", "o/b"})
	h.failing["o/a"], h.failing["o/b"] = true, true

	if err := h.sweep(t); err == nil {
		t.Fatal("first sweep: want an error when every repo fails, got nil")
	}
	h.now = h.now.Add(time.Minute)
	if err := h.sweep(t); err != nil {
		t.Fatalf("second sweep: want nil while both repos wait out backoff, got %v", err)
	}
}

// A sweep that runs out of budget resumes where it stopped, so the tail of the
// repo list is delayed by a cycle rather than starved forever.
func TestSweepBudgetResumesAtUnreachedRepo(t *testing.T) {
	h := newSweepHarness(t, []string{"o/a", "o/b", "o/c"})
	// Each listing burns four minutes of a five-minute budget, so the first
	// sweep gets through o/a and then finds itself over the line.
	inner := h.d.listPRs
	h.d.listPRs = func(ctx context.Context, repo string) ([]ghPR, error) {
		h.now = h.now.Add(4 * time.Minute)
		return inner(ctx, repo)
	}

	if err := h.sweep(t); err != nil {
		t.Fatalf("first sweep: %v", err)
	}
	if got := h.calls; len(got) != 2 || got[0] != "o/a" || got[1] != "o/b" {
		t.Fatalf("first sweep listed %v, want [o/a o/b] before the budget ran out", got)
	}
	if len(h.warns) == 0 || !strings.Contains(h.warns[len(h.warns)-1], "sweep budget") {
		t.Fatalf("expected a budget log line, got %v", h.warns)
	}

	mark := len(h.calls)
	if err := h.sweep(t); err != nil {
		t.Fatalf("second sweep: %v", err)
	}
	if got := h.callsSince(mark); len(got) == 0 || got[0] != "o/c" {
		t.Fatalf("second sweep started at %v, want o/c first (the repo the budget cut off)", got)
	}
}

// --- page-size ladder ---

// listArg reads one `-f`/`-F` variable (name=value) out of a gh api argv.
func listArg(args []string, name string) string {
	for _, a := range args {
		if v, ok := strings.CutPrefix(a, name+"="); ok {
			return v
		}
	}
	return ""
}

// listPage is a canned search response holding numbers, with a next page
// behind cursor when next is set.
func listPage(numbers []int, next bool, cursor string) []byte {
	var nodes []string
	for _, n := range numbers {
		nodes = append(nodes, fmt.Sprintf(`{"number":%d,"headRefOid":"sha%d","author":{"login":"a","__typename":"User"},"reviewRequests":{"totalCount":0},"reviews":{"totalCount":0}}`, n, n))
	}
	return []byte(fmt.Sprintf(`{"data":{"search":{"pageInfo":{"hasNextPage":%v,"endCursor":%q},"nodes":[%s]}}}`,
		next, cursor, strings.Join(nodes, ",")))
}

func span(from, to int) []int {
	var out []int
	for n := from; n <= to; n++ {
		out = append(out, n)
	}
	return out
}

func newListDiscoverer(t *testing.T, limit int) (*Discoverer, *[]string) {
	t.Helper()
	cfg := config.Config{Repos: []string{"o/a"}}
	if limit > 0 {
		cfg.Discovery.ListLimit = &limit
	}
	d := New(staticConfig(cfg), &fakeStore{}, nil)
	var warns []string
	d.warnf = func(format string, args ...any) { warns = append(warns, fmt.Sprintf(format, args...)) }
	return d, &warns
}

// An exhausted page is retried SMALLER, not repeated: asking again for the
// same too-expensive query is the thing that does not work.
func TestListPRsShrinksThePageOnExhaustion(t *testing.T) {
	var asked []string
	restore := stubRunGHOnce(func(args []string) ([]byte, error) {
		n := listArg(args, "n")
		asked = append(asked, n)
		if n == "100" {
			return nil, errors.New("gh api graphql: HTTP 502: 502 Bad Gateway")
		}
		return listPage([]int{1, 2}, false, ""), nil
	})
	defer restore()

	d, warns := newListDiscoverer(t, 0)
	prs, err := d.ghListPRs(context.Background(), "o/a")
	if err != nil {
		t.Fatalf("ghListPRs = %v, want success at the smaller page", err)
	}
	if len(prs) != 2 {
		t.Fatalf("got %d PRs, want 2", len(prs))
	}
	if strings.Join(asked, ",") != "100,50" {
		t.Fatalf("page sizes asked = %v, want [100 50]", asked)
	}
	if len(*warns) != 1 || !strings.Contains((*warns)[0], "pages shrunk to 50") {
		t.Fatalf("expected one degraded warning, got %v", *warns)
	}
}

// The depth is the listing's to keep: the old ladder bought its way past a
// 502 by listing fewer PRs, which is exactly what hid PRs from discovery.
// Pages walk the cursor until the limit, the last one asking only for the
// remainder.
func TestListPRsPagesToTheLimit(t *testing.T) {
	var asked, cursors []string
	restore := stubRunGHOnce(func(args []string) ([]byte, error) {
		n := listArg(args, "n")
		asked = append(asked, n)
		cursors = append(cursors, listArg(args, "after"))
		start := len(asked)*100 - 99
		size, _ := strconv.Atoi(n)
		return listPage(span(start, start+size-1), true, fmt.Sprintf("c%d", len(asked))), nil
	})
	defer restore()

	d, _ := newListDiscoverer(t, 250)
	prs, err := d.ghListPRs(context.Background(), "o/a")
	if err != nil {
		t.Fatalf("ghListPRs: %v", err)
	}
	if len(prs) != 250 {
		t.Fatalf("got %d PRs, want the full 250", len(prs))
	}
	if strings.Join(asked, ",") != "100,100,50" {
		t.Fatalf("page sizes asked = %v, want [100 100 50]", asked)
	}
	if strings.Join(cursors, ",") != ",c1,c2" {
		t.Fatalf("cursors = %q, want each page to continue from the last", cursors)
	}
}

// Sorting by updated time lets a PR touched mid-listing appear on two pages.
func TestListPRsDropsARepeatedPR(t *testing.T) {
	calls := 0
	restore := stubRunGHOnce(func([]string) ([]byte, error) {
		calls++
		if calls == 1 {
			return listPage([]int{1, 2}, true, "c1"), nil
		}
		return listPage([]int{2, 3}, false, ""), nil
	})
	defer restore()

	d, _ := newListDiscoverer(t, 0)
	prs, err := d.ghListPRs(context.Background(), "o/a")
	if err != nil {
		t.Fatalf("ghListPRs: %v", err)
	}
	if len(prs) != 3 {
		t.Fatalf("got %d PRs, want 3 with the repeat dropped", len(prs))
	}
}

// A shrunk page must not become the new setting: the next listing asks for
// full pages again.
func TestListPRsReturnsToFullPageSize(t *testing.T) {
	exhausted := true
	var asked []string
	restore := stubRunGHOnce(func(args []string) ([]byte, error) {
		n := listArg(args, "n")
		asked = append(asked, n)
		if exhausted && n == "100" {
			return nil, errors.New("gh api graphql: HTTP 502: 502 Bad Gateway")
		}
		return listPage(nil, false, ""), nil
	})
	defer restore()

	d, _ := newListDiscoverer(t, 0)
	if _, err := d.ghListPRs(context.Background(), "o/a"); err != nil {
		t.Fatalf("degraded listing: %v", err)
	}
	exhausted = false
	mark := len(asked)
	if _, err := d.ghListPRs(context.Background(), "o/a"); err != nil {
		t.Fatalf("recovered listing: %v", err)
	}
	if got := asked[mark:]; len(got) != 1 || got[0] != "100" {
		t.Fatalf("next listing asked %v, want [100]: page size must not stay degraded", got)
	}
}

// The ladder is only worth having if it is walked to the bottom, and the
// error the caller sees must be the FLOOR's: an operator reading "backing
// off" needs to know the cheapest question also failed.
func TestListPRsExhaustsEveryRungBeforeGivingUp(t *testing.T) {
	var asked []string
	restore := stubRunGHOnce(func(args []string) ([]byte, error) {
		n := listArg(args, "n")
		asked = append(asked, n)
		return nil, fmt.Errorf("gh api graphql: HTTP 502: 502 Bad Gateway at page %s", n)
	})
	defer restore()

	d, _ := newListDiscoverer(t, 0)
	_, err := d.ghListPRs(context.Background(), "o/a")
	if err == nil {
		t.Fatal("want an error when every rung fails")
	}
	if strings.Join(asked, ",") != "100,50,25" {
		t.Fatalf("page sizes asked = %v, want [100 50 25]", asked)
	}
	if !strings.Contains(err.Error(), "at page 25") {
		t.Errorf("error = %q, want the floor rung's failure", err)
	}
}

// Sorted by recent activity, the PRs already listed are the likeliest
// candidates there are. A listing that fails further down keeps them.
func TestListPRsKeepsWhatItListedBeforeFailing(t *testing.T) {
	restore := stubRunGHOnce(func(args []string) ([]byte, error) {
		if listArg(args, "after") == "" {
			return listPage(span(1, 100), true, "c1"), nil
		}
		return nil, errors.New("gh api graphql: HTTP 502: 502 Bad Gateway")
	})
	defer restore()

	d, warns := newListDiscoverer(t, 0)
	prs, err := d.ghListPRs(context.Background(), "o/a")
	if err != nil {
		t.Fatalf("ghListPRs = %v, want the first page kept", err)
	}
	if len(prs) != 100 {
		t.Fatalf("got %d PRs, want the 100 listed before the failure", len(prs))
	}
	if len(*warns) != 1 || !strings.Contains((*warns)[0], "cut short at 100") {
		t.Fatalf("expected a cut-short warning, got %v", *warns)
	}
}

// An exhausted ladder is ONE repo failure, not three. The ladder is how a repo
// spends a single cycle's attempt; if each rung counted, a repo would be
// thrown into deep backoff by its first bad moment.
func TestLadderExhaustionCountsAsOneRepoFailure(t *testing.T) {
	calls := map[string]int{}
	restore := stubRunGHOnce(func(args []string) ([]byte, error) {
		repo := strings.Fields(strings.TrimPrefix(listArg(args, "q"), "repo:"))[0]
		calls[repo]++
		if repo == "o/sick" {
			return nil, errors.New("gh api graphql: HTTP 502: 502 Bad Gateway")
		}
		return listPage(nil, false, ""), nil
	})
	defer restore()

	cfg := config.Config{Repos: []string{"o/sick", "o/well"}}
	cfg.Discovery.Interval = "5m"
	// The production wiring, deliberately not stubbed: this is the one test
	// that holds the real ladder and the sweep's failure accounting together.
	d := New(staticConfig(cfg), &fakeStore{}, nil)
	now := fixedNow()
	d.now = func() time.Time { return now }
	d.warnf = func(string, ...any) {}

	if _, err := d.Discover(context.Background()); err != nil {
		t.Fatalf("Discover: %v", err)
	}
	if calls["o/sick"] != 3 {
		t.Errorf("sick repo made %d gh calls, want 3 (the whole ladder, within one cycle)", calls["o/sick"])
	}
	if calls["o/well"] != 1 {
		t.Errorf("healthy repo made %d gh calls, want 1: one repo's bad cycle must not cost another repo anything", calls["o/well"])
	}
	_, fails, held := d.inBackoff("o/sick", now)
	if !held || fails != 1 {
		t.Errorf("after an exhausted ladder: held=%v fails=%d, want held=true fails=1", held, fails)
	}
	if _, _, held := d.inBackoff("o/well", now); held {
		t.Error("healthy repo is in backoff")
	}
}

// A permanent failure is the same answer at every page size.
func TestListPRsDoesNotLadderPermanentFailure(t *testing.T) {
	calls := 0
	restore := stubRunGHOnce(func([]string) ([]byte, error) {
		calls++
		return nil, errors.New("gh api graphql: GraphQL: Could not resolve to a Repository")
	})
	defer restore()

	d, _ := newListDiscoverer(t, 0)
	if _, err := d.ghListPRs(context.Background(), "o/a"); err == nil {
		t.Fatal("want an error for a missing repo")
	}
	if calls != 1 {
		t.Fatalf("gh called %d times on a permanent failure, want 1", calls)
	}
}

// stubRunGHOnce swaps the single-shot gh call for fn, which sees the argv.
func stubRunGHOnce(fn func(args []string) ([]byte, error)) func() {
	old, oldDelay := runGHOnce, ghRetryDelay
	ghRetryDelay = 0
	runGHOnce = func(_ context.Context, args ...string) ([]byte, error) { return fn(args) }
	return func() { runGHOnce, ghRetryDelay = old, oldDelay }
}

// --- transient-failure retry ---

func TestTransientClassification(t *testing.T) {
	retry := []string{
		"gh pr list: HTTP 502: 502 Bad Gateway (https://api.github.com/graphql)",
		"gh api: HTTP 503: Service Unavailable",
		"gh pr list: HTTP 504: Gateway Timeout",
		"gh api: read tcp: connection reset by peer",
		"gh api: net/http: TLS handshake timeout",
	}
	for _, msg := range retry {
		if !transient(msg) {
			t.Errorf("transient(%q) = false, want true", msg)
		}
	}
	// A 4xx, a bad query, or a missing repo fails identically however many
	// times we ask; retrying only delays the error.
	permanent := []string{
		"gh pr list: HTTP 404: Not Found",
		"gh pr list: HTTP 401: Bad credentials",
		"gh api: GraphQL: Field 'nope' doesn't exist",
		"gh pr list: could not resolve to a Repository",
	}
	for _, msg := range permanent {
		if transient(msg) {
			t.Errorf("transient(%q) = true, want false", msg)
		}
	}
}

func TestRunGHRetriesTransientThenSucceeds(t *testing.T) {
	restore := fakeGH(t, `
if [ ! -f "$STATE" ]; then echo 1 > "$STATE"; echo "HTTP 502: 502 Bad Gateway" >&2; exit 1; fi
echo '[]'
`)
	defer restore()

	out, err := runGH(context.Background(), "pr", "list")
	if err != nil {
		t.Fatalf("runGH after one 502 = %v, want success on the retry", err)
	}
	if strings.TrimSpace(string(out)) != "[]" {
		t.Fatalf("runGH returned %q, want the retry's output", out)
	}
}

func TestRunGHGivesUpAfterAttempts(t *testing.T) {
	restore := fakeGH(t, `echo "HTTP 502: 502 Bad Gateway" >&2; exit 1`)
	defer restore()

	if _, err := runGH(context.Background(), "pr", "list"); err == nil {
		t.Fatal("runGH with a permanently 502ing gh = nil, want the last error")
	}
	if got := attempts(t); got != ghAttempts {
		t.Fatalf("gh invoked %d times, want %d", got, ghAttempts)
	}
}

func TestRunGHDoesNotRetryPermanentFailure(t *testing.T) {
	restore := fakeGH(t, `echo "HTTP 404: Not Found" >&2; exit 1`)
	defer restore()

	if _, err := runGH(context.Background(), "pr", "list"); err == nil {
		t.Fatal("runGH on a 404 = nil, want an error")
	}
	if got := attempts(t); got != 1 {
		t.Fatalf("gh invoked %d times on a 404, want 1 (no retries)", got)
	}
}

// fakeGH puts a stub `gh` on PATH running body, with $STATE pointing at a
// scratch file the body may use to vary its behaviour between invocations,
// and $COUNT at a tally of invocations. It zeroes the retry delay so the
// retry path costs the suite nothing.
func fakeGH(t *testing.T, body string) func() {
	t.Helper()
	dir := t.TempDir()
	script := "#!/bin/sh\nSTATE=" + dir + "/state\nprintf x >> " + dir + "/count\n" + body + "\n"
	if err := os.WriteFile(dir+"/gh", []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	oldDelay := ghRetryDelay
	ghRetryDelay = 0
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
	ghDir = dir
	return func() { ghRetryDelay = oldDelay }
}

var ghDir string

func attempts(t *testing.T) int {
	t.Helper()
	b, err := os.ReadFile(ghDir + "/count")
	if err != nil {
		return 0
	}
	return len(b)
}
