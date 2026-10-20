package discover

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"
)

// One repo's open-PR listing, written as our own GraphQL rather than
// `gh pr list --json`.
//
// gh's field set is the expensive part, not the depth. `gh pr list` turns each
// field it is given into a generous subtree (every review with its body and
// author profile, every review request with its reviewer), and the line
// counts make GitHub compute a diff summary per PR. Measured against a repo
// with 590 open PRs, one 100-PR page of the old field set took longer than
// the ~10s GitHub allows a GraphQL query, so the listing 502'd at any depth
// above ~75 and, on a slow day, at every depth the ladder tried. That parked
// the repo in backoff and took it out of discovery entirely. The same page
// asking only for what classify reads takes 3-4s.
//
// So the listing asks for counts where classify needs only "is there one"
// (review requests, reviews), and leaves the line counts out. They feed the
// queue display alone, and are fetched afterwards for the handful of PRs that
// became candidates (sizes.go).

// listQuery is the search behind `gh pr list --search`, without gh's field
// expansion. $q, not $query: `-f query=` is how gh api graphql takes the
// document itself.
const listQuery = `query($q:String!, $n:Int!, $after:String) {
  search(query:$q, type:ISSUE, first:$n, after:$after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number title url createdAt updatedAt isDraft headRefOid
        author { login __typename }
        reviewDecision
        reviewRequests { totalCount }
        reviews { totalCount }
      }
    }
  }
}`

// Page-size ladder for one repo's listing. GitHub answers a query it cannot
// finish in time with a 502, and the honest reply to that is to ask for less
// rather than to ask again for the same thing. Less means a smaller PAGE, not a
// shallower listing: the old ladder shrank the depth, but every rung above 100
// still asked for the same 100-PR page, so it gave up depth without making a
// single request cheaper.
//
// Once a page has had to shrink, the rest of that listing keeps the smaller
// size: the next page is the same query over similar PRs. The next listing
// starts at full size again; the ladder is a way through one bad moment, not
// a new setting.
const (
	listPageMax = 100
	listPageMin = 25
	// searchResultCap is GitHub's own ceiling on one search; a list_limit
	// above it cannot be honoured, and asking past it is an error.
	searchResultCap = 1000
)

type ghListResp struct {
	Data struct {
		Search struct {
			PageInfo struct {
				HasNextPage bool   `json:"hasNextPage"`
				EndCursor   string `json:"endCursor"`
			} `json:"pageInfo"`
			Nodes []ghListNode `json:"nodes"`
		} `json:"search"`
	} `json:"data"`
}

