# Bluebell wood (2026-10-10)

**Status**: pre-production draft (decisions settled, not built).

**Pins**: written against `ea7e9d5`. Code-internal; the page measurements
below were taken on the running preview at that commit.

May's theme, from `decisions/2026-10-seasonal-theme-calendar.md`. The config
value is `bluebells`; `auto` will turn it on from 1 to 31 May in the daemon's
local time. This note settles the month's open questions before code, as the
calendar's checklist asks, so the month's owner starts from decisions,
research and art. It is the first flier on the page since the robin, and the
first month to need walls as a shared surface, so most of it is about room:
where a bee may be, and what it may touch.

## What it shows

- **Rail shelf** (`BluebellsShelf.svelte`): a clump of native bluebells
  growing out of a mossy mound with a couple of oak leaves, a twig and a
  fern unrolling. Growing, not picked: the native bluebell is protected, and
  a jug of cut ones would be the wrong picture. Hidden on cramped rails like
  the other shelves.
- **Moss and bluebells** (`moss.ts`): a low rim of moss along the ledges,
  with small clumps of bluebells growing out of it where there is room.
- **Buff-tailed bumblebees** (`bee.ts`, drawn by `bee-rig.ts`): two, or three
  where the page has room, bumbling from bluebell to bluebell, on the ledges
  and on the shelf. Each lands on a bell, feeds, crawls to the next bell up,
  then lifts off and wanders to another clump. A moving cursor that comes
  close makes a bee dart out of its way. Now and then one flies head first
  into the side of a card, bounces off, wobbles, and carries on.
- **No sky effect.** The rail sky is used as air for the bees to reach the
  shelf's flowers, not for an effect of its own.

## Decisions

### Which bee: the buff-tailed bumblebee, a spring queen

The calendar offered the buff-tailed (*Bombus terrestris*) or the common
carder (*B. pascuorum*). The buff-tailed wins: black, with a golden collar on
the thorax, a golden band on the abdomen and a buff tail, it reads as a
bumblebee at 18px where the carder's all-over ginger reads as a brown blob.
In a bluebell wood in May the big ones are queens provisioning new nests,
alongside the first, smaller workers, so the drawing is a queen: large,
with pollen baskets carrying a load. A short-tongued bee, it often takes bluebell nectar
by biting into the base of the bell rather than climbing into the mouth, so
the feeding pose has it on top of the bell with its head at the stalk (see
Research). Its yellows are the species' darker golden ochre, not the lemon of
the white-tailed bumblebee.

### Group size: two, or three where there is room

