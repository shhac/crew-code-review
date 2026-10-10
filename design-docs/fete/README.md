# Village fête (2026-10-10)

**Status**: pre-production draft (decisions settled, not built).

**Pins**: written against `b45e997`. Code-internal.

June's theme, from `decisions/2026-10-seasonal-theme-calendar.md`. The
config value will be `fete`; `auto` turns it on from 1 to 30 June in the
daemon's local time. This note settles the month's open questions before
code, as the calendar's checklist asks: the shared "gaps between ledges"
surface the calendar's table leaves to June, where bunting may hang, whether
the wasps come, and if so their airspace. Nothing here is built yet; the
month's owner builds from it and keeps it current.

## What it shows

- **Rail shelf** (`FeteShelf.svelte`): a Victoria sandwich on a cake stand
  with a red first-prize rosette, a small coconut shy (three coconuts in cups
  on posts, two wooden balls) and three jam jars under gingham covers. Hidden
  on cramped rails like the other shelves.
- **Bunting** (`bunting.ts`): small cloth pennants on a tape, strung across
  the gaps between ledges: festooned in shallow swags under a page heading's
  rule, and in one short swag across each gutter between two cards side by
  side. It hangs still, flutters a little in a breeze, and swings when the
  cursor brushes it.
- **Common wasps** (`wasp.ts`, drawn by `wasp-rig.ts`): two, circling the
  cake in the rail's air above the shelf. One now and then zigzags in, lands
  on the sponge and feeds; the other keeps to the jam jars. A moving cursor
  that comes close chases one off out of the window's left edge; it comes
  back a little later.
- **No sky effect.** The rail's sky is the wasps' air; a summer afternoon
  needs nothing else in it.

## Decisions

### The gaps between ledges: a new shared surface

The calendar's table asks June to define "gaps between ledges: neighbouring
ledges only, with stable end ids and the vertical step between them". A
survey of every route (overview, history, metrics, leaderboard, config,
prompt, logs) at 1440x900, 1280x800 and 1024x768 on the running preview
measured what is actually there:

| Route | Side by side (gutter, step) | Under a heading rule (band) |
| --- | --- | --- |
| Overview | queue board and Now card: 22px at 1440 and 1280, step 0; at 1024 the two context cards: 16px, step 0 | hero rule to the first cards: 22px |
| Metrics | the KPI cards: 14px, step 0 (two rows of two gutters); the two chart cards: 18px, step 0 | hero rule to the KPI row: 22px |
| History, prompt | none | page heading's rule to the first card: 22px |
| Config | none | blocked: the tab bar sits in the band |
| Leaderboard, logs | none | none: the panel or terminal shares the heading's edge |

Two things follow. Ledges side by side only ever stand level on today's
pages, with gutters of 14 to 22px whose columns are free for 113px or more
below the card tops. And a page with no cards side by side has no such gap
at all, so bunting strung only between ledge ends would leave four routes in
seven bare. The band under a page heading's rule is the other gap between
neighbouring ledges (the rule and the card tops below it, a vertical step of
22px), and it is empty by construction: the heading's text and controls sit
above its rule. So the surface has two kinds of gap, both between
neighbouring ledges.

**What it is.** `measureGaps(page: PageMap): Gap[]` in `lib/theme/gaps.ts`
(a new shared module, as the calendar asks; `floors.ts` stays about ledges),
in viewport coordinates like the ledges, recomputed from each `PageMap`:

```ts
export type GapEnd = { ledge: number; side: 'left' | 'right'; x: number; y: number };
export type Gap = {
  id: string;            // stable while both ledges' elements live (below)
  kind: 'side' | 'under';
  from: GapEnd;          // the left end of the gap
  to: GapEnd;            // the right end; from.x < to.x
  step: number;          // side: to.y - from.y; under: the band's height
  top: number;           // where anything hung in the gap may start (viewport y)
  bottom: number;        // how far down it may reach, before any obstacle
};
```

