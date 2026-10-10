# A seasonal theme for every month, on one shared page geometry

**Date**: 2026-10-08
**Pins**: written against `b903337`. Code-internal; nothing external to pin.
**Status**: being built month by month; a month's heading below says
"(built)" once it is switched on. When first written, October (Halloween) and
December (Christmas) were built and the other ten months and the geometry
consolidation were not started. Revised the same day after a read-only
review by Codex (`gpt-5.6-terra`), which corrected two claims about the code
and tightened the refactor's contract. Since built: February (Valentine's,
2026-10-10), April (Easter egg hunt, 2026-10-10).

## The problem

The dashboard had two seasonal themes, picked by month through
`seasonalThemes` in `internal/config/theme.go`. The other ten months showed
nothing. Each built theme followed the same three-part shape, and new months
should keep it:

1. **Shelf art**: illustrated raster art on the rail shelf.
2. **Ledge quirk**: something that sits along the measured ledges of cards and
   heading rules (Halloween's candle stubs and webs, Christmas's snow).
3. **Animal and activities**: creatures that move between ledges and react
   to the cursor, never covering controls, text or charts (how many, and how
   they are drawn: see "Animals" below).

Every theme also kept the existing constraints: a fixed `aria-hidden` overlay
that never intercepts clicks, sits below dialogs, and shows a still scene
under reduced motion.

## The calendar

Every pick has a fixed month, so the month-keyed map in `theme.go` can hold
all twelve. Easter can fall in late March; an April-long egg hunt still works.

### January: Northern lights

- **Shelf**: a thermos, a woolly hat and mittens, a mug of cocoa.
- **Ledges**: a thin rim of frost that glints, tinted by the aurora's current
  colour.
- **Animal**: an Arctic fox sleeps curled on a ledge. Its ear twitches when the
  cursor passes; if the cursor stays close it wakes, stretches and trots to
  another ledge. Now and then it makes a mousing pounce on its own. The aurora
  ripples slowly in the header band.

### February: Valentine's (built)

- **Shelf**: a box of chocolates, a single rose, a heart-shaped card.
- **Ledges**: a few rose petals, plus spent arrows stuck in ledge edges that
  wobble, then fade.
- **Animal**: two cupids hover and flit between spots. When the cursor goes
  still, one draws and aims at it, then fires along an arc into the nearest
  ledge, where the arrow pops into a few hearts. A fast-moving cursor makes
  them dodge. Arrows land in ledges only, never in a card, chart or text.
  Hovering is a new rest state; the robin only perches. Two or three cupids,
  by the group rule. The first fliers on the rig; their airspace contract and
  sources are in `design-docs/valentine/`.

### March: Mad March hares

- **Shelf**: a pot of daffodils.
- **Ledges**: tufts of grass and daffodil shoots.
- **Animal**: two hares box on a wide ledge, then chase each other ledge to
  ledge in bounding leaps. When the cursor comes near they freeze with ears
  up, then bolt.

### April: Easter egg hunt (built)

- **Shelf**: a basket, chicks.
- **Ledges**: eggs tucked into ledge ends, revealed on hover, with a found/total
  counter in the top bar. The counter is decorative and session-only: nothing
  is persisted, a reload starts a new hunt, and it stays `aria-hidden` like
  the rest of the overlay.
- **Animal**: a rabbit hops between ledges and sometimes leaves a new hidden
  egg behind it. Built as two or three European rabbits; sources and method
  are in `design-docs/easter/`.

### May: Bluebell wood

- **Shelf**: bluebells.
- **Ledges**: moss with small clumps of bluebells.
- **Animal**: a bumblebee bumbles from flower to flower, dodges the cursor, and
  now and then bonks into a card wall and bounces off.

### June: Village fête

- **Shelf**: a Victoria sponge with a rosette, a coconut shy, jam jars.
- **Ledges**: bunting strung across the gaps between ledges, swaying when the
  cursor brushes it.
- **Animal** (optional): a wasp circles the cake. Chased off by the cursor, it
  comes back a little later. June works without any animal.

