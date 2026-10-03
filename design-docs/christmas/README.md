# December scene: design 1

Studied design-docs/halloween and its originals, config/theme.go, App's rail and
scene, floors.ts, HalloweenLayer, Spider, spiderwalk and strands. Halloween
separates illustrated art from movement and silk. Stable element IDs, clearance
and card walls are the shared foundation; silk remains spider-specific.

Choose Juniper's quiet ledge snow and one European robin. Ledge snow gives
localized interaction without veiling controls. Cleared frost would cover text
and require masks; disturbed snowfall competes with charts. A robin has a warm,
recognizable winter silhouette at small scale. A wren is less distinctive, a
squirrel needs more space and complex locomotion, and a deer dominates the UI.
The supplied SVG is preserved unchanged here; no web sources or generated art
were needed. Extracted symbols retain all definitions and untrimmed cells.

## Approved phases

CCR-2 delivers December activation, shared geometry and the still composition.
CCR-3 depends on CCR-2 and implements wiping, recovery and robin reactions/
movement below. Owner verification of draft 2 (e926638) completes acceptance:
all eleven Vite-only Chromium tests passed without the daemon, and all ten
unobscured 1440px/480px screenshots matched design 1.

Snow clips to left+8/right-8, tapers and leaves irregular clear stretches.
It rises above measured edges, normally 3–7px, capped at 9px and room minus
4px; headings cap at 3px. Skip insufficient clearance. Seed by stable ledge ID
and local position so scrolling preserves shape. Never bridge gaps or coat walls.

Robin uses the supplied 128×112 cell at .35 scale, anchor (64,100), mirrored
about its feet. Visible walkable perches need 42px clearance and 24px inset.
Prefer exposed ends, reserve a 20px snow-free foot patch, preserve local offsets
and relocate immediately or hide when invalid. One holly sprig uses the supplied
96×64 cell at 48×32, baseline y=55, above rail identity. Champagne accents
preserve surfaces, charts and status colors. The fixed aria-hidden overlay sits
below dialogs, snow behind bird, and never intercepts clicks. Reduced motion
shows the same still scene.

## Completed interaction

Moving mouse or hovering pen wipes complete segments, radius 24px with 8px soft
falloff. Ignore touch/contact and stationary pointers; reset origin on layout
changes or exit. Recovery waits 1.5s then approaches the seed with a four-second
half-life, never overshooting. No particles. Keep simulation pure and time-based.

Robin rests 6–12s, hops 18–32px in 220–320ms with 6–10px rise. Optional
450–750ms flights are separated by 12–20s; reject routes crossing cards, charts
or text. Moving cursors alert within 90px and trigger escape within 48px, with
action immunity and 2s cooldown. Rest resumes after 3s without nearby movement.
Use supplied alert/flight poses, never spider climbing or silk. Reduced motion
disables wiping, recovery animation and animal movement.

Snow stores seeded targets and the last affected depth/time per local sample.
Rendering evaluates recovery analytically, so skipped frames and long elapsed
intervals do not change the result. Overlapping strokes never deepen snow and
renew only affected samples' delay. The foot patch is applied at rendering;
moving the bird reveals the original profile rather than permanently clearing it.

The pure robin model receives time, randomness, ledges and obstacle rectangles.
Routes use a conservative continuous envelope containing the bird, arc and
rotated wing. It can reject a route that a more precise path would permit;
remaining perched is preferable to crossing content. Perches also reject content
overlap. Flight rendering groups only the supplied raised-wing paths and rotates
that group by at most five degrees about (64,57); all cells and anchors remain.

Passive pointer subscriptions and the single-frame lifecycle are shared with
Halloween. Its existing movement-expiry and gait rules remain unchanged. Dirty
layout reads are deferred to frames, with periodic comparisons for CSS-only
changes, including obstacle changes without ledge movement. Invalidations reset
pointer history immediately. Remeasurement retains compatible snow samples,
discards removed ledges, cancels interrupted routes and relocates or hides the
bird. Backgrounding stops scheduling and resets history; returning remeasures,
uses actual elapsed recovery time and cancels missed animal actions. Preference
changes restore seeded snow and still perching, without duplicate loops.

Stopping/reloading loses only ephemeral decoration state. Nothing is persisted
and no daemon records are read or written. Empty geometry hides snow and bird
while preserving the responsive holly shelf. Cleanup cancels frames and timers,
removes listeners and disconnects observers; stopped callbacks cannot restart a
scene. If source/bundle generation is interrupted, rebuild the entire bundle and
rerun freshness checks before considering the checkout verified.

## CCR-3 acceptance record (2026-10-03)

Commands executed without the daemon or network:

