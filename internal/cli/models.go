package cli

// The model-catalog client behind shell completion of the engines' model and
// effort keys. The harness reads each engine's own catalog (codex's
// app-server model list, claude's and grok's initialization metadata) without
// inference; nothing here parses a CLI's output or keeps a list of its own.

import (
	"context"
	"slices"

	"github.com/shhac/crew-code-review/internal/config"
	harness "github.com/shhac/lib-agent-harness"
	"github.com/shhac/lib-agent-harness/catalog"
)

// discoverModels is the harness read, a variable so completion's tests never
// start a real CLI.
var discoverModels = catalog.Discover

func engineModels(ctx context.Context, engine string) []catalog.Model {
	if !harness.Support(harness.Engine(engine), harness.Models, harness.Available).Usable() {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, completionTimeout)
	defer cancel()
	models, err := discoverModels(ctx, config.Read().Review.Provider(engine))
	if err != nil {
		return nil
	}
	return models
}

// completeModels offers the engine's model ids.
func completeModels(engine string) func(context.Context) []string {
	return func(ctx context.Context) []string {
		models := engineModels(ctx, engine)
		ids := make([]string, 0, len(models))
		for _, m := range models {
			ids = append(ids, m.ID)
		}
		return ids
	}
}

// completeEfforts offers the efforts the engine's CONFIGURED model accepts, or
// every effort any model accepts when none is pinned.
func completeEfforts(engine string) func(context.Context) []string {
	return func(ctx context.Context) []string {
		cfg := config.Read()
		return modelEfforts(engineModels(ctx, engine), cfg.Review.EngineCommon(engine).Model)
	}
}

func modelEfforts(models []catalog.Model, model string) []string {
	var efforts []string
	for _, m := range models {
		if model != "" && m.ID != model {
			continue
		}
		for _, e := range m.Efforts {
			if !slices.Contains(efforts, e.ID) {
				efforts = append(efforts, e.ID)
			}
		}
	}
	return efforts
}