### July: Wimbledon

- **Shelf**: strawberries and cream, a jug of Pimm's, a racquet.
- **Ledges**: grass-court white lines.
- **Animal**: pigeons wander the ledges until a Harris hawk sweeps through and
  scatters them (the championships fly one for exactly this). Every so often a
  ball rallies between two cards, and the cursor can intercept it.

### August: Seaside

- **Shelf**: chips in paper, a bucket and spade, a 99 ice cream.
- **Ledges**: sand drifts with the odd shell.
- **Animal**: a herring gull struts along the ledges eyeing the cursor. Left
  still for too long, the cursor gets swooped at; the gull then lands with a
  squawk.

### September: Harvest

- **Shelf**: a scarecrow, marrows, apples, a wheat sheaf.
- **Ledges**: scattered straw and grain.
- **Animal**: crows land and peck at the grain. Moving the cursor near the
  scarecrow makes it flap its arms and scatter them; they drift back after a
  cooldown.

### October: Halloween (built)

- **Shelf**: pumpkins, candles.
- **Ledges**: candle stubs and webs.
- **Animal**: spiders walk the ledges, hang from silk and leave strands.
  Sources and method are in `design-docs/halloween/`.

### November: Guy Fawkes

- **Shelf**: a bonfire with the guy on top, a Catherine wheel, toffee apples.
- **Ledges**: glowing embers that cool to ash.
- **Animal**: a hedgehog shelters in a small unlit woodpile on a ledge, well
  away from the bonfire, peeks out when the cursor is still, then trots along
  the ledge. (Not out of the bonfire itself: that reads as an animal escaping a
  lit fire.) Fireworks burst occasionally, confined to the header band.
  Poppies stay out: Remembrance falls in the same month and is not decoration.
- **Before building**, November's own note must define:
  - **Fireworks policy**: sparse cadence, a cap on particles and on the area
    lit at once, no flash-like brightness jumps, no sound, and a still
    composition under reduced motion. The header band must exclude heading
    text and controls; being click-through does not stop a burst covering
    them visually.
  - **Hedgehog locomotion**: a small, pure, ledge-only walker with its own
    width, clearance, ends and cursor policy, and a resting pose for reduced
    motion. Not the robin's model (hops, flight curves, wing envelopes) and not
    the spider's (wall climbing, drops, silk).
  - **Bonfire**: its own art anchors, glow bounds and a cap on how much light
    it throws; the candle `Flame` is calibrated for wicks and a 3.4x glow, so
    it is a starting point, not something to multiply.
  - **Embers**: may share snow's per-ledge sampling and stable seeding, not
    its semantics; they avoid headings and text, budget for glow above the
    ledge, and are static under reduced motion.

### December: Christmas (built)

- **Shelf**: tree, presents, holly.
- **Ledges**: snow that the cursor wipes and that recovers.
- **Animal**: two robins rest, hop, fly and react to the cursor. Design and
  phases are in `design-docs/christmas/`.

## One source of truth for the page's geometry

Twelve themes each measuring the page their own way would drift apart: a ledge
one animal can stand on would be missing, or a different shape, for the next.

### Where things stood at `b903337`

- `lib/theme/floors.ts` alone decided where ledges and walls were
  (`measureFloors`). Both layers called it. Only Christmas also called
  `measureObstacles` (text, charts and controls the robins must not cross);
  Halloween never measured obstacles.
- Each ledge carried a shared `walkable` flag: false when another ledge sat
  less than `HEADROOM = 34` px above it. That number was the spider's body
  height, yet every consumer read it. Spiders used it to route; Christmas's
  snow and robin perches (`eligible` in `christmas/snow.ts`) also rejected
  unwalkable ledges, so the robin inherited the spider's gate. The robin's own
  numbers were different in kind: a perch must sit at least 42 px below the
  top of the viewport and 24 px in from the ledge ends, and its clearance from
  text and controls is checked against obstacles (37 px perched, 59 px in
  flight).
- Blocked ledges stayed in the map on purpose: candles and snow render on
  them, and spiders use a blocked card's walls.
