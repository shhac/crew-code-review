# Summer tennis (2026-10-10)

**Status**: being built. Done: the birds' parts cut and exported, the
shelf, the court lines (see "As built" under each). Waiting on the bird kit
(legs, gait with head bob, flight poses, the envelope check) and the
surfaces kit (courts, exits, the `?theme-cue=` cue) for the rigs, the
flights and the rally.

**Pins**: written against `ea7e9d5` (the hedgehog rebuilt from one drawing and
the robin kept mounted). Code-internal, except the research sources below.

July's theme, from `decisions/2026-10-seasonal-theme-calendar.md`. The config
value is `wimbledon`; `auto` will turn it on from 1 to 31 July in the
daemon's local time. This note settles the month's open questions before
code, as the calendar's checklist asks, so the owner who builds it starts
from decisions, research and art rather than from the calendar's one
paragraph.

## What it shows

- **Rail shelf** (`WimbledonShelf.svelte`): a white bowl of strawberries and
  cream, a glass jug of fruit cup with strawberries, orange, cucumber and
  mint, and an old wooden racquet with a ball, on a strip of mown lawn drawn
  in code (two greens, in stripes). Hidden on cramped rails like the other
  shelves. As built: the kit is 140x55 on a 168x64 stage, standing in a
  168x12 lawn of seven mown stripes with a chalked baseline along its front.
- **Court lines** (`lines.ts`): a chalk-white line along the ledges, with a
  centre mark and the corners of a court, where the page leaves them clear.
- **Pigeons** (`pigeon.ts`, drawn by `pigeon-rig.ts`): two, or three where
  the page has room, wander the ledges, walking with the head bob, pecking
  and standing about. A cursor that comes close makes one walk briskly away;
  one swept past fast makes it fly off and come back later.
- **The hawk** (`hawk.ts`, drawn by `hawk-rig.ts`): every minute or two a
  single Harris's hawk sweeps low along the row of ledges the pigeons stand
  on. They see it coming, clap up off the ledge and fly away ahead of it, out
  of the window; when it has gone they come back one at a time and land.
- **The rally** (`rally.ts`): every so often a ball rallies between two
  cards that sit side by side, bouncing on each card's top with the gap
  between them as the net. Hovering the cursor in its path volleys it back.
- **No sky effect.** The rail sky stays empty: July's movement is on the
  page, and the rail is calmer without it.

## Decisions

### No marks of the real championships

The calendar names the month after the championships, and the config value
`wimbledon` stays as the calendar fixes it (it is also a place). Nothing the
theme draws carries the championships' marks: no logo, no crossed racquets,
no purple-and-green livery, no trophy, no players, umpires or ball crew, no
named hawk (the real one has a name; ours has none), no lettering anywhere.
The calendar's "jug of Pimm's" is drawn as an unlabelled jug of fruit cup,
and user-facing copy (the root README, the release notes, `config set`'s
help) calls the month "summer tennis" with the config value in code style,
rather than using the drink's brand or the event's name as a title.

### One hawk: the exception the calendar allows

The calendar's animal rule asks for two or three of a species and allows an
exception "where the idea needs one animal (a single predator and its prey,
say)". This is that case, so the note takes it: one Harris's hawk and two or
three pigeons. Wild Harris's hawks hunt in family groups of around five, but
the bird the calendar is about is a falconer's hawk, flown alone in the early
morning to keep pigeons off the courts and roofs, kept fed so that it scares
rather than kills (sources below). One hawk is the accurate picture of that,
and two would turn a deterrent into a hunt. The hawk is never shown catching
anything: it passes, the pigeons go, nobody is hurt.

### Sizes: one scale for both birds

Both birds share one page scale in centimetres, so the hawk is the size it
should be beside the pigeons: a feral pigeon is 30 to 35cm long, a Harris's
hawk 46 to 59cm, so the hawk is drawn 1.6 times the pigeon's length. A
tennis ball (6.5 to 6.9cm) is drawn on the same scale.

