package cli

import (
	"context"

	libcli "github.com/shhac/lib-agent-cli/cli"
	"github.com/spf13/cobra"

	"github.com/shhac/crew-code-review/internal/config"
	"github.com/shhac/crew-code-review/internal/review"
)

var (
	boolValues          = []string{"true", "false"}
	engineValues        = review.Engines
	sandboxValues       = []string{"read-only", "workspace-write", "danger-full-access"}
	tailscaleModeValues = []string{"serve", "funnel"}

	// Model ids and efforts complete from each engine's own catalog (see
	// models.go). Claude's effort is still VALIDATED against a fixed list,
	// because it is pinned by default and a typo there fails every review.
	claudeEffortValues = []string{"low", "medium", "high", "xhigh", "max"}
	// Only the non-interactive modes: `plan` produces no review and `manual`
	// waits for an approval no headless run can give. `auto` is the default;
	// the rest are static allow-list modes for a tighter or looser run.
	claudePermissionModeValues = []string{"auto", "acceptEdits", "dontAsk", "bypassPermissions"}
	// Grok's own permission modes, as `grok --help` lists them, less `plan`
	// for the same reason as claude's.
	grokPermissionModeValues = []string{"default", "acceptEdits", "auto", "dontAsk", "bypassPermissions"}
)

// configKeySpec describes one editable scalar once: the lib-agent-cli key
// drives get/set/unset, while complete supplies its known values when there
// are any. This keeps validation and shell completion from evolving apart.
type configKeySpec struct {
	key      libcli.ConfigKey
	complete func(context.Context) []string
}

func registerConfig(root *cobra.Command) {
	specs := configKeySpecs()
	keys := configKeysFromSpecs(specs)
	// WithDocument: this config outlives the release that wrote it, so it can
	// hold a key we renamed or never knew. get and unset reach those; set
	// deliberately does not. The library decides by the registry, so a plain
	// typo still gets its list of valid names.
	cmd := libcli.ConfigCommand(globals, keys, libcli.WithDocument(config.Store(), config.Config{}))
	attachConfigCompletions(cmd, specs)
	cmd.Short = "Get and set configuration (also: init, path, show)"
	cmd.AddCommand(
		&cobra.Command{
			Use:   "init",
			Short: "Write an annotated starter config (refuses to overwrite)",
			Args:  cobra.NoArgs,
			RunE: func(_ *cobra.Command, _ []string) error {
				path, err := config.Init()
				if err != nil {
					return err
				}
				return emit(map[string]string{"created": path, "next": "add repos via 'repos add', define cohorts under authors.groups, roster people via 'authors set', set prompts via 'prompts set'"})
			},
		},
		&cobra.Command{
			Use:   "path",
			Short: "Print the config file path",
			Args:  cobra.NoArgs,
			RunE: func(_ *cobra.Command, _ []string) error {
				return emit(map[string]string{"path": config.Path()})
			},
		},
		&cobra.Command{
			Use:   "show",
			Short: "Print the current resolved config",
			Args:  cobra.NoArgs,
			RunE: func(_ *cobra.Command, _ []string) error {
				return emit(config.Read())
			},
		},
	)
	registerGroupUsage(cmd, "config", configUsageText)
	root.AddCommand(cmd)
}

func configKeysFromSpecs(specs []configKeySpec) []libcli.ConfigKey {
	keys := make([]libcli.ConfigKey, 0, len(specs))
	for _, spec := range specs {
		keys = append(keys, spec.key)
	}
	return keys
}

