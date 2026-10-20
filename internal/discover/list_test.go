package discover

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/shhac/crew-code-review/internal/config"
)

// The listing's node must read as the same PR the old `gh pr list` payload
// did: same login spelling, same gate answers.
func TestListNodeMatchesTheGhShape(t *testing.T) {
	var resp ghListResp
	raw := `{"data":{"search":{"nodes":[
	  {"number":1,"author":{"login":"dependabot","__typename":"Bot"},"reviewRequests":{"totalCount":1},"reviews":{"totalCount":0}},
	  {"number":2,"author":{"login":"alice","__typename":"User"},"reviewRequests":{"totalCount":0},"reviews":{"totalCount":3}},
	  {"number":3,"author":null,"reviewRequests":{"totalCount":0},"reviews":{"totalCount":0}}
	]}}}`
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatal(err)
	}
	var prs []ghPR
	for _, n := range resp.Data.Search.Nodes {
		prs = append(prs, n.pr())
	}

	// gh spells a GitHub App "app/<name>", and the roster and overrides are
	// written that way; the raw login would detach every bot from its policy.
	if got := prs[0].Author.Login; got != "app/dependabot" {
		t.Errorf("bot login = %q, want app/dependabot", got)
	}
	if got := prs[1].Author.Login; got != "alice" {
		t.Errorf("user login = %q, want alice", got)
	}
	if got := prs[2].Author.Login; got != "" {
		t.Errorf("deleted author login = %q, want empty", got)
	}

	if !prs[0].hasOpenReviewRequest() || prs[1].hasOpenReviewRequest() {
		t.Error("review-request counts must answer hasOpenReviewRequest")
	}
	if prs[0].hasAnyReview() || !prs[1].hasAnyReview() {
		t.Error("review counts must answer hasAnyReview")
	}
	if ok, reason := candidacyGate(prs[1], true); ok || reason != "no open review request" {
		t.Errorf("gate on a counted PR = (%v, %q), want the same answer the slices gave", ok, reason)
	}
}

func TestPRSizesAliasesEveryNumber(t *testing.T) {
	var query string
	restore := stubRunGHOnce(func(args []string) ([]byte, error) {
		query = listArg(args, "query")
		return []byte(`{"data":{"repository":{
		  "p7":{"number":7,"additions":10,"deletions":2,"changedFiles":3},
		  "p9":{"number":9,"additions":1,"deletions":0,"changedFiles":1}}}}`), nil
	})
	defer restore()

	sizes, err := ghPRSizes(context.Background(), "o/a", []int{7, 9})
	if err != nil {
		t.Fatalf("ghPRSizes: %v", err)
	}
	for _, alias := range []string{"p7: pullRequest(number:7)", "p9: pullRequest(number:9)"} {
		if !strings.Contains(query, alias) {
			t.Errorf("query missing %q:\n%s", alias, query)
		}
	}
	if got := sizes[7]; got.Additions != 10 || got.Deletions != 2 || got.ChangedFiles != 3 {
		t.Errorf("sizes[7] = %+v", got)
	}
	if len(sizes) != 2 {
		t.Errorf("got %d sizes, want 2", len(sizes))
	}
}

func TestPRSizesBatches(t *testing.T) {
	calls := 0
	restore := stubRunGHOnce(func([]string) ([]byte, error) {
		calls++
		return []byte(`{"data":{"repository":{}}}`), nil
	})
	defer restore()

	if _, err := ghPRSizes(context.Background(), "o/a", span(1, sizeBatch+1)); err != nil {
		t.Fatalf("ghPRSizes: %v", err)
	}
	if calls != 2 {
		t.Errorf("%d PRs took %d queries, want 2", sizeBatch+1, calls)
	}
}

// Sizes ride on the candidates, and a failed fetch costs the sweep nothing
// but the sizes: the candidates are still enqueued.
func TestSweepMeasuresCandidatesBestEffort(t *testing.T) {
	pr := readyPR()
	for _, tc := range []struct {
		name    string
		sizes   func(context.Context, string, []int) (map[int]prSize, error)
		wantAdd int
		warned  bool
	}{
		{"measured", func(_ context.Context, _ string, numbers []int) (map[int]prSize, error) {
			return map[int]prSize{numbers[0]: {Number: numbers[0], Additions: 40, Deletions: 4, ChangedFiles: 2}}, nil
		}, 40, false},
		{"fetch failed", func(context.Context, string, []int) (map[int]prSize, error) {
			return nil, errors.New("gh api graphql: HTTP 502")
		}, 0, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fs := &fakeStore{}
			cfg := config.Config{Repos: []string{"o/a"}}
			cfg.Candidates.RequireReviewRequest = config.Bool(false)
			d := newDiscoverer(fs)
			d.cfg = staticConfig(cfg)
			d.listPRs = func(context.Context, string) ([]ghPR, error) { return []ghPR{pr}, nil }
			d.prSizes = tc.sizes
			var warns []string
			d.warnf = func(f string, a ...any) { warns = append(warns, fmt.Sprintf(f, a...)) }

			if _, err := d.Discover(context.Background()); err != nil {
				t.Fatalf("Discover: %v", err)
			}
			if len(fs.enqueued) != 1 {
				t.Fatalf("enqueued %d, want 1 whatever the size fetch did", len(fs.enqueued))
			}
			if got := fs.enqueued[0]; got.Additions != tc.wantAdd {
				t.Errorf("additions = %d, want %d", got.Additions, tc.wantAdd)
			}
			if (len(warns) > 0) != tc.warned {
				t.Errorf("warnings = %v, want warned=%v", warns, tc.warned)
			}
		})
	}
}
