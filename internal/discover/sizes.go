package discover

import (
	"context"
	"fmt"
	"strings"

	"github.com/shhac/crew-code-review/internal/store"
)

// Line counts for discovery's candidates, as the queue displays them.
//
// The listing leaves them out (list.go): GitHub computes a diff summary per PR
// to answer them, and asking for them across a whole listing is what pushed it
// past GitHub's timeout. Here they are asked for only for the PRs that became
// candidates, which is a handful per repo per sweep.
//
// Not to be confused with measure.go, which is the per-file measurement a
// SCORE is computed from at claim time.

// prSize is a PR's raw diff totals, as the queue displays them.
type prSize struct {
	Number       int `json:"number"`
	Additions    int `json:"additions"`
	Deletions    int `json:"deletions"`
	ChangedFiles int `json:"changedFiles"`
}

// ghSizesResp is one aliased size query's reply: each alias (p<number>) maps
// to that PR's totals.
type ghSizesResp struct {
	Data struct {
		Repository map[string]*prSize `json:"repository"`
	} `json:"data"`
}

// sizeBatch bounds one size query. Each PR costs GitHub a diff summary, which
// is what made the listing too slow when it asked for all of them; fifty is
// well inside the timeout and more candidates than one repo has in a sweep.
const sizeBatch = 50

// ghPRSizes fetches the line counts for just these PRs, aliased into one query
// per batch: the production prSizes.
func ghPRSizes(ctx context.Context, repo string, numbers []int) (map[int]prSize, error) {
	out := make(map[int]prSize, len(numbers))
	for start := 0; start < len(numbers); start += sizeBatch {
		batch := numbers[start:min(start+sizeBatch, len(numbers))]
		var fields strings.Builder
		for _, n := range batch {
			fmt.Fprintf(&fields, "p%d: pullRequest(number:%d) { number additions deletions changedFiles }\n", n, n)
		}
		query := "query($owner:String!, $repo:String!) { repository(owner:$owner, name:$repo) {\n" + fields.String() + "} }"
		resp, err := ghGraphQL[ghSizesResp](ctx, repo, "PR sizes", query)
		if err != nil {
			return nil, err
		}
		for _, s := range resp.Data.Repository {
			if s != nil {
				out[s.Number] = *s
			}
		}
	}
	return out, nil
}

// fillSizes fills in the line counts the listing leaves out (list.go), for
// candidates only. Best-effort: they are for display, so a failed fetch is a
// warning and the candidates are enqueued unmeasured, which leaves any figures
// already stored on their rows alone.
func (d *Discoverer) fillSizes(ctx context.Context, repo string, cands []store.Candidate) {
	if len(cands) == 0 {
		return
	}
	numbers := make([]int, len(cands))
	for i, c := range cands {
		numbers[i] = c.Number
	}
	sizes, err := d.prSizes(ctx, repo, numbers)
	if err != nil {
		d.warnf("discover %s: measuring %d candidate(s) failed, enqueued without sizes: %v", repo, len(cands), err)
		return
	}
	for i := range cands {
		s := sizes[cands[i].Number]
		cands[i].Additions, cands[i].Deletions, cands[i].ChangedFiles = s.Additions, s.Deletions, s.ChangedFiles
	}
}
