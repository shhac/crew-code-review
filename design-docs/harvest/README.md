# Harvest (2026-10-10)

**Status**: pre-production draft (decisions settled, not built).

**Pins**: written against `ea7e9d5` (the hedgehog rebuild and its test
isolation). Code-internal.

September's theme, from `decisions/2026-10-seasonal-theme-calendar.md`. The
config value is `harvest`; `auto` will turn it on from 1 to 30 September in
the daemon's local time. This note settles the month's open questions before
code, as the calendar's checklist asks, so its owner starts from decisions,
research and art rather than from the calendar's one paragraph. Nothing here
is built yet; the numbers in it are targets for the owner to confirm against
the rig and the page, and to correct here if they move.

## What it shows

- **Rail shelf** (`HarvestShelf.svelte`): a scarecrow on its post beside a
  wheat sheaf, two marrows and a few apples. The scarecrow is drawn from parts
  so its arms can flap. Hidden on cramped rails like the other shelves.
- **Straw and grain** (`chaff.ts`): short stalks of straw lying along the
  ledges, with small clusters of wheat grains among them, only where
  `clearRuns` says the ledge is clear. The crows eat the grain.
- **Carrion crows** (`crow.ts`, `crows.ts`, drawn by `crow-rig.ts`): two, or
  three where the page has room, walking the ledges and pecking at the grain,
  stopping now and then to look about. A moving cursor near the scarecrow
  makes it flap its arms; every crow on the page takes off and flies off the
  page, and they drift back in ones and twos after a while.
- **No sky effect.** The rail sky stays empty. The crows never use it (see
  "Where scattered crows go"), and a moon or drifting leaves there would only
  compete with the scarecrow, which is the month's one moving thing in the
  rail.

## Decisions

### Two or three crows: a pair and last year's young

The calendar's animal rule asks for at least two. Carrion crows hold
territories as pairs, and in many populations the young of the year stay on
or near the family's ground into autumn, some for up to two years, so a crow
family of three feeding together on a September stubble field is the natural
group (Animal Diversity Web; Baglione et al. on carrion crow family groups).

- **How many**: three where three feeding spots (below) exist at once, at
  least 90px apart on one ledge or on different ledges; else two; one or none
  only when the page has fewer spots. Decided once when the group is placed,
  and kept: crows that leave and come back are the same crows, and a group
  never grows on scroll or on a later measurement.
- **Spacing**: never closer than 60px centre to centre on a ledge (a 38px
  crow and a gap), so they never overlap. A walk stops 60px short of another
  crow and never passes one. They are stepped and placed in a fixed order,
  each seeing the others as they now are (`lib/theme/group.ts`).

### Size, measured from the page

The crow is drawn at one page scale for every pose, set so that the reference
drawing standing is 26.5px tall, which makes it about 38px from bill tip to
tail tip. That fits the room the page has: the first row of card tops has
22px up to the heading rule plus the 6px a standing animal may reach into the
empty edge above (the fox and the hedgehog stand at 26.5 for the same
reason), and the heading rule has 26 to 30px where its text leaves room. The
key poses give these boxes at that scale (measured from the drawings; the
owner's rig tests replace them with the box each pose stays inside through
its whole motion):

| Pose | Footprint (target) | Used for | Needs clear above |
| --- | --- | --- | --- |
| stand | 38.5x26.5 | scanning, settling, reduced motion | 27px |
| walk | 39x26.5 | walking to grain | 27px over its stride |
| peck | 35x25 at the dip, 39x26.5 between pecks | pecking | 27px |
| alert | 32.5x29 | head up, watching the cursor | 29.5px; elsewhere the stand pose with the head raised instead |
| skim | 46x34, reaching 6px below its own line | low flight along a ledge's band, take-off and landing where the air is low | 28px above, 6px below |
| flight | 46x58 target (planned at 46x64 until the rig measures it) | flapping flight in open air | the whole box, everywhere along the route |

Every pose is anchored at its feet (or, flying, at the point under its body
on the line it flies along) and mirrored to face the way it goes; the art
faces right. A pose that does not fit is not used: no room for `alert` means
the stand pose with the head raised; no air for a route means no flight
there, and so no crow feeding there (below).

### Where a crow may feed: only where it can get away

