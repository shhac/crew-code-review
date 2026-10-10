# Valentine's (2026-10-10)

**Pins**: written against `ea7e9d5` (the hedgehog rebuilt from one drawing).
Code-internal.

February's theme, from `decisions/2026-10-seasonal-theme-calendar.md`. The
config value is `valentine`; `auto` turns it on from 1 to 28 (or 29) February
in the daemon's local time. This note settles the month's open questions
before code, as the calendar's checklist asks. The cupids are the first
animals on the rig that fly, so most of it is their airspace contract.

## What it shows

- **Rail shelf** (`ValentineShelf.svelte`): a heart-shaped box of
  chocolates, a single red rose in a bud vase and a heart-shaped card, as one
  picture. Hidden on cramped rails like the other shelves.
- **Petals** (`petals.ts`): a few rose petals lying along the ledges, seeded
  per ledge id, only where the ledge is clear.
- **Spent arrows** (`arrows.ts`): an arrow a cupid has shot stays stuck in
  the ledge it hit, wobbles, holds a while, then fades.
- **Cupids** (`cupid.ts`, drawn by `cupid-rig.ts`, grouped by `cupids.ts`):
  two, or three where the page has room, hovering in the page's open air and
  flitting between spots now and then. When the cursor goes still, one of
  them draws its bow, aims at it and shoots; the arrow flies along an arc
  into the ledge nearest the cursor, where it pops into a few hearts. A
  cursor whipping past makes a cupid dodge.

## Decisions

### Where the air is: the airspace contract

Every animal so far stood on a ledge, and `clearRuns` with the 6px reach is
about standing. A flier needs the space between things. Measured on every
route at 1440 and 1024 wide: the gaps between cards are 14 to 22px, too
narrow for anything with wings, but each page heading has open air beside
and above its text (the band right of the title and above the heading's
controls, 60 to 110px tall), and some pages have wide empty stretches (the
column below the queue on the overview, the page's foot below the last
card). On a phone the heading is mostly its text and stacked controls; the
stretch right of a short title is usually all there is.

- **What air is** (`air.ts`): the box of `main` (never the rail, whose nav
  is not measured as obstacles) inset 6px, minus every obstacle
  `measurePage` reports (text, controls, charts, and every card's own box),
  each widened by 4px. Card boxes count here, unlike for the ledge walkers'
  6px reach: a cupid over a card's empty middle would read as covering the
  card, and an arrow crossing one would read as shooting it. It is worked
  out with each measurement (`airOf`: the `PageMap` and `main`'s box, read
  in the same frame). Two boxes come of it: the room (all of `main`, in
  view or not), which a cupid already somewhere must stay inside, since a
  scroll carries it out of view and back with its ledge; and the view (the
  part of it inside the window, 6px in), where new spots, the ends of
  routes and shots are chosen.
- **Footprints**: each pose's box is the box its drawing stays inside at
  every moment of its motion, wings through the whole wingbeat, bow and
  string at full draw, dangling legs at the ends of their swing, and the
  hover bob. Taken from the anchor (the middle of the belly), so a pose has a
  half width (it is mirrored to face either way), a reach up and a reach
  down. A rig test samples every pose over its whole cycle and checks the
  drawing never leaves its box (as `fox-rig.test.ts` does, extended for a
  reach down), sampling whole wingbeats, the slow bob and leg kick, every
  point of a draw and a loose at every aim from 35 degrees up to 75 down,
  and flying slow and fast, braking and speeding up (`cupid-rig.test.ts`;
  `footprints.ts`). In page pixels:

  | Footprint | Either side | Up | Down | Used for |
  | --- | --- | --- | --- | --- |
  | hover | 24 | 28 | 17 | hovering, turning, entering |
  | flight | 23 | 28 | 17 | flits and dodges, swept along the route |
  | shoot | 24 | 29 | 17 | drawing, aiming and loosing |
  | dodge | 25 | 28 | 15 | the startled first third of a dodge |

  A hover spot must hold the largest of all four (50 wide, 29 up, 17
  down), since a cupid may do any of them there. The wings beat out behind
  the back, so they set the width; the curls and the raised wing set the
  height.
- **Hover spots**: a point where that footprint sits wholly in air, and
  over no ledge's own line (a card top or heading rule: hovering across one
  read as standing on it; crossing one in flight is fine). Candidates are
  sampled every 16px over the view. A spot is anchored to the nearest ledge
  (its id and an offset from the ledge's left end and line), so a hovering
  cupid rides with the page on scroll exactly as a ledge walker does; it is
  re-checked on every measurement. First placement prefers spots spread
  out (as far from the others as it can, up to 300px) and about 50px above
  a ledge, where its arrows can land, with a little randomness.
- **Routes**: a flit is one cubic curve from spot to spot, four bows tried
  in turn (arched over by a fifth of the distance, dipped under, straight,
  arched higher). The route is clear when the flight footprint, swept
  along the curve, is: the curve is sampled at least every 2px of its length
  and each pair of neighbouring samples is tested as one box covering both,
  so nothing between samples is missed. No route is clear, no flit: it stays
  where it is. A route is in page coordinates while it is flown and anchored
  to its starting spot's ledge, so a scroll carries it along.
- **Room between cupids**: centres stay at least 64px apart (two hover
  boxes and a gap), checked against where each other cupid is, where it is
  going, and the whole remaining route of one in flight. A flit or dodge
  that would pass closer is not taken.
- **Arrows**: the arrow is a swept effect too. It flies along one quadratic
  arc from where it leaves the bow (12px ahead of the cupid's middle and 6px
  up) to a landing point on a ledge, at most 420px away, and the arc is
  clear when the arrow's box (its 12px shaft behind its tip, along the arc,
  plus 2px) swept along it stays in air, never within 20px of another
  cupid's hover box, and comes down onto the ledge from above (no point of
  it over the ledge's span is below the ledge's line). The only exemption is
  the card whose top edge it lands in, which the arc meets only with its
  tip. Arcs are tried at four heights (their top a quarter of the distance
  across above the higher end, then two fifths, an eighth and three fifths)
  and the first clear one that the cupid can aim along (35 degrees up to 75
  down) is shot.