- Ledge ids came from a `WeakMap` over elements, stable while an element
  lives. Snow seeds and candle placement depend on that.
- Each layer kept its own measuring cadence. Halloween re-measured ledges at
  most every 250 ms while animating. Christmas measured ledges and obstacles
  together on invalidation, plus a one-second check for CSS-only changes that
  only invalidates when the geometry actually differs (so a robin mid-hop is
  not reset every second).

### The change

1. **One snapshot type, measured in one place.** A `PageMap` holds the
   viewport size, the ledges and (when asked for) the obstacles, measured
   together so a consumer never sees ledges from one layout and obstacles
   from another. Along with it goes one equality check, used for the CSS-only
   comparison that Christmas hand-rolled. Obstacles stay opt-in because
   walking every text node is the expensive part; Halloween does not pay for
   it.
2. **Raw measurements in the shared code; each animal's needs in its own.**
   The shared ledge stops carrying `walkable` and carries `headroom` instead:
   the distance to the nearest ledge that overlaps it from above (infinite
   when none). The old flag is exactly `headroom >= 34`. Spiders, snow and
   robin perches each name their own threshold, all 34 for now, so behaviour
   does not change. Whether the robin should really need a different
   clearance is a separate, later decision.
3. **Each layer keeps its own cadence.** Only one layer mounts at a time, so
   "measured once" already holds per page; what was duplicated was the
   measuring code and the snapshot shape, and those become shared. Cadence
   differs because the animals do, and changing it is not part of this step.
4. **The labs move with it.** `src/lab/SpiderScene.svelte` binds Halloween's
   ledges and draws its own debug view; it keeps working against the new
   types, and the lab test suite runs as part of acceptance.
5. **The debug overlay shows the raw data.** `Geometry.svelte` (enabled with
   `?theme-debug=1`) labels each ledge with its headroom rather than a
   spider-specific "no headroom".

### Surfaces the new months need

These go into the same shared module, each defined (coordinate system, what
it excludes, how it is identified across measurements) in the note of the
first month that needs it, and drawn by the debug overlay before a theme
relies on it. None is built speculatively.

| Surface | First needed by | Definition to settle |
| --- | --- | --- |
| Header band | November (fireworks) | Fixed viewport strip or the page heading's box; either way it excludes heading text and controls |
| Gaps between ledges | June (bunting) | Neighbouring ledges only, with stable end ids and the vertical step between them |
| Walls as segments | May (bumblebee) | Explicit vertical card sides, keeping today's rule that headings and `.panel` have none |
| Rail shelf slot | none yet | The shelf sits outside `main` (which the layout observer watches) and is hidden by responsive CSS; it would need an App-owned slot that is absent when hidden |

## Animals (added 2026-10-09)

Two rules for every month from November on, set after November and January
first shipped with one stiff sprite each:

- **At least two of a decorative animal.** A month's animal comes as a small
  group of the same species: two, or three where the page has room for them
  all (decided from the animals' own footprints, once, when the group is
  placed, so scrolling never grows it). Fewer, even none, only when the page's
  geometry cannot host them safely. They keep their distance from each other,
  so no two ever overlap: a group is stepped and placed one animal at a time,
  each seeing the others as they now are (`lib/theme/group.ts`). A theme may make an exception in its own note where
  the idea needs one animal (a single predator and its prey, say).