Real crows feed in the open, where they can see danger coming and take off
without obstruction. On this page that rule also solves the airspace
problem. A **feeding spot** is a place on a ledge where:

1. the stand pose fits (`clearRuns(f, obstacles, 27, { reach: 6 })`), at least
   16px inside the clear run, in view (`inView`);
2. grain lies within 30px of it (it has not all been eaten);
3. it keeps 90px from every other crow and from where each is heading;
4. **an escape route exists from it**: a flight route (see "Airspace") from
   the spot off the page, by the top or the right edge, whose swept envelope
   stays in air the whole way.

A crow is only ever placed, or lands, at a feeding spot, and only walks along
the clear run its spot is on. If the page has no feeding spot there are no
crows on it; that is the calendar's "none only when the geometry cannot host
them safely". A survey of the preview (every route at 1024, 1280, 1440 and
1920px wide and at 760 and 390, measuring the stand box, a 46x34 skim and a
46x64 flight envelope against the real text, controls, charts and cards)
found at least one clear run with an escape route on every route at every
width: the first row of card tops on most pages, the heading rule's clear
stretch on the others (the leaderboard at 1024 and 1280 is the exception
found, where the run under the heading has no way out, so the crows feed on
other routes only there). At 1440 on the overview, both first-row card tops
and the heading rule's clear stretch qualify, so three crows fit.

### The scarecrow is in the rail, so "near the scarecrow" is the rail

The scarecrow stands on the rail shelf, outside `main`. The shelf owns the
trigger, since only it knows where its scarecrow is drawn:

- **Near**: a moving mouse or pen (the shared passive pointer: hover, no
  buttons; `pointerTracker` strokes) whose stroke passes within 32px of the
  scarecrow's box at rest (body, hat and both arms), in viewport coordinates,
  measured from the scarecrow's own element. A still cursor does nothing,
  however close: the calendar says moving.
- **The flap**: three flaps of 0.5s each, the arms swinging from 8 degrees
  below horizontal up to 40 above and back, eased at each end, both arms
  together; the hat jolts up 1.5px and settles on each upswing; the post does
  not move. Strokes that keep arriving near it add a flap at a time, up to
  eight; then it rests 1s before it can start again. On its own the arms
  stir 2 degrees in the wind on a slow 4 to 6 second breath.
- **The signal**: each flapping episode, as it starts, sends one message to
  the page layer through a month-local store (`harvest/alarm.ts`): when it
  started and where the scarecrow is (its centre, viewport coordinates). The
  layer never reads the shelf's geometry and never draws into the shelf.
- **Hidden shelf** (phones, short windows: `offsetParent` null): no
  scarecrow, so no flap and no scatter. The crows still feed, and still come
  and go on their own (below).
- **Reduced motion**: the arms rest straight out, no stirring, no flap, no
  signal.

This is why the calendar's "rail shelf slot" surface is still not needed: the
layer only has to hear that the scarecrow flapped, not where the shelf is.

### A flap scatters every crow on the page