- `GOPROXY=off GOSUMDB=off go vet ./...`: passed.
- `GOPROXY=off GOSUMDB=off go test ./... -count=1`: passed.
- `npm --prefix internal/dashboard/ui run check`: zero errors, three existing
  warnings outside this feature.
- `npm --prefix internal/dashboard/ui test`: 356 tests passed in 31 files,
  including Halloween gait, spider, strands, geometry and shelf coverage.
- The lab tests and Playwright config also passed a standalone TypeScript
  check (`tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler
  --types node --skipLibCheck lab-tests/christmas.spec.ts playwright.lab.config.ts`).
- `make dashboard`, twice: passed; every output filename and SHA-256 content
  hash was identical between builds (seven bundle files).
- From `internal/dashboard/ui`,
  `./node_modules/.bin/playwright test --config playwright.lab.config.ts --list`:
  eleven synthetic lab tests discovered, including 1440px/480px capture paths
  and an actual-DOM standalone-text route regression.
- `./node_modules/.bin/playwright test --config playwright.lab.config.ts`:
  historical sandbox attempt blocked before browser startup: Vite's bind to `127.0.0.1:5179` fails with
  `EPERM`. A direct `npm run dev -- --port 5179 --strictPort` has the same
  failure in this sandbox. This is the draft-2 rerun attempt, not the owner's
  successful draft-2 verification described below. The local bind restriction
  is an environment limitation, not an outstanding acceptance requirement.

Regression sensitivity was checked by temporarily removing wiping, the 1.5s
recovery delay, and obstacle collision rejection. Respectively two, two and
three new tests failed; every mutation was restored before the passing suite
and bundle builds. In this revision, removing rendered-text obstacles made
seven new tag-independent regressions fail; the mutation was restored.

| Original criterion | Verification / outcome |
| --- | --- |
| 1. Go vet/test and svelte-check | Passed as listed above. |
| 2. Behavior tests fail without change | Mutation checks above; pure colocated regressions. |
| 3. Task-only changes | Christmas models/integration, narrowly shared lifecycle/pointer subscriptions, geometry, synthetic lab, docs and generated assets only. No config/API/scheduler changes. |
| 4. Depend on phase one, reuse design 1 | CCR-2 is the recorded dependency; original SVG unchanged, existing ledges/profiles/perches/art reused. |
| 5. Complete segments; 24px + 8px; reject/reset | Pointer and wipe tests cover fast segments, core/falloff/boundary, stationary/contact/touch, pen hover, identity and exit/reset. Layout invalidation resets origin before measuring. |
| 6. Delay and half-life; no particles | Analytic depth tests pin 1500ms delay, 4000ms half-life, frame partition independence, overlap and large elapsed times. No particle rendering. |
| 7. Pure robin timing and safe routes | Injected model tests pin both bounds for rests/hops/flights, rise, flight spacing, swept body/wing obstacles and blocked destinations. Rendered-text line rectangles now cover any tag, including bare div, strong, small, dt/dd and summary outside cards. |
| 8. Supplied poses and anchors | Existing 128×112 poses and (64,100) anchor preserved; only supplied wing group rotates at (64,57). Pure pose/anchor assertions pass; the owner accepted all desktop/narrow poses against design 1 in e926638. |
| 9. Cursor reactions and cooldowns | Tests pin alert/facing, escape direction, corner-flight fallback, blocked fallback, action immunity, 2s cooldown and 3s alert expiry. Stationary input creates no segment. |
| 10. Shared helpers and cleanup | Passive listeners and scene loop reused by both themes; loop tests cover background/resume, one frame, stale callbacks and teardown. Existing Halloween suite passes. Disappeared/blocked route tests pass. |
| 11. Reduced motion and transitions | Still profiles, safe perch and existing holly; shared loop preference/visibility tests pass. The updated lab live-preference assertions passed in the owner's eleven-test Chromium run (e926638). |
| 12. Required regressions | Pointer, wipe, robin, obstacle and lifecycle regressions pass; selector-sensitive geometry fixtures and seven standalone-text route regressions close the review finding. |
| 13. Vite browser and screenshot acceptance | Completed by the owner for draft 2 (e926638): 11/11 Vite-only Chromium tests passed without the daemon, including standalone text, blocked routes, strokes/recovery, rejection/reset, click-through, teardown, empty/changed geometry and shelf contracts. All ten unobscured seeded/wiped/recovering/alert/flight screenshots at 1440px and 480px were accepted against design 1. |
| 14. Checks, bundle, docs and explicit verification | Go vet/tests, svelte-check, 356 frontend tests and bundle freshness passed as recorded above. Owner e926638 verification completes browser and screenshot acceptance. Completed interaction and all fourteen criteria are documented; no acceptance checks remain pending. |