- **Side gaps.** Ledge B is ledge A's right-hand neighbour when B's left end
  lies 8 to 160px to the right of A's right end (`span = B.left - A.right`),
  their step `|B.y - A.y|` is at most `min(40, span)`, and no third ledge's
  span crosses the gap's columns within 8px of either end's height. Of the
  candidates, the nearest wins (smallest span, then smallest step, then lower
  id), and each ledge end is used by one gap at most (a contested end keeps
  the smaller span). Ends: `from` is A's right end `(A.right, A.y)`, `to` is
  B's left end `(B.left, B.y)`. `top = min(A.y, B.y)`; `bottom` is the top of
  the first obstacle (text, control, chart or card box) overlapping the
  column `A.right..B.left` below `top`, capped at `top + 120`. A gap whose
  column has an obstacle straddling `top` (something spanning the gutter at
  the anchors' height) is left out. Any ledge kind qualifies.
- **Under gaps.** For a heading rule H (`kind: 'heading'`) and a ledge L
  below it, the band between them is a gap when L is the nearest ledge below
  H over their shared stretch, `L.y - H.y` is 12 to 80px and the shared
  stretch (`max(H.left, L.left)` to `min(H.right, L.right)`) is at least 60px
  long. Ends: the shared stretch's two ends at H's height. Each end is named
  by the ledge end that bounds it (the innermost of the two; the lower
  ledge's on a tie), so `from` and `to` carry real ledge end ids. `top = H.y`;
  `bottom = L.y`. Only heading rules: they are the only ledges whose underside
  lies outside their own element. Below a card's top is the card itself, and
  a panel's ledge (`base == y`) is its table's top rule, so neither has a band
  beneath it.
- **What it excludes.** Everything that is not between two measured ledges:
  the page's side margins, the space beyond a ledge's outer end, the strips
  between cards stacked one above another (no ledge sits on a card's bottom
  edge, and those strips are 14 to 18px, too tight to hang anything),
  anything above a heading rule. A gap says where hung things may start and
  how far down nothing blocks them; it never vouches for a stretch with
  content in it.
- **How deep it is free, stretch by stretch.** A gap's `bottom` is its best
  case. Obstacles inside an under gap's band (the config page's tab bar) are
  found the way `clearance` finds them above a ledge, mirrored:
  `gapDepth(g, obstacles, x0, x1)` returns how far below `g.top` the stretch
  `x0..x1` (gap-local, from `g.from.x`) is free, up to `g.bottom`; and
  `gapRuns(g, obstacles, depth, { inset = 4, step = 4 })` returns the
  stretches where `depth` fits, as `clearRuns` does for ledges. A side gap is
  one column, so its whole span is one stretch.
- **Identity across measurements.** A ledge end's id is `<ledge id><l|r>`
  (`12r`, `15l`), from the ledge ids `measureFloors` already keeps stable for
  the life of an element. A side gap's id is `<from end>-<to end>` (`12r-15l`);
  an under gap's is `<heading id>/<ledge id>` (`5/12`). The same two elements
  give the same id on every measurement, so anything seeded by a gap (pennant
  colours, which stretches carry bunting) stays put across scrolls and
  resizes; a re-rendered card is a new element and a new gap, as it is for
  candles and snow. `gapSeed(g)` hashes the two ledge ids and the kind into
  one number for `hash()`.
- **Debug overlay.** `Geometry.svelte` (`?theme-debug=1`) draws each gap
  over the ledges it already shows: a side gap as its two ends (3px circles
  labelled with their end ids), a dashed line between them, and its free
  column as a dashed box drawn down to `min(bottom, top + 40)`, labelled
  `12r-15l · step 0 · 113`; an under gap as a dashed box over its band,
  labelled `5/12 · 22`, with any stretch `gapRuns` leaves out at 14px drawn
  hatched. Each group carries `data-gap-id` so the e2e suite can read them.
- **July uses it too.** July's courts (`design-docs/wimbledon/`) are side
  gaps between two card tops with a span of 8 to 48px and a step of 2px or
  less: a filter on `measureGaps`, not a second measurement. Whichever month
  is built first writes `gaps.ts`; the other filters it.
- **Tests.** Unit tests on fixtures taken from the survey above (overview
  and metrics at 1440 and 1024: the gap count, spans, steps and ids), a
  stepped fixture (a step within and beyond the limit), a third ledge across
  the gutter, a contested end, a straddling obstacle, and the config page's
  tab bar cutting an under gap's runs. Ids must not change across two
  measurements of the same fake elements.

### Where bunting may hang

Bunting is drawn only inside a gap's free space: never above `top`, never
below the depth `gapDepth` reports, never outside the gap's columns. That
space holds no text, control, chart or card by construction, so bunting can
never cover content, swinging included: the space each string needs is its
whole swept footprint (the string at its lowest sag and widest sway, every
pennant at its widest swing), and a string is hung only where all of it fits
with 2px to spare. It ignores `clearRuns` and the 6px reach: those are about
standing on a ledge, and bunting hangs below one.

- **Pennants.** 5px wide along the tape, 7px deep, a 1px cream tape
  (`#efe6d0`). Colours in a fête's cotton prints: pillar-box red `#d9473f`,
  cream `#f4ecd8`, cornflower `#5f8fd6`, buttercup `#f2c94c`, sweet pea
  `#f39ac0` and sage `#8cc49a`, each string starting at a seeded colour and
  stepping through them so neighbours never match. Each pennant gets a 0.6px
  darker edge so it reads on both the card and the page background.
- **Under a heading: festoons.** The tape is pinned 1px under the rule at
  seeded-stable points about 64px apart (the gap's length divided evenly into
  swags of 56 to 80px, 4px in from each end), and sags 4px between pins.
  Pennants every 7px along each swag, 4px clear of each pin. A swag is hung
  only where `gapRuns(g, obstacles, 16)` covers its whole stretch (its deepest
  point: 1 + 4 sag + 1.5 sway + 7 pennant + 2 spare); the swags either side
  of a blocked stretch stay. Swags are numbered from the gap's left end, so a
  blocked one never renumbers the rest.
- **Across a side gap: one swag.** Tied at the two ends, sagging a quarter of
  its span (3.5px across a 14px gutter, 5.5px across 22px), with
  `floor((span - 3) / 6)` pennants spaced evenly between 2px margins: one in
  the metrics page's 14px gutters, two in 18px, three in 22px. Hung when its
  footprint (sag + 2 sway + 7 pennant + 2 spare) fits `gapDepth`. A step
  between the ends tilts the swag; its lowest point moves toward the lower
  end, as a real catenary's does.
- **The curve.** A catenary through both ends with the chosen sag
  (`y = a cosh(x / a)`, solved numerically for unequal ends); at these sags it
  is within a quarter pixel of a parabola, which may stand in for it if the
  test says so.
- **How a pennant hangs.** Each is sewn along its top edge, so the top edge
  follows the tape between its two corners and the tip hangs below the
  middle of that edge: plumb at rest, swung in the page's plane by a small
  angle when the tape moves, and foreshortened (drawn shorter by the cosine
  of its flutter angle) as it flutters toward or away from the viewer.
- **Swaying.** Each string moves in two modes about its rest curve: a sag
  mode (the whole swag rising and falling) and a rocking mode (one half up
  while the other goes down), each a damped spring. Their frequencies are a
  real swag's: a shallow hanging cable's first mode is about
  `0.5·sqrt(g / 8d)` (sag d), 1.2Hz for the 20cm sag of a 3m run, and the
  rocking mode twice that, 2.5Hz. A pennant swings as a triangle hinged along
  its top edge, a compound pendulum at `(1/2π)·sqrt(2g / h)`, 1.6Hz for a 20cm
  pennant. Amplitude halves every 0.6s. Caps: the tape moves at most 1.5px
  (festoon) or 2px (side swag), a pennant swings at most 22 degrees in a
  festoon and 12 in a side gap's narrow column.
- **The breeze.** While motion is allowed, every pennant flutters about 3
  degrees on its own seeded phase, under a slow gust that rises and falls
  over 8 to 14 seconds, so the bunting never looks pinned flat or ticks in
  step.
- **The cursor brushing it.** A moving mouse or pen segment (from
  `ledgeScene`'s `stroke`) passing within 3px of a tape, or through a
  pennant, kicks that swag: its vertical speed into the sag mode, its
  horizontal speed into the rocking mode and every pennant's swing, scaled
  by the speed (capped at 900px/s) and by how near the pennant is to the
  crossing. A festoon passes 40% of the kick to the swags either side
  (they share a tape); a side swag is its own string. The swing state is kept
  by string id (`<gap id>#<swag>`) across measurements, so a scroll mid-swing
  carries on; a string whose id has gone is dropped.
- **Caps.** At most 32 strings and 200 pennants a page, taken in gap order;
  the busiest surveyed page (metrics at 1440) has 20 strings and about 160
  pennants.
- **Reduced motion.** Every string at rest, every pennant plumb, no breeze,
  no swing.
- **Layout changes.** Bunting is a pure function of the latest `PageMap`
  plus the swing state, so it follows each remeasure; nothing animates into
  place.

### The wasps come: two common wasps

The calendar makes June's animal optional, and the later Animals rule asks
for at least two of a month's animal unless the page's geometry cannot host
them. The cake is on the rail shelf, and the rail's air above it holds no
page content at all, so it can host them on every window tall enough to show
the shelf. They come: a fête in June without a wasp at the cake would be
missing the joke. Two, not three: the rail is 200px wide, the air above the
cake is 54px tall on a 1024x768 window and 10px at 1440x700, so a third
would have nowhere to circle without crossing the others; two is what the
rule asks.

They are worker common wasps (*Vespula vulgaris*), the familiar black and
yellow picnic wasp. In June they are early: a colony is founded in April and
its first workers follow some weeks later, so they are still few, and they
spend the season hunting insects for the larvae while feeding themselves on
sugars. The late-summer crowds round the jam come later, when prey grows
scarce and the larvae give the workers less of their own sugary secretion.
A wasp investigating a sugared sponge in June is still well within what they
do.

### The wasps' air

Every existing animal walks or perches; these never touch a ledge. Their
whole world is the rail, and this is their contract.

- **Their air** (`measureRailAir` in `sky.ts`, additive): the rail sky
  stretched down through the shelf's own box. In viewport coordinates: left
  and width as the sky's (the shelf's left edge and `clientWidth`), top at the
  sky's top (16px below the nav, at most 240px above the shelf), bottom at the
  shelf's bottom edge (the table line the art stands on). Null while the
  shelf is hidden, as the sky is. Plus one **exit lane**: the strip from the
  window's left edge (and 24px beyond it, off-screen) to the air's left edge,
  over the air's top half, which is the rail's empty left padding. Watched by
  `watchRailSky`, which already observes everything in the rail. The debug
  overlay draws it as a dashed box labelled `air WxH` beside the sky's, and
  the lane hatched. May's bumblebees (`design-docs/bluebells/`) define the
  same sky-plus-shelf air in their own `bluebells/air.ts`, widened rightward
  to `main`'s edge instead of a left exit lane. June is that air's second
  user, so whichever of the two is built first lifts the shared part (the
  sky stretched through the shelf's box) into `sky.ts` as `measureRailAir`,
  and each month adds its own widening (May's to the right, June's exit lane
  to the left) in its own module.
- **Never**: over the nav (the air starts 16px below it), over the identity
  chip or anything below the shelf (the air stops at the shelf's bottom
  edge), over the page (the air ends at the shelf's right edge, 18px inside
  the rail's border). The shelf's own art is decoration and may be flown over
  and landed on.
- **Positions** are in the shelf stage's coordinates, so the wasps ride with
  the stage; the air's bounds are converted into the same coordinates on each
  measurement.
- **Full moving footprint.** Each pose's box (the drawing at every moment of
  its flap, wing blur, dangling legs and antennae included, at its tilt) is
  checked by a rig test that samples the whole flap cycle, as the robin's and
  fox's are. Targets, in page pixels, for a wasp 16px from head to tail:

  | Pose | Footprint | Used for |
  | --- | --- | --- |
  | standing | 20x10 | resting, reduced motion |
  | feed | 20x10 | feeding, the few steps on the cake |
  | hover | 18x16 | circling, the zigzag inspection |
  | land | 18x15 | landing and taking off |
  | cruise | 20x13 | fleeing, coming back |

- **Swept area.** A route is eased cubic curves (as `flight-route.ts`'s) and
  is accepted only when the pose's footprint, swept along the whole route
  (each small interval enclosing the curve, as `clearArc` and `clearFlight`
  do), stays inside the air or the exit lane. Circling, the zigzag and the
  hover bob are parametric curves whose bounds are known in closed form, so
  they are checked once when an orbit is laid out.
- **Where it may circle, hover and land.** All measured from the shelf art
  (anchors as fractions of its box, like the candle wicks, written in
  `export.py` and re-measured if the art is regenerated): the cake's top
  surface (its centre and half-width) and the lid of the right-hand jam jar
  (the blackcurrant).
  - **Lower orbit** (wasp 0): an ellipse round the cake, centre 8px above its
    top, radii half the cake's width plus 12px across and 9px deep, so the
    near side passes in front of the sponge's top edge and the far side above
    it, as a circle seen from slightly above would. Needs 30px of air above
    the cake's top.
  - **Upper orbit** (wasp 1): centre 38px above the cake's top, radii half
    the cake's width plus 4 across and 7 deep. Needs 60px of air above the
    cake's top.
  - **Landing spots**: wasp 0 on the cake's top, wasp 1 on the jar's lid.
    The jar sits outside the lower orbit's width, so wasp 1 comes down to it
    without crossing wasp 0's band.
- **Keeping apart.** Each has its own orbit band and its own landing spot,
  and the two bands are a footprint plus 6px apart, so circling, inspecting
  and feeding never meet. Routes that do cross bands (fleeing, coming back,
  wasp 1 dropping to its jar) are stepped in turn (`group.ts`'s `inTurn`):
  if a wasp's next position would overlap the other's footprint, it hovers
  where it is for that frame instead, and the lower
  id has right of way.
- **When the air is short.** With 30 to 60px above the cake (a 1440x700
  window), only the lower orbit fits: wasp 1 rests on its jar, feeding and
  walking a little, taking off only once there is room. Under 30px, both
  rest: wasp 0 on the cake, wasp 1 on the jar. With no shelf (phones, short
  windows) there are no wasps. Decided whenever the air is measured, so a
  wasp that loses its orbit lands (below), and one that gains it takes off.
- **Layout change mid-flight.** On each new measurement every route and
  orbit is checked against the new air. A wasp whose route no longer fits is
  re-routed from where it is to its orbit, or, if its orbit no longer fits,
  to its landing spot; if no route fits, it is placed on its spot with no
  animation. An away wasp keeps its timer. When the shelf is hidden the
  wasps are dropped; when it shows again they are placed afresh (circling
  where they fit, else resting), with no entrance.
- **Still pose (reduced motion).** Wasp 0 standing on the cake's top, wasp 1
  on the jar's lid, wings folded along their backs, never stepped, antennae
  still.

### Wasp behaviour

A pure model in the stage's coordinates, stepped each frame like the
foxes, in the shelf component's own `sceneLoop`. The cursor is the passive
mouse or pen hover position, tracked by the shelf with `observePointer` as
the page layer does, and forgotten on pointer down, leaving the window,
blur, a hidden tab and a reduced-motion change.

| Mode | Pose | Ends when | Then |
| --- | --- | --- | --- |
| circle | hover, facing the cake | 2 to 5 laps (1.6 to 2.4s a lap), or chased | inspect (one time in two), else circle on |
| inspect | hover | 3 to 5 side-to-side zigzags in front of its spot, 1.5 to 2.5s | land, if its spot is free and no cursor is within 50px of it; else circle |
| land | land | 0.5s, dropping onto its spot | feed |
| feed | feed, with a few steps | 4 to 8s | take off |
| take off | land | 0.35s, rising off the spot | depart |
| depart | hover, facing its spot | two arcs backing away from the spot, each wider than the last, about 1.5s | circle, joining its orbit where the arcs end |
| flee | cruise, facing where it flies | it crosses the window's left edge | away |
| away | not drawn | 6 to 12s, and no cursor within 60px of the cake | return |
| return | cruise, two brief hovers on the way | it reaches its orbit | circle |
| rest | standing or feed | its orbit has room (never under reduced motion) | take off |

- **Circling faces the cake.** Wasps leaving or re-finding food circle above
  it in arcs centred on it, turning so they keep looking at it. So on the
  left half of the orbit a wasp faces right, on the right half left, and it
  turns about (mirrored, eased over 120ms) as it passes in front of and
  behind the cake. It banks up to 10 degrees with the turn and bobs about
  1px on a seeded wobble, and the orbit itself drifts 2 to 3px off true so
  no two laps match. On the far side it is drawn at 0.9 of its size.
- **Inspecting**: wasps come in to food with a quick side-to-side flight
  before landing, which is the zigzag: about 2 sweeps a second, 8px either
  side, hovering between.
- **Feeding**: head down, mandibles to the sugar, antennae tapping the
  surface in turn every 0.3 to 0.6s, two or three short shuffles across the
  spot on an alternating tripod (below), the abdomen pulsing slowly.
- **Departing** reproduces a learning flight: the wasp turns to face what it
  is leaving and backs away from it in widening arcs, then circles.
- **Chased off.** A cursor that moved in the last 120ms at 60px/s or more,
  within 40px of a wasp's centre, chases it. Its flee route starts directly
  away from the cursor, then curves to the exit lane at the height farthest
  from the cursor; if that route leaves the air, it climbs first and exits
  along the air's top. A wasp with no clear way out (a cramped air) dodges to
  the far side of its orbit instead. Both may be chased at once. A resting
  wasp chased off takes off and flees the same way. A cursor that stays
  still is ignored, except that no wasp lands within 50px of it and none
  comes back while it is within 60px of the cake.
- **First placement**: both circling where their orbits fit, at seeded
  points on them, wasp 1 starting 1 to 3s behind.
- **No blinking.** Insects have no eyelids, so `rig/life.ts`'s blink is not
  used; the signs of life are the antennae (a small seeded twitch every 1 to
  3s, leaning toward a cursor within 80px, eased), the abdomen's pulse at rest
  and the wing blur in flight.

### Accent

Sweet pea `#f39ac0`, a cotton-print pink well away from the bad-status ink
(`#ea8478`, a salmon) and from every other month's accent. Only the accent
tokens move. A proposal: easy to change in `styles/themes.css`.

## Research

### The common wasp

- **Size and build.** Workers are 12 to 17mm long; queens about 20mm. The
  body is three parts: the head; the mesosoma (the thorax with the first
  abdominal segment fused onto it) carrying all six legs and both pairs of
  wings; and the rest of the abdomen, joined by the wasp-waist, a
  constriction between the first and second abdominal segments (the
  petiole), behind which lies the gaster, the striped abdomen people see.
  Vespids range from long-stalked to short-waisted; in *Vespula* the waist
  is a short pinch and the gaster's front is blunt and broad (the first
  drawing had a long stalk and was redrawn). The gaster is yellow with black
  bands, each band pointed in the middle.
- **Head.** Compound eyes notched on their inner edge (emarginate), a family
  mark; a yellow face whose clypeus in *V. vulgaris* carries one black mark,
  usually anchor- or dagger-shaped, the way to tell it from the German wasp;
  mandibles that cut off pieces of food. Antennae have 12 segments in
  females, a long first segment (the scape) then the rest (pedicel and
  flagellum), with an elbow between scape and pedicel.
- **Wings.** Two pairs. Hooked bristles on the hind wing's front edge
  (hamuli) lock it to the forewing, so in flight each side beats as one
  surface. At rest vespids fold their wings lengthwise along the body: the
  folded-wing look that marks the family, and what the reference drawing
  shows.
- **Legs.** Each leg runs coxa, trochanter, femur, tibia, tarsus (usually
  five tarsomeres) and pretarsus with its claws; the mid tibia carries two
  spurs and the hind tibia a cleaning spur. The joint between femur and
  tibia is called the knee here, as entomologists informally do. All six
  legs come from the mesosoma, the front pair just behind the head.
- **Walking.** At the slowest paces an insect moves one leg at a time, five
  down; faster, it uses the alternating tripod, front and hind leg on one
  side stepping with the middle leg on the other, three feet always down
  (fruit flies use the tripod across all their walking speeds). The wasp
  only shuffles a few steps on the cake, on a slow tripod.
- **Flight.** The wingbeat is about 148Hz (measured for the German wasp,
  *V. germanica*; 140 to 160Hz quoted for yellowjackets generally), far too
  fast to show frame by frame at 60 frames a second, so it is drawn as a
  blur (below). Insects hover by beating their wings rapidly, and as forward
  speed rises the body tilts nose-down toward the horizontal; the drawings
  hold it about 35 degrees nose-up hovering and 10 cruising, a drawing
  choice rather than a measurement. Yellowjackets make a quick side-to-side
  flight just before landing.
- **Food and coming back.** Adults feed on sugars (nectar, ripe fruit, and
  people's sweet things) while the larvae are fed chewed insects and meat.
  *Vespula* foragers return again and again to a food source that has not
  run out, and relearn it if it moves: on leaving, a forager turns back to
  face the food and backs away from it in a series of arcs roughly centred on
  it, turning at a rate that keeps the food at a fixed place in its view,
  each arc wider than the last ("learning flights", also described as
  circling above the food). One feeding visit is enough for them to learn a
  site. That is why the calendar's wasp that is chased off "comes back a
  little later", and why it circles facing the cake.

### Bunting

- **Pennants.** Cloth bunting is triangles sewn along a tape: a home-sewing
  guide cuts them about 22cm wide and 20cm deep, pinned 5cm apart. Pennants
  here are 5px wide and 7px deep, longer and narrower than that so they read
  as pennants rather than as a jagged line at page size, with gaps of 1 to
  2px.
- **How it hangs.** A tape hanging under its own weight between two points
  is a catenary, `y = a cosh(x / a)`; between ends at different heights its
  lowest point moves toward the lower end. At the sags used here it is
  indistinguishable from a parabola.
- **How it swings.** A shallow hanging cable's swing has a first frequency
  of about `0.5·sqrt(g / 8d)` for sag d (the taut-string formula with the
  sag's horizontal tension; Irvine and Caughey's linear theory of suspended
  cables covers the in-plane and out-of-plane modes), and its antisymmetric
  mode is twice that. A pennant hinged along its top edge is a compound
  pendulum whose period is `2π·sqrt(h / 2g)`.

### The fête

- **Victoria sandwich.** The Women's Institute judges it with raspberry jam
  only for the filling and a dusting of caster sugar (never icing sugar) on
  top, 20cm across: so the shelf's cake has a red jam line, no cream and a
  sugared flat top, which is also where the wasp lands.
- **Rosette.** In British shows red has long meant first prize (agricultural
  shows' rosettes marked "First Prize" were red; the Pony Club is the
  exception, with blue).
- **Coconut shy.** Wooden balls thrown at coconuts balanced on posts, a
  traditional sidestall at British fairs and fêtes.

## Art plan

### The shelf

One picture (`fete-table.png`): the coconut shy on the left, the cake on its
stand in the middle with the rosette at its foot, three jam jars on the
right, all on one baseline, displayed about 168px wide on the shelf's stage
like the winter kit. `export.py` records two anchors measured from it, as
fractions of the exported box: the cake's top surface (centre, half-width,
height) and the right-hand jar's lid (centre and top). Regenerated art means
measuring them again.

### The wasp's rig

A parts rig on `lib/theme/rig/` like the fox and hedgehog, from the one
reference drawing (`wasp-standing.png`, the wasp standing side-on, wings
folded):

| Part | Art or code | Why |
| --- | --- | --- |
| head (eye, face, mandibles) | image | turns a little toward the cursor and dips to feed |
| mesosoma (thorax and propodeum, with the wing base) | image | the body's root; every leg and wing pivots on it |
| gaster (with the petiole) | image, pivoting at the petiole | the abdomen tilts in flight and pulses at rest |
| folded wing | image | at rest it lies along the back |
| open wing (fore and hind as one, coupled) | image, cut from the hover key pose | in flight it is swept and blurred in code |
| legs (trochanter, femur, tibia, tarsus) | code, tapered strokes, black near the body and yellow below | at page size a tarsus is under a pixel wide, and leg art would blur away; strokes stay crisp |
| antennae (scape, flagellum) | code, two strokes with an elbow | they tap, twitch and point independently |

- **Wing blur.** At 148Hz a wing sweeps the whole stroke between frames, so
  each frame draws the open wing three times: at both ends of a 100 degree
  stroke at 0.3 opacity and once at a seeded phase in between at 0.55, near
  and far wings both, the far one a shade darker. It reads as a shimmering
  blur and never flickers in a regular pattern. Folded under reduced motion.
- **Legs in flight**: drawn up under the body when cruising, hanging lower
  with the hind pair trailing when hovering, reaching down for the surface
  when landing (from photographs; no study of *Vespula* leg posture in flight
  turned up).
- **Joint names** in the lab's joints view: coxa, trochanter, femur, knee
  (femoro-tibial joint), tibia, tarsus, claws; scape, pedicel, flagellum;
  wing hinge (at the tegula); petiole.
- **One scale.** Every picture exported so the compound eye is the same
  height (`art.py`'s `feature`), at 12 file pixels per drawing unit, and one
  page scale for every pose, chosen so the wasp is 16px long. That is about
  three times true scale beside a 20cm cake, so it reads as a wasp at all.
- **Key poses**, each an edit of the reference drawing, to tune the rig
  against in the critters lab (which needs its airborne view, added to the
  descriptor additively, for these as for the cupids):

  | Key pose | Modes |
  | --- | --- |
  | `wasp-standing.png` (the reference) | rest, reduced motion |
  | `wasp-pose-hover.png` | circle, inspect, depart |
  | `wasp-pose-cruise.png` | flee, return |
  | `wasp-pose-land.png` | land, take off |
  | `wasp-pose-feed.png` | feed |

  Parts are not cut yet: the owner cuts them once the rig is settled.

## Art

Generated on 2026-10-10 by the Codex CLI (`gpt-5.6-terra`) through its
built-in `$imagegen` path, each on a flat magenta `#FF00FF` background, with
`design-docs/aurora/winter-kit.png`, `design-docs/bonfire/toffee-apples.png`
and `design-docs/halloween/pumpkins.png` as style references (and the
hedgehog's and fox's standing drawings for the wasp's outline weight).
Every wasp picture after the reference is an edit of it. Nothing is exported,
cut or shipped yet; the owner writes `export.py` on `design-docs/art.py` once
the rig is settled.

| Source | Size | What | Prompt, in short |
| --- | --- | --- | --- |
| `fete-table.png` | 1906x825 | the shelf art | generate: a coconut shy (three coconuts in cups on posts, two wooden balls), a Victoria sandwich (raspberry jam line, caster sugar on a flat top, no cream) on a white stand with a red rosette, three gingham-covered jam jars (strawberry, marmalade, blackcurrant); one baseline, front view, no text, no pink |
| `wasp-standing.png` | 1536x1024 | the wasp's one reference drawing | a worker *Vespula vulgaris* standing side-on facing right on six jointed legs, elbowed antennae, wings folded lengthwise along the back; an edit of a first generation that had a long stalked waist and wings floating over the body, shortening the waist to a pinch and laying the wings on the back |
| `wasp-pose-hover.png` | 1536x1024 | key pose: circle, inspect, depart | edit: airborne, body about 35 degrees nose-up, wings open at the top of the stroke (fore and hind wing as one), legs hanging, hind pair trailing |
| `wasp-pose-cruise.png` | 1536x1024 | key pose: flee, return | edit: fast flight, body near level, wings open and swept back, legs drawn up under the body |
| `wasp-pose-land.png` | 1536x1024 | key pose: land, take off | edit: just above a surface, body about 25 degrees up, wings raised high, all six legs reaching down with tarsi spread |
| `wasp-pose-feed.png` | 1536x1024 | key pose: feed | edit: standing on six feet, front lowered, head bowed with mandibles at the surface, antennae tips touching it, wings folded |

What was looked at and kept: the shelf art reads at shelf size, with the
cake's flat sugared top clear for a landing (the rosette's tails dip a few
pixels below the shared baseline, which the export's crop can absorb). Of the
reference drawings, a fresh generation with a sharper prompt came back with
the same long waist and was discarded; the edit fixed it. In the key poses
the far legs are partly hidden in the cruise (tucked behind the near ones,
as they would be), and the feed pose's abdomen came out a little longer than
the reference's: the rig's gaster is cut from the reference, so the pose is
only a guide for the angles.

## Verification (for the owner)

- Unit tests: `gaps.ts` (above); the bunting's swags, caps, seeded colours,
  breeze bounds, the swept footprint inside each gap's free space at every
  swing, and stillness under reduced motion; the wasps' state table, orbit
  layout against the air, routes inside the air or the exit lane, the
  two-band separation over long random runs, the short-air fallbacks and
  the layout-change rules; `measureRailAir`.
- The rig's tests: each pose's footprint over the whole flap cycle, feet on
  the surface when standing and feeding, the tripod's footfall order.
- `e2e/fete.spec.ts`: palette and mounting, every descendant click-through,
  `aria-hidden` and below dialogs, bunting on the overview and metrics pages
  (under the hero and across the gutters) and none over content
  (`e2e/content.ts`'s `coveredContent` extended additively to bunting's
  pennant and tape elements), the wasps always inside the measured air or the
  exit lane and never over the nav or the identity chip, a brushed swag
  swinging, a fast cursor chasing a wasp off, a still scene under reduced
  motion, and the phone layout (no shelf, no wasps, bunting where gaps
  exist).
- The lab's shared shelf contract, now including `fete`.

## Sources

- Wikipedia, *Vespula vulgaris* (worker and queen size; the anchor-shaped
  clypeal mark; colony from April to October; adults on sugars, larvae on
  insects): https://en.wikipedia.org/wiki/Vespula_vulgaris
- BWARS, *Vespula vulgaris* (workers appear later than the German wasp's;
  workers catch insects and spiders to chew for the larvae):
  https://www.bwars.com/wasp/vespidae/vespinae/vespula-vulgaris
- Wikipedia, Yellowjacket (12mm workers; adults on sugars, larvae on
  protein; late-season sugar foraging; the side-to-side flight before
  landing): https://en.wikipedia.org/wiki/Yellowjacket
- Watson and Dallwitz, *Insects of Britain and Ireland: the families of
  Hymenoptera*, Vespidae (wings folded longitudinally at rest; eyes
  emarginate; pronotum reaching the tegulae; antennal segments; the waist;
  tibial spurs): https://www.delta-intkey.com/britin/hym/www/vespidae.htm
- Wikipedia, Hymenoptera (hamuli locking the hind wing to the forewing; the
  wasp-waist between the first and second abdominal segments; the first
  abdominal segment fused to the thorax):
  https://en.wikipedia.org/wiki/Hymenoptera
- Wikipedia, Arthropod leg (coxa, trochanter, femur, tibia, tarsus with
  usually five tarsomeres, pretarsus): https://en.wikipedia.org/wiki/Arthropod_leg
- NC State, insect locomotion (the alternating tripod, three feet always
  down; one leg at a time at the slowest paces):
  https://genent.cals.ncsu.edu/bug-bytes/thorax/locomotion
- Chun, Biswas and Bhandawat 2021, *Drosophila* uses a tripod gait across
  all walking speeds (eLife): https://elifesciences.org/articles/65878
- Wingbeat of *V. germanica* about 148Hz, quoted in the optical-sensor study
  of the yellow-legged hornet:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC10107170/
- Thorax resonance in Hymenoptera (yellowjacket wingbeat 140 to 160Hz):
  https://www.biorxiv.org/content/10.1101/2019.12.11.873562v2.full
- Wikipedia, Insect flight (hovering by rapid wingbeats; the body tilting
  nose-down toward horizontal as forward speed rises):
  https://en.wikipedia.org/wiki/Insect_flight
- Zeil, Kelber and Voss 1996, Structure and function of learning flights in
  bees and wasps, J. Exp. Biol. 199 (backing away in arcs roughly centred on
  the goal, turning to keep it at a fixed place in view):
  https://www.lunduniversity.lu.se/lup/publication/9a1c4b47-204f-4756-ab81-13e9b9f5f96d
- Moreyra, D'Adamo and Lozada 2012, Cognitive processes in *Vespula
  germanica* wasps (learning flights as circling above the food; one visit
  enough to learn a site; more learning flights when food is moved):
  https://bioone.org/journals/annals-of-the-entomological-society-of-america/volume-105/issue-1/AN11097/Cognitive-Processes-in-iVespula-germanica-i-Wasps-Hymenoptera--Vespidae/10.1603/AN11097.full
- Moreyra, D'Adamo and Lozada 2007, Odour and visual cues utilised by German
  yellowjackets while relocating protein or carbohydrate resources (foragers
  return to a food source that has not been depleted; Australian Journal of
  Zoology):
  https://publish.csiro.au/zo/ZO06029
- Wikipedia, Catenary (the curve; a hanging chain between ends at different
  heights): https://en.wikipedia.org/wiki/Catenary
- Irvine and Caughey 1974, The linear theory of free vibrations of a
  suspended cable (Proc. R. Soc. A 341; in-plane and out-of-plane modes of a
  shallow cable), via Irvine's Caltech report:
  https://thesis.library.caltech.edu/11820
- Wikipedia, Pendulum (mechanics): the compound pendulum, period from the
  moment of inertia about the pivot:
  https://en.wikipedia.org/wiki/Pendulum_(mechanics)
- Hobbycraft, how to sew bunting (pennant size and spacing on tape):
  https://www.hobbycraft.co.uk/ideas/how-to-sew-bunting.html
- The WI's Victoria sandwich (a light dusting of caster sugar on top):
  https://www.thewi.org.uk/lifelong-learning/the-wi-is-what-you-make-it/food-and-lifestyle/recipes/recipes/baking-bread,-cakes-and-treats/wi-victoria-sandwich
- Country Life, why we give rosettes to winners (red for first in British
  shows; the Pony Club's blue):
  https://countrylife.co.uk/out-and-about/curious-questions-why-do-we-give-rosettes-to-winners-231998
- Wikipedia, Coconut shy: https://en.wikipedia.org/wiki/Coconut_shy
