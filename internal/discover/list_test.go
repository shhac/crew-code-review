package discover

import (
	"encoding/json"
	"testing"
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