A scarecrow guards the whole field, and crows flush together when one takes
alarm, so a flap scatters all of them, not only those near the rail (which,
the scarecrow being at the rail's foot, would usually be none).

- Each crow takes off in turn, nearest the scarecrow first (page distance
  from the scarecrow's centre), 0.2 to 0.35s apart, so the take-off ripples
  away from it.
- A crow already arriving turns back: it plans a route from where it is to an
  exit and leaves.
- They stay away 15 to 25s after the last flap ends, each its own time; a
  flap while they are away starts their wait again, so a cursor that keeps
  stirring the scarecrow keeps them off.
- They come back one at a time (the first is a scout; the next waits until it
  has landed and 2 to 6s more), each to a feeding spot whose arrival route is
  clear, farthest from the scarecrow first. A crow that finds no spot stays
  away and looks again every 5s, still counted in the group.

### Where scattered crows go: off the page, by the top or the right edge

Not the rail sky and not other ledges.

- **The rail sky** is above the scarecrow; crows flee away from what scared
  them, not over it. The rail also holds the nav's text around the sky.
- **Other ledges**: a crow that only moved to another ledge would mean the
  scarecrow had failed, and flights from ledge to ledge need open air in
  between, which the page rarely has (cards are stacked 16 to 25px apart).
- **Off the page** reads as a flock scattering, and the survey above shows
  every feeding spot can be given a way out. The top and the right edges are
  the exits; the left is the rail (and the scarecrow), and flying down out of
  the bottom reads as falling.

The crow is drawn until its whole envelope is past the edge; it does not
fade. It comes back the same way in reverse, entering past an exit edge.

### Airspace contract

The crows are the first animals here that leave the ledges and the page.
This is their contract; any code the February cupids have made shared by then
(phase B) is used under it with the crows' own numbers.

- **Air** is defined per measurement, in viewport coordinates, from the same
  `PageMap` as the ledges (`measurePage` with obstacles): the viewport, plus
  the space beyond its top and right edges; minus every text, control and
  chart box; minus each card's box shrunk by 6px on every side (a crow may
  overlap a card's empty edge by the same 6px a standing animal may, never
  its inside, which is full of content); minus the whole rail (sky
  included); minus anything below the viewport. It is recomputed whenever the
  page is remeasured and needs no ids: every route is re-checked against the
  newest air.
- **Envelopes**: a crow's drawing stays inside one of two boxes, each the
  union of every frame of its wingbeat at the largest tilt it flies at,
  which the rig's footprint test checks: **skim** (shallow strokes, wings
  between 15 degrees above and below level; 46x34, from 28px above its line
  to 6px below) and **flight** (full strokes; 46x58 target). A route segment
  uses the flight envelope wherever it fits and the skim envelope where only
  that fits; the stroke's depth eases between the two over 0.25s, so it
  never jumps. Nowhere does a crow fly with less than the skim envelope's
  room.
- **Routes** are chains of cubic curves with shared tangents (as the robin's
  `flight-route.ts`), each checked by subdividing it until every piece's
  control hull, grown by the envelope, is in air. A departure is tried in
  this order: a climb from the spot up and to the right, off the top; a skim
  along its own ledge's band to the right edge; a skim to where the flight
  envelope first fits, then a climb off the top. The first that is clear is
  used. An arrival is the same, planned from an entry point past an exit edge
  to the spot.
- **Speed and turns**: 180 to 240px a second along the route, eased in at
  take-off and out at landing; the body pitches with the route's slope, at
  most 20 degrees, as the robin's does.
- **Keeping apart in the air**: a route is accepted only if, sampled every
  50ms, the crow's envelope stays at least 8px from every other crow's
  envelope at the same moment (and from any crow standing). If not, the crow
  waits 0.2s and plans again, for up to 2s; after that it walks 20px away
  along its run and tries again. Arrivals come one at a time anyway.
- **Hovering**: crows do not hover; nothing does here.
- **Layout change mid-flight** (scroll, resize, the page changing): the crow
  keeps flying in viewport coordinates and its remaining route is re-checked
  against the new air. A leaving crow that is no longer clear plans a new way
  out from where it is; with none, it is taken away at once (it was leaving
  anyway). An arriving crow plans again to its spot if that still qualifies,
  else to another feeding spot, else back out; with none, it is taken away
  and waits as above. A crow is never left drawn where the new air does not
  hold it.
- **Reduced motion**: no flight at all.

### Straw and grain

Drawn in code, like the frost, one stroked path per ledge, only where
`clearRuns(f, obstacles, 4)` says 4px is clear, on card tops and heading rules
alike (never under heading text), seeded by ledge id so scrolling never
reshuffles it.

- **Straw**: stalks 4 to 9px long, lying within 12 degrees of flat, 1.1 to
  1.6px wide, in two straw tones with a darker node now and then, about one
  in each 14px slot, some crossing.
- **Grain**: wheat grains 1.6x1.1px, warm gold with a darker crease, in
  clusters of two to five in about half the 24px slots.
- **Caps**: never taller than 3px; at most 220 stalks and 160 grains on a
  page, shared out a ledge at a time (as the frost's glint cap, so a long page
  is not bare below its first cards).
- **Pecking eats grain.** Each peck takes the grain nearest the bill's tip
  within 6px; it is no longer drawn. A crow walks on to the next cluster
  along its run when none is in reach, and a spot with no grain within 30px
  is not a feeding spot. Eaten grain comes back, fading in over 2s, once no
  crow has been within 40px of it for 20s (somebody has scattered more). The
  straw is never eaten.