Inherited CCR-2 requirements: research/design rationale and December activation
are unchanged; existing calendar/override/opt-out tests pass. Shared geometry,
supplied art, capped snow and safe perches are retained. Winter interaction and
animal behavior now have the implementations and pure tests above. README and
configuration documentation already describe activation; README now describes
completed interaction. The inherited desktop/narrow visual and browser checks
are complete through the owner's draft-2 verification (e926638).

Owner evidence for draft 1 (d28d84b): on the owner's Mac, Chromium ran all ten
Vite-only lab tests successfully at 1440px and 480px without the daemon. This
covered strokes/recovery/rejection/teardown, blocked routes, flight interrupted
by layout and both shelf contracts. The owner compared desktop captures with
design 1 and accepted the snow on card tops, rail holly, corner perch in wiped/
recovery states and mid-air flight. The narrow controls obscured roughly half
of the scene, so that draft's narrow visual acceptance was incomplete; draft 2
resolved it as recorded below.

Review fixes: rendered text is measured through DOM text nodes and Range line
rectangles rather than tag selection, with hidden/empty/malformed rectangles
excluded. Both initial measurement and CSS-only obstacle refresh use that same
function. Selector-sensitive unit fixtures, seven safe-endpoint/intervening-text
regressions and an actual-DOM Vite test cover div, strong, small, dt, dd, summary
and custom tags outside a card. Every seeded/wiped/recovering/alert/flight
screenshot now uses one capture helper that temporarily hides the fixed lab
controls with visibility, preserving layout and simulation state, asserts the
controls are hidden and the robin visible, and restores controls in finally.
No product layout or artwork changes were needed.

Owner evidence for draft 2 (e926638): on the owner's Mac, the updated Vite-only
Chromium suite passed 11/11 without the daemon. The owner inspected all ten
seeded, wiped, recovering, alert and flight screenshots at 1440px and 480px
against design 1 and accepted them with no remaining visual defects:

- The narrow lab panel no longer obscures the scene, resolving draft 1's finding.
- Seeded snow sits along card tops, holly is in the rail, and the robin perches
  at the Stack top corner as designed.
- The wiped cap is cleanly cleared; the owner's seeded/wiped pixel comparison
  changes only the swept card's cap, leaving every other cap untouched.
- A thin snow layer visibly returns in the recovery captures.
- Supplied alert and mid-air flight poses read clearly at both widths.

Historical sandbox bind refusals and reviewer frontend reruns that stopped on
`_svelte_metadata.json` with EPERM occurred before tests could execute. They are
environment limitations, not observed regressions, and do not undo the recorded
passing checks or owner acceptance. This revision changes documentation only;
the accepted runtime, tests, supplied artwork and generated bundle are unchanged.
Artwork regeneration belongs to the separate CCR-4 task and is outside CCR-3.

For future validation, run the lab command above in an environment permitted to
bind localhost, and compare captures against `christmas-current-design.svg`.
Never start the daemon or access its API for these checks. The lab's manual
clock/random controls permit repeating timings without real-time waits. No
additional owner verification is required for this documentation correction.

## Validation

Use npm run dev and /lab/scene.html, never the daemon. Compare desktop/narrow
screenshots to the original; check cramped headings, empty/changed geometry,
scroll/resize, click-through and repeated theme switching. Unit tests pin snow
caps and safe perches; Go tests pin calendar and overrides. Regenerate the
committed bundle after source changes. CCR-3 interactive acceptance is complete
through the owner's e926638 verification.

Phase-one check record: go vet ./... and go test ./... passed. Svelte-check
passed (zero errors; three existing warnings outside this feature). All 325
frontend tests passed, including existing spider/gait/silk tests. Removing
December activation, the heading snow cap or the safe-perch clearance guard
each made its regression tests fail; all mutations were restored. The dashboard
bundle was rebuilt and a second build produced identical filenames and hashes.

Historical phase-one record: browser execution was pending because this sandbox
rejected Vite's localhost bind with EPERM. On an unrestricted machine, from
internal/dashboard/ui run
`npx --no-install playwright test --config playwright.lab.config.ts`.
It launches only npm run dev, exercises desktop/narrow scenes and writes
screenshots. Review those against the original SVG; do not start the daemon.

Review correction: ChristmasShelf now participates in the existing
`.theme-shelf` rail contract, taking the footer's auto margin above identity
and hiding on widths at most 760px or heights at most 640px. The scene lab
uses the actual `.shell/.rail` structure and ViewerChip, with both seasonal
shelves in App's footer order. The Vite-only regressions assert the gap above
identity, space below navigation, narrow/short hiding and opt-out for both
Christmas and Halloween. Removing Christmas's shared class makes the new
rail-contract assertion fail. Those draft-1 browser assertions subsequently
passed in the owner's Chromium run (d28d84b); draft-2 browser and unobscured
narrow screenshot acceptance also passed (e926638).