The calendar's rule: at least two. Three where three visitable flowers (see
"Flowers") 120px or more apart are in view when the group is placed (the
shelf counts as one), else two; one or none only where the page has fewer
visitable flowers than that. The number is kept: a layout change never grows
the group, though a bee that had to leave may come back up to that number.
They are stepped as a group in a fixed order, each seeing the others as they
now are (`group.ts`'s `inTurn` and `placeInTurn`).

### The page's real room (measured)

Measured on every route at 1440 and 1024 wide, and at 390 (phone), at
`ea7e9d5`:

| Where | Room | What it means for a bee |
| --- | --- | --- |
| The page margins, beside the outer cards | 54px wide at 1440, 41px at 1024, 14px on a phone; the whole height of the page | The bees' main corridors on desktop, and where they bonk |
| Gutters between cards side by side | 14 to 22px | Too narrow: never flown through |
| Gaps between rows of cards | 14 to 18px | Too narrow: never flown through; moss only, no clumps |
| Above the first row of cards | 48px up to the heading's text (22px up to the heading rule, which is a line, not content) | Clumps, perches, hovering and flight |
| Heading rules | 26 to 30px clear along most of their length (from the January survey) | Clumps and perches; hovering beside a clump, not over it |
| Card padding (content to a card's side, inside it) | at least 9px, usually 19 to 21px | A bonk touching a card's side is never near its content |
| The rail sky | the rail from 16px under the nav to the shelf's top, up to 240px; the rail does not scroll | The way to the shelf's flowers |

Heading rules are borders, not text, controls or charts, so a flying bee may
cross one. Cards' own boxes are not content either, but a bee never flies
inside one (see the airspace contract); it may only reach 6px into a card's
empty bottom edge, as the walkers may, and touch a card's side when it bonks.

### Size and footprints

One bee, one scale. The bee is 18 page px from the front of its head to the
tip of its tail, a third of a hedgehog's length, which is about right
against an 8px bluebell bell for a cartoon (a queen is 20 to 22mm; a bell is
about 15 to 20mm, so a true bee would be half again as long as a bell; the
ledge flowers are drawn large for their stems, so the bee is drawn small
for its flowers). Each footprint is the box the drawing stays inside at
every moment of that mode's motion, wing blur, bob and pitch included; a rig
test samples the whole cycle (`rig/test-rig.ts`'s `pageReach`), as for the
fox and the hedgehog. Boxes are measured from the thorax's centre, the point
the models move, and mirrored with the bee's facing:

| Pose | Footprint (w x h) | Used for | Needs |
| --- | --- | --- | --- |
| perch | 20x13 | feeding on a bell, the warm-up shiver, reduced motion | the clump's box plus 6px above its top |
| crawl | 20x13 | walking from one bell to the next | as perch |
| land | 22x20 | the last 70ms before touching down | air |
| hover | 22x21 | hovering at a flower, before a dart, after a bonk | air |
| fly | 24x18 | flying between flowers, darting | air, swept along the route |
| bonk | 26x22 | the knock and the bounce | the wall's air run (below) |

These are targets for the rig, set against the room above: the hover box fits
beside a clump on a heading rule (26px), and the bonk with its 8px bounce
fits the 41px margin at 1024 with room to spare. If the rig comes out bigger,
change these numbers here first, then the code.

### Walls as segments (a new shared surface)

The calendar's table asks May to define this: explicit vertical card sides,
keeping today's rule that headings and `.panel` have none. It goes into
`floors.ts` as additive exports. It is derived from a `PageMap` alone (no
new DOM measuring), so it always describes the same layout as the ledges and
obstacles it came with, and `samePage` needs no change.

```ts
// A card's side, in viewport px, with the side its open air is on.
export type Wall = { id: string; floor: number; side: -1 | 1; x: number; top: number; bottom: number };
export function walls(page: PageMap): Wall[];
// The stretches of a wall, in wall-local d (px down from its top), where a
// box `depth` px deep stands clear in front of it.
export function wallRuns(w: Wall, page: PageMap, depth: number, opts?: { inset?: number; step?: number }): Run[];
```

- **What a wall is.** Each card ledge (`kind === 'card'`) whose `base` is at
  least 24px below its `y` gives two walls: its left side (`x = f.left`,
  `side: -1`, open air to the left) and its right side (`x = f.right`,
  `side: 1`), each from `top = f.y` to `bottom = f.base`. Headings
  (`kind === 'heading'`, whose `base` is their `y`) and `.panel` (the same)
  have none, as today. These are exactly the walls the spiders already use
  implicitly from `left`, `right` and `base`; the spiders keep their own code
  and nothing about them changes.
- **What it excludes.** A side whose outer 4px strip lies inside another
  card's box for its whole length (a card nested in another, whose side faces
  into its parent) is left out. A side partly covered is kept; its runs say
  where it is open.
- **Coordinates.** Viewport px, like the ledges. A point on a wall is held as
  `d`, its distance down from the wall's top (the card's top edge), so it
  rides with its card on scroll exactly as ledge-local x does.
- **Identity across measurements.** `id` is `` `${floor}:l` `` or
  `` `${floor}:r` ``, where `floor` is the ledge's id, stable for the life of
  the card's element (the `WeakMap` in `floors.ts`). A wall vanishes when its
  card does, or when the card grows too short for one.
- **Runs.** `wallRuns` samples `d` every `step` px (4 by default), kept
  `inset` px (8) from the wall's top and bottom, and keeps a sample when the
  box from `x` outward `depth` px, `step` px tall, overlaps no obstacle
  (text, a control, a chart, another card's box) and stays inside `main`'s
  box and the viewport, and the 2px just inside the wall (between the side
  and the card's content) holds no content either. Runs come back merged,
  like `clearRuns`. It needs `main`'s box, so `PageMap` gains an optional
  `bounds` (`main`'s visible rect, measured with the rest; additive, and
  compared by `samePage` only when present).
- **Debug overlay.** `?theme-debug=1` already draws each card's sides as
  dashed purple lines. `Geometry.svelte` draws them from `walls(page)`
  instead, each a `<g data-wall-id>` labelled `l` or `r` at its top, and
  shades each wall's runs at the bee's bonk depth (34px) as a faint purple
  strip on its open side, so a wall a bee may bonk is visible as such.
  Floors keep their own drawing.
- **Tests.** Unit tests on the existing fake pages: headings and `.panel`
  give no walls; a nested card's inner side is excluded; ids hold across a
  scroll (every `y` moved by the same amount) and across a card growing;
  runs stop at text beside a wall, at a neighbouring card closer than the
  depth, and at `main`'s edge; the lists equal the spiders' implicit walls on
  the Halloween fixtures.

### The bees' airspace contract

Every flier must define this before code (the seasonal brief's "Fliers").

- **Air.** The bees may be drawn only in air: `main`'s visible box minus
  every obstacle (`measurePage` with obstacles: rendered text, controls,
  charts, and every card's box), plus the rail's air when the shelf is shown
  (below). A card's box is not air, except that a footprint may reach 6px
  into the empty bottom edge of a card above it (as the walkers may) and
  1px into a card's side at the moment of a bonk. Heading rules are lines,
  not obstacles. Air stays 70px below the window's top (the shared
  `TOP_MARGIN`) and 30px above its bottom, so a bee is never half off
  screen. The bees' air is their own (`bluebells/air.ts`), not a shared
  surface: it is the first, and the calendar asks that nothing shared be
  built for a second user that does not exist yet. February's cupids may
  lift it into `floors.ts` when they come.
- **The rail's air.** When `measureRailSky` gives a sky at least 60px tall:
  the sky's rectangle, widened rightward to `main`'s left edge (the rail's
  padding beside the sky is empty by the sky's own definition: the nav is
  above it and the shelf below), plus the shelf's own box (its art is ours;
  a bee over the bluebells is the point). Nothing else in the rail is air:
  never the nav, the brand or below the shelf. The rail does not scroll;
  this air is in viewport coordinates and remeasured with `watchRailSky`.
- **Whole footprint, every frame.** A bee's footprint for its current pose
  lies in air at every frame, including the moment of a bonk and the frame
  after a layout change (see "Layout changes").
- **Routes, swept.** A flight is a chain of smooth curves (cubic Béziers,
  as `christmas/flight-route.ts`), planned on a grid: 12px cells, a cell
  open when the fly footprint centred on it, grown by the wobble bound
  (3.5px) and a 2px margin, lies in air; A* over the open cells from the
  bee's spot to its target's approach spot, then smoothed into curves
  through every third cell, and each curve checked against the grown
  footprint by subdividing its control hull (`clearFlight`'s method) rather
  than sampling points. A curve that fails is split at the failing cell and
  re-smoothed; a route that still fails is not flown. Cells are bucketed by
  obstacle so a measurement costs a few milliseconds even on a long page.
  Gaps narrower than the footprint (the 14 to 22px gutters) are closed by
  construction, as real bumblebees judge a gap against their own wingspan.
- **Bumbling.** A flying bee's spot is its route point plus a seeded wobble
  across the route: `2 * (sin(2π·1.3t + a) + 0.6·sin(2π·2.9t + b))` px,
  bounded by 3.2px, which the grown footprint covers. Speed eases from 0 to
  70px/s and back to 25px/s on approach. It banks into turns (at most 15°)
  and pitches with its speed.
- **Hovering and landing spots.** A flower's approach spot is beside its
  clump, on the side the bee comes from, where the hover footprint (bottom
  4px above the ledge) lies in air; its perch spot is on top of a bell. A
  flower is visitable only while its perch box and at least one approach
  spot are in air and in view (`inView`).
- **Keeping apart.** No two bees' footprints ever come within 8px of each
  other. When a bee plans, the others' current footprints and the swept
  boxes of their committed routes are obstacles. Each frame, in turn, a bee
  whose next step would break the 8px gap holds where it is (hovering is
  always in air); after 0.5s held, the later one in the group's order
  replans. One bee per clump, one bee at the shelf at a time; a clump or
  the shelf a bee is heading for is claimed.
- **Layout changes, mid-flight.** On every measurement (scroll included):
  a flying bee's route is held relative to its target (a ledge-local point,
  or the rail's air for the shelf), so scrolling carries the route with the
  card it is going to. If the bee's current footprint is in the new air and
  the rest of its route still clears, it carries on. If its footprint is in
  air but the route does not clear, it replans from where it is; with no
  route it hovers and tries again at each measurement, and after 2s it
  leaves (below). If its footprint is no longer in air (content moved under
  it), it is placed on the nearest visitable flower in view at once, with no
  animation; with none, it is gone until there is one. A perched bee keeps
  its flower while the flower's perch box stays in air, and is re-placed the
  same way when it does not.
- **Leaving and coming back.** A bee with nowhere to go (no visitable flower
  in view, no route) flies out through the nearest margin column off the top
  or bottom of the window if a route exists, else simply stops being drawn
  at its next landing. It comes back, up to the group's number, along a
  margin column from the window's edge nearest a visitable flower.
- **Reduced motion.** Each bee perches on a flower, still, wings folded, no
  blur, no shiver, no antenna twitch. Each keeps its flower across
  measurements while it stays visitable; otherwise it is placed on the
  visitable flower with the most room. No visitable flowers, no bees.
- **The content check.** `e2e/content.ts`'s `coveredContent` looks only at a
  rig's `<image>` elements. The wing blur and antennae are drawn in code
  (paths, not images), so it is extended additively: an animal's drawing is
  the union of its `<image>` elements and any element marked
  `data-drawn` (the blur and antennae carry it). Every bee, every frame
  sampled, never over text, controls or charts, on every route.

### Flowers: the ledges' bluebells and the shelf's

Both. A bee visits a ledge clump or the shelf, never a moss rim.

- **Ledge clumps** are visitable when their perch box and an approach spot
  lie in air: in practice the first row of card tops (48px up to the
  heading's text) and heading rules where their text leaves room.
- **The shelf** is visitable while the rail's air exists (whenever the
  shelf is shown and its sky is 60px or taller; never on a phone or a short
  window, where the shelf is hidden). Its perch spots are the tops of four
  bells measured from the art as fractions of its box (like the candle
  wicks' fractions), recorded in `export.py` and re-measured if the art is
  regenerated. One bee there at a time.
- **Choosing.** On leaving a flower, a bee picks among the visitable,
  unclaimed flowers reachable by a route, preferring near ones (weight
  1/(distance + 80)) and the direction it was already going (×1.5 within
  60° of its last heading), as foraging bumblebees move to near neighbours
  and keep their direction. On one clump it works upward: it lands on the
  lowest open bell and crawls to the next bell up before leaving, never
  reaching the top bell, as bumblebees on a spike do.

### Moss and clumps (the ledge quirk)

- **Moss** is drawn in code: one stroked and filled path per ledge, a lumpy
  cushion 2 to 4px tall in two greens with seeded bumps, wherever
  `clearRuns(f, obstacles, 5)` says 5px is clear (card tops and heading rules
  alike, never under heading text, as January's frost).
- **Clumps** are the three bluebell clumps cut from `ledge-clumps.png`,
  drawn 20px tall, in seeded 140px slots along each ledge, kept where
  `clearRuns(f, obstacles, 26, { reach: 6 })` holds over the clump's width
  plus 10px each side (room for a bee to perch). At most 3 a ledge and 12 a
  page, shared out a ledge at a time (the frost glints' lesson). The two
  plain moss cushions from the same sheet sit in empty slots on ledges with
  room for 8px, at most 6 a page.
- **Life.** A bell under a perched bee dips 1px, eased. Nothing else moves;
  under reduced motion nothing moves at all.

### Behaviour

A bee's state is held in its target's frame: a ledge-local point (ledge id,
x, height) for a flower, the rail for the shelf, so it rides with its card.
The cursor is the last mouse or pen hover position (no buttons held), forgotten on
pointer down, leaving the window, blur, a hidden tab and a reduced-motion
change, as for every theme. "Moving" means a cursor event in the last
120ms.

| Mode | Pose | Ends when | Then |
| --- | --- | --- | --- |
| perch | perch | 3 to 8s; or a moving cursor within 40px | crawl if a higher bell is open and it has visited fewer than 3 on this clump, else shiver. A cursor: shiver is skipped, straight to takeoff, then dodge |
| crawl | crawl | it reaches the next bell up (4 to 7px along the stem at 10px/s) | perch |
| shiver | perch, the body trembling 0.3px at 25Hz, wings still | 0.4s | takeoff |
| takeoff | perch to hover, the wing blur fading in, legs letting go | 0.25s: lifts to its approach spot | hover |
| hover | hover, bobbing 1.5px at 1.8Hz | 0.4 to 1.2s (a bonk's daze: 0.7s with a 3px wobble) | choose a flower, or a bonk (below), then fly; no route: hover again, and after 2s leave |
| fly | fly | it reaches the target's approach spot (bumbling, as in the contract) | approach |
| approach | hover | two braking steps to a stop 8px from the perch spot, then 0.2 to 0.5s hovering | land |
| land | land, legs reaching | 70ms | perch |
| dodge | fly, banked 15° away | it reaches a spot 30 to 40px from the cursor at 140px/s | hover 0.3s, then a flower away from the cursor |
| bonk | fly, then bonk | contact: the head reaches the wall | bounce |
| bounce | bonk | 0.18s: 8px back from the wall, easing out, pitching nose up 25° and settling (damped, 3Hz); the blur dims to half for 0.12s | hover (the daze) |
| leave | fly | it is out of the window | away |
| away | not drawn | 3 to 8s, and a visitable flower is in view | fly in from the window's edge |

- **Dodging.** A moving cursor within 56px of a flying or hovering bee's
  centre makes it dodge: it tries eight directions away from the cursor (the
  farthest first) for a spot 30 to 40px away whose swept dart is in air, and
  takes the first. None: it holds and hovers (it is already in air). Not
  again for 0.8s. A still cursor is not chased off by anything, but routes
  are planned 40px clear of it, so a bee does not fly into a cursor at rest.
  Only one bee dodges at a time if two are near (the first in the group's
  order); the other holds.
- **Bonking.** Choosing what to do from a hover, a bee picks a bonk instead
  of a flower one time in eight, only if no bee in the group has bonked in
  the last 30s, and only if a wall run of depth 34 (bonk footprint plus the
  bounce) exists in view with a route to a point 30px in front of it at the
  bee's height. The last 30px are flown level and straight at the wall, so
  it hits head first. Contact puts the front of the head at the wall's `x`
  (at most 1px into the card's side, which has 9px or more of empty padding
  behind it). It is never chosen near a cursor, and a dodge cancels it.
- **Looking.** Perched or hovering, a bee's antennae lean toward a cursor
  within 120px (at most 15°, eased); its head turns at most 5°. Bees have no
  eyelids, so nothing blinks: the signs of life are the antennae flicking on
  a seeded schedule (`rig/life.ts`'s pattern, a 120ms flick every 1.5 to
  4s) and the abdomen pumping (its length scaling 3% at 1.2Hz) while it
  perches.
- **First placement.** Each bee in turn on the visitable flower with the
  most room, 120px or more from the others, perched, restless in 1 to 6s
  (staggered so they do not all lift at once).

### Layout changes

As the contract above says for flight. A layout change never moves a bee
over content: the reconciliation runs in `measured`, before the next frame
is drawn (`ledgeScene` measures, then frames). A bee in `away` keeps its
timer; where it comes in is decided when it does.

### Accent

Bluebell violet `#9b9cf4`, distinct from the info blue `#7fb9ea`, January's
teal and the default lime. Only the accent tokens move. A faint static wash
of the same violet in the page's bottom-left corner, as Bonfire's firelight
sits there. A proposal: easy to change in `styles/themes.css`.

## Research

### The bee

- **Body plan.** A bee's body is three sections: head, thorax (strictly the
  mesosoma, the thorax with the first abdominal segment fused to it) and
  abdomen (the metasoma), joined at a narrow waist hidden in a bumblebee's
  fur. The abdomen's segments are counted from the waist: T1 to T6 on top.
  In the buff-tailed queen, the thorax has a golden collar at its front and
  is black behind it; the abdomen is black at T1, golden at T2, black at T3
  and buff from T4 to the tip; workers have whiter tails with a thin buff
  line. Queens are up to 22mm long, workers 11 to 17mm.
- **Head.** Two large compound eyes on the sides, three small ocelli on the
  top, mandibles (jaws) at the front, and a long tongue folded back under
  the head when not feeding. The antennae are elbowed (geniculate): a long
  scape from the face, a short pedicel at the elbow, then the flagellum;
  a female has 12 segments in all (10 in the flagellum), a male 13.
- **Wings.** Four, hinged on the thorax: the larger forewings and smaller
  hindwings. A row of tiny hooks (hamuli) on each hindwing's leading edge
  catches a fold on the forewing's trailing edge, so each side's pair beats
  as one surface; the coupling flexes between strokes. Before flight the bee
  draws its forewings over the hindwings, which engages the hooks. At rest
  the wings lie folded back over the abdomen.
- **Legs.** Six, all from the thorax, one pair on each of its three
  segments. Each leg runs: coxa (at the body), trochanter (a small joint
  piece), femur, tibia, then the tarsus of five segments, the first (the
  basitarsus) long, and the pretarsus with its two claws. The hind tibia of
  a queen or worker is the pollen basket (corbicula): broad, flat, shiny
  and concave, fringed with long hairs, where pollen is packed into a ball;
  males have none. The hind basitarsus is broad and flat too. The joint
  names for the lab: coxa (socket), trochanter, knee (femur to tibia),
  tibiotarsal joint, claws.
- **Walking.** Insects walk with their legs in two alternating tripods (fore
  and hind legs of one side with the middle leg of the other) at speed, and
  with slower, tetrapod or wave-like patterns (four or five feet down) when
  slow. A bee crawling between bells is slow: its walk is tetrapod, at most
  two feet off at once, diagonal pairs; the key pose shows the tripod for
  clarity.
- **Flight.** Bumblebees beat their wings about 130 to 200 times a second
  (figures cited vary with species and size: around 150 to 250Hz for
  *B. impatiens*, about 200 in popular accounts). The stroke sweeps about
  115 to 125° in *B. terrestris* (Dudley and Ellington's measurements, as
  cited by later work), in a stroke plane nearly level relative to the
  body. Body angle and stroke plane change with airspeed (Dudley and
  Ellington); the paper's bumblebee figures could not be read for this note,
  so the direction drawn (steeply nose up in a hover, flatter in fast
  flight) follows the drone-fly measured alongside them and photographs of
  hovering bumblebees, and the owner should check the angles against the
  paper if it can be had. A 60Hz page cannot
  show a 150Hz wingbeat: any drawn cycle would alias into a slow, wrong
  flap. So in flight the wings are a blur, as the eye sees them (see the
  art plan). Bumblebees must warm their flight muscles to about 30°C before
  taking off, by shivering with the wings still: the short `shiver` before
  takeoff.
- **Landing.** Landing bumblebees approach in steps rather than one smooth
  braking, often with one or more brief hovers, then extend their legs about
  60 to 70ms before touchdown; at low wind they often touch with the head or
  antennae first. Hence `approach` (two braking steps, a hover) and `land`
  (70ms, legs reaching).
- **Collisions.** Bumblebees foraging in dense plants hit things all the
  time: wing collisions with vegetation, about one a second on average in
  one study, are what wear their wings down. They judge gaps against their
  own wingspan, slowing and turning sideways for tight ones. So a bonk is
  in character; and gaps narrower than the bee are closed to it.
- **Foraging.** On a vertical spike of flowers, bumblebees start at the
  bottom, move to the nearest flower above, and leave before reaching the
  top (Pyke). Between plants they tend to go to near neighbours and keep
  their direction. Bluebell nectar is an important early food for queens;
  short-tongued species such as the buff-tailed often rob it, biting
  through the base of the bell.

### The bluebell

The native bluebell (*Hyacinthoides non-scripta*): narrow, tubular, deep
violet-blue bells with the petal tips curled back, hanging from one side of
the stem, so the stem droops over at the tip; cream pollen; long narrow
strap-shaped leaves. (The Spanish bluebell has upright stems with bells all
round, broader leaves and blue pollen.) It is protected under the Wildlife
and Countryside Act 1981; digging it up in the countryside is an offence.
All three pieces of art were checked against this: one-sided, nodding,
cream-tipped.

## Art plan: the parts the rig needs, and why

Not cut yet; the owner cuts them from `bee-standing.png` by image edits, as
the fox and hedgehog were, and places each where it sat in the drawing
(`art.py`'s `place`, verified by overlay). The bee's eye cannot be the scale
feature (`art.py`'s `feature` measures a dark blob, and the head around the
eye is black too): measure the golden T2 band's width instead, the one
feature every picture shares at a fixed size, and export every picture so it
matches, at 12 file px per drawing unit.

- **Head**, with its eye and jaws, a soft unoutlined back edge where it sits
  over the thorax, so it can turn a few degrees at the neck.
- **Thorax**, with the collar, the wing hinges and the leg sockets marked;
  the rig's root.
- **Abdomen**, with its bands and tail, pivoting at the waist: it pumps
  while perched, swings down in a hover and in the bounce, trails in
  flight.
- **Wings, near pair and far pair**, each the forewing and hindwing as one
  piece, as the hooks hold them in flight; the far pair a shade darker.
  Folded, they lie back over the abdomen at rest. In flight each pair is
  drawn at the front and back of its stroke at 0.35 opacity, with a
  code-drawn fan between (a pale sector from the hinge spanning the 120°
  stroke as seen side-on, 0.3 opacity), steady from frame to frame (no
  flicker), its angle following the stroke plane: nearly level relative to
  the body, so tilted with the body's pitch. The fan and ghosts are in the
  footprint.
- **Legs, in code on leg art.** Each leg is three posed bones (femur, tibia,
  tarsus) from a socket on the thorax's underside, the coxa and trochanter
  hidden in the fur. Leg pieces cut from the reference's near legs: a femur,
  a tibia, and the hind tibia with its pollen basket (with and without its
  pollen ball, so a load can come and go), each outlined and as fill only
  (`fill_only`). At 18px a tarsus is under a pixel thick, so tarsi are code
  strokes in the outline colour, with a two-pixel hook for the claws. The
  far legs a shade darker. `rig/gait.ts`'s quadruped legs do not fit six
  legs; the owner adds a small hexapod stepping (two alternating tripods,
  driven by distance crawled so planted feet never slide) additively to
  `rig/`.
- **Antennae, in code.** Two strokes each: scape, then flagellum from the
  elbow, the far one behind the head.
- **Shelf and clumps.** `bluebell-shelf.png` exported for the shelf (about
  124x62 on the page) with its four perch fractions; `ledge-clumps.png`
  split into its three clumps and two moss cushions (`art.py`'s `poses`).

## Art

Generated on 2026-10-10 by the Codex CLI (`gpt-5.6-terra`) through its
built-in `$imagegen` path, each on a flat magenta `#FF00FF` background, with
`design-docs/halloween/pumpkins.png`, `candle-stubs.png`,
`design-docs/aurora/winter-kit.png` and `design-docs/bonfire/toffee-apples.png`
and `hedgehog-standing.png` as style references. The bluebells are a
blue-violet whose red channel stays well below its blue, so the keying
(alpha from `min(R,B) - G` between 60 and 140) leaves them whole: on both
flower sheets, 99% of the blue pixels sit below 36 on that measure.

| Source | What | Prompt summary |
| --- | --- | --- |
| `bluebell-shelf.png` | the shelf | native bluebells growing from a mossy mound, oak leaves, a twig, a fern frond; one-sided nodding stems, cream pollen; no vase |
| `ledge-clumps.png` | the ledge quirk | three small bluebell clumps on moss cushions and two plain cushions, in a row, few large bells to read at 20px |
| `bee-standing.png` | the reference | a buff-tailed queen standing side-on facing right: three body sections with a waist, six legs all from the thorax with their segments, four opaque wings folded back and lifted, elbowed antennae, a pollen basket with a load |
| `bee-pose-*.png` | key poses | edits of `bee-standing.png`, one per mode (below) |

A first reference had its six legs spread evenly along the body, the hind
pair under the abdomen, like a caterpillar's; it was replaced by one with
every leg on the thorax (a second try, from a prompt spelling out the body
plan). Of two drawn from that prompt, the one with all six feet showing was
kept.

Key poses, each an edit of the reference on the same canvas scale:

| Pose | Mode |
| --- | --- |
| `bee-pose-perch.png` | perch: on top of one bell, head at its base near the stalk, wings folded |
| `bee-pose-crawl.png` | crawl: walking, wings folded |
| `bee-pose-hover.png` | hover: body steeply nose up, wings level, legs dangling |
| `bee-pose-fly.png` | fly: body nearly level, wings up, legs tucked, hind legs trailing |
| `bee-pose-land.png` | land: legs reaching forward and down |
| `bee-pose-bonk.png` | bonk: recoiling nose up from a wall on its right, legs splayed |

## Verification (for the owner)

- Unit tests for the pure models: the walls and their runs (see the
  surface's tests); the air grid and route planning (no route through a
  gutter narrower than the footprint; every route's grown footprint clear
  of every obstacle by hull subdivision; routes held relative to their
  target across a scroll); the bee's state table, dodging, bonk choice and
  cooldown, separation over long random runs, reconciliation after layout
  changes (never over content the frame after), reduced motion's still
  perches; the moss and clump caps and seeding; the rig's footprints over
  the whole cycle of every mode, feet on the bell when perched.
- `e2e/bluebells.spec.ts`: mounting and palette, every descendant
  click-through, `aria-hidden` and below dialogs, at least two bees on the
  overview at 1440, no bee over content on every route sampled over time
  (with the extended `coveredContent`), a moving cursor making a near bee
  dodge, a still scene under reduced motion, the phone layout. Bonks are
  random and timed: left to unit tests.
- The critters lab: a bee descriptor with an airborne view (no floor
  anchor, added to the descriptor additively), its modes, footprints, rig
  and these drawings; the lab's shelf contract for `bluebells`.

## Sources

- Bumblebee Conservation Trust, common bumblebees identification guide
  (buff-tailed queens' darker yellow and buff tail; workers' white tail
  with a buff line):
  https://www.bumblebeeconservation.org/wp-content/uploads/2024/05/common-bumblebees-identification-guide.pdf
- NatureSpot, Buff-tailed Bumblebee (golden rather than lemon bands; sizes;
  season): https://www.naturespot.org/species/buff-tailed-bumblebee
- Wikipedia, Bumblebee (queen up to 22mm, workers 11 to 17mm; corbiculae;
  about 200 wingbeats a second; warming to about 30°C by shivering;
  robbing by biting the base of the corolla):
  https://en.wikipedia.org/wiki/Bumblebee
- Montana Entomology, bumble bee female morphology (terga T1 to T6 counted
  from the waist; coxa; basitarsus; the corbicula "the shiny, concave portion
  of the hind tibia" and its fringe):
  https://mtent.org/projects/Bumble_Bees/morphology_female.html
- Casteel 1912, *The Behavior of the Honey Bee in Pollen Collection*,
  Project Gutenberg edition (the corbicula's structure in the related honey
  bee: a concave tibia arched over by long hairs): https://gutenberg.org/files/40802/40802-h/40802-h.htm
- Buzz About Bees, bee antennae (12 segments in females, 13 in males;
  scape, pedicel, flagellum): https://buzzaboutbees.net/bee-antennae.html
- Ibycter, high speed arthropod week: hamuli (the hooks coupling the
  wings, and their coming apart): https://ibycter.com/high-speed-arthropod-week-day-1-hamuli
- Honey Bee Suite, diaphanous wings (the forewings drawn over the
  hindwings before flight to engage the hooks):
  https://www.honeybeesuite.com/diaphanous-wings-they-soar/
- Dudley and Ellington 1990, Mechanics of forward flight in bumblebees I:
  kinematics and morphology, J. Exp. Biol. 148: 19-52 (body angle and
  stroke plane angle vary with airspeed):
  https://cob.silverchair.com/jeb/article-pdf/148/1/19/2868857/jexbio_148_1_19.pdf
- Bumblebees exhibit adaptive flapping responses to air disturbances
  (sweep amplitude about 120°, matching 115 to 125° reported for
  *B. terrestris*; stroke planes nearly horizontal to the body):
  https://arxiv.org/html/2409.01299v1
- SICB abstract on *B. impatiens* wingbeat (150 to 250Hz as the species'
  range): https://sicb.org/?p=9403
- Combes and Dudley 2009, via the Harvard Gazette (bees extend their hind
  legs in turbulence):
  https://news.harvard.edu/gazette/story/2009/06/trading-energy-for-safety-bees-extend-legs-to-stay-stable-in-wind/
- Chang et al. 2016, bumblebee landings in dim light (Frontiers in
  Behavioral Neuroscience; hover phases, then leg extension, then
  touchdown): https://www.frontiersin.org/journals/behavioral-neuroscience/articles/10.3389/fnbeh.2016.00174/pdf
- Goyal et al. 2021, Bumblebees land rapidly and robustly using a
  sophisticated modular flight control strategy (iScience; braking in
  bouts): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8099750/
- Bumblebees land remarkably well in red-blue greenhouse LED light
  (hover phases, leg extension before touchdown):
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7295593/
- SICB abstract on landing (legs extended 60 to 70ms before touchdown; head
  or antennae often touching first): https://sicb.org/?p=16127
- Ravi et al. 2020, Bumblebees perceive the spatial layout of their
  environment in relation to their body size and form to minimize inflight
  collisions, PNAS 117: 31494-31499:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC7733852
- Foster and Cartar 2011, What causes wing wear in foraging bumble bees?
  J. Exp. Biol. 214: 1896-1901, and the SICB abstract on collision rate:
  https://cob.silverchair.com/jeb/article-pdf/214/11/1896/1275772/1896.pdf,
  https://sicb.org/abstracts/effect-of-collision-speed-on-rate-of-wing-wear-in-bombus-impatiens-bumblebees
- Pyke 1978, Optimal foraging in bumblebees and coevolution with their
  plants, Oecologia 36: 281-293 (bottom first, nearest flower above, leave
  before the top): https://link.springer.com/article/10.1007/BF00348054
- Insect walking gaits (tripod, tetrapod, wave, and the continuum since
  Wilson 1966): Static stability predicts the continuum of interleg
  coordination patterns in Drosophila, J. Exp. Biol. 2018:
  https://cob.silverchair.com/jeb/article/221/22/jeb189142/20759/Static-stability-predicts-the-continuum-of
  and Quadrupedal gaits in hexapod animals, J. Exp. Biol. 2012:
  https://cob.silverchair.com/jeb/article-split/215/24/4255/11167/Quadrupedal-gaits-in-hexapod-animals-inter-leg
- RSPB, bluebells (early nectar for bumblebees; some bumblebees rob it by
  biting through the base of the flower): https://members.rspb.org.uk/?p=94339
- Woodlands.co.uk, native and non-native bluebells (one-sided drooping
  stems, cream pollen, narrow leaves; the Spanish bluebell's differences):
  https://www.woodlands.co.uk/?p=182
- Woodland Trust, bluebell (protected under the Wildlife and Countryside Act
  1981): https://woodlandtrust.org.uk/trees-woods-and-wildlife/plants/wild-flowers/bluebell/
- BSBI species account, *Hyacinthoides non-scripta*, *H. hispanica* and the
  hybrid: https://bsbi.org/learn/resources/species-accounts/hyacinthoides-non-scripta-h-hispanica-and-h-x-massartiana