- **Reduced motion**: all the grain is drawn, none eaten.

### Crow behaviour

A pure model per crow (`crow.ts`); standing, it is in ledge-local x so it
rides with its card on scroll; flying, it is in viewport coordinates. The
cursor is the last mouse or pen hover position, forgotten on pointer down,
leaving the window, blur, a hidden tab and a reduced-motion change, as for
every theme.

| Mode | Pose | Ends when | Then |
| --- | --- | --- | --- |
| away | not drawn | its return time comes, it is its turn, and a feeding spot has a clear arrival route | arrive |
| arrive | flight or skim along the route, the last stretch a glide, then two braking strokes with the legs reaching forward | its feet touch the ledge | settle |
| settle | stand, wings folding over 0.25s, a flick of the tail | 0.6s | scan (1.5 to 3s the first time) |
| scan | stand, head raised, turning to look | 0.8 to 2s | peck if grain is in reach, else walk |
| walk | walk, head bobbing | it reaches grain along its run (at most 60px, at 20px/s) or another crow's 60px | peck |
| peck | peck: 2 to 5 pecks of 0.35s | the last peck | walk (70%) or scan |
| wary | alert (or stand, head raised), facing the cursor | the cursor has stayed beyond 70px for 1.2s | scan |
| sidle | a quick walk at 45px/s, away from the cursor along its run, at most 30px | it gets there | wary |
| take-off | a crouch (0.15s), then the spring (0.12s), the first stroke starting as the feet leave | its feet are off the ledge | depart |
| depart | flight or skim along the route | its envelope is past the exit edge | away |

- **Scatter**: a scarecrow signal sends every crow that is not away to
  take-off, in the order above; one arriving turns back into depart.
- **Restless**: now and then (every 60 to 120s, one crow at a time, never
  while another is flying) a crow takes off on its own and comes back 8 to 15s
  later, to a different spot if one qualifies. This is how the crows move
  between ledges, so the page is not static when nobody touches the
  scarecrow, and it works on phones, where there is none.
- **Cursor near a crow**: a cursor within 70px (moving, or still for less
  than 1.2s) makes that crow wary; one moving within 40px and toward it makes
  it sidle away along its run, if it has room, else stay wary. The cursor
  alone never makes a crow fly: flying off is the scarecrow's job, and that is
  the month's idea. Otherwise the head turns toward a cursor within 160px, at
  most 14 degrees, eased.
- **First placement**: at feeding spots, scanning, with no arrival; restless
  in 20 to 60s.
- **Layout changes** for standing crows: a crow keeps its ledge, position and
  mode while its spot's run still exists and still has an escape route, with
  its position and any walk target pulled inside the run if it shrank;
  otherwise it is placed at a new feeding spot with no animation, or, with
  none, taken away to come back later. A ledge scrolled out of view keeps its
  crow (it rides off with its card); only a new spot or an arrival must be in
  view.
- **Reduced motion**: every crow stands at its spot, head level, no blink,
  never stepped; it keeps its spot across measurements while the spot stays
  clear, else it stands in the middle of the best clear run with an escape
  route. The scarecrow rests with its arms straight out.

### Accent

Blackberry `#c39be0`, for the hedgerows in September: distinct from the
default lime, Halloween's orange, Bonfire's gold (which wheat or straw would
have been too close to), the warning amber, the info blue and the bad ink's
salmon. The page gets a faint warm glow in its top-right corner, a low harvest
moon (about `rgba(255, 200, 120, .05)`), behind everything. A proposal:
easy to change in `styles/themes.css`.

### Debug overlay

With `?theme-debug=1` the harvest layer draws, over the shared ledge and sky
overlay: each feeding spot (a tick, hollow when it has no escape route),
each crow's current route as a dashed line with its envelope box at eight
points along it, and the two exit edges.

## Research

### The carrion crow

- **Size and build.** 45 to 47cm from bill tip to tail tip, wingspan 93 to
  104cm, 370 to 650g (RSPB). The wing from shoulder to the longest primary's
  tip is therefore about as long as the whole bird. Broad, evenly wide wings
  with "fingered" primary tips; a square or slightly rounded tail (a raven's
  is wedge-shaped, a rook's more rounded and its bill pale with bare skin at
  its base).
