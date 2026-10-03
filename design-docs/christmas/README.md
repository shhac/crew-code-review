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
CCR-3 is queued depending on CCR-2: wiping, recovery, robin reactions/movement
and final interactive acceptance belong there, not to this phase.

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

## Follow-up contract

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

## Validation

Use npm run dev and /lab/scene.html, never the daemon. Compare desktop/narrow
screenshots to the original; check cramped headings, empty/changed geometry,
scroll/resize, click-through and repeated theme switching. Unit tests pin snow
caps and safe perches; Go tests pin calendar and overrides. Regenerate the
committed bundle after source changes. Full interactive acceptance is CCR-3.

Phase-one check record: go vet ./... and go test ./... passed. Svelte-check
passed (zero errors; three existing warnings outside this feature). All 325
frontend tests passed, including existing spider/gait/silk tests. Removing
December activation, the heading snow cap or the safe-perch clearance guard
each made its regression tests fail; all mutations were restored. The dashboard
bundle was rebuilt and a second build produced identical filenames and hashes.

Browser execution and visual acceptance remain pending: this sandbox rejected
Vite's localhost bind with EPERM. On an unrestricted machine, from
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
rail-contract assertion fail. Execution and screenshot comparison remain the
owner's assigned post-landing check, not a claimed browser pass.
