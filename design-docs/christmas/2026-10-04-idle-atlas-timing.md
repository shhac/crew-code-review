# Idle atlas timing investigation

## Evidence before selecting the fix

Base revision: `140be0dcb9f42a7c545c0a11ad39cf4cc25bd5e8`.
The unchanged requested reproduction was attempted first, from
`internal/dashboard/ui`:

```sh
npx --no-install playwright test -c playwright.lab.config.ts lab-tests/robin-atlas.spec.ts:16 --repeat-each 20
```

Vite failed to bind `127.0.0.1:5179` with `listen EPERM`. Zero repeats
completed; no browser launched. This is infrastructure failure, not a frame
assertion failure, and does not reproduce the owner's intermittent failure.

Before editing the spec, controlled tests exercised the real `sceneLoop` and
`createAtlasIdlePlayback` together, with an injected clock and explicitly
dispatched animation frames. Their sample records distinguish the orderings:

| Ordering | Last paused sample | First resumed sample/epoch | Frame at 51600 | Frame at epoch + 1600 |
| --- | --- | --- | --- | --- |
| Resume before clock advance | 50000, reduced, I0 | 50000, animated, I0 | I1 | I1 |
| Clock advance before resume draw | 50000, reduced, I0 | 51600, animated, I0 | I0 | I1 |

In both cases, I0 is observable immediately after the preference events,
before the pending draw has executed. Rapid preference invalidations retain
one pending frame. Both players select I0 at epoch + 4800; stopping cancels
the pending frame and a stale callback does not draw.

This demonstrates a test setup race capable of producing the reported result:
the old I0 assertion does not establish the resumed epoch. Playback selects the
correct frame for elapsed time measured from its actual epoch. It does not
demonstrate a production playback defect. The production layer uses
`performance.now()` through the same clock seam, but its actual browser/Svelte
execution has **not** been measured here. Browser confirmation of this causal
explanation remains required; the controlled tests alone do not exclude every
possible production defect.

## Selected change

Only test code changes. Both reduced-motion transitions now register a
preference-event barrier before emulation, then wait through its scheduled
animation frame and the following frame so the scene draw and Svelte microtask
flush have completed at the fixed manual time. Visibility resume waits through
the same frame boundary after its synchronous event. The I0/I1 assertions,
durations, artwork and production playback remain unchanged. No sleeps,
retries or timeout increases were added.

The barrier regression controls preference delivery, promise jobs and frame
dispatch. It asserts that the helper cannot finish at the stale paused I0.
Temporarily replacing the helper with the previous unsynchronized
`emulateMedia` call failed at `expect(finished).toBe(false)` (received true).
The synchronization was restored. Both preference directions are covered.
Existing atlas boundary, fallback, movement, rewind and lifecycle tests remain.

## Verification, 2026-10-04

Verification used the base SHA above with an uncommitted working tree. No
commit was created, per task instructions. These SHA-256 hashes identify the
tested code (paths relative to `internal/dashboard/ui`):

```text
742f18d84e434b67ef8b1f75e4774c32c629f106cc333b3320c4b9564b30b538 lab-tests/robin-atlas.spec.ts
29d7969a4bc1c55c1864d05f7df1ffb97a2fee7c45b095c51646fa3c999dbad2 lab-tests/scene-resume.ts
58ccb0086ddac83ba88a1c68eafaa430919b6e1ab60e8365c1bc88ce48cf8e64 src/lib/theme/lifecycle.test.ts
f45227b83092f2bd8da865bca7b3935631dd4d212614dd3036e249a262643b2c src/lib/theme/scene-resume.test.ts
```

- `go vet ./...`: passed.
- `go test ./... -count=1`: passed.
- `npm --prefix internal/dashboard/ui test`: 41 files, 430 tests passed.
- `npm --prefix internal/dashboard/ui run check`: 0 errors, 3 existing warnings.
- `make dashboard`: passed; regenerated assets match the committed bundle
  (no asset changes in working-tree status).
- Final hosted `run_check`: exit 0, Go tests and svelte-check passed,
  workspaces `checks/run-1203768872/tree` and final rerun
  `checks/run-963210048/tree`. Its output does not include browser
  tests, so it does not satisfy browser acceptance.
- `npx --no-install playwright test -c playwright.lab.config.ts lab-tests/robin-atlas.spec.ts:16 --repeat-each 30`:
  Vite bind EPERM; zero repeats completed.
- `npx --no-install playwright test -c playwright.lab.config.ts`:
  Vite bind EPERM; zero browser tests completed.

Browser/version: unavailable, because all browser commands failed before
launch. Playwright dependency is 1.62.1. No daemon, production data, network,
deployment or integration was used.

## Remaining team verification

On a browser-capable seat, record the task's resulting exact revision and
working-tree state, browser/version and results. Run the unchanged baseline
20-repeat reproduction, capture actual preference/sample/reset/epoch/render
ordering, and compare both manual-clock orderings with the normal production
clock in the synthetic lab. Then verify the final 30-repeat command with zero
retries and the full lab suite, followed by the project check. This draft is
not browser-accepted; neither the failed startup nor the partial diagnosis
counts as a successful reproduction or a completed acceptance run.