- **Colour.** All black, with a green-blue and purple gloss; the bill stout,
  black and slightly arched, as long as the head, with bristle feathers over
  the nostrils; the eye dark brown; the legs and feet black (RSPB, BirdForum).
  Its look on the page is carried by blue-grey highlights on black, since a
  black bird on a dark page needs its shapes separated.
- **Standing posture.** The body at about 30 degrees, wings folded along the
  sides with the primary tips reaching most of the way along the tail.

### Legs and feet, by name

A bird stands on its toes. Its leg has the same joints as a mammal's hind leg,
placed so that most of them are out of sight:

- the **hip** inside the body, and the short **femur** running forward from it
  to the **knee**, also inside the body's feathers, which bends forward;
- the **tibiotarsus** (the drumstick) from the knee down and back to the
  **intertarsal joint**, the ankle, which points backward and is the joint
  people mistake for a backward knee. On a crow the tibiotarsus is covered by
  the feathered "trousers";
- the **tarsometatarsus**, the bare, scaled part people call the leg, from the
  ankle down and slightly forward to the toes;
- the **toes**, joined at the metatarsophalangeal joint: three forward and the
  **hallux** back (anisodactyl, the passerine arrangement), each with a
  curved claw, flat on the ground standing.

(Bird feet and legs, Wikipedia; birds-online.de on the hidden knee.) In the
rig these map onto the three-bone hind leg of `rig/gait.ts` (the mammal's
hock is the same ankle): hip and knee inside the body, the feathered shank to
the intertarsal joint, the bare tarsus to the toes. The lab's joints view
names them hip, knee, intertarsal joint (ankle) and toes.

### Walking, pecking and looking

- **Gait.** Crows walk, one foot after the other, rather than hop as jays and
  sparrows do (Stanford Birds); in a hurry they break into a skipping run
  (Alexander, as summarised there). A walk is the gait whose duty factor
  is over a half (Hancock et al., tinamous); the crow's walk here keeps each
  foot down for 60% of a stride, the two feet half a stride apart, so one is
  always down and both are for a fifth of the stride. A foot lifts heel
  first, its toes curl as it swings forward low, and open again just before
  it is set down flat.