type ghListNode struct {
	Number     int       `json:"number"`
	Title      string    `json:"title"`
	URL        string    `json:"url"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
	IsDraft    bool      `json:"isDraft"`
	HeadRefOID string    `json:"headRefOid"`
	// Author is null for a deleted account; that reads as an empty login, as
	// it did through gh.
	Author *struct {
		Login    string `json:"login"`
		Typename string `json:"__typename"`
	} `json:"author"`
	ReviewDecision string                   `json:"reviewDecision"`
	ReviewRequests struct{ TotalCount int } `json:"reviewRequests"`
	Reviews        struct{ TotalCount int } `json:"reviews"`
}

// pr converts a listing node to the shared wire shape classify reads.
func (n ghListNode) pr() ghPR {
	pr := ghPR{
		Number:             n.Number,
		Title:              n.Title,
		URL:                n.URL,
		CreatedAt:          n.CreatedAt,
		UpdatedAt:          n.UpdatedAt,
		IsDraft:            n.IsDraft,
		HeadRefOID:         n.HeadRefOID,
		ReviewDecision:     n.ReviewDecision,
		reviewRequestCount: n.ReviewRequests.TotalCount,
		reviewCount:        n.Reviews.TotalCount,
	}
	if n.Author != nil {
		pr.Author.Login = ghLogin(n.Author.Login, n.Author.Typename)
	}
	return pr
}

// ghLogin spells an author's login the way gh does, because that spelling is
// what the roster, the author overrides and every stored row already hold. Raw
// GraphQL calls a GitHub App "dependabot"; gh calls it "app/dependabot". Taking
// the raw form would quietly detach every bot from the policy written for it.
func ghLogin(login, typename string) string {
	if typename == "Bot" {
		return "app/" + login
	}
	return login
}

// ghListPRs fetches open PRs for one repo with the fields we classify on:
// the production listPRs.
//
// Sorted by most recently updated, not by gh's default of most recently
// created, because the limit truncates and the two orderings truncate
// differently. Every candidate type we recognise is a statement about recent
// activity: NEW is bounded by an age window, REFRESHED by a head SHA that
// moved, DISCUSSION by somebody having just spoken. A PR that qualifies has,
// by definition, been updated recently, while its NUMBER says only when it was
// opened. Under created-desc, one repo with 528 open PRs hid 12 PRs with open
// review requests behind 100 newer ones that were mostly drafts.
//
// The ordering is also what makes a cut-short listing still worth having: it
// drops the LEAST recently active PRs, which are the least likely to be
// candidates. So when even the smallest page fails partway down, the PRs
// already listed are returned rather than thrown away. degraded says when the
// listing got through at less than full strength; it is part of the result,
// so the sweep records the whole outcome in one place.
//
// This is the one gh read that does not use runGH's retry. Retrying an
// exhausted query unchanged is the thing that does not work; the ladder is the
// retry, and it is a better one.
func (d *Discoverer) ghListPRs(ctx context.Context, repo string) (prs []ghPR, degraded string, err error) {
	limit := min(d.cfg().DiscoveryListLimit(), searchResultCap)
	search := "repo:" + repo + " is:pr is:open sort:updated-desc"
	page, shrinks := listPageMax, 0
	cursor := ""
	// Sorting by updated time means a PR touched mid-listing moves up the
	// order and can turn up on two pages. gh drops the repeat; so do we.
	seen := map[int]bool{}
	for len(prs) < limit {
		resp, err := searchPRs(ctx, search, min(page, limit-len(prs)), cursor)
		if err != nil {
			if !transient(err.Error()) {
				return nil, "", err
			}
			if page > listPageMin {
				page = max(page/2, listPageMin)
				shrinks++
				if err := sleepOrCancel(ctx, ghRetryDelay); err != nil {
					return nil, "", err
				}
				continue
			}
			if len(prs) == 0 {
				return nil, "", err
			}
			return prs, fmt.Sprintf("listing cut short at %d PR(s) of up to %d: %v", len(prs), limit, err), nil
		}
		for _, n := range resp.Data.Search.Nodes {
			if n.Number == 0 || seen[n.Number] {
				continue
			}
			seen[n.Number] = true
			prs = append(prs, n.pr())
		}
		info := resp.Data.Search.PageInfo
		if !info.HasNextPage || len(resp.Data.Search.Nodes) == 0 {
			break
		}
		cursor = info.EndCursor
	}
	if shrinks > 0 {
		degraded = fmt.Sprintf("pages shrunk to %d after %d exhaustion(s), listed %d PR(s)", page, shrinks, len(prs))
	}
	return prs, degraded, nil
}

// searchPRs is one page of the listing, through the single-shot gh call so
// the ladder above is the only retry.
func searchPRs(ctx context.Context, search string, n int, cursor string) (ghListResp, error) {
	var resp ghListResp
	args := []string{"api", "graphql", "-f", "q=" + search, "-F", "n=" + strconv.Itoa(n)}
	if cursor != "" {
		args = append(args, "-f", "after="+cursor)
	}
	out, err := runGHOnce(ctx, append(args, "-f", "query="+listQuery)...)
	if err != nil {
		return resp, err
	}
	if err := json.Unmarshal(out, &resp); err != nil {
		return resp, fmt.Errorf("decode PR listing: %w", err)
	}
	return resp, nil
}
