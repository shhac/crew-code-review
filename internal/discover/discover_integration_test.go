//go:build integration

package discover

import (
	"context"
	"os"
	"testing"

	"github.com/shhac/crew-code-review/internal/config"
	"github.com/shhac/crew-code-review/internal/store"
)

// TestLiveDiscovery runs the real `gh pr list` path against a repo named in
// CREW_CODE_REVIEW_TEST_REPO (never hardcoded) and classifies the results.
// Validates that the JSON fields we request unmarshal against live data.
func TestLiveDiscovery(t *testing.T) {
	repo := os.Getenv("CREW_CODE_REVIEW_TEST_REPO")
	if repo == "" {
		t.Skip("CREW_CODE_REVIEW_TEST_REPO not set")
	}

	d := New(staticConfig(config.Config{Repos: []string{repo}}), &fakeStore{}, t.Logf)
	prs, err := d.listPRs(context.Background(), repo)
	if err != nil {
		t.Fatalf("listPRs: %v", err)
	}
	t.Logf("%s: %d open PRs fetched", repo, len(prs))

	var cands []store.Candidate
	for _, pr := range prs {
		c, ok, err := d.classify(context.Background(), d.cfg(), repo, pr)
		if err != nil {
			t.Fatalf("classify #%d: %v", pr.Number, err)
		}
		if ok {
			if c.HeadSHA == "" {
				t.Errorf("#%d: candidate missing head SHA", c.Number)
			}
			cands = append(cands, c)
		}
	}

	// The sizes the listing leaves out, fetched for the candidates alone.
	d.measure(context.Background(), repo, cands)
	measured := 0
	for _, c := range cands {
		t.Logf("candidate: #%d %s type=%s author=%s sha=%.8s +%d -%d files=%d", c.Number, c.Title, c.Type, c.Author, c.HeadSHA, c.Additions, c.Deletions, c.ChangedFiles)
		if c.ChangedFiles > 0 {
			measured++
		}
	}
	if len(cands) > 0 && measured == 0 {
		t.Errorf("none of %d candidate(s) came back measured", len(cands))
	}
}