func configKeySpecs() []configKeySpec {
	plain := func(key libcli.ConfigKey) configKeySpec { return configKeySpec{key: key} }
	static := func(key libcli.ConfigKey, values []string) configKeySpec {
		return configKeySpec{key: key, complete: func(context.Context) []string { return values }}
	}
	return []configKeySpec{
		plain(stringKey("gh_user", "GitHub login used for the self-review rule (empty = derive via `gh api user`)",
			func(c *config.Config) *string { return &c.GHUser }, nil)),
		static(optionalBoolKey("schedule.enabled", "Whether the serve daemon dispatches reviews (default true)",
			func(c *config.Config) **bool { return &c.Schedule.Enabled }), boolValues),
		plain(stringKey("schedule.interval", "Idle poll as a Go duration: how long the dispatcher waits when nothing is ready (default 30s)",
			func(c *config.Config) *string { return &c.Schedule.Interval }, validateDuration)),
		plain(stringKey("schedule.dispatch_cooldown", "Pause between dispatches as a Go duration (default 5s, 0s disables)",
			func(c *config.Config) *string { return &c.Schedule.DispatchCooldown }, validateHoldDuration)),
		static(optionalBoolKey("discovery.enabled", "Whether the serve daemon scrapes repos for candidates (default true)",
			func(c *config.Config) **bool { return &c.Discovery.Enabled }), boolValues),
		plain(stringKey("discovery.interval", "Candidate-scraping cadence as a Go duration (default 5m; deterministic gh calls, no LLM)",
			func(c *config.Config) *string { return &c.Discovery.Interval }, validateDuration)),
		plain(optionalIntKey("discovery.list_limit", "How many open PRs one repo's sweep pulls, newest activity first (default 300; gh pages at 100, so this is the per-repo page budget)",
			func(c *config.Config) **int { return &c.Discovery.ListLimit }, 1, 1000)),
		plain(stringKey("discovery.sweep_budget", "Wall-time cap on one sweep as a Go duration (default: discovery.interval; the next sweep resumes at the repo this one could not reach)",
			func(c *config.Config) *string { return &c.Discovery.SweepBudget }, validateDuration)),
		plain(intKey("schedule.max_parallel", "Max PRs reviewed concurrently (default 4)",
			func(c *config.Config) *int { return &c.Schedule.MaxParallel }, 1, 32)),
		plain(intKey("candidates.new_max_age_days", "Age window for New candidates (default 14)",
			func(c *config.Config) *int { return &c.Candidates.NewMaxAgeDays }, 1, 365)),
		plain(intKey("candidates.refreshed_max_age_days", "Age window for Refreshed candidates (default 21)",
			func(c *config.Config) *int { return &c.Candidates.RefreshedMaxAgeDays }, 1, 365)),
		plain(intKey("candidates.discussion_max_age_days", "Age window for Discussion candidates (default 14)",
			func(c *config.Config) *int { return &c.Candidates.DiscussionMaxAgeDays }, 1, 365)),
		plain(stringKey("candidates.rereview_cooldown", "Hold after one of our own reviews before re-discovery, as a Go duration (default 90m, 0s disables)",
			func(c *config.Config) *string { return &c.Candidates.RereviewCooldown }, validateHoldDuration)),
		plain(stringKey("candidates.quiet_period", "How long a PR must go untouched before discovery accepts it, as a Go duration (default 15m, 0s disables)",
			func(c *config.Config) *string { return &c.Candidates.QuietPeriod }, validateHoldDuration)),
		plain(stringKey("candidates.steering_hold", "How long an open steering editor defers the PR being edited, as a Go duration (default 5m, 0s disables)",
			func(c *config.Config) *string { return &c.Candidates.SteeringHold }, validateHoldDuration)),
		static(optionalBoolKey("candidates.require_review_request", "Whether a PR needs an outstanding review request to be discovered (default false: any open non-draft PR is ready; true requires somebody to have asked)",
			func(c *config.Config) **bool { return &c.Candidates.RequireReviewRequest }), boolValues),
		plain(stringKey("candidates.error_backoff", "How long a PR waits after a failed engine attempt before one retry, as a Go duration (default 15m, 0s retires it on the first error)",
			func(c *config.Config) *string { return &c.Candidates.ErrorBackoff }, validateHoldDuration)),
		static(stringKey("review.engine", "Review engine (default codex)",
			func(c *config.Config) *string { return &c.Review.Engine }, validateOneOf("engine", engineValues)), engineValues),
		plain(stringKey("review.workspace_retention", "How long a review's workspace (and its agent transcript) is kept before the boot sweep removes it, as a Go duration (default 720h, 0s keeps everything)",
			func(c *config.Config) *string { return &c.Review.WorkspaceRetention }, validateHoldDuration)),
		plain(stringKey("codex.bin", "Codex binary (default codex)",
			func(c *config.Config) *string { return &c.Review.Codex.Bin }, nil)),
		plain(stringKey("codex.home", "Codex home, its config and login directory (default: the CLI's own, CODEX_HOME or ~/.codex)",
			func(c *config.Config) *string { return &c.Review.Codex.Home }, nil)),
		configKeySpec{key: stringKey("codex.model", "Model passed to codex exec --model",
			func(c *config.Config) *string { return &c.Review.Codex.Model }, nil), complete: completeModels("codex")},
		configKeySpec{key: stringKey("codex.effort", "Reasoning effort passed as Codex model_reasoning_effort (empty = model default)",
			func(c *config.Config) *string { return &c.Review.Codex.Effort }, nil), complete: completeEfforts("codex")},
		static(stringKey("codex.sandbox", "Codex sandbox mode (default workspace-write)",
			func(c *config.Config) *string { return &c.Review.Codex.Sandbox }, validateOneOf("sandbox mode", sandboxValues)), sandboxValues),
		plain(optionalIntKey("codex.max_resumes", "Resume nudges when a codex run ends on an intermediate WORKING report (default 2, 0 disables)",
			func(c *config.Config) **int { return &c.Review.Codex.MaxResumes }, 0, 10)),
		plain(optionalIntKey("codex.usage_floor.5h_percent", "Hold codex's candidates when its 5 hourly window has less than this % remaining (default 10, 0 disables)",
			func(c *config.Config) **int { return &c.Review.Codex.UsageFloor.FiveHourPercent }, 0, 100)),
		plain(optionalIntKey("codex.usage_floor.1w_percent", "Hold codex's candidates when its weekly window has less than this % remaining (default 10, 0 disables)",
			func(c *config.Config) **int { return &c.Review.Codex.UsageFloor.OneWeekPercent }, 0, 100)),
		plain(usageFloorKey("codex", func(c *config.Config) *config.UsageFloorLimits { return &c.Review.Codex.UsageFloor })),
		plain(stringKey("claude.bin", "Claude Code binary (default claude)",
			func(c *config.Config) *string { return &c.Review.Claude.Bin }, nil)),
		plain(stringKey("claude.home", "Claude Code config and login directory (default: the CLI's own, CLAUDE_CONFIG_DIR or ~/.claude)",
			func(c *config.Config) *string { return &c.Review.Claude.Home }, nil)),
		configKeySpec{key: stringKey("claude.model", "Model passed to claude --model (alias or full id; default claude-opus-5-5)",
			func(c *config.Config) *string { return &c.Review.Claude.Model }, nil), complete: completeModels("claude")},
		static(stringKey("claude.effort", "Reasoning effort passed to claude --effort (default medium)",
			func(c *config.Config) *string { return &c.Review.Claude.Effort }, validateOneOf("effort", claudeEffortValues)), claudeEffortValues),
		static(stringKey("claude.permission_mode", "Claude permission mode, the analogue of codex.sandbox (default auto: a classifier vets each action, no allow-list needed)",
			func(c *config.Config) *string { return &c.Review.Claude.PermissionMode }, validateOneOf("permission mode", claudePermissionModeValues)), claudePermissionModeValues),
		plain(floatKey("claude.max_budget_usd", "Hard per-invocation ceiling passed to claude --max-budget-usd (0 = uncapped)",
			func(c *config.Config) *float64 { return &c.Review.Claude.MaxBudgetUSD }, 0, 1000)),
		plain(optionalIntKey("claude.max_resumes", "Resume nudges when a claude run ends without a final report (default 2, 0 disables)",
			func(c *config.Config) **int { return &c.Review.Claude.MaxResumes }, 0, 10)),
		plain(optionalIntKey("claude.usage_floor.5h_percent", "Hold claude's candidates when its 5 hourly window has less than this % remaining (default 10, 0 disables)",
			func(c *config.Config) **int { return &c.Review.Claude.UsageFloor.FiveHourPercent }, 0, 100)),
		plain(optionalIntKey("claude.usage_floor.1w_percent", "Hold claude's candidates when its weekly window has less than this % remaining (default 10, 0 disables)",
			func(c *config.Config) **int { return &c.Review.Claude.UsageFloor.OneWeekPercent }, 0, 100)),
		plain(usageFloorKey("claude", func(c *config.Config) *config.UsageFloorLimits { return &c.Review.Claude.UsageFloor })),
		plain(stringKey("grok.bin", "Grok binary (default grok)",
			func(c *config.Config) *string { return &c.Review.Grok.Bin }, nil)),
		plain(stringKey("grok.home", "Grok home, its config and login directory (default: the CLI's own, GROK_HOME or ~/.grok)",
			func(c *config.Config) *string { return &c.Review.Grok.Home }, nil)),
		configKeySpec{key: stringKey("grok.model", "Model passed to grok --model (empty = the CLI's default)",
			func(c *config.Config) *string { return &c.Review.Grok.Model }, nil), complete: completeModels("grok")},
		configKeySpec{key: stringKey("grok.effort", "Reasoning effort passed to grok --reasoning-effort (empty = model default)",
			func(c *config.Config) *string { return &c.Review.Grok.Effort }, nil), complete: completeEfforts("grok")},
		plain(stringKey("grok.sandbox", "Grok sandbox profile passed to grok --sandbox (default workspace: writes confined to the per-PR workdir, network left for gh)",
			func(c *config.Config) *string { return &c.Review.Grok.Sandbox }, nil)),
		static(stringKey("grok.permission_mode", "Grok permission mode passed to grok --permission-mode (default auto: a classifier vets each action; default, acceptEdits and dontAsk cancel a headless run at its first gh call)",
			func(c *config.Config) *string { return &c.Review.Grok.PermissionMode }, validateOneOf("permission mode", grokPermissionModeValues)), grokPermissionModeValues),
		static(stringKey("grok.telemetry", "Grok telemetry policy: reduced (default: client telemetry, trace upload and imports of other harnesses' config off for the run) or standard (the CLI's own behaviour)",
			func(c *config.Config) *string { return &c.Review.Grok.Telemetry }, validateOneOf("telemetry policy", config.GrokTelemetry)), config.GrokTelemetry),
		plain(optionalIntKey("grok.max_resumes", "Resume nudges when a grok run ends without a final report (default 2, 0 disables)",
			func(c *config.Config) **int { return &c.Review.Grok.MaxResumes }, 0, 10)),
		plain(stringKey("dashboard.addr", "Dashboard listen address (default 127.0.0.1:8330; bind wider only deliberately, the dashboard has no auth of its own)",
			func(c *config.Config) *string { return &c.Dashboard.Addr }, nil)),
		static(stringKey("dashboard.tailscale.mode", `Tailscale exposure: "", "serve", or "funnel"`,
			func(c *config.Config) *string { return &c.Dashboard.Tailscale.Mode }, validateOneOf("tailscale mode", tailscaleModeValues)), tailscaleModeValues),
		plain(stringKey("dashboard.usage_poll_interval", "Engine usage refresh cadence as a Go duration (default 10m)",
			func(c *config.Config) *string { return &c.Dashboard.UsagePollInterval }, validateDuration)),
		static(stringKey("dashboard.theme", "Seasonal dashboard decorations: auto (default: the northern lights in January, an Easter egg hunt in April, Halloween in October, Bonfire Night in November, Christmas in December), none, or a set by name to force it on",
			func(c *config.Config) *string { return &c.Dashboard.Theme }, validateOneOf("dashboard theme", config.Themes)), config.Themes),
		plain(stringKey("store.path", "DuckDB file path (default under XDG data dir)",
			func(c *config.Config) *string { return &c.Store.Path }, nil)),
		static(stringKey("scoring.mode", "Global scoring switch: enabled (measure and score), leaderboard-only (stop measuring, keep showing the standings), disabled (also hide the leaderboard)",
			func(c *config.Config) *string { return &c.Scoring.Mode }, validateOneOf("scoring mode", config.ScoringModes)), config.ScoringModes),
		plain(optionalFloatKey("scoring.piece_lines", "Changed lines that earn the most points PER LINE (default 50): the size to aim for when splitting a large change into a stack",
			func(c *config.Config) **float64 { return &c.Scoring.PieceLines }, 1, 1e6)),
		plain(optionalFloatKey("scoring.size_points", "The most a single PR can earn for its size alone (default 100), which sets the scale of the whole board",
			func(c *config.Config) **float64 { return &c.Scoring.SizePoints }, 0.0001, 1e6)),
		plain(optionalFloatKey("scoring.size_falloff", "How sharply a PR stops being worth more as it grows (default 3; must be above 2, higher widens the gap between a stack and one big PR)",
			func(c *config.Config) **float64 { return &c.Scoring.SizeFalloff }, 2.0001, 12)),
		plain(optionalFloatKey("scoring.removal_points_per_100", "Points for a hundred NET removed lines (default 20), paid on top of the size reward and independent of it",
			func(c *config.Config) **float64 { return &c.Scoring.RemovalPointsPer100 }, 0, 1e6)),
		plain(optionalFloatKey("scoring.attempt_decay", "Per-revision decay, so a first-pass approval beats the same approval after rounds of comments (default 0.4; must be under 1)",
			func(c *config.Config) **float64 { return &c.Scoring.AttemptDecay }, 0.0001, 0.9999)),
		plain(optionalFloatKey("scoring.verdicts.approved", "Multiplier for an approval (default 1.0)",
			func(c *config.Config) **float64 { return &c.Scoring.Verdicts.Approved }, -100, 100)),
		plain(optionalFloatKey("scoring.verdicts.commented", "Multiplier for a comment-only review (default 0.25)",
			func(c *config.Config) **float64 { return &c.Scoring.Verdicts.Commented }, -100, 100)),
		plain(optionalFloatKey("scoring.verdicts.requested_changes", "Multiplier for requested changes (default -0.25; negative means a rejected round costs points)",
			func(c *config.Config) **float64 { return &c.Scoring.Verdicts.RequestedChanges }, -100, 100)),
		static(optionalBoolKey("scoring.use_gitattributes", "Read the repo's own .gitattributes to exclude linguist-generated and linguist-vendored files from the size (default true)",
			func(c *config.Config) **bool { return &c.Scoring.UseGitattributes }), boolValues),
	}
}
