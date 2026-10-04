# Native review migration: harness v0.12.0 to v0.24.0

The reviewer continues to use `internal/review/nativeengine.go` and
`native.Run`, with one structured stream per review. No API workbench review
engine is introduced. The published v0.24.0 dependency has no replace directive.

## Sources and release dispositions

H denotes the owner's attached `lah-changes-v0.12-v0.22.md`, full tag commit
messages. There are no v0.13–v0.21 release-note files. R denotes the named file
in the cached published module's `release-notes/`. S denotes comparison of
cached v0.12.0 and v0.24.0 source, principally `native/`, `usage.go`,
`facts.go` and `account/`. These are local sources; no web lookup was used.

| Release | Source | Reviewer disposition |
| --- | --- | --- |
| v0.13.0 | H, S | Background priority and tool images are additive; reviewer leaves Background and Browser unset. |
| v0.13.1 | H | Windows expectations/process test corrections; no caller migration. |
| v0.13.2 | H, S | Background uses nice rather than macOS background band; reviewer does not opt in. |
| v0.14.0 | H, S | ReasoningKnown and Claude thinking accounting apply. Updated equality expectations and injected Review tests. Typed Claude quota cause/reset survive error wrapping. Account inspection uses the library's Grok environment correction; no caller API change. Catalog, replay, API streaming and session login synchronization do not change native.Run. |
| v0.14.1 | H | Library sandbox-aware tests only. |
| v0.14.2 | H | Library Windows missing-file expectation only. |
| v0.15.0 | H, S | Workbench foundation and API routing unused. Native browser addition preserves defaults; reviewer does not enable browser. Native resume startup errors remain failures. |
| v0.16.0 | H | Read-only workbench and session image events unused. |
| v0.17.0 | H | Sandboxed browser capability addition unused. |
| v0.18.0 | H | Session browser proofs/hosted lease cleanup unused by native.Run. |
| v0.19.0 | H, S | Workbench edits/commands and session fixes unused. Process group cleanup now reaps on killed leader/Close, inherited through native execution. No application containment implementation added. |
| v0.20.0 | H | Linux workbench commands, listing/link checks and command environment additions unused. |
| v0.21.0 | H | Session generated-image timeout/browser home changes unused. |
| v0.22.0 | R v0.22.0.md, H | Standalone command sandbox additive, not imported here. |
| v0.23.0 | R v0.23.0.md | Sandbox package extraction retains wrappers. Reviewer has no Release/Reclaim deadline to widen. Library process cleanup changes require no caller API migration. |
| v0.23.1 | R v0.23.1.md | Developer-tool read selectors and session release corrections; native.Run does not use command sandbox. |
| v0.23.2 | R v0.23.2.md | Private TMPDIR git permissions only in command sandbox. |
| v0.23.3 | R v0.23.3.md | Node sysctl allowance in command sandbox; launch sweep correction inherited. |
| untagged v0.23.4 | R v0.23.4.md, S | Command PATH/read-set enforcement and error handles apply only to sandbox commands, not native.Run. See policy below. |
| v0.24.0 | R v0.24.0.md, S | Breaking workbench content-tool refusal is outside the native reviewer surface; documented below. Ships v0.23.4 policy. |

## Capabilities and toolchain policy

On Linux/macOS, API workbench `read_file`, `search_files`, and `edit_file`
are disabled pending verified workspace admission. Standalone
Workspace.Read/Search/Edit refuse with typed `not_offered` before content I/O.
WorkspaceRead and combined WorkspaceWrite are unsupported. API sessions retain
`list_files`, opt-in `write_file`, caller/skill tools and proved commands;
WorkbenchTools includes availability reasons, the model receives an absence
notice, reserved names cannot bypass refusal, and reference hashes remain
compatible. This consumer does not open those sessions or restore those tools.

Native reviews are unaffected by those workbench refusals. Source inspection
of `native.execute` and `nativeEnvironment` shows direct `process.Command`
execution with the selected environment (inherited when unset). Native review
CLI lookup and its child commands, including gh and operator-selected tools,
retain PATH; they do not pass through sandbox.Run/Start's new PATH filter.
The reviewer adds no external read grant because it has no command-sandbox Read
configuration. The selected CLI still owns its own sandbox policy.

For a separately sandboxed project check, v0.23.4 retains only canonical PATH
directories already admitted by Read. External toolchains and runtime files
must be explicitly readable; empty/relative/outside entries are dropped and
the bounded `[harness PATH: ...]` diagnostic must survive failure. On this
machine Go is under `/opt/homebrew`, Node/npm under
`/Users/paul/.nvm/versions/node/v22.22.3`; a host command sandbox must admit
those canonical roots and Go's module/toolchain cache. This repository does
not configure the hosted check's read set. Successful compilation or fake
invocation tests do not prove runtime confinement.

## Compatibility coverage

`migration_test.go` runs concurrent injected native reviews for all three
engines. It checks bounded WORKING resumption, session/nudge/workspace scope,
private Codex report locations, transcript recovery, raw usage and Claude cost.
Reported, explicit zero, absent and incomplete reasoning evidence are distinct;
Codex replaces session totals while Claude/Grok accumulate turns. Claude thinking
is part of output, not an extra charge. A quota refusal preserves typed reset
facts and diagnostic text and never auto-resumes.