The pigeon's size is set by the page. Every pose a pigeon takes on a ledge
must fit the room the other animals have: 22px on a first-row card top plus
6px into the empty edge above, so 27px tall with a pixel spare. The tallest
grounded pose is the alert one (neck stretched up), so the page scale is
chosen to make the alert pose, measured over its whole motion by the rig
test, at most 27px tall. From the reference drawing's proportions that makes
a standing pigeon about 26 to 28px long and 21 to 24px tall, and these
footprints the budget (the rig's tests replace them with measured boxes):

| Pose | Footprint budget (w x h) | Used for |
| --- | --- | --- |
| stand | 30x24 | standing, looking about |
| walk | 36x24 (the head thrust adds width) | wandering, shying away |
| peck | 32x22 | feeding on the grass |
| alert | 28x27 | the hawk overhead, a flockmate flushing |
| take-off | 38x44 | the clap and the first beat, rising off the ledge |
| flight | 36x44 (the whole flap cycle) | flying out and back in |
| landing | 34x42 | the last 0.35s before touchdown |

The hawk at 1.6 times the pigeon is about 44px long. Gliding with its wings
level it is long and low: the glide drawing is about four times as long as
it is deep, so about 46x14 over its whole glide (wings, a 1px rise and fall,
the tail). Flapping, its wings reach about a body length above
and below it, about 48x52 over the flap cycle.

All the grounded pigeon poses fit the 22px of a first-row card top plus its
6px; the flight poses do not fit there, which is what the airspace contract
below is about.

### The page's room, measured

A survey of the running preview (every route, at 1440x900, 1280x800 and
1024x768, unscrolled and scrolled 400px) measured, for each ledge, how much
standing room there is for a 30x24 pigeon (counting the 6px reach), how much
of that a pigeon could fly away from with a 38x46 flight footprint (a
continuous path of clear air to an exit, by a flood fill of the clear
positions), and where a 56x20 glide crosses the whole page clear of content:

- **Unscrolled, every route but the leaderboard has a clear flight stage**:
  the band between the page heading's text and the first row of cards. At
  1440 on the overview it is 48px tall (the heading's last text line ends at
  y 134, the cards start at 182), and pigeons standing anywhere on the first
  row of cards can fly out along it (984px of the 2032px of standing room);
  1024 and 1280 are the same in kind. On the leaderboard the heading's text
  runs down to its rule, so pigeons there could stand but not fly away
  (16px of 2096).
- **A full-width glide lane** runs along that same band on every route at
  every width (for example y 156 to 180 at 1440 on the overview): the hawk
  can cross the page skimming the first row of cards.
- **Scrolled, the first row is gone and the rows below have no way out**:
  a pigeon can stand on deeper card tops, but no stretch scrolled 400px
  connects to an exit through air a flying pigeon fits, on any route or
  width. Pigeons already placed ride on with their cards; nothing can fly
  from there.

So the stage for the whole month is the first row of cards and the air above
it, which is also where the courts lines show best and where the rally plays
on the overview and the metrics page. The rules below are general, but this
is the geometry they were designed against.

### Airspace contract (pigeons, hawk and ball)

Every flier and the ball obey one contract. It goes in the shared code so
August's gull, September's crows and February's cupids can use it.

- **Air** is the viewport minus content (rendered text, controls, charts:
  `measureObstacles` without its card blocks), minus card boxes (the blocks),
  except the bottom 6px of a card or heading box above, into which a bird may
  reach as the ledge animals may. A heading box is not an obstacle, only its
  text and controls, so the empty part of a page heading is air, as it is for
  the robin. The rail is never air: nothing is drawn over it.
- **Exits**: a flier leaves or enters the page only by
  - the right edge of the window (the whole footprint past it);
  - the top of the window (the whole footprint above it), within main's
    width;
  - the rail's edge, when the rail is a full-height column left of main (its
    right edge at 120px or more and the rail as tall as the window). A flier
    crossing it is clipped at main's left edge, so it passes behind the rail
    rather than over it. On phone layouts, where the rail is not a column,
    this exit does not exist.
  Never the bottom of the window: a pigeon fleeing downward reads wrong, and
  the hawk sweeps level.
- **Footprints for fliers** are envelopes: the box the drawing stays inside
  at every moment of a cycle (the whole flap, from the clap at the top to the
  tips at the bottom of the downstroke), anchored at the bird's feet line
  under its hip and mirrored with its facing. A rig test samples each cycle
  and checks it, as `pageReach` does for the ledge animals.
- **Routes** are chains of cubic curves joined smoothly (the robin's
  `FlightCurve`), flown at an eased speed with no straight-line jumps. A route
  is clear when its envelope swept along its whole length stays in air, except
  where it is past an exit, checked by subdividing each curve's control hull
  as `clearFlight` does. `clearFlight` gains an optional envelope argument
  (additive; the robin keeps its 35px and 59px pads).
- **What is planned, and when**: a flight is planned before it starts and
  checked as a whole. A sweep is simulated from start to end before the hawk
  appears (see below); a pigeon's flight out, and its flight back in, are each
  checked before take-off.
- **Landing** is only on a spot a pigeon could stand on (its standing
  footprint clear, counting the 6px reach), whose final approach (the landing
  envelope over the last 40px of the route) is clear. There is no hovering:
  pigeons do not hover, and the hawk passes through.
- **Keeping apart**: no two birds' envelopes ever overlap, in the air or on
  a ledge, with a 6px gap. Pigeons and the hawk are stepped as one group
  (`group.ts`), the hawk first.
- **Layout changes in flight**: routes are stored relative to the ledge
  the flight started from (its row), so a scroll carries a bird in the air
  with the page, as the ledge animals ride with their cards; a scroll moves
  everything in main together, so a clear route stays clear except against
  the window's own edges, which are exits. On any other change (a resize, the
  page's content changing) the rest of the route is checked again: if clear,
  the bird flies on; if not, it is planned again from where it is to its
  exit or its landing spot; if no route is clear, or the bird's own envelope
  is now over content, it is hidden at once and counts as away. It is never
  drawn over content, even for a frame.
- **Reduced motion**: no flight at all. The pigeons stand still on their
  spots; there is no hawk and no ball.

### A new shared surface: lanes, courts and exits

The calendar's table asks the first month that needs a surface to define it.
July needs three, all derived from the measured ledges and obstacles, all in
`floors.ts` (or a new `air.ts` beside it), each drawn by `Geometry.svelte`
under `?theme-debug=1`:

| Surface | Definition | Identity across measurements | Debug drawing |
| --- | --- | --- | --- |
| Row | Ledges whose tops are within 2px of each other, side by side, none overlapping another | The id of its leftmost ledge | (the ledges themselves) |
| Lane | A horizontal line at a height above a row, in viewport coordinates, along which a given envelope swept from the rail's edge (or main's left edge with no rail column) to past the window's right edge stays in air | Its row's id and its height above the row | A dashed line across the page, labelled `lane <row> +<h>` |
| Court | Two neighbouring card-top ledges in one row (left and right, tops within 2px), with a gap of 8 to 48px between them and no other ledge in it; the gap is the net | The pair of ledge ids | A dashed box over the court's air, labelled `court <a>|<b>` |
| Exits | The window's right edge, its top, and the rail's edge when the rail is a column | Fixed; the rail exit present or not | Short chevrons at each exit, and a dashed line at the rail's edge |