- **Landing points**: only ledges in view, at least 16px in from a ledge's
  end, where `clearance` finds 24px clear (with the walkers' 6px reach)
  over the 17px either side of the point: room for the stuck arrow (it stands up to 11px out of
  the ledge) and for its hearts (they rise up to 21px and spread 17px each
  way). So an arrow never lands in a card's middle, a chart or text, and its
  hearts never cover any.
- **Layout changes**: on every measurement each cupid's spot is re-checked.
  One hovering on a spot still clear stays. One whose spot is gone flits to
  the nearest clear spot if a clear route exists from where it is now; if
  not, and where it is now is clear, it hovers there (anchored afresh);
  otherwise it is placed at a new spot without animation, fading in over
  0.3s; with no air at all it is not drawn. Mid flight, its route is checked
  again from where it is: still clear, it flies on; else as for a lost spot.
  An arrow in flight is anchored to its landing ledge; if the ledge is gone,
  or the arc or the landing is no longer clear, it vanishes and no hearts
  pop. A cupid drawing its bow keeps drawing while its spot stays; the shot
  is re-checked when it looses, and lowered without a shot if it no longer
  clears.
- **Reduced motion**: every cupid hovers still at its spot (the first clear
  spots, kept across measurements while clear), wings held spread, no bob,
  no blink, legs hanging. No flits, no shots, no arrows, no hearts. Petals
  are drawn as always.
- **Debugging**: `?theme-debug=1` draws the hover spots as dots and each
  cupid's footprint, in the layer's own overlay.

### How many, and keeping apart

The calendar's group rule: two, or three where three hover spots pairwise
120px apart exist when they are placed (decided once from their footprints,
never grown on scroll), else two; fewer only when the page has no room.
They are placed and stepped in turn (`group.ts`), each seeing the others as
they now are. Ledges or air with no cupid come first, so they spread out.
Only one flits at a time, except a dodge, and only one draws or aims at a
time: a shot claims the page until its hearts have popped.

### What each does

A pure model in page coordinates anchored to ledges (above), stepped with
the time, a random source and the cursor.

| Mode | Pose | Ends when | Then |
| --- | --- | --- | --- |
| hover | hover | its restless time comes (6 to 14s, seeded), and no other cupid is flitting or shooting | flit, if a clear route to a spot 60 to 360px away exists; else hover on |
| flit | flight | it reaches the spot, at about 150px/s, eased in and out | hover |
| turn | hover | 0.25s, facing the target | draw |
| draw | draw | 0.6s: the bow arm rises toward the target, the string hand pulls back to the jaw | aim |
| aim | aim (full draw) | 0.45s | loose: the arrow leaves, if its arc is still clear; else hover |
| loose | release | 0.45s: the string hand follows through past the cheek, the bow arm holds, then lowers | hover |
| dodge | dodge then flight | it reaches a spot away from the cursor, at about 320px/s | hover; no dodging or shooting for 1.2s from the dodge |
| enter | hover, fading in | 0.3s | hover |

- **The cursor goes still**: the last mouse or pen hover position (no
  buttons, as for every theme), unmoved for 1s and still in the window.
  Then, if no shot has been made at it since it last moved, no arrow is in
  the air and 3s have passed since the last shot, a hovering cupid shoots.
  The landing point is the clear point on a ledge in view nearest the
  cursor that some cupid can reach with a clear arc (at most 420px away);
  the shooter is the cupid that can, nearest the cursor. It aims along the
  arc's first stretch, which runs toward the cursor's side since the landing
  is chosen nearest it. An arrow is never shot at the cursor itself: the
  cursor is usually over content, and arrows only ever land in ledges.
- **The cursor moves again** before the arrow leaves: 24px or more from
  where it was still, the cupid lowers its bow and hovers. A fast move is a
  dodge as well.
- **A fast cursor**: one moving at 900px/s or more, passing within 70px of a
  cupid's middle, makes it dodge: a quick dart to the nearest clear spot,
  reachable by a clear route, at least 60px farther from the cursor's path
  than it is now (within 360px; the 24 nearest are tried). None reachable,
  it flutters in place (a faster wingbeat for 0.4s). Then it cannot dodge
  again for 1.2s. (It first darted to the farthest such spot; in the
  heading band those were nearly always out of reach, so on the real page
  it only ever fluttered.)
- **The arrow** flies at 420px/s (at least 0.3s), turned along its arc. On
  landing it becomes a spent arrow stuck in the ledge (below) and pops four
  hearts.
- **First placement**: on the best spots: those over or near a ledge in
  view, spread out; restless 3 to 8s later, so the first flit comes soon.
- **Hidden tab, leaving the window, pointer down, reduced motion changing**:
  the cursor is forgotten, as for the other themes; a drawn bow is lowered.

### Flight drawn from research

Hummingbirds hover with the body held steeply (about 45 degrees) and the
wings sweeping in a near-level figure-eight, turned over on the upstroke
(supinated) so that it also lifts, unlike most birds, whose upstroke is
idle; to fly forward they tilt the body and the stroke plane together,
keeping the same beat (Tobalske et al. 2007; the Stanford essay; Warrick et
al. 2005). Small birds that briefly hover (finches and other passerines)
lift on the downstroke only and pitch the body up and down with each beat,
spreading the tail against it. A cupid is drawn upright, so:

- **Hover**: the body upright, leaning back about 8 degrees. The near wing
  sweeps from high behind the shoulder down and back to about level with
  it and up again, an arc of about 75 degrees. (A level stroke plane, as a
  hummingbird's, would carry an upright cupid's wings forward across its
  face at page size; behind the back, tipped well up from level, is the
  nearest that reads.) On the downstroke the wing is broad; on the upstroke
  it is turned edge-on, drawn narrower (squashed across its width to 55%),
  and the tip rides a little higher coming back than going forward, so it
  traces a flattened figure-eight. The far wing beats with it, behind the
  body, a shade darker. The body rises a hair on each downstroke (0.3
  drawing units) and drifts on a slower bob (1.6s, 1.5px on the page).
- **Flit**: the body pitches forward toward where it is going, up to 25
  degrees with speed and back as it slows; the stroke plane steepens with it
  so the wings beat more up and down, over a wider arc (95 degrees).
- **Beat**: a real hummingbird beats 40 to 50 times a second, which at page
  size and 60 frames a second is a blur. A cupid is drawn as a slower,
  clearly seen flutter, as cartoons draw it: 5.5 beats a second hovering
  (eleven frames a beat), 4.5 flitting, 8 for a startled flutter. The beat
  is drawn in code by turning and squashing the wing pictures; there are no
  generated flap frames.

### The figure, from putto iconography

A cupid is drawn as the Renaissance putto (an amorino when he is Cupid): a
chubby toddler with small feathered wings, shown with his bow and arrows,
the attributes that make a putto Cupid. Hellenistic and later art made Eros
a chubby boy; modern pictures dress him in a sash or a nappy. Ours is
cartoon and wholesome, fully decent: golden curls, rosy cheeks, a rose-red
toga tunic over the near shoulder that covers the body and hips to mid
thigh, belted with a gold cord, a small quiver of gold arrows with heart
fletching on its back, small white dove-like wings from the upper back. (A
sash wrapped round the hips was asked for first; the image generator
refused it, and a tunic reads more clearly at page size anyway.) No blindfold (it would hide
the eye that blinks and aims), no halo, no torch.

- **Parts**: as for the fox, every part comes from one drawing of the cupid
  hovering in side view (`cupid-reference.png`), cut by image edits: the
  body (torso, tunic and quiver, with the arms, legs, head and wings taken
  off and the body closed where they were), the head (a soft unoutlined back
  edge where it sits over the neck), one wing (the far one is the same
  picture behind the body, a shade darker), and the limb pieces from its own
  limbs: an upper arm, a forearm piece, a little fist, a chubby thigh, a
  shin and a foot seen from the side. Each part is placed where it sat in
  the reference by matching (`art.py`'s `place`) and checked by overlay.
- **Legs, in code**: a toddler's legs hang from hips low in the body (under
  the tunic), thigh then shin then foot, knees bent a little, toes pointing
  down. They are pendulums: each hip's angle follows the body's sideways
  acceleration (they trail as it speeds up, swing forward as it brakes),
  damped, with a slow kick of a few degrees while hovering, the two legs out
  of step. The near leg's fur is drawn over the tunic's hem so it grows out
  of it.
- **Arms, in code**: an archer stands side on, the bow arm straight out
  toward the target, and draws the string straight back with the other
  hand to a fixed anchor on the face (the corner of the mouth or the jaw);
  at the release the fingers relax, the drawing hand follows through back
  past the face and the bow arm stays up a moment (USA Archery, NASP, Mississippi
  State Extension). Facing right, the near side is the cupid's right, so it
  holds the bow in its far (left) hand and draws with its near (right) hand,
  whose arm is seen whole. Hovering, the bow hangs in the far hand in front
  of the belly and the near arm hangs loose. Each arm is two pieces of arm
  art along posed bones (shoulder, elbow, wrist) with the fist at the end,
  drawn twice like the legs (outlined, then fur alone) so no line crosses
  the elbow. Posed in code rather than baked into pictures, so the bow arm
  can point along any arc.
- **The bow, string and arrow** are drawn in code, in drawing units, over
  the far hand: a gold stave that bends deeper as it is drawn, a thin dark
  string from tip to tip through the drawing hand, and the nocked arrow
  (gold shaft, rose heart-shaped fletching and a small heart head) lying
  from the string along the bow arm. A stroke layer (`kind: 'stroke'`, a
  polyline in drawing units with a colour and a width) is added to the
  shared rig for this; the existing animals do not use it.
- **Head**: the eye blinks on a seeded schedule (`rig/life.ts`); the head
  turns a little toward a cursor within 160px (eased, at most 12 degrees),
  and toward the target while aiming.
- **One scale**: every picture is exported so the eye is one size, at 12
  file pixels per drawing unit, and `cupid-rig.ts` sets one page scale for
  every pose, 1.5 page pixels per unit: the cupid is about 38px from curls
  to toes.
- **Key poses** (edits of the reference, `cupid-pose-*.png`): hovering is
  the reference itself; then flit, aim (full draw, which the draw rises
  to), release and dodge. The critters lab lays each over its mode, lined
  up eye to eye with the rig (the poses lean, so standing them on the
  anchor would not compare like with like). Tuned against them: the flit's
  forward pitch and trailing legs, the far arm straight out with the near
  hand at the jaw at full draw, the hand flung back past the ear on the
  loose, and the dodge leaning back with arms up and legs tucked.

### The ledges: petals and spent arrows

- **Petals** (`petals.ts`): drawn only where `clearRuns(f, obstacles, 7)`
  says the ledge is clear (8px in from the ends), so never under a heading's
  text, on card tops and heading rules alike. Ledges are cut into 70px
  slots; just under half of them, seeded by ledge id, hold one to three
  petals lying on the ledge, each a curled teardrop 6 to 8px long, turned
  up to 25 degrees, in one of three rose reds with a darker edge. At most 36
  on a page, shared out a ledge at a time (as the frost's glints are). They
  are still, and the same under reduced motion. Drawn in code: at this size
  a path is crisper than a picture.
- **Spent arrows** (`arrows.ts`): only where an arrow landed (above), stuck
  in the ledge's edge, slanting the way it flew, standing up to 11px out of
  the ledge, in ledge-local x so it rides with its card. It wobbles about
  its tip, 9 degrees at first, damped by half every 0.17s (a 7 per second
  quiver, gone in about 1.2s); it holds until 6s, then fades over 1.5s. At
  most three on the page: a fourth fades the oldest out at once. Dropped if
  its ledge goes or the stretch under it is covered. Under reduced motion
  there are none, since nothing shoots.
- **Hearts**: four per landing, 6px across, each flung out from the tip at
  its own seeded angle within 50 degrees of straight up, rising 10 to 18px
  and easing to a stop as they grow from half size and fade, over 0.9s, in
  rose `#e8436b` and pink `#ff8fb3`. Inside the landing's 24px clearance.

### Rail

The shelf alone, with no sky effect this month: the cupids keep to the page,
and two skies (the rail's and the page's) with things in both would be busy.
The rail sky stays empty.

### Accent

Rose pink `#f48fb8`, a cool pink kept apart from the warning salmon
(`#ea8478`, the bad ink) and from the lime default. Only the accent tokens
move; a faint rose glow sits in the page's top-right corner, behind
everything. A proposal: easy to change in `styles/themes.css`.

### Colours near magenta

The art is pink and red, near the magenta every earlier sheet was keyed on,
and magenta keying eats any pink with enough blue in it. So the cupid's art
is drawn on flat green `#00FF00` (it has no green anywhere), and the shelf
art, whose rose has a green stem, on flat blue `#0000FF` (it has no blue or
purple). `export.py` keys each on its own colour with the same ramp as the
magenta recipe, the spill taken as that channel's excess over the other
two, and pulls the green or blue fringe out of the edge pixels.

## Integration

Shared code, changed additively: the rig (`lib/theme/rig/`) gains a
`stroke` layer (a polyline in drawing units, with an optional fill) for
the bow, its string and the arrow, and an optional `far` on an image layer
(a shade darker, as the far legs are) for the far wing; `layerName`, the
rig's `Layers.svelte` and the rig tests' reach handle both, and the fox
and hedgehog draw exactly as before. The critters lab's descriptor gains
an optional `lift` (a flier hovers that far above the stage's floor) and
an optional `down` on a footprint (how far below the anchor it reaches),
which the lab uses to raise the stage point and draw the box; walkers
leave both unset. `e2e/content.ts`'s `coveredContent` takes an optional
selector for what in each element is drawn (the cupids' pictures and bow
strokes; an arrow or heart counts whole), defaulting to the pictures as
before.

The calendar's checklist for February (done in the activation commit, last):
`ThemeValentine` in `internal/config/theme.go` (`Themes` and
`time.February` in `seasonalThemes`), with calendar, boundary and override
cases (`valentine_test.go`, and January's boundary test now expecting
`valentine` on 1 February); the dashboard config API test; `THEMES`; the
scene module's shelf and layer; the accent block; the lab pickers; the
config notes in `config.example.json`, `internal/config/starter.json` and
`config set`'s help; the root README and the release notes.

## Art

Every source was generated on 2026-10-10 by the Codex CLI
(`gpt-5.6-terra`) through its built-in `$imagegen` path, with
`design-docs/aurora/fox-standing.png`, `design-docs/aurora/winter-kit.png`,
`design-docs/bonfire/toffee-apples.png` and
`design-docs/halloween/pumpkins.png` as style references. The shelf art is
on flat blue `#0000FF`, the cupid's on flat green `#00FF00` (see "Colours
near magenta"). The cupid starts from one drawing, `cupid-reference.png`:
the cupid hovering side on, facing right, holding its bow upright in front.
A first prompt, which asked for a sash wrapped round the hips, was refused
by the generator; the second asked for a tunic. Every other cupid image is
an edit of that drawing:

- `cupid-parts.png`: the body with its arms, legs, head and wings taken off
  and closed where they were, the head with a soft unoutlined neck edge,
  and the near wing.
- `cupid-limbs.png`: an arm piece, a fist, a thigh piece, a shin piece and a
  foot seen from the side, cut from its own limbs.
- `cupid-pose-flit.png`, `-aim.png`, `-release.png`, `-dodge.png`: the key
  poses (hovering is the reference itself).

| Source | Shipped as | Display size |
| --- | --- | --- |
| `valentine-kit.png` | `ui/src/lib/theme/valentine/valentine-kit.webp` | 100x70, written at twice that |
| `cupid-reference.png` | `ui/src/lab/cupid-reference.webp` (the lab's overlay) | 19x25.17 units |
| `cupid-pose-*.png` | `ui/src/lab/cupid-pose-*.webp` (the lab's overlays) | on the same eye scale; `export.py` prints each one's eye, which the lab lines up with the rig's |
| `cupid-parts.png` | `cupid-body.webp`, `cupid-head.webp`, `cupid-wing.webp` | 10.33x12.58 at (5.64, 8.9), 11.58x11 at (6.32, 1.03), 8.33x11.17 at (1.3, 5) |
| `cupid-limbs.png` | `cupid-arm.webp`, `cupid-hand.webp`, `cupid-thigh.webp`, `cupid-shin.webp`, `cupid-foot.webp`, each with a `-fur` version | arm 2 units thick, fist 2.08 tall, thigh 2.83 and shin 2.17 thick, foot 3.17 long |

The cupid's pictures are in drawing units, all on one scale: each sheet's
eye is measured (`art.py`'s `feature`, from a seed point set in
`export.py`) and every picture is exported so its eye is 1.6 units, at 12
file pixels per unit. The body is placed where it sat in the reference by
matching its tunic's red, the head by its pale skin and curls (`art.py`'s
`place`, with a mask); both were checked by laying them over the
reference. The wing is placed by hand, since in the reference the near wing
is partly behind the quiver and the far wing. Where the shoulders, hips,
neck, wing roots, jaw and eye are, and the fist's and foot's heels, are set
in `cupid-rig.ts`, measured against these exports on a unit grid; the lab's
joints view shows them. Regenerated art means measuring again.
`uv run design-docs/valentine/export.py` reproduces every shipped file.

## Verification

- Unit tests for the pure models: air and hover spots (never over an
  obstacle, outside `main` or the window), routes (the swept footprint clear,
  including a thin obstacle between samples), arcs and landing points, the
  cupid's state table (still cursor to shot, cancel on move, dodge, cooldowns,
  layout changes mid flight and mid shot), the group (count, spacing over
  long random runs, one shot at a time), spent arrows (wobble, fade, cap),
  hearts, petals (clear runs only, cap, seeded).
- The rig: every pose stays inside its footprint over its whole wingbeat,
  swing and draw; it blinks, and holds still under reduced motion.
- `e2e/valentine.spec.ts`: mounting and palette, every descendant
  click-through, `aria-hidden`, below dialogs, still under reduced motion,
  at least two cupids on the overview, nothing over content on every route
  including arrows and hearts during a shot, and the phone layout.
- The critters lab: the cupid in an airborne view, with every mode and its
  key pose.

## Sources

- Wikipedia, Putto (a chubby, usually winged child; amorino when Cupid;
  from Eros/Cupid and the Roman genius): https://en.wikipedia.org/wiki/Putto
- Wikipedia, Cupid (bow and arrows his attributes; a chubby boy from the
  Hellenistic period; modern pictures add a sash or a nappy):
  https://en.wikipedia.org/wiki/Cupid
- Tobalske et al. 2007, three-dimensional kinematics of hummingbird flight,
  J Exp Biol 210:2368 (body and stroke plane tilt together with speed, beat
  unchanged): https://biewenerlab.oeb.harvard.edu/publications/three-dimensional-kinematics-hummingbird-flight
- Stanford Birds, Hovering Flight (body about 45 degrees, wings in a
  figure-eight on its side, twisting so both strokes lift; small birds
  cannot hover long):
  https://web.stanford.edu/group/stanfordbirds/text/essays/Hovering_Flight.html
- Warrick, Tobalske and Powers 2005, Nature 435:1094 (hummingbird
  upstroke supinated, about a quarter of the lift), as summarised in
  Sapir and Dudley 2012 and the Haifa animal flight lab's papers:
  https://animalflight.haifa.ac.il/wp-content/uploads/2015/05/Hovering-hummingbird-wing-aerodynamics-during-the-annual-cycle.-I.-Complete-wing.pdf
- APS DFD 2010, pitching oscillation in a hovering passerine (downstroke-only
  lift pitches the body; the tail counters it):
  https://archive.aps.org/dfd/2010/ht/2
- NASP, 11 steps to archery success, and Mississippi State Extension, the
  process of archery (draw straight back to a fixed anchor at the mouth or
  jaw, release by relaxing the fingers, follow through with the bow arm up):
  https://www.naspschools.org/11-steps-to-archery-success/ and
  https://accessibility.extension.msstate.edu/publications/the-process-archery
