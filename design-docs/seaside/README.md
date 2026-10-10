# Seaside (2026-10-10)

**Status**: pre-production draft (decisions settled, not built).

**Pins**: written against `ea7e9d5`. Code-internal.

August's theme, from `decisions/2026-10-seasonal-theme-calendar.md`. The
config value will be `seaside`; `auto` turns it on from 1 to 31 August in the
daemon's local time. This note settles the month's open questions before
code, as the calendar's checklist asks, so the month's owner starts from
decisions, research and art rather than from the calendar's three lines.

## What it shows

- **Rail shelf** (`SeasideShelf.svelte`): chips in a cone of white chip paper
  with a wooden chip fork, a red bucket with a yellow spade, and a 99 ice
  cream stood in a small heap of sand. One picture (`seaside-kit-2.png`), on
  a low sand drift drawn in code like the aurora's snow drift. Hidden on
  cramped rails like the other shelves. No sky effect: the rail sky stays
  empty this month (see "No rail sky").
- **Sand drifts** (`drifts.ts`): low drifts of sand along the ledges, each a
  little dune with a gentle slope on one side and a steeper one on the other,
  a lighter crest and a few darker grains; on about one drift in four, a
  small shell (a ribbed cockle or a winkle). Only where the ledge is clear.
- **Herring gulls** (`gull.ts`, drawn by `gull-rig.ts`): two, or three where
  the page has room, standing and strutting along the ledges, each turning to
  face and eye the cursor and following it along its ledge while it moves. A
  cursor left still for five seconds gets swooped at by one of them: it runs
  two steps, lifts off, climbs, dives at the cursor through clear air, pulls
  up short, and lands on a ledge with a squawk (the long call, posture only).
  The others stand and watch it go.

## Decisions

### Two or three gulls, one in the air at a time

The calendar's animal rule: at least two. Herring gulls loaf in loose groups
and keep a pecking distance from each other, so they stand apart rather than
as a pair.

- **How many**: three where three standing spots 100px apart exist when they
  are placed (on one ledge or several, each with the walking footprint's
  27px clear over 38px, see "Footprints"), else two; fewer only when the page
  has no room. A survey of the preview (below) found room for three on every
  route at 1440 and 1024 wide. The number is kept as the fox's is: a layout
  change re-places a gull that lost its spot, may put back one that had no
  room, and never adds beyond the number placed, so scrolling never grows the
  group.
- **Where**: ledges with no gull first, then the longest free stretch, so
  they spread out; never two within 100px of each other's spot or of where
  another is walking to.
- **One swoop at a time, and not often**: only one gull is ever airborne. A
  swoop needs the cursor still for 5s, and then it happens once for that
  resting place: the cursor must move 24px or more before another can come.
  Swoops are at least 30s apart for the whole group. Five seconds is long
  enough that pausing to click does not set it off, short enough that a
  parked cursor is "left still for too long" while the page is being read.
- **Who swoops**: of the gulls standing or strutting on ledges in view, the
  one with the shortest valid plan (a walk of at most 60px to a take-off
  spot, then a clear route; see the airspace contract). If none has one, the
  gull nearest the cursor gives the long call at it from where it stands,
  once for that resting place, and nobody flies.
- **While one flies**, the others stop, face it and watch it with their heads
  turned (the eye pose), and look back to the cursor when it lands. When it
  calls, a neighbour within 300px answers with its own long call half the
  time, 0.4 to 0.9s later: gulls in a colony do take up each other's long
  calls. Only one answers.