Courts are June's "gaps between ledges" with a vertical step of 2px or less.
June and July are being prepared at the same time: whichever lands first
defines the gap in the shared code, and the other uses it (July's court is
then a gap filtered by its step), rather than measuring the same thing twice.

### The hawk's sweep

The hawk flies one way only: straight along a lane, gliding, from one exit
to the opposite one (the rail's edge and the right edge of the window), about
4px above the row's ledges. That is what a Harris's hawk hunting does, low
and fast over the ground, and what the falconer's bird does over the courts;
it is also the only flight on these pages that fits, since the air above the
first row is about one pigeon high. Straight lines also make the swept
footprint trivially checkable.

| Mode | Drawn | Ends when | Then |
| --- | --- | --- | --- |
| waiting | not drawn | its sweep time comes (first 30 to 60s after the pigeons settle, then 70 to 140s apart) and a sweep plans | sweep; if none plans, try again in 10s |
| sweep | gliding at 360px/s, rising and falling 1px over each 0.8s | its whole footprint is past the far exit | waiting |

A sweep is planned when:

- at least one pigeon stands in view on a row that has a lane at 4px for the
  glide envelope;
- no ball is in play and no pigeon is flying or away;
- every pigeon on that row has a clear escape away from the hawk (below),
  and the whole sweep, simulated frame by frame with every pigeon's reaction,
  keeps every envelope in air and apart from every other.

It enters from the side farther from the nearest pigeon on the row, so they
get the longest warning, and tries the other side if that plan fails. The
hawk does not react to the cursor and the cursor does not change a sweep in
progress (the plan was checked as a whole). It flaps only where the flap
envelope fits around its line (rare on these pages: usually it arrives and
leaves already gliding, its flapping done out of sight), at 4.5 beats a
second, two or three beats at a time. Its eye blinks with the nictitating
membrane (below). It never lands.

### Pigeons

A pure ledge walker on the ground, as the fox and hedgehog are, in
ledge-local x so it rides with its card; a flier in the air, under the
contract above. The cursor is the last mouse or pen hover position, buttons
up, forgotten on pointer down, leaving the window, blur, a hidden tab and a
reduced-motion change, as for every theme.

| Mode | Pose | Ends when | Then |
| --- | --- | --- | --- |
| stand | stand, the head turning now and then | 1.5 to 5s | walk (60%) or peck (40%) |
| walk | walk, with the head bob | it reaches a target 30 to 120px along its stretch at 18px/s | stand, or peck (30%) |
| peck | peck: 2 to 5 pecks, 0.45s each | done | stand |
| shy | walk, brisk (35px/s, a shorter hold) | 40 to 80px away from the cursor, along its stretch | stand |
| alert | alert | the hawk is gone, or 1 to 1.5s after a flockmate flushed nearby | stand |
| take-off | take-off: the wings clap overhead as the feet leave | 0.3s, rising 8px | fly |
| fly | flight, flapping | its route reaches an exit, or its landing approach | away, or land |
| away | not drawn | its return time | fly (in) |
| land | landing | 0.35s, touching down | stand (the wings folding over 0.3s) |

- **Placing**: two or three, decided once when they are placed and never
  grown by scrolling, as for the foxes. Three where three spots 70px apart
  exist in view where a pigeon could both stand and fly away from (the
  survey's "escape" stretches), else two; fewer only when there are none
  (the leaderboard, a scrolled page, a phone with no air). Ledges with no
  pigeon come first, so they spread out.
- **Walking** targets lie on the pigeon's own clear stretch, stop 6px short
  of another pigeon, never pass one, and prefer stretches it could fly from.
  The walk is driven by distance walked so planted feet never slide.
- **The cursor**: moving within 70px makes one shy away from it along its
  stretch; passing within 40px faster than 1500px/s makes it fly off (if it
  has an escape; otherwise it shies), and it comes back 6 to 12s later. At
  most one flushes for the cursor in any 8s. Others within 200px of one
  flushing go alert for 1 to 1.5s.
- **The hawk**: every pigeon on the hawk's row takes off in turn, the one
  farthest from the hawk first (the one with the clearest way out), 0.15s
  after the hawk appears plus 0.1s per place in the order, and flies away
  from the hawk along its escape: straight ahead along the band to the far
  exit, or up and out of the top of the window, whichever is clear and
  shorter. They fly at 480px/s after a 0.3s climb from the ledge, faster than
  the hawk, so the gap between them only grows. Pigeons on other rows with an
  escape that keeps clear of the sweep follow 0.3 to 0.6s later, flying the
  same way (a flock under attack aligns and flies away from the danger);
  those without one go alert until it has passed.
- **Coming back**: 5 to 10s after the hawk's exit (or 6 to 12s after a
  cursor flush), one at a time, 1.5 to 3s apart, each flies in by the exit it
  left by to a landing spot: one it could stand on and fly away from again,
  in view, 70px from the others and where they are heading, as near its old
  spot as there is. If there is none, or no clear route in, it stays away and
  tries again every 5s.
- **Group**: stepped in a fixed order with the hawk (`group.ts`), each seeing
  the others as they now are, so no two envelopes ever overlap.
- **Layout changes**: on the ground, as the foxes: a pigeon keeps its ledge
  and mode while the stretch under it is clear, pulled back inside it if it
  shrank, and is re-placed with no animation if it is gone. In the air, as
  the contract says.
- **Reduced motion**: standing still on its spot, head level, no blink,
  never stepped; the spot is kept across scrolls while it stays clear.

### The rally

One ball, drawn in code: an optic-yellow disc 6px across (a tennis ball at
the birds' scale) with its white seam as a curved line, which turns with
the ball's spin. Its swept area obeys the airspace contract.

**Between which two cards**: a court in view (two side-by-side card tops,
the gap between them the net) with a clear arc over it, nearest the top of
the window first. On the overview that is the worklist and the "Now" card;
on the metrics page two of the first row's figures. Pages whose cards are
one column (history, logs, the leaderboard, config, prompt) have no court,
so no rally.

**The arc**: a shot leaves one side from a point 6px up (the top of the
ball's hop) and lands on a bounce spot on the other side 40 to 140px from
the net. Its height is a parabola with its top 12 to 20px above the ledges:
at most the air over the whole shot (`clearance` over its span, with the
6px reach, less the ball's 6px and 2px spare), at least 4px clear of the
net. Below 12px of room, no rally on that court. Each shot is checked with
the robin's `clearArc` (the ball's radius as its side, its diameter as its
height) against air. Shots cross at 320px/s.

| Mode | Drawn | Ends when | Then |
| --- | --- | --- | --- |
| idle | nothing | its time comes (first 15 to 30s, then 40 to 90s), with a court clear of pigeons and no bird flying | serve |
| serve | the ball fading in over 0.15s at the start of the first shot, from the far end of one side | it lands | bounce |
| shot | the ball on its arc, spinning | it lands on its bounce spot | bounce |
| bounce | squashed for two frames, then a low hop 10px back, 6px high; a chalk puff if it lands on a line | the top of the hop, 0.12s | the next shot back, or the end |
| volley | a fast flat shot back (1.4 times the speed) from where the cursor met it | it lands | bounce |
| dead | falling straight down, then two smaller bounces and a roll | it stops, fading over 0.5s | idle |
| out | the last shot lands deep, bounces twice lower and rolls | it stops, fading over 0.5s | idle |
| net | the last shot drops into the gap | 10px below the ledges, fading as it goes | idle |

A rally is 4 to 9 shots; it ends out or in the net, about evenly.

**The cursor intercepts the ball by where it hovers, never by clicking.**
The overlay keeps `pointer-events: none` on every descendant, as for every
theme. During a shot, if the cursor's hover position comes within 9px of
the ball's centre (its 3px radius plus 6px), or the cursor's last movement
crossed the ball's path in this frame (the shortest distance between the two
segments, `distance` in `pointer.ts`), the ball is volleyed: a new shot from
that point back to a bounce spot on the side it came from, checked like any
other. If no such shot is clear, it drops dead where it is. One volley per
shot, so a cursor resting in the path does not juggle it. Because a pointer
press forgets the cursor, pressing or dragging never volleys, and every
click goes to the page underneath as before.

**Pigeons and the ball**: a rally starts only when no pigeon stands in the
court's air (its arcs and bounce spots), and while it plays that air counts
as taken, so no pigeon walks or lands into it. A pigeon within 150px of a
bounce turns its head to it. No sweep is planned during a rally, and no
rally starts while a bird is flying or away.

**Reduced motion**: no ball.

**As built** (`rally.ts`): everything is in court-local coordinates from
the left card's top left, so the ball rides with the cards. The court's two
card ids come from the surfaces kit's courts; the rally works out the net
and the bounce spots itself (40 to 140px from the net, never inside a
card's 12px rounded corner). The shot's height is the ball's bottom over
the ledges; a shot is a parabola solved so its top is the height chosen.
The bounce's low hop goes on 10px the way the ball was going, to the
height the next shot is struck from. Every piece of the ball's way (shot,
squash, hop, fall, roll, drop into the net) is sampled every 2px and its
box, each pair joined, kept 2px from text, controls and charts, off any
card but its top (where it bounces) and its empty bottom 6px (where it may
rise), and inside the window; the room over a shot comes from `clearance`
on both cards with the 6px reach, less the ball and 2px. A volley is a fast
flat shot (a 2px rise) back to the side the ball came from; it cannot be
volleyed in turn, and the rally then goes on as before. The deep landing of
an out leaves room for its two lower bounces and the roll (30px) before the
card's end; a rally that cannot finish one way finishes the other, or
simply ends. A page change that leaves the rest of the ball's way unclear
ends the rally at once.

### Court lines

Drawn only where `clearRuns(f, obstacles, 4)` says 4px is clear, on card
tops and heading rules alike, so never under a heading's text. Each clear
run of 60px or more gets one chalk-white line 1.5px thick along the ledge,
at 0.7 opacity (`#f4f4ec`), with:

- a short centre mark (4px up from the line) at the middle of runs of 120px
  or more, as a baseline has;
- at each end, the corner: a 4px stub where the sideline meets the line, and
  a second stub inside it for the doubles tramline, 12.5% of the run in
  (1.37m of a 10.97m wide court), at most 18px;
- a few faint scuffs of worn grass along it, seeded by ledge id.

At most five marks per run. The lines are still under reduced motion (they
never move anyway). The ball's bounce puffs a little chalk (four or five
specks fading over 0.4s) when it lands within 3px of a mark.

**As built** (`wimbledon/lines.ts`): two changes from the plan, after
looking at the page. The runs are kept 12px in from a ledge's ends, not 6:
cards have 12px rounded corners, and a line starting 6px in hung in the air
above the corner's curve. The scuffs were first drawn as worn earth
(brownish strokes on the line); on the dark page they read as specks of
dirt, so a scuff is now a stretch where the chalk is worn thin, the
baseline broken and that stretch drawn at a quarter of its opacity. Caps:
at most 40 baselines and 40 worn stretches a page, shared out a ledge at a
time (`decor.ts`'s `shareOut`); scuffs keep 2px clear of the marks. The
puff is in the same module (`puffAt`, `specksOf`, `markNear`), ready for
the rally.

### Accent

Optic yellow `#dde85a`, the ball's colour: distinct from the default lime
(`#84cb2d`), the warning amber (`#d9b13c`) and Bonfire's gold (`#f4c25b`).
Only the accent tokens move. A proposal: easy to change in
`styles/themes.css`.

## Research

Accurate anatomy is a hard requirement. Facts below are cited in the
Sources list; where the evidence is only a search snippet or a general
rule for birds rather than this species, it says so.

### Feral pigeon (*Columba livia*)

- **Size**: 30 to 35cm long, wingspan 62 to 68cm, 238 to 380g. Legs and
  feet red to pink (Wikipedia, Rock dove; Animal Diversity Web).
- **Leg, by name** (Wikipedia, Bird feet and legs): the femur runs from the
  hip to the knee inside the body, the hip under the folded wing; the knee
  points forward and is hidden in the belly feathers; the drumstick is the
  tibiotarsus, also mostly hidden; the joint that looks like a backward knee
  is the ankle, the intertarsal joint; below it the bare, scaly shank is the
  tarsometatarsus. A pigeon stands on its toes (digitigrade), which are
  anisodactyl: toes II, III and IV forward, the hallux (toe I) back. So the
  rig's leg has three bones (femur hidden, tibiotarsus mostly hidden,
  tarsometatarsus seen) and a foot of toes, the joints named hip, knee,
  ankle (intertarsal) and toes in the lab's joints view.
- **The walk and the head bob** (Necker's review of avian head bobbing,
  after Frost 1978 and Troje and Frost 2000): the head moves in two phases,
  a quick forward thrust and a hold, in which it stays almost fixed in space
  (drifting about 3mm/s, against 500 to 800mm/s in the thrust) while the
  body walks on beneath it, so relative to the body it slides back. One bob
  per step, two per stride, bob and step usually in time. The thrust starts
  in the double-support phase, just after the front foot lands; the hold
  covers the single support that follows, as the rear foot swings. It is
  optokinetic: it holds the world's image still on the retina. Pigeons
  walking on a treadmill, where the world does not move past them, do not
  bob, and blindfolded birds never do. As walking speeds up the hold shortens
  and at the fastest speeds disappears (Davies and Green 1988; snippet only).
- **Gait**: a bipedal walk, legs half a stride apart, each foot down for more
  than half the stride, so there is double support (the review's thrust
  phase depends on it). No pigeon duty factor was found; the rig uses 0.6.
  As a foot lifts, the toes fold back and curl through the swing (a general
  observation for birds, snippet only), and open flat as the foot is set
  down.
- **Pecking** (Ostheim et al. 2020): the head goes down in steps, stopping
  to fixate, then a final ballistic thrust; during the thrust the eyelids
  narrow to a slit rather than closing.
- **Blinking** (Animals, 2023, "The various ways in which birds blink"):
  birds blink mostly with the nictitating membrane, a third eyelid drawn
  across the eye from its front corner to its back, quickly, mostly as the
  head moves. The lower lid rises in drowsiness; pigeons are among the few
  birds whose upper lid also comes down. So the pigeon's blink is a pale,
  translucent membrane sweeping across the eye from the beak side, now and
  then on a head thrust, and the peck narrows the eye with the lids.
- **Take-off** (Heppner and Anderson 1985): rock doves push off with 1.3 to
  2.3 times their weight, and "as the birds' feet left the experimental
  perch, their wings were in the overhead clap position"; leg thrust, then
  clap and fling, then steady flight. (Berg and Biewener 2010 found the legs
  gave about a quarter of take-off acceleration in short perch-to-perch
  flights; snippet only.) Startled pigeons clap their wings over their backs
  as they burst up, and the noise warns the flock (Audubon; Davis 1975 via
  Wikipedia).
- **Wingbeat**: about 5.5 beats a second in level flight for a pigeon on
  its own (Sankey et al. 2019; snippet only), 6.1 to 9.6 across trials
  (Berg and Biewener 2008; snippet only), highest at take-off and falling
  with each beat after it (Berg and Biewener 2010; snippet only), and barely
  changing with speed in level flight (Tobalske and Dial 1996). At slow
  speeds doves use a tip-reversal upstroke: the wing flexes at the wrist and
  the hand-wing sweeps back and up (ringed turtle doves at up to 7 to 9m/s;
  Tobalske, Hedrick and Biewener 2003). The rig flaps at 7 a second for the
  first three beats and 5.5 after, with the wrist flexing on the upstroke
  near take-off and landing.
- **Landing** (Green and Cheng 1998; Berg and Biewener 2010, snippet): the
  body, tail and wings swing from near level to near upright to brake, the
  tail is pressed down, and the legs take up the rest, with forces of 2 to 8
  times body weight aimed 40 to 90 degrees below the horizontal, so the legs
  reach forward and down to meet the ledge.
- **Flock and hawk** (Sankey et al. 2021): pigeon flocks attacked by a
  robotic falcon did not bunch to the middle; each bird aligned with the
  others and flew away from the danger. Hence all of ours flee the same way.
- **Cruising speed**: about 15m/s in GPS studies (snippet only). The page
  slows every bird down (480px/s is about 5m/s at this scale) so that the
  flight reads; both birds are slowed alike.

### Harris's hawk (*Parabuteo unicinctus*)

- **Size**: 46 to 59cm long, wingspan 103 to 120cm; males about 700g,
  females about 1,030g, so females are the larger (Wikipedia; Audubon;
  Animal Diversity Web).
- **Colours**: dark brown, with chestnut shoulders, wing linings and thighs;
  white upper and undertail coverts and a white base to the tail, which ends
  in a broad white tip; a yellow cere and long yellow legs (Wikipedia,
  Audubon, Animal Diversity Web). (Yellow lores were not found in a source;
  the reference drawing shows yellow skin round the cere and gape, as photos
  of the species do, but the owner should not lean on it.)
- **Build and flight**: broad wings and tail, which suit soaring (Peregrine
  Fund); it flaps, glides and soars (Audubon); it hunts actively in a low,
  "dashing and powerful" flight, chasing prey round bushes (Audubon field
  guide). Its wingbeat measured 3.9 to 5.4 beats a second in perch-to-perch
  flights, mostly near 4.5 (a 2026 motion-capture preprint). In a wind tunnel
  a 0.7kg bird glided at 6 to 16m/s, its glide angle 5 to 8.5 degrees (Tucker
  and Heine 1990; abstract only). Whether it glides on flat wings or a slight
  dihedral was not found; the glide is drawn with the wings level.
- **Legs in flight**: no source for this species. In raptors generally the
  legs trail back for the first beats after push-off and then tuck up under
  the base of the tail (a bird photographer's observations), and the talons
  come forward only to strike. The hawk's feet are drawn closed under its
  tail and never come forward.
- **Wild groups**: it hunts in family groups of about five, which beat pairs
  for winter food (Animal Diversity Web; Coulson and Coulson 2013).
- **Over the courts**: a Harris's hawk is flown at dawn and early morning,
  before spectators arrive, to scare pigeons off the courts and the roofs;
  its handlers keep it fed so it scares rather than eats them, while saying
  they cannot promise it never kills (Al Jazeera 2015; The World 2012).

### Tennis

- **Court and ball** (ITF Rules of Tennis): a doubles court is 10.97m wide,
  a singles court 8.23m, so each tramline is 1.37m in; the baseline carries a
  centre mark 10cm long, drawn inside the court; a ball is 6.54 to 6.86cm
  across.

## Art plan

### Pigeon rig parts, and why

- **Body**, with the folded near wing painted on, the legs taken off and the
  belly closed where they were. The pigeon's body is one rigid shape; its
  bob is in the neck.
- **Head and neck as two parts**: the head (with its soft, unoutlined back
  edge, as the hedgehog's has) and a neck piece laid along a bone from the
  upper breast to the back of the head, drawn twice (outlined, then fur alone)
  like a leg piece, so it stretches in the thrust and shortens in the hold
  without a line across it. The head is placed in world space during the hold
  (it stays put while the body moves) and thrust forward on the step; this is
  what makes it a pigeon.
- **The folded wing as its own part** too, so take-off can lift it away and
  landing can fold it back.
- **Flight wings**: a near wing and a far wing (a shade darker), each in two
  pieces, the arm-wing (secondaries, with the two black bars) and the
  hand-wing (primaries, dark tipped), hinged at the wrist, so the downstroke
  can spread them and the slow-flight upstroke can flex at the wrist as doves
  do. Flapped in code by rotating about the shoulder and wrist, and squashed
  vertically by the cosine of the stroke angle to stay a strict side view.
- **Tail**: closed, and fanned (a second image) for take-off and landing.
- **Legs in code** (`rig/gait.ts`): two legs, half a stride apart, each a
  hidden femur and a short feathered tibiotarsus piece in the belly's grey
  (fur only), and the bare coral tarsometatarsus piece below the ankle; feet
  as images, flat (three toes forward, the hallux back) and curled (for the
  swing and for flight, tucked under the belly). The near leg's fur is drawn
  over the belly's edge so it grows out of it. The gait needs a two-legged
  spec in the shared gait (additive: two beats, half a cycle apart, and a
  duty factor over half).
- **Eye**: the iris painted on; the blink is a nictitating membrane drawn in
  code (a pale translucent shape sweeping from the beak side), and the peck
  narrows it with the lids.

### Hawk rig parts, and why

- **Body with the head**, from the glide pose: the hawk does not bob, and in
  a glide its head is steady; the head is a separate part only so it can
  turn a few degrees toward the pigeons it is passing.
- **Wings**: near and far, each arm-wing and hand-wing hinged at the wrist,
  flapped in code like the pigeon's (it rarely flaps on these pages, but it
  must be able to), and held level for the glide.
- **Tail**: closed, the white base and tip showing.
- **Legs**: tucked under the tail base and painted on the body, since it
  never lands or strikes.
- **Eye**: nictitating membrane blink, as the pigeon's.

### Generated so far

Generated on 2026-10-10 by the Codex CLI (`codex-cli 0.161.0`,
`gpt-5.6-terra`) through its built-in `$imagegen` path, each on a flat
magenta `#FF00FF` background. The pigeon's neck sheen was asked for as a dark
slate violet so the keying (`min(R,B) - G`) leaves it opaque; checked by
keying the reference onto white. Parts are not cut yet: the owner cuts them
once the rig is decided, each as an edit of the reference drawing, placed
where it sat in it.

| File | What | Prompt summary |
| --- | --- | --- |
| `summer-kit-2.png` | The shelf: strawberries and cream, the jug of fruit cup, the racquet and ball | Generated with `aurora/winter-kit.png`, `bonfire/toffee-apples.png` and `halloween/pumpkins.png` as style references, no text or marks; then edited so the jug's glass is an opaque pale aqua (the first version let the magenta through the glass, which keys out as holes) |
| `pigeon-standing-2.png` | The pigeon's reference drawing: standing square, side view facing right | Generated with the fox's and hedgehog's standing drawings as style references; a blue-bar feral pigeon with a white cere, orange-red eye, two black wing bars and coral legs, then redrawn as an edit for a stricter profile and a darker violet sheen |
| `hawk-perched.png` | The hawk's reference drawing: standing perched, side view facing right | Generated the same way; dark brown, chestnut shoulders and thighs, white undertail and tail tip, yellow cere and legs, no falconry gear |
| `pigeon-pose-walk-thrust.png`, `-walk-hold.png` | The walk: the end of the head thrust (neck out, far foot swinging with its toes curled), and the hold (head back over the breast, rear foot lifting) | Edits of `pigeon-standing-2.png` |
| `pigeon-pose-peck.png`, `-alert.png` | Bill to the ground, tail lifted; standing tall and sleek | Edits of the reference |
| `pigeon-pose-takeoff.png` | Wings in the overhead clap, tail fanned, feet leaving | Edit of the reference |
| `pigeon-pose-flight-down.png`, `-flight-up.png` | Mid downstroke; the flexed upstroke; feet tucked | Edits of the reference |
| `pigeon-pose-land.png` | Body upright, wings forward to brake, tail fanned down, legs reaching forward | Edit of the reference |
| `hawk-pose-glide-2.png` | Gliding with the wings level, low and long | Edit of `hawk-perched.png` with `hawk-pose-flap-up.png`; redrawn because the first glide hung the near wing down like a downstroke |
| `hawk-pose-flap-down.png`, `-flap-up.png` | Mid downstroke; top of the upstroke; feet tucked under the tail | Edits of the reference |

Every pose was looked at against the reference before keeping it. The
generated poses are not all drawn at one size: the owner exports each on the
eye scale (`art.py`'s `feature`, `rescaled`), and their boxes then give the
real footprints in place of the budget above.

### Parts, as built

Cut on 2026-10-10 by the same tool and model, each an edit of the drawing it
names, on flat magenta, the pieces in one row so `art.py`'s `cut` splits
them at their empty columns. Each was looked at before use, and the parts
were checked by laying them at their printed places over their drawing.

| File | What | Edit of |
| --- | --- | --- |
| `pigeon-parts.png` | the body (legs, folded wing and tail off, belly and back closed, a soft unoutlined top where the head and neck go), the folded wing, the closed tail, the head with the green of the upper neck and a soft lower edge | `pigeon-standing-2.png` |
| `pigeon-limbs.png` | the neck piece (green over violet), the feathered tibiotarsus piece, the bare coral tarsometatarsus, a foot flat (three toes forward, the hallux back) and a foot curled | `pigeon-standing-2.png` |
| `pigeon-wings.png` | the near wing's arm and hand, each as upper side and underside, root at the left with a soft end; the fanned tail | `pigeon-standing-2.png`, with the flight and take-off poses as guides |
| `hawk-parts.png` | the gliding body (wing, head and tail off, the feet tucked under the tail painted on), the head with a soft back edge, the closed tail | `hawk-pose-glide-2.png` |
| `hawk-wings.png` | the near wing's arm and hand, upper side and underside | `hawk-pose-glide-2.png`, with the flap poses as guides |

`export.py` puts both birds on one scale in drawing units, each bird's eye
(its pupil) setting its own: the pigeon's pupil is 1 unit, which makes the
standing reference 20.2x17.0 units; the hawk's is 1.8, which makes its glide
drawing 32.3 units long, 1.6 times the pigeon, as the sizes above ask. So
one page size for a unit serves both rigs. The hawk's plumage is itself dark
brown, so `art.py`'s `feature` gained an optional darkness threshold (90
for the hawk, 200 as before for everyone else). The parts' shapes alone fit
anywhere inside their drawing (a tail, a head, the folded wing), so they are
placed by colour: `art.py`'s new `by_colour` finds the offset where a part's
own pixels differ least from the drawing's, by FFT; every placement checked
by overlay. Where each part sat (units, the reference's top left at 1, 1):

| Part | Size | At |
| --- | --- | --- |
| `pigeon-body` | 12.17x10.17 | 8.02, 4.36 |
| `pigeon-wing` | 12.42x6.92 | 3.98, 5.75 |
| `pigeon-tail` | 7.92x4.17 | 1.00, 10.04 |
| `pigeon-head` | 7.67x6.67 | 13.45, 1.00 |
| `hawk-body` | 18.25x7.17 | 9.15, 1.65 (on the glide) |
| `hawk-head` | 8.67x6.42 | 24.62, 1.00 |
| `hawk-tail` | 10.67x4.67 | 1.03, 3.11 |

The limb pieces are exported at measured thicknesses (neck 3.6 units,
tibiotarsus 1.7, tarsometatarsus 0.45) with their fur alone beside them
(`-fur`), the flat foot 4.7 units long and the curled one 2.8. The wings are
placed by hand in the rig, so they are scaled by length: the hand-wing is
half the bird's length (10 units on the pigeon, 15.3 on the hawk), the arm
on the same scale, and every wing piece is also written 22% darker for the
far wing (`-far-`). The fanned tail is as long as the closed one. The lab
gets `pigeon-reference.webp`, the eight pigeon key poses, and the hawk's
glide (`hawk-pose-glide.webp`, the frame its parts are placed on) and two
flap poses.

## Verification (for the owner)

As for January and November, plus what flight adds:

- Unit tests for the pure models: the pigeons' state table, placing and
  spacing over long random runs; the head bob (head fixed in space through
  each hold, one thrust per step, thrust starting in double support); the
  sweep planner (no plan when any pigeon on the row lacks an escape; a
  simulated sweep keeps every envelope in air and apart at every frame); the
  rally's arcs (inside the court's air, over the net, a volley only from a
  hover within reach, one per shot, none with a button held); the lines
  (never under text, mark caps).
- Rig tests: each pose's footprint over its whole cycle, and each flier's
  envelope over the whole flap.
- The shared surfaces (rows, lanes, courts, exits) unit-tested and drawn by
  the debug overlay, and the `clearFlight` envelope argument tested with the
  robin's defaults unchanged.
- `e2e/wimbledon.spec.ts`: mounting, click-through on every descendant, below
  dialogs, at least two pigeons on the overview, no bird and no ball over
  content (extend `e2e/content.ts` additively so it also checks the ball's
  drawn circle and any chalk), a still scene under reduced motion, the phone
  layout. A sweep and a rally are timed and random, so a test-only trigger
  (for example `?theme-cue=sweep` or `rally`, read like `theme-debug`) lets
  the suite start one and sample frames through it for the content check.
- The critters lab: a pigeon page with its walk, peck, alert and flight
  (flight needs the airborne view the brief describes), a hawk page with its
  glide and flap, the key poses laid over each.

## Sources

- Wikipedia, Rock dove (size, mass, leg colour; the wing clap as an alarm,
  citing Davis 1975): https://en.wikipedia.org/wiki/Rock_dove
- Animal Diversity Web, *Columba livia*:
  https://animaldiversity.org/accounts/Columba_livia/
- Wikipedia, Bird feet and legs (femur, knee, tibiotarsus, intertarsal joint,
  tarsometatarsus, digitigrade, anisodactyl toes):
  https://en.wikipedia.org/wiki/Bird_feet_and_legs
- R. Necker, a review of head bobbing in birds (the thrust and hold phases,
  their timing against the footfalls, the optokinetic basis; reporting Frost
  1978 and Troje and Frost 2000, J Exp Biol): https://reinhold-necker.de/seite10.html
- Heppner and Anderson 1985, J Exp Biol 114:285-288, leg thrust and the
  overhead clap at take-off in rock doves:
  https://digitalcommons.uri.edu/cels_past_depts_facpubs/78
- Audubon, how and why rock pigeons clap their wings:
  https://audubon.org/news/how-and-why-rock-pigeons-clap-their-wings
- Tobalske and Dial 1996, J Exp Biol 199:263-280, flight kinematics of
  magpies and pigeons over a wide range of speeds:
  https://umimpact.umt.edu/en/publications/flight-kinematics-of-black-billed-magpies-and-pigeons-over-a-wide/
- Tobalske, Hedrick and Biewener 2003, wing kinematics of avian flight across
  speeds (tip-reversal upstroke in doves at slow speeds):
  https://umimpact.umt.edu/en/publications/wing-kinematics-of-avian-flight-across-speeds/
- Sankey et al. 2019, homing pigeons modulate wingbeat characteristics
  (level-flight wingbeat frequency):
  https://pure.royalholloway.ac.uk/en/publications/homing-pigeons-columba-livia-modulate-wingbeat-characteristics-as/
- Green and Cheng 1998, J Exp Biol 201:3309, landing flights of pigeons:
  https://researchportal.hw.ac.uk/en/publications/variation-in-kinematics-and-dynamics-of-the-landing-flights-of-pi/
- Sankey et al. 2021, Current Biology, pigeon flocks under a robotic falcon
  (University of Exeter news):
  https://news-archive.exeter.ac.uk/2021/june/articles/newfindingsshowpigeonsact.html
- Ostheim et al. 2020, J Exp Biol 223:jeb223313, pecking and eyelid
  narrowing: https://kops.uni-konstanz.de/entities/publication/19bb0cb7-c483-4d9b-8ecd-57fcedc10e8c/full
- "The various ways in which birds blink", Animals 2023 (nictitating
  membrane, lower and upper lids): https://pmc.ncbi.nlm.nih.gov/articles/PMC10705787/
- Wikipedia, Homing pigeon (cruising speed, a weak source):
  https://en.wikipedia.org/wiki/Homing_pigeon
- Wikipedia, Harris's hawk (size, mass, colours, cere and legs):
  https://en.wikipedia.org/wiki/Harris%27s_hawk
- Animal Diversity Web, *Parabuteo unicinctus*:
  https://animaldiversity.org/accounts/Parabuteo_unicinctus/
- The Peregrine Fund, Harris's hawk (broad wings and tail):
  https://peregrinefund.org/explore-raptors-species/hawks/harriss-hawk
- Audubon field guide, Harris's hawk (flight styles, low dashing hunting
  flight): https://www.audubon.org/field-guide/bird/harriss-hawk
- Audubon, how Harris's hawks hunt in groups:
  https://www.audubon.org/news/better-know-bird-how-harriss-hawks-hunt-wolves-bring-down-prey
- Coulson and Coulson 2013, The Auk 130:548, cooperative hunting and group
  size: https://bioone.org/journals/the-auk/volume-130/issue-3/auk.2013.120063/Reexamining-Cooperative-Hunting-in-Harriss-Hawk-iParabuteo-unicinctus-i/10.1525/auk.2013.120063.full
- Harris's hawk wingbeat by motion capture (preprint, 2026):
  https://arxiv.org/html/2602.19196v1
- Tucker and Heine 1990, J Exp Biol 149:469, gliding in a wind tunnel
  (bibliographic record): https://scholars.duke.edu/publication/919673
- Feathered Photography, a raptor's feet tucked in flight (one
  photographer's observations, for raptors generally):
  https://featheredphotography.com/blog/2015/07/27/swainsons-hawk-in-flight-with-feet-fully-tucked/
- Al Jazeera 2015, the hawk flown over the courts:
  https://www.aljazeera.com/sports/2015/7/2/rufus-the-hawk-ruling-wimbledon-skies
- The World 2012, the hawk scaring pigeons over the courts:
  https://theworld.org/stories/2012-07-02/rufus-stolen-wimbledon-hawk-returned-back-scaring-pigeons
- ITF, Rules of Tennis 2026 (rule 1, the court's widths and the centre mark;
  appendix I, the ball's size):
  https://www.itftennis.com/media/7221/2026-rules-of-tennis-english.pdf