Existing configuration/argv tests cover defaults, overrides, schema delivery
and prompt terminators. Existing driver tests cover cancellation, malformed or
missing reports, stale Codex output, failed resumes and resume exhaustion;
transcript goldens remain shared with dashboard parser tests. No persistence
schema change for ReasoningKnown is made; existing usage_raw retains evidence.

See the verification record below for executed checks and limits.

## Verification record (2026-10-04)

Platform: Darwin arm64. `go list -m github.com/shhac/lib-agent-harness`
reports v0.24.0. Go commands used `GOPROXY=off GOSUMDB=off`; dependencies came
from the shared module cache. Only the harness pin/checksums changed in the
module files. No integration tags, real agents, account probes, production
data or GitHub mutations were used.

| Command | Result |
| --- | --- |
| `go mod tidy` (offline) | Passed; published checksums, no replace directives. |
| `go test ./... -count=1` | Passed, all packages. |
| `go vet ./...` | Passed. |
| `go test ./internal/review ./internal/scheduler -race -count=1` | Passed, including concurrent injected streams. |
| `npm --prefix internal/dashboard/ui run check` | Passed: 0 errors, 3 warnings in 3 files. |
| `npm --prefix internal/dashboard/ui test` | Passed: 41 files, 430 tests, including transcript consumers. |
| `go test ./internal/review ./internal/scheduler -json -count=1` | Passed; no skip events. Integration-tagged tests deliberately excluded. |
| `go test ./... -json -count=1` (follow-up) | Passed, exit 0; 14 tested packages, 1,015 passing test/subtest events. Full skip inventory below. |
| Temporary `-modfile` pinned back to v0.12.0, targeted migration tests | Failed compilation: ReasoningKnown, CauseQuotaExhausted and Facts.ResetsAt absent. Temporary module files removed. |
| Hosted `run_check` (poll to completion) | Passed, exit 0; all Go packages and svelte-check, no timeout or truncation. |
| `npm --prefix internal/dashboard/ui run dev -- --port 5179 --strictPort` (historical local attempt) | Refused: `listen EPERM: operation not permitted 127.0.0.1:5179`. |
| Playwright Chromium launch for `/lab/scene.html` (historical local attempt) | Refused before navigation: `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`, SIGTRAP. |
| `npx playwright test -c playwright.lab.config.ts` (owner-reported) | Complete Vite synthetic lab suite: 36 passed, 0 failed on macOS 27 with Chromium, outside the sandbox, exact draft 1 revision `928c4c73648ff16589bed9537326035b43e9b2ee`. |

The hosted check successfully resolved Go and npm; its read-set configuration
is not exposed by run_check and needed no consumer change. The owner-reported
exact-revision run supplies browser evidence; the earlier local refusals are
historical attempts, not an outstanding browser requirement. The owner also
waived a lab rerun provided no files under `internal/dashboard/ui` change.
This follow-up changes only this verification document, so that condition holds.
No UI source or committed dashboard asset changed, so no rebuild was needed.
These results verify the native adapter with fake dependencies, not installed
agents or platform sandbox confinement. Linux and Windows runtime checks were
not run.

### Project-wide skip inventory

The follow-up captured every event from `GOPROXY=off GOSUMDB=off go test ./...
-json -count=1` on Darwin arm64, including each skipped test's output/reason.
There were exactly two `Action: skip` events:

| Package/test | Reason | Coverage disposition |
| --- | --- | --- |
| `cmd/crew-code-review` (package event, no Test field) | `[no test files]` | Not a skipped test or a refused prerequisite. |
| `internal/cli.TestStartDashboardBindConflict` | `serve_test.go:106: environment refused a socket: listen tcp 127.0.0.1:0: bind: operation not permitted` | The real occupied-port startup guard was not exercised locally. This existing CLI socket test is outside native-review migration coverage; do not infer it ran from the overall pass. |

No other ordinary-suite tests skipped. In particular,
`internal/cli.TestScoreAuthorCompletionNeverWritesTheStore` passed: its DuckDB
prerequisite was available. All injected native-review migration tests and
scheduler tests ran; the follow-up also passed `go vet ./...` and
`go test ./internal/review ./internal/scheduler -race -count=1`.
The migration's required Go tests, vet, race tests and svelte-check are verified;
the existing occupied-port test remains locally unverified as identified above.
Hosted run_check reports package results rather than JSON test events, so its
successful exit is not used as evidence that the socket test ran.

Excluded tests are a separate category, not skip events: the eight files
`internal/cli/score_integration_test.go`,
`internal/discover/discover_integration_test.go`,
`internal/review/{claude,codex}_integration_test.go`,
`internal/store/{scoring,steering,store}_integration_test.go`, and
`internal/usage/inspect_integration_test.go` require the `integration` build tag.
That tag was deliberately not enabled; live agent, account and GitHub checks
are outside this task's authorized offline verification. No claim is made
that those integration tests ran.