They are stepped as a group, in a fixed order, each seeing the others as they
now are (`group.ts`'s `inTurn` and `placeInTurn`), so the spacing rules hold
every frame. The swooper's route is reserved for the others while it flies
(as `christmas/flock.ts` reserves a robin's), so none walks under its landing.

### Footprints, measured from the page

The page scale is set so the reference drawing stands 25.5px tall (the
drawing is 882 file pixels tall; 0.0289 page pixels per file pixel before the
owner converts to drawing units at 12 file pixels per unit). Each pose's box
below is what its key pose measures at that scale, plus an allowance for the
motion; the rig test (`pageReach`, `solesOf` over the whole cycle) pins the
real numbers and the model uses those.

| Pose | Footprint | Used for | Needs clear above its ledge |
| --- | --- | --- | --- |
| stand | 36.5x25.5 | standing, looking about, reduced motion | 27px (shared rule: 22px plus the 6px reach) |
| strut | 38x26.5 | walking, following the cursor, stepping aside | 27px over the stride |
| eye | 32x27 | eyeing the cursor or a flying gull | 27px |
| call | 31x27 | the long call (head up, bill open) | 27px |
| take-off | 31x28, rising into the flight envelope | the run and lift-off | 40px over 56px of ledge ahead of it |
| flight | 44x46 about the body's centre | flapping: climbing, cruising, pulling up | air (below) |
| swoop | 41x20 about the body's centre | the dive at the cursor, wings folded back | air |
| flare | 34x34, feet at the bottom | the last 30px before touchdown, braking flaps | 40px over 56px of ledge behind the spot |

The ground poses all fit the shared 27px rule, so a gull can stand on the
first row of card tops (22px plus 6) and on heading rules where their text
leaves room, as the foxes and hedgehogs do. The call's head is thrown up only
as far as its key pose shows, which keeps it inside 27px; a fuller throw-back
would need 30px and is not worth a second rule. The flight poses are held to
the airspace contract instead.

A survey of the running preview (Bonfire's, `?theme-debug=1`, every route at
1440 and 1024 wide, 900 tall) measured, per ledge, the longest stretch with a
given height clear of content above it (cards counted as blocks with the 6px
reach), and the clear air for a 48x46 box inside `main`:

- 27px standing room: every route has at least one ledge with 344px or more
  (the first row of card tops and the page heading's rule).
- 40 to 50px take-off columns: 140px or more on most routes; 48px on the
  leaderboard at 1440, 0 on `/history` at 1024 (no swoops there, which is
  fine: the fallback call covers it).
- Air: the side margins of `main` (about 54px), the heading area beside its
  text, and empty space below short pages hold a 44x46 envelope. From the
  middle of a line of text, the nearest clear air was a median of 80 to 160px
  away at 1440 and 100 to 400px at 1024.

### The airspace contract

Every existing flier (the robin) and every walker so far is held to one rule:
never drawn over text, controls or charts. A gull swooping at a cursor that
is usually over content is the hardest case yet, so the rule is spelled out.

- **Air** is the box of `main` clipped to the viewport and inset 4px, minus
  every obstacle `measurePage` returns (rendered text, controls, charts, and
  every card's box as a block, with the 6px reach into a block's bottom edge
  only for poses touching a ledge). Ledges are not obstacles: a heading rule
  is a line, and flying past it covers nothing. The rail (nav, sky, shelf)
  is not air; see "Air bounds" for the one new measurement this needs.
- **A route** is a chain of eased cubic curves (the robin's `FlightCurve`,
  `curvePoint`, `routeLength`, `routeFacing`, `routeTilt` from
  `christmas/flight-route.ts`), each tagged with the pose drawn along it. Its
  **swept area** is checked curve by curve with that pose's box, by the
  robin's hull subdivision (`clearFlight`), generalised from its fixed 35/59
  box to a box per curve (left, right, up, down extents about the body's
  centre, including the bank allowance). A curve is clear when every
  subdivided hull box lies inside air. Nothing is ever checked only at its
  end points.
- **Never over the cursor's content, and pulling up short**: the gull never
  flies to the cursor itself. The dive aims at a **pass point** P, the point
  nearest the cursor where the swoop box (41x20) sits wholly in air, at least
  12px from the cursor and at most 160px from it, chosen on an 8px grid. The
  dive into P must head within 35 degrees of the cursor, so it reads as
  aimed at it. When the cursor sits over clear air (the empty space under a
  short queue, say), P can be within 12px of it; when it sits over a table of
  text, the gull dives at the nearest clear air beside or above it and pulls
  up there. With no P within 160px, or no clear route through one, there is
  no swoop (the fallback call above). 160px came from the survey: closer
  than that the dive reads as aimed at the cursor; farther, it does not.
- **The route's shape**: take-off at T on the gull's ledge (its spot, or a
  strut of at most 60px to a spot with the take-off column), a climb to A,
  40 to 90px above P and 60 to 140px back along the approach, the dive A to P
  in the swoop pose, the pull-up P to B (30 to 50px up over 60 to 100px on),
  then on to a landing spot L with the last 30px flown in the flare pose.
  Each side of approach is tried, and up to four landing spots (its home
  first, then the nearest valid ones); the first wholly clear route wins,
  shortest first, at most 900px long.
- **Landing spots**: on a ledge in view, 27px standing room across the strut
  footprint, a 40px column over the 56px of ledge it lands along, 100px from
  every other gull and anywhere one is walking to, and 80px from the cursor
  (it lands near enough to squawk at it, not under it). It lands facing the
  cursor's side.
- **Keeping clear of the others**: the other gulls' footprints, grown by
  12px, and their walk targets are obstacles for the route, as `flock.ts`
  reserves a robin's perch and path. Only one gull flies, so no two routes
  can cross.
- **Hover**: none. Gulls hang in the wind over cliffs, but a hover on the page
  would mean holding a 44x46 envelope still beside content for seconds; the
  pass point is a moment, not a stop.
- **Layout changes mid-flight**: the route is stored relative to its landing
  ledge (ledge-local, as a walker's x is), so a scroll carries the whole
  flight with the page. After every measurement the remaining route is
  checked again. Still clear: it carries on, even if part of it is now
  scrolled out of view (nothing off screen is covered). Blocked, or the
  landing ledge gone: it re-plans from where it is, heading the way it is
  going, to the nearest valid landing spot (flap curves, then the flare).
  No route at all: it fades out where it is over 150ms and is placed standing
  at a new spot with no animation 1.2 to 2.5s later (as the fox's `away`).
- **Reduced motion**: no flight at all; see "Reduced motion".
- **Test**: the rig test checks each air pose's box over its whole flap cycle
  (the flight envelope through a full wingbeat and the bank, the flare
  through its braking flaps). Model tests check that random routes over the
  fixture pages never leave air, that P never contains the cursor, and that
  a route blocked mid-flight re-plans or fades. The e2e content check must
  cover a flying gull: `e2e/content.ts` already tests every `<image>` under
  the animal's element, so a swoop forced on the queue page and sampled
  every 50ms until it lands is checked by the existing `coveredContent`.

### Air bounds: the one new shared measurement

The robin flies within `PageMap`'s width and height, the viewport.
`measureObstacles` only looks inside `main`, so the rail's nav text is not an
obstacle, and a viewport-wide flier could cross it. The gull needs `main`'s
own box.

- **What it is**: `air: { left, top, right, bottom }`, the bounding box of
  `main` clipped to the viewport, inset 4px on each side. Viewport
  coordinates, like the ledges and obstacles.
- **What it excludes**: the rail and everything in it (nav, brand, the rail
  sky, the shelf), and anything outside the window. It does not subtract
  obstacles itself: air is these bounds minus `obstacles`.
- **Identity and cadence**: one per page, no id. Measured with the rest of
  `PageMap` (an optional field set by `measurePage({ air: true })`, so the
  existing themes do not pay for it and `samePage` compares it when present),
  so it never comes from a different layout than the ledges.
- **Debug**: `Geometry.svelte` draws it as a dashed box labelled `air WxH`,
  and the seaside layer, with `?theme-debug=1`, draws a planned route as its
  curve plus the swept boxes of its subdivided hulls.
- If February's cupids land an air surface first, use theirs, provided it
  excludes the rail.

### Gull behaviour

A pure model in ledge-local coordinates while on a ledge, so it rides with
its card on scroll; in flight, relative to its landing ledge. The cursor is
the last mouse or pen hover position (no buttons held), forgotten on pointer
down, leaving the window, blur, a hidden tab and a reduced-motion change, as
`ledgeScene` already does. "Moving" means a hover move in the last second;
"still" means none for the time given.

| Mode | Pose | Ends when | Then |
| --- | --- | --- | --- |
| stand | stand (facing and eyeing a cursor within 360px) | its idle time (4 to 10s) runs out; a moving cursor comes within reach (see Follow); a cursor within 40px | strut |
| strut | strut, 26px/s | it reaches its target | stand; or eye if the cursor is still |
| eye | eye, head tilted toward the cursor or a flying gull (eased, at most 25 degrees) | the cursor moves (stand or strut); it is chosen to swoop (run) or to call (call) | |
| run | take-off: two running steps of 9px, wings beating at 4 per second | 0.45s, airborne at the end | climb |
| climb | flight, 2.8 wingbeats a second, 200px/s | it reaches A | dive |
| dive | swoop, wings folded back, gliding, speeding up to 360px/s | it reaches P | pull-up |
| pull-up | flight, body pitched up 25 degrees, two quick flaps at 4 per second | it reaches B (about 0.35s) | cruise |
| cruise | flight, 2.8 a second, 240px/s | 30px before L | flare |
| flare | flare, braking flaps at 4 per second, slowing to 60px/s | its feet reach the ledge | touchdown |
| touchdown | flare to stand, two run-out steps of 6px, wings held up then folded | 0.7s | call |
| call | call | 1.6s | stand, ignoring that resting cursor |
| away | not drawn | 1.2 to 2.5s | stand at a new spot (the re-plan's last resort only) |

- **Follow**: a moving cursor within 360px across and 240px up or down of a
  gull's ledge makes it strut along its clear run toward the point under the
  cursor, stopping 36px short of it (it keeps its distance) and 100px from
  any other gull. That is "struts along the ledges eyeing the cursor".
- **Too close**: a cursor within 40px of a standing gull makes it strut 48px
  away from it, in the upright pose, if its run allows; otherwise it stays.
- **Wander**: with no cursor, a gull struts 30 to 120px along its run every
  4 to 10s, stops, and looks about (a head turn either way).
- **Facing**: it faces the cursor (turning round when the cursor is behind
  it, at most once per 1.2s, the turn a quick 0.2s mirror like the fox's
  settle), or a flying gull while one flies.
- **The long call**, visual only (there is no sound anywhere in these
  themes): 0.3s with the bill pointed down and forward, then the head thrown
  up over 0.25s, held 0.8s with the bill wide open and three small pulses of
  the head as each note would come, then closed over 0.25s. Herring gulls
  start the long call bill down and swing the head up, calling with the bill
  open (All About Birds; Filchagov on the closely related Armenian gull). No
  call marks or other drawn effects: the posture reads, and a drawn mark
  would be one more thing to keep off content.
- **First placement**: standing at random spots 16px or more inside the
  ledges' clear runs, in view, per the group rules; wander times staggered.
- **Layout changes** (on a ledge): a gull keeps its ledge and mode while the
  27px run under it still exists, with its position and target pulled inside
  it if it shrank; otherwise it is placed standing at a new spot with no
  animation. A ledge scrolled out of view keeps its gull; only a new spot or
  a landing must be in view. In flight: see the airspace contract.
- **Touch**: no hover cursor, so no following and no swoops; the gulls
  wander.

### Reduced motion

Every gull stands in the reference pose, head level, no blink, no wander, no
swoop and no call, at its spot, kept across measurements while that spot
stays clear (so scrolling does not make it jump), else at the middle of the
best run. A reduced-motion change mid-flight places the flier standing at
its landing spot, or the nearest valid one. The drifts and shells are static
anyway and stay as they are.

### Sand drifts

- **Where**: only where `clearRuns(f, obstacles, 6)` says 6px is clear (the
  tallest drift with a shell on it), on card tops and heading rules alike,
  inset 8px from each end. Never under heading text: the overlay sits above
  the page, so a drift there would be drawn over it.
- **What**: seeded by ledge id, in 56px slots; about 55% of slots get a
  drift, 16 to 44px long and 1.5 to 5px high, its crest a third of the way
  along from one end (the windward slope long and gentle, the lee short and
  steep, as wind-blown sand lies), the side chosen per ledge so a ledge's
  drifts all face the same wind. One stroked and filled path per ledge: a
  sand fill (`#d8bf8a`), a lighter crest line (`#ecd9a8`), and at most three
  darker grains (`#b49a66`, 1px) per drift.
- **Shells**: on about one drift in four, at its foot, a ribbed cockle (a
  small fan with three ribs) or a winkle (a small spiral), 4 to 5px, drawn in
  code. At most 14 shells on a page, shared out a ledge at a time (the
  lesson of the frost's glint cap: the first 14 in document order would
  leave every later card bare).
- **Motion**: none. The drifts are still under every setting, so reduced
  motion changes nothing about them. The gulls stand in front of them.
- **Cost**: one path per ledge plus a few shell paths; no per-frame work
  beyond following the ledges on scroll.

### No rail sky

The rail sky (`sky.ts`) is free this month. Gulls wheeling there would be a
second, separate flier with its own rules, and the swoop is the gull's moment;
a quiet rail keeps the eye on it. The shelf's chips are left for the
viewer to imagine the gulls eyeing.

### Accent

Seaside-rock pink `#f49ac1`, the colour of a stick of rock: distinct from
the default lime, Halloween's orange, Bonfire's gold, the aurora's teal,
Christmas's parchment, the info blue and the status red (`#d95f52`, which is
darker and redder). Only the accent tokens move. A proposal: easy to change
in `styles/themes.css`. (The art keeps clear of pink and magenta for keying;
the accent is CSS and does not touch it.)

## Research: the herring gull

The British breeding adult, *Larus argentatus argenteus*.

**Size and plumage.** 55 to 67cm long, wingspan 125 to 155cm, 0.7 to 1.5kg;
males larger. Adults in breeding plumage have a white head and underparts and
a pale silver-grey back and upper wing (the mantle); the wingtips are black
with white spots ("mirrors") and white tips. The bill is yellow, stout, with
a hooked tip and a red spot on the lower mandible near the tip (the gonys
spot); the eye pale yellow with a ring of bare yellow-orange skin, which
gives the hard stare. Legs pink at all ages (flesh-coloured; yellowish in some
Baltic birds). Folded, the black primary tips cross and project well beyond
the short square white tail. (Wikipedia, European herring gull; Scottish
Wildlife Trust; MarLIN.)

**Leg and foot, joints by name.** A bird stands on its toes (digitigrade).
From the body down:

- **Hip** (the acetabulum, high in the pelvis) and the **femur**, short and
  held near horizontal, entirely inside the body's feathers.
- **Knee**, pointing forward, hidden in the belly feathers. Below it the
  **tibiotarsus** (the tibia fused with the upper tarsal bones, the
  "drumstick"), feathered above and bare in its lower part, which shows as a
  short pink stub below the belly.
- **Intertarsal joint**, the ankle: the visible joint that bends backward and
  is so often called the knee. In a standing gull it sits a little below the
  belly feathers.
- **Tarsometatarsus**, the long scaly bare shank (the tarsus), from the ankle
  down to the foot.
- **Metatarsophalangeal joints** where the tarsus meets the toes, and the
  toes themselves: digits two to four forward, joined by full webs (a
  palmate foot); the hallux (digit one) small, raised and set high at the
  back, as in gulls and terns. Phalanges per toe 2, 3, 4 and 5 for digits
  one to four, each toe ending in a short dark claw.

(Wikipedia, Bird feet and legs; birds-online.de on the intertarsal joint.)

**The walk and its strut.** Birds walk with each foot down for more than
half a stride (duty factor above 0.5), alternating single and double
support, and change gait gradually rather than abruptly (Gatesy and Biewener
1991). The gull's walk: the two feet alternate exactly half a stride apart,
each down for about 0.6 of it, so both are down briefly at each change. A
foot lands nearly flat, toes spread; as it leaves, the heel (the
metatarsophalangeal end of the tarsus) rises first and the toes peel off the
ground from the proximal joints out, as measured in walking mallards
(PeerJ 2023, on the mallard's webbed foot); in the swing the ankle flexes, the webbed toes
draw together and hang toes down, then spread again before the foot lands.
Gulls are classed as walkers that do not head-bob: black-headed gulls bob
only now and then, while foraging with long strides (Fujita 2006), and
ring-billed gulls likewise when walking slowly to forage (Lisney and Troje).
So the strut keeps the head steady relative to the ground, the body rising
and falling a little twice a stride (once a step) with a slight roll, which
is what makes a gull's deliberate walk look like a strut. The upright
posture (neck stretched up and forward, head a little down, the wrists of
the folded wings lifted slightly off the body) is the herring gull's threat
or alarm stance (Tinbergen's posture catalogue, via All About Birds' gull
behaviour pages) and is the eye pose here: a gull squaring up to the cursor.

**Take-off.** On the ground a large gull faces into the wind, takes a few
running steps and jumps, beating hard; the first wingbeats are the most
powerful, with the stroke plane tilted steeply down to drive the body
forward, and the body, tail and wings near horizontal to cut drag (Berg and
Biewener 2010, pigeon, the best measured case). Two running steps and a jump
on the page.

**Flight and wingbeat.** Herring gulls flap at about 2.5 beats a second in
level flight (Blake 1948: 2.5 plus or minus 0.33, range 1.8 to 3.3, 83
observations), up to 4 in the few quick flaps of landing; tables give 2.8.
The page uses 2.8 cruising and 4 for take-off and landing, a rate that reads
plainly at 60 frames a second without a blur. A wing has the **shoulder**
(the humerus), the **elbow** (the forearm, radius and ulna, carrying the
secondaries) and the **wrist** (the carpal joint), beyond which the hand
(carpometacarpus and digits) carries the ten primaries, the black-tipped
outer flight feathers. On the downstroke the wing is spread straight; on the
upstroke birds of the gull's build flex at the elbow and wrist, drawing the
hand in and back (Tobalske 2007; Crandell and Tobalske 2015). So the rig
flaps the arm about the shoulder and folds the hand about the wrist on the
way up. Gulls glide often between flaps; the dive at the cursor is a glide
with the wings half folded and swept back, wrists forward, the shape a gull
takes stooping on food.

**The landing flare.** Landing, a bird pitches its body, tail and wings from
near horizontal to near vertical to brake, tilts its stroke plane up so its
last few strong wingbeats push air forward, and swings its legs forward to
take the touchdown (Berg and Biewener 2010; Provini et al. 2014, finches and
doves, on the final wingbeats). A gull's tail fans and presses down, the
webbed feet spread wide and reach forward, and it often runs a step or two
on landing and holds its wings up a moment before folding them.

**The long call.** The herring gull's loud territorial and greeting call:
the head is brought down with the bill pointing down and forward, then swung
up and back while calling with the bill wide open (All About Birds; Filchagov
on the Armenian gull, a close relative, whose argentatus-type throw-back ends
with head, neck and back in a line). Neighbours often answer with their own.

## Art plan

The rig follows the fox's and the hedgehog's: parts on the shared rig
(`lib/theme/rig/`), legs posed in code, every picture on one eye scale.

- **Ground parts** (an edit of `gull-standing.png`): the body with its
  folded wing as drawn, legs taken off and the belly closed where they were;
  the head and neck with a soft unoutlined back edge where it overlaps the
  body; the lower mandible as its own piece pivoting at the gape, with the
  orange-red gape drawn behind it, so the bill opens smoothly for the call
  (one head picture with the bill open would snap); the tail closed and the
  tail fanned (for the flare).
- **Flight parts** (an edit of the reference, with `gull-pose-flap-up.png`
  and `gull-pose-flap-down-2.png` as guides): the body with the folded wing
  taken off and the back closed, for flight; the near wing in two pieces, the
  inner arm (shoulder to wrist, with the secondaries) and the hand (wrist to
  tip, with the primaries), each as an upper surface and as an underside,
  because a side view sees one side of a raised wing and the other of a
  lowered one (raised, the near wing's upper side turns up and in, so a
  side-on eye sees its underside; lowered, its upper side; the far wing
  the other way about: `rig/wings.ts`'s `wingFace`). The far wing reuses them a shade darker. The flap rotates the
  arm about the shoulder (about 50 degrees up to 35 down from level at
  cruise), folds the hand about the wrist on the upstroke, foreshortens both
  as they pass level, and swaps upper for underside there.
- **Legs** (an edit cut from the reference's near leg): the bare stub of the
  tibiotarsus, the tarsus piece (rounded at both ends, laid along the bone),
  and two feet seen from the side, spread flat and folded (toes together,
  for the swing and for flight, where the legs are tucked into the belly
  feathers and not drawn). Each piece outlined and as fill alone
  (`fill_only`), so outlines run only round the silhouette. The bird kit's
  `BirdLeg` (`rig/bird.ts`) covers a bird's leg: the femur hidden in the
  body, the knee kept forward, `walksOn: Toes` with the tarsometatarsus as
  the bone up from the toes and the intertarsal joint as its "ankle",
  stepping on `birdWalk`'s two-beat gait (beats 0 and 0.5, stance 0.6).
  The lab's joints view names hip, knee, intertarsal joint (ankle) and
  metatarsophalangeal joint.
- **Life**: the eye blinks on a seeded schedule (`rig/life.ts`), the lid a
  pale grey-white (gulls draw a pale third eyelid across); the head eases
  toward the cursor; the body breathes slowly when standing.
- **Key poses**: one per mode, each an edit of the reference, for the lab to
  lay over the rig: `walk-contact` and `walk-pass` (the strut), `eye`,
  `call`, `takeoff`, `flap-up` and `flap-down-2` (flight), `swoop`,
  `flare-2`. Stand and reduced motion use the reference itself.
- **The critters lab**: the gull needs the airborne view the fliers'
  descriptor extension adds (no floor anchor): flight modes shown hanging in
  the frame, with the flap cycle on the numbered frames.

The parts were cut by the bird kit (phase C's `c-birds`), which built the
gull as its test bird (`seaside/gull-rig.ts`, in the critters lab) for the
owner to take over; see "Art" for the sheets and "The test gull's rig" for
what it does and does not yet do.

## Art

Generated on 2026-10-10 by the Codex CLI (0.161.0, `gpt-5.6-terra`) through
its built-in `$imagegen` path, each on a flat magenta `#FF00FF` background
(the gull's legs and gape are a muted flesh and orange, well away from
magenta, so the shared keying recipe holds), with
`design-docs/aurora/winter-kit.png`, `fox-standing.png`,
`design-docs/bonfire/toffee-apples.png` and `design-docs/halloween/pumpkins.png`
as style references. Every pose is an edit of `gull-standing.png`.

| Source | Prompt, in short | Shipped as | Display size |
| --- | --- | --- | --- |
| `seaside-kit-2.png` | chips in plain chip paper with a wooden fork, a red bucket with a yellow spade, a 99 with a flake stood in a sand heap; an edit of a first generation whose chips came out as cubes and whose cone balanced on its point | `seaside-kit.webp` (not yet) | about 124x56 on the shelf |
| `gull-standing.png` | an adult herring gull standing square, side on, facing right: plumage, bill and gonys spot, pale eye with orange ring, pink legs with the intertarsal joint showing, webbed feet with a raised hallux | the lab's reference (not yet) | 36.5x25.5 page px |
| `gull-pose-walk-contact.png` | the strut as the near foot lands, the far heel lifting | the lab's overlay (not yet) | same eye scale |
| `gull-pose-walk-pass.png` | mid-stride, the swinging foot folded, toes down | the lab's overlay | |
| `gull-pose-eye.png` | upright, neck stretched, bill up toward something above | the lab's overlay | |
| `gull-pose-call.png` | the long call: head up, bill wide open, gape showing | the lab's overlay | |
| `gull-pose-takeoff.png` | the last running step, wings high at the top of the upstroke | the lab's overlay | |
| `gull-pose-flap-up.png` | level flight, top of the upstroke, legs tucked | the lab's overlay | |
| `gull-pose-flap-down-2.png` | level flight, bottom of the downstroke, true side view; the first try had the far wing growing from the breast | the lab's overlay | |
| `gull-pose-swoop.png` | a shallow dive, wings half folded and swept back | the lab's overlay | |
| `gull-pose-flare-2.png` | the flare, pitched up, wings raised, tail fanned, feet reaching forward, true side view; the first try was a three-quarter front view | the lab's overlay | |

| `gull-parts.png` | the reference taken apart: the body with its folded wing, legs off and belly closed, head off with a soft edge; the head and neck with a soft unoutlined back edge | `gull-body.webp`, `gull-head.webp` | placed where they sat |
| `gull-flight-body.png` | an edit of `gull-parts.png`'s body, in place: folded wing, wingtips and tail taken off, the back closed as a grey mantle | `gull-flight-body.webp` | |
| `gull-flight-parts.png` | the tail closed and fanned, soft at the root (its first piece, an egg-shaped body, is not used) | `gull-tail.webp`, `gull-tail-fanned.webp` | laid at the rump by hand |
| `gull-wings.png` | the spread wing flat, seen from above and from below, each cut at the wrist: arm and hand, span up the picture, leading edge right | `gull-arm.webp`, `gull-hand.webp`, `-under` of each | arm 10.5, hand 11.5 drawing units long |
| `gull-limbs-3.png` | the leg's pieces: the drumstick (feathered at the knee end), the tarsus, the webbed foot flat and with its toes drawn together; the first try (not kept) was refused by the image tool and the second drew hands | `gull-drumstick`, `gull-tarsus`, `gull-toes`, `gull-toes-curled` (`.webp` and `-fur.webp`) | bars by the reference leg's thickness, feet by its foot's length |

Each prompt followed the seasonal brief's template (header, image spec,
footer); the table gives each request in short. `export.py` (on
`design-docs/art.py`) puts every picture on the eye's scale (the pupil
0.3 drawing units, 12 file pixels to a unit, so the reference is 17.3
units tall and `gull-rig.ts`'s 1.5px a unit draws it 26px tall) and
prints where each part sat in the reference.

### The test gull's rig

`seaside/gull-rig.ts` is the bird kit's test bird, built from these parts
on `rig/bird.ts` (legs and walk) and `rig/wings.ts` (wings and flight
poses), with footprints its rig test measures over every motion. It does
stand, strut (no head bob, the body rising once a step), forage (the
occasional bob), take-off, flap (2.8 a second), glide, stoop, flare and
settle; it does not yet do the eye or call poses, the opening bill, or the
mirror turn, and its model and behaviour are the owner's. Known
shortcuts for the owner to refine: the flight body's grey mantle reads a
little like a folded wing; the wings are drawn about 0.9 of the bird's
length, longer than the key poses but shorter than life; landing and
taking off hold the anchor on the floor (a route lifts it).

## Verification (for the build)

- Unit tests: the gull's state table, follow and wander, group count and
  spacing over long random runs, one airborne at a time, the swoop's once per
  resting place and 30s cooldown, P's choice (never containing the cursor,
  within 160px, aimed within 35 degrees), every route's swept area inside air
  on the fixture pages, re-plan and fade on a mid-flight layout change,
  reduced motion; the rig's footprints over every cycle (the flap envelope
  and the bank included), feet never below the ledge, the two-beat walk with
  double support, the head steady while strutting; the drifts' heights,
  their gaps under text, the shell cap shared out by ledge; `air` bounds
  excluding the rail.
- The Go calendar, boundary and override cases (July's last day and
  September's first now bordering `seaside`).
- `e2e/seaside.spec.ts`: palette and mounting, click-through and below
  dialogs, at least two gulls on the overview, no gull over content on every
  route, a forced swoop on the queue page sampled until it lands with
  `coveredContent` empty at every sample, a still scene under reduced motion,
  and the phone layout; the critters lab tests; the shared shelf contract.

## Sources

- Wikipedia, European herring gull (size, plumage, bill and gonys spot, eye
  ring, legs, the long call, taking food from people):
  https://en.wikipedia.org/wiki/European_herring_gull
- Scottish Wildlife Trust, herring gull (UK size range, flesh-coloured legs):
  https://scottishwildlifetrust.org.uk/?p=948252
- MarLIN, *Larus argentatus* (length and wingspan):
  https://marlin.ac.uk/species/detail/2209
- Wikipedia, Bird feet and legs (digitigrade stance, the knee hidden and
  pointing forward, the intertarsal joint, palmate feet, the gull's reduced
  hallux, phalanx counts): https://en.wikipedia.org/wiki/Bird_feet_and_legs
- birds-online.de on the intertarsal joint mistaken for the knee:
  https://www.birds-online.de/wp/?p=20276
- Gatesy, S. M. and Biewener, A. A. (1991), Bipedal locomotion: effects of
  speed, size and limb posture in birds and humans, *J. Zool.* 224: 127-147
  (walks at duty factor above 0.5, gradual gait change), as summarised in
  Hancock et al. 2007 on tinamous:
  https://people.ohio.edu/stevensn/documents/Hancock%20et%20al%202007%20Tinamous%20early%20view.pdf
- PeerJ (2023), Effects of the speed on the webbed foot kinematics of
  mallard (Anas platyrhynchos) (toes leaving the ground in turn from the proximal
  phalanges): https://peerj.com/articles/15362
- Fujita, M. (2006), Head-bobbing and non-bobbing walking of black-headed
  gulls, *J. Comp. Physiol. A* 192: 481-488; and the review of head-bobbing
  in walking birds: https://reinhold-necker.de/seite10.html
- Lisney and Troje, head-bobbing in ring-billed gulls, *Canadian
  Field-Naturalist*:
  https://canadianfieldnaturalist.ca/index.php/cfn/article/download/1843/1805/7224
- Blake, C. H. (1948), More data on the wing flapping rates of birds,
  *Condor* 50: 148-151 (herring gull 2.5 plus or minus 0.33 a second; 4.0 in
  the quick flaps of landing):
  https://sora.unm.edu/sites/default/files/journals/condor/v050n04/p0148-p0151.pdf
- Hooper Museum (Carleton), wingbeat table (herring gull 2.8 a second):
  https://hoopermuseum.carleton.ca/birds/pg4pt3.htm
- Berg, A. M. and Biewener, A. A. (2010), Wing and body kinematics of
  takeoff and landing flight in the pigeon, *J. Exp. Biol.* 213: 1651-1658:
  https://biewenerlab.oeb.harvard.edu/publications/wing-and-body-kinematics-takeoff-and-landing-flight-pigeon-columba-livia
- Provini et al. (2014), Transition from wing to leg forces during landing in
  birds, *J. Exp. Biol.* 217: 2659:
  https://cob.silverchair.com/jeb/article/217/15/2659/12207/Transition-from-wing-to-leg-forces-during-landing
- Tobalske, B. W. (2007), Biomechanics of bird flight, *J. Exp. Biol.* 210:
  3135-3146: https://doi.org/10.1242/jeb.000273; and Crandell and Tobalske
  (2015), Kinematics and aerodynamics of avian upstrokes:
  https://cob.silverchair.com/jeb/article/218/16/2518/14222/Kinematics-and-aerodynamics-of-avian-upstrokes
- Cornell Lab, All About Birds Academy, decoding gull behaviour and threat
  signals in gull colonies (the long call's bill-down then head-up sequence;
  the upright posture):
  https://academy.allaboutbirds.org/decoding-gull-behavior/ and
  https://academy.allaboutbirds.org/keeping-the-peace-threat-signals-in-gull-colonies/
- Filchagov, long call of the Armenian gull (the throw-back phase and the
  argentatus-type head-neck-back line):
  https://gull-research.org/armenicus/filchagov/fig1.html
- Tinbergen's catalogue of gull postures (upright, oblique, long call), as
  cited by his group: https://repository.naturalis.nl/pub/317905/ZM1964039023.pdf