- **Head bobbing.** Crows are among the birds that bob the head walking
  (Jiménez Ortega et al. list them; Necker's review): the head holds still in
  space while the body walks under it, then thrusts forward, one bob per
  step. At 20px/s and about three steps a second the hold lasts about 0.2s and
  the thrust 0.15s, eased so it reads as a bob, not a jerk.
- **Pecking.** Surface pecking is the commonest way corvids feed on farmland
  in winter (the northern Italian farmland study in Avocetta). The body tips
  forward from the hips, the neck reaches down and the tail lifts behind;
  the bill strikes, holds a moment and lifts. Pecks come in short bouts
  broken by looking up, which is when a feeding bird checks for danger.

### Take-off, flight and landing

- **Take-off.** Birds jump into the air: the legs give over 90% of the speed
  at lift-off (93.6% in the zebra finch, 95.2% in the diamond dove; Provini et
  al. 2012), and in most species the feet leave the ground about halfway
  through the first downstroke (Tobalske et al., SICB). The first stroke is
  a transition, weaker than those after it. Hence the crouch, the spring with
  the wings already raised, and the first stroke starting as it leaves.
- **Wingbeat.** A hooded crow (*Corvus corone cornix*, the carrion crow's
  grey-and-black form) flew with continuous flapping at 3.84Hz and 10.5m/s,
  at 0.553kg with a 0.925m span (Pennycuick 2001). The crows here beat at 3.6
  to 4Hz (each crow its own, seeded): about 0.26s a beat, 15 or 16 frames at
  60 a second, enough to draw every stroke rather than a blur. The
  downstroke takes 55% of the beat. (Their speed on the page is set to read,
  not scaled from 10.5m/s, which would cross a screen in a second.)
- **The wing's stroke.** The downstroke is made with the wing spread; on the
  upstroke the wing is flexed at the wrist, folding the hand back, which
  most birds do in slow flight (Crandell and Tobalske 2015). Seen from the
  side, a wing turning about the body's long axis shows a height of its
  length times the sine of its angle, so the rig draws each wing spread flat
  and squashes it vertically by that sine, flipping it below the body on the
  downstroke; the hand folds back through the upstroke. Full strokes run from
  about 50 degrees above level to 40 below; skim strokes 15 either way.
- **Landing.** In the last wingbeats before landing the wings make about
  twice the force of take-off's first beats, braking (Provini et al. 2014):
  the body pitches up, the wings sweep forward, the tail fans and presses
  down, and the legs swing forward with the toes open to take the ground.
  Then the wings fold and the tail gives a flick, as crows' do on landing.
- **Blinking.** Birds blink with a third eyelid, the nictitating membrane,
  which sweeps across the eye from front to back; on a crow it is pale. The
  rig's lid is drawn that way, pale blue-grey, in 0.12s, on a seeded schedule.

### The scarecrow, and why its arms can flap

A traditional scarecrow is two timbers in a T, the crossbar about a quarter of
the way down the upright, driven into the ground, dressed in old clothes with
the sleeves tied off, stuffed with straw, a stuffed sack or pillowcase for a
head and a hat on top; loose clothes that move in the wind scare more birds
(the Titchfield and Uckfield guides). On a rigid crossbar the arms cannot
flap. This one's sleeves are each tied at the shoulder to a short yoke on the
post, so each hangs from its own pivot and swings there, which is also how a
wind-driven flapping scarecrow is made. Drawn from the front, the swing is
in the picture's plane and reads at shelf size; from the side it would not.

## Art plan

### The crow's parts

From one drawing, as the fox and the hedgehog were: `crow-standing.png` is
the reference, and every part is an edit of it, placed where it sat in it
(`art.py`'s `place`, with a mask on the bill and eye where the black
silhouette is ambiguous), all exported on one eye scale.

- **Body**: legs, head, tail and folded wing taken off, closed underneath,
  the "trousers" kept as part of the body's lower edge so the bare tarsus
  comes out of them.
- **Head**: bill, eye and bristles, with a soft unoutlined back edge where it
  sits over the neck, so no line crosses it when it bobs and pecks.
- **Tail**: one piece pivoting at the rump (it lifts when pecking, fans and
  presses down landing: a vertical scale of up to 1.4 with a rotation).
- **Folded wing**: drawn over the body standing and walking; hidden in flight.
- **Spread wing**, in two pieces: the arm wing (shoulder to wrist, with the
  secondaries) and the hand wing (wrist to the fingered primaries), drawn as
  if seen flat from above, true to length (shoulder to primary tip about as
  long as the bird), so the wrist can fold on the upstroke. The far wing is
  the same art a shade darker, behind the body; both beat together.
- **Legs and feet**: a bare tarsus piece (scaled, black, drawn twice: outlined
  and as fill only), the foot from the side (three toes forward, the hallux
  back, claws), and the same foot curled, for the swing and for flight, where
  the legs tuck up under the belly.
- **Eye**: the nictitating membrane drawn in code.

### The scarecrow's parts

From `scarecrow.png`, by edits: the body (post, jacket, head and collar
straw) as one piece; the hat on its own (it jolts); and each arm (a stuffed
sleeve with its straw cuff) on its own, its inner end rounded and continuing
under the jacket's shoulder so no gap shows as it swings, its pivot at the
shoulder seam. `scarecrow-flap.png` is the key pose for the flap's top. On the
shelf the scarecrow stands about 64px tall at the left of a 168px stage, with
the still life (about 76x38) at its feet to the right; the stage keeps room
above for the arms at the top of the flap.

### The key poses

Each an edit of the reference, for the lab to lay over the rig in each mode:
`crow-pose-walk` (a step), `crow-pose-peck`, `crow-pose-alert`,
`crow-pose-takeoff-2` (the spring, wings high), `crow-pose-flight-up-2` and
`crow-pose-flight-down-2` (the top and bottom of a stroke) and
`crow-pose-land-2` (the flare). The flight poses were redrawn once: the first
set drew the spread wing about a third of the bird's length where a crow's is
about its whole length. The redraws reach a half to two thirds of it, which
reads right for the posture of the body, tail, legs and wing angle that the
poses are for, but is still short: the rig takes the wing's length from the
anatomy (shoulder to primary tip about the bird's length, projected by the
sine of its angle), not from these drawings, and the spread wing parts must
be drawn true to length. The redraws also came out with the body a little
smaller than the reference's; exporting each on the reference's eye scale
(`art.py`'s `feature`) puts them back on one scale.

### Provenance

Generated on 2026-10-10 by the Codex CLI (`gpt-5.6-terra`) through its
built-in `$imagegen` path, each on a flat magenta `#FF00FF` background (no
art colour comes near it; the crow's gloss was kept blue-green and
blue-grey). Style references: `design-docs/bonfire/toffee-apples.png`,
`bonfire.png` (its guy, for the scarecrow), `design-docs/aurora/winter-kit.png`,
`design-docs/halloween/pumpkins.png`, and for the crow
`design-docs/aurora/fox-standing.png` and `bonfire/hedgehog-standing.png`.
No parts are cut yet and nothing is exported: the owner does that once the
rig is decided, with an `export.py` on `design-docs/art.py`.

| Source | What it is | Prompt summary | Drawn size (key, then crop) |
| --- | --- | --- | --- |
| `harvest-still-life.png` | the shelf's still life | a tied wheat sheaf, two striped marrows in front, four red and green apples | 1774x887, art 1418x820 |
| `scarecrow.png` | the scarecrow, front view | a sack head with button eyes and a stitched smile, felt hat, patched tweed jacket stuffed with straw, separate straight sleeves with straw cuffs, on a post, no legs | 1254x1254, art 1204x1187 |
| `scarecrow-flap.png` | its flap, an edit of it | both sleeves swung up about 40 degrees at the shoulders, nothing else moved | 1254x1254, art 1167x1194 |
| `crow-standing.png` | the crow's reference drawing | a carrion crow standing square, side view facing right, both legs and feet visible, the anatomy spelt out | 1536x1024, art 1243x857 |
| `crow-pose-walk.png` | a step, an edit | near leg planted, far leg swinging forward with the toes curled | art 1242x854 |
| `crow-pose-peck.png` | pecking, an edit | body tipped 40 degrees, bill to the ground, tail raised | art 1137x809 |
| `crow-pose-alert.png` | alert, an edit | body upright, neck stretched, sleeked | art 1046x936 |
| `crow-pose-takeoff-2.png` | the spring, an edit | legs extending, wings high at the top of the first stroke; the wing's true length spelt out | art 1020x973 |
| `crow-pose-flight-up-2.png` | top of the stroke, an edit | level body, wings raised, wrists flexed, legs tucked; true wing length | art 1230x862 |
| `crow-pose-flight-down-2.png` | bottom of the stroke, an edit | wings spread and swept below the body; true wing length | art 1256x827 |
| `crow-pose-land-2.png` | the flare, an edit | body pitched up, wings forward, tail fanned, legs reaching forward; true wing length | art 1043x967 |

The crow's sources are each 1536x1024. Rejected and deleted:
the first take-off, flight and landing poses (wings far too short).

## Verification (for the owner)

The brief's and the calendar's lists, plus for this month:

- Unit tests: the state table; scatter order, the turn-back of an arriving
  crow, the wait reset by a later flap, one-at-a-time return; feeding spots
  (stand fits, grain, spacing, escape route); routes never leaving air over
  long random runs and random layouts, including the 8px separation in time;
  re-planning on a layout change mid-flight; grain eaten and returned, caps,
  never under heading text; the rig's footprints over the whole wingbeat and
  every ground pose, feet never below the ledge; the scarecrow's flap timing
  and its signal.
- `e2e/harvest.spec.ts`: mounting, click-through on every descendant,
  `aria-hidden`, below dialogs; at least two crows on the overview; a stroke
  near the scarecrow flaps it and empties the page of crows, sampled through
  the scatter for `coveredContent` (crows mid-flight included) and for no crow
  image inside the rail's box; the phone layout (crows, no scarecrow);
  reduced motion still with the cursor stirring near the scarecrow.
- The lab: the crow's page with an airborne view (no floor anchor) for the
  skim and flight modes, every key pose laid over its mode, the joints view
  naming hip, knee, intertarsal joint and toes; and the shared shelf contract
  including `harvest`.

## Sources

- RSPB, carrion crow (length 45 to 47cm, wingspan 93 to 104cm, weight; heavy,
  steady wingbeats): https://www.rspb.org.uk/birds-and-wildlife/carrion-crow
- RSPB, how to identify the crow family (crow against rook, raven, jackdaw):
  https://web-cdn.rspb.org.uk/birds-and-wildlife/identifying-birds/corvids-how-to-identify-the-crow-family
- BirdForum Opus, carrion crow (gloss, eye, legs, bill):
  https://www.birdforum.net/opus/Carrion_Crow
- Animal Diversity Web, *Corvus corone* (pairs on territories; family groups):
  https://animaldiversity.org/site/accounts/information/Corvus_corone.html
- Baglione, Canestrari et al., carrion crows: family living and helping in a
  flexible social system (young staying with their parents):
  https://www.cambridge.org/core/books/cooperative-breeding-in-vertebrates/carrion-crows-family-living-and-helping-in-a-flexible-social-system/6D7FA203CCD0BC1B153E5E1C53ABF04F
- Pennycuick 2001, Speeds and wingbeat frequencies of migrating birds compared
  with calculated benchmarks, J Exp Biol 204 (Table 1 and 2: *Corvus corone*,
  0.553kg, 0.925m span, 3.84Hz, 10.5m/s, continuous flapping):
  https://tethys.pnnl.gov/sites/default/files/publications/Pennycuick_2001.pdf
- Bird feet and legs (femur, hidden knee, tibiotarsus, intertarsal joint,
  tarsometatarsus, hallux; birds stand on their toes):
  https://en.wikipedia.org/wiki/Bird_feet_and_legs
- birds-online.de, the bird's knee (forward-bending knee hidden in the
  feathers; the visible "heel" is the ankle): https://www.birds-online.de/wp/?p=20276
- Stanford Birds, walking versus hopping (crows stride, jays hop):
  https://web.stanford.edu/group/stanfordbirds/text/essays/Walking_vs_Hopping.html
- Hancock, Stevens and Biknevicius 2007, tinamou locomotion (walks at duty
  factors of a half or more):
  https://people.ohio.edu/stevensn/documents/Hancock%20et%20al%202007%20Tinamous%20early%20view.pdf
- Jiménez Ortega et al. 2009 (crows among the birds that head-bob walking;
  hold and thrust phases):
  https://dev2.imp10.ruhr-uni-bochum.de/bpsy/mam/content/papers/jimenez2009.pdf
- Necker, head-bobbing of walking birds, a review (one bob per step):
  https://reinhold-necker.de/seite10.html
- Foraging behaviour and habitat use in corvids wintering on farmlands in
  northern Italy, Avocetta (surface pecking the commonest technique):
  https://avocetta.org/articles/vol-22-12-vkb-foraging-behaviour-and-habitat-use-in-corvids-wintering-on-farmlands-in-northern-italy
- Provini, Tobalske, Crandell and Abourachid 2012, Transition from leg to wing
  forces during take-off in birds, J Exp Biol 215:
  https://research.bangor.ac.uk/en/publications/transition-from-leg-to-wing-forces-during-take-off-in-birds/
- Provini et al. 2014, Transition from wing to leg forces during landing in
  birds, J Exp Biol 217:
  https://cob.silverchair.com/jeb/article/217/15/2659/12207/Transition-from-wing-to-leg-forces-during-landing
- Tobalske, Altshuler and Powers, take-off mechanics (in most birds the feet
  leave the perch about halfway through the first downstroke):
  https://sicb.org/?p=36572
- Crandell and Tobalske 2015, Kinematics and aerodynamics of avian upstrokes
  during slow flight, J Exp Biol 218 (the wrist-flexed upstroke):
  https://cob.silverchair.com/jeb/article/218/16/2518/14222/Kinematics-and-aerodynamics-of-avian-upstrokes
- St Peter's Titchfield, guide to building a scarecrow (the T frame, straw,
  tied sleeves, sack head):
  https://www.stpetertitchfield.org.uk/wp-content/uploads/2024/04/Guide-to-Building-a-Scarecrow-V2-2024.pdf
- Uckfield Town Council, ideas for making a scarecrow (crossbar a quarter of
  the way down; loose clothes that move scare more birds):
  https://www.uckfieldtc.gov.uk/wp-content/uploads/2025/07/Ideas-for-Making-a-Scarecrow-UTC.pdf