- **Drawn from parts, with legs and faces that move.** Not one image per pose
  slid along the ledge, and not generated walk-cycle frames (the spider's
  generated walk atlas came out with near-identical frames). The art is
  generated as separate parts (body, head, tail and so on, no legs) and put
  together in code; legs are drawn and stepped in code from the shared gait
  (`lib/theme/rig/`, on the spider's `spidergait.ts`), driven by distance
  walked so planted feet never slide; eyes blink and heads nod, turn and
  look on seeded schedules (`rig/life.ts`), held still under reduced motion.
  Each animal has a page in the critters lab (`lab/critters.html`), driven
  by numbered frames (60 a second) so a frame number, or the page's address,
  names one drawing exactly when talking about it.
- **From one drawing, checked against real animals.** An animal starts as one
  generated drawing of it standing square. Its parts and legs are cut from
  that drawing by image edits and placed where they sat in it, and key poses
  for each thing it does are drawn as edits of it and laid over the rig in
  the lab to tune against. Its anatomy and gait (which joints bend which way,
  the order its feet move, how a foot leaves and meets the ground) are
  looked up and cited in its theme's notes before its legs are built.
- **One animal, one scale.** Every picture of an animal (each pose and each
  part) is exported so its eye is the same size, and its rig sets one page
  scale for every pose, so curled up or trotting it is the same animal.
- **Legs that join cleanly.** Legs are pieces of leg art laid along posed
  bones on a small flat paw; each piece is drawn outlined, then again as fur
  alone with the outline taken out, so outlines run only round a leg's
  silhouette, not across its joints or its hip.
- **Room to stand.** An animal may stand up to 6px past the bottom edge of a
  card or heading above its ledge, into its empty edge, never over text,
  controls or charts; an end-to-end test checks that on every route.

## Sequencing

1. **Geometry consolidation first, with no new theme.** Acceptance:
   - `npm test` (vitest), including floors tests that pin `headroom >= 34` to
     the old `walkable` on the existing fixtures, and `npm run check`.
   - The Playwright suites against the real daemon (`e2e/theme.spec.ts`,
     `e2e/christmas-robin.spec.ts` and the rest) and the lab suite.
   - A one-off before/after equivalence capture: for each dashboard route at a
     desktop and a phone width, with reduced motion so the scenes are still,
     record each ledge (id order, box, headroom-derived flag), candle keys and
     positions, snow drawings and robin perches under Halloween and Christmas
     on `b903337` and on the refactor, and require them identical.
   - `make dashboard`, with the regenerated embedded assets committed.
2. **Then the soonest unshipped month**, counting forward from today:
   November first (from 2026-10-08), then January, February and so on.

### Checklist for every new month

- Go: a theme constant, its `Themes` entry and its `seasonalThemes` month in
  `internal/config/theme.go`; calendar, boundary and override cases in
  `internal/config/theme_test.go`; validation and the dashboard config API
  test (`internal/dashboard/config_theme_test.go`).
- UI: the name in `lib/theme/theme.ts`'s `THEMES`; App's imports and branches
  for both the shelf and the layer; an accent block in `styles/themes.css`
  (accents only; chart and status hues never move); the lab's theme picker.
- Tests: pure models unit-tested; an e2e spec that the theme mounts, stays
  click-through and below dialogs, and renders a still scene under reduced
  motion.
- Docs: the root `README.md` seasonal themes paragraph, the theme note in
  `config.example.json`, and `release-notes/unreleased.md`.
- Build: `make dashboard` and the regenerated `internal/dashboard/assets`
  committed (CI's `dashboard-fresh` job diffs them).
- Art, following `design-docs/halloween/README.md`: originals and provenance
  (tool, model, date, prompt reference) kept under `design-docs/<theme>/`,
  outside the embedded tree; the keying, cropping and export steps recorded;
  any anchor measured from the art (like the candle wick fractions) written
  down so regenerated art gets re-measured; shipped files as WebP.
- A design note under `design-docs/<theme>/` covering the month's own open
  questions before code (for November, the list in its calendar entry).

## Alternatives considered

Options proposed for each open month and not picked:

- **January**: Big Garden Birdwatch (feeder visited by several small birds; too
  close to December's robins), Burns Night wild haggis, Hogmanay countdown
  (fireworks overlap November).
- **February**: Pancake Day. It moves each year, which a month-keyed map
  cannot express.
- **June**: ducklings following their mother along ledges, a pond with
  dragonflies and a frog, midsummer glow-worms.
- **September**: conkers with leaves the cursor kicks about (the Christmas
  wipe model re-skinned), swallows gathering on the top bar before migrating,
  back to school with smudgeable chalk doodles.
