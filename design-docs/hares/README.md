# Mad March hares (2026-10-10)

**Pins**: written against `ea7e9d5` (the hedgehog's rebuild and the shared
leg draw order). Code-internal.

March's theme, from `decisions/2026-10-seasonal-theme-calendar.md`. The
config value is `hares`; `auto` turns it on from 1 to 31 March in the
daemon's local time. This note settles the month's open questions before
code, as the calendar's checklist asks; numbers marked as targets are
replaced by the measured ones once the art exists.

## What it shows

- **Rail shelf** (`HaresShelf.svelte`): a terracotta pot of daffodils.
  Hidden on cramped rails like the other shelves.
- **Grass and shoots** (`grass.ts`): low tufts of grass along the ledges and,
  here and there, daffodil shoots (two or three spear leaves, some with a
  closed bud), seeded per ledge id, only where `clearRuns` says the space is
  clear. The grass stirs in a breeze and parts where a moving cursor brushes
  it; under reduced motion it stands still.
- **Brown hares** (`hare.ts`, `hares.ts`, drawn by `hare-rig.ts`): two, or
  three where the page has room. They graze and sit up on the ledges. Now and
  then a jack lopes up to the jill; where there is room to rear up they box,
  then she bolts and he chases her ledge to ledge in bounding leaps, a second
  jack on his heels when there are three. A cursor coming near makes them
  freeze, crouched with their ears up, then bolt.

## The animal, looked up

Before any legs were drawn, the brown hare's build, gaits and behaviour were
looked up (sources at the end). What the rig and the model take from it:

**Build.** A lean, leggy animal, larger than a rabbit (head and body 50 to
70cm), with very long ears tipped black (grey-white inside), a tail black on
top and white beneath, golden-brown grizzled fur, a rufous chest and legs, a
white belly, and large eyes set high on the head. Its legs are much longer
than a rabbit's, the forelegs included; the hind legs are long and powerful,
the hind foot alone about 15cm. Most of the hind limb's muscle is at the hip
(the extensors that drive the push-off), and the distal limb is light, run by
long tendons; the foreleg is a stiffer strut (Williams, Payne and Wilson
2007).

**Joints, named as in the code and the lab.** A hind leg: the hip up in the
rump; the thigh (femur) runs down and forward to the stifle (the true knee)
at the flank; the shank (tibia) back down to the hock (the ankle, its point
the heel, the calcaneus); the long hind foot (metatarsus and toes) from the
hock to the toes. A foreleg: the shoulder in the chest; the upper arm
(humerus) back to the elbow; the long forearm down to the wrist (the
carpus); the short forefoot (metacarpus and toes).

**Two ways of standing on the hind feet.** Sitting, grazing or reared up to
box, a hare rests on the whole long hind foot, sole down from the hock to the
toes, its thigh folded tight against the body. Running, it is on its toes:
the hock lifts well off the ground and the foot rolls up over the toes as it
pushes off. Rabbits are described the same way, a plantigrade foot used in a
digitigrade gait (Hall et al. 2022). The rig's hind legs are toe walkers whose
bone up from the toes (the long foot) is let down flat for the sitting poses
and stood up on the toes for running, the same leg in both.

**Gaits.** Hares do not walk or trot at speed; they move by asymmetrical gaits
(Hildebrand 1977, 1980):

- *The slow hop* (grazing, unhurried): a forefoot, then the other, set down a
  little ahead, then both hind feet swung forward together and set down near
  or just behind them. Slowly, the hind feet do not pass the forefeet. No
  flight. The model calls this a lope.
- *The half-bound and bound* (running): the hind feet land together (a bound
  lands the forefeet together too; a half-bound sets them one after the
  other), and land ahead of where the forefeet were set, so a hare's tracks
  are groups of two long hind prints side by side in front of two small
  fore prints in a line, the groups further apart the faster it goes. After
  the hind feet push off the body flies stretched out, forelegs reaching
  forward and hind legs trailing (an extended suspension, the flight phase
  small fast mammals use), lands on its forefeet, then vaults over them,
  spine flexing, hind feet swinging forward past them (a gathered moment).
  The ears are laid back along the back while running, the tail held down.

**Behaviour.** Brown hares rest by day in a form, a shallow scrape just big
enough to crouch in, ears laid flat. Disturbed, a hare first freezes and lies
still, hoping not to be seen; if the danger comes closer it leaps up and runs,
tail down, swerving and doubling back. Alert but not yet alarmed, it sits up
with its ears raised. Boxing, most often seen in spring when the crops are
low, is usually a jill (female) fending off a jack (male) who is pressing his
attentions: she rears up on her hind legs and strikes at him with her
forepaws; jacks also chase jills, and each other, across the fields.

## Decisions

### The hare's size, and what it needs on the page

A survey of every route at 1440 and 1024px wide (the same measurement as the
fox's: each ledge's clear runs at a given height, counting the 6px reach
into the empty bottom edge of a card or heading above) found:

- 27px clear: the first row of card tops (22px up to the heading rule, plus
  the reach), in long runs (the overview's queue 688px, the metrics page's
  three KPI cards 340px each with a 14px gap between them, the history card
  1080px).
- 40px clear: the page heading's rule wherever its own text leaves it free
  (the overview 160px at 1440, 136px at 1024; metrics 628px; history 188px;
  config 748px), the top card on the logs and leaderboard pages, and the
  config page's first card.
- Every deeper card top has another card within a few pixels: nothing stands
  there, as for the fox and the hedgehog.

So everything the hares do day to day fits 27px, as the fox and the hedgehog
do, and rearing up to box needs a taller, wide stretch, which the heading
rules give on most routes:

| Pose | Used for | Footprint (target) | Needs clear above it |
| --- | --- | --- | --- |
| graze | grazing, nibbling, sitting tight | about 34x20 | 27px |
| sit | sitting up alert, ears up; the stand-off; reduced motion | about 30x27 | 27px |
| lope | the slow hop | about 40x24 | 27px |
| bound | running, the chase, bolting, coming and going | about 48x22 | 27px |
| leap | the flight between ledges | the bound's | the arc's swept box (below) |
| freeze | crouched low, ears up | about 36x26 | 27px |
| box | reared up on the hind feet, striking | about 24x40 | 40px over the pair |

Ears up is what makes the sit and the freeze tall; they are drawn up but
tilted back a little, as a relaxed hare's are, so the head and ears stay
inside 27px. Running and leaping, the ears lie back along the back, so the
bound is long and low. The box is the only pose over 27px. As for the fox,
every footprint is the box the drawing stays inside at every moment of its
motion, checked by the rig's tests, and every pose is anchored at its bottom
centre on the ledge, mirrored to face the way it is going.

### Two or three

The calendar's animal rule: at least two, three where the page has room. The
idea is a pair (a jill and a jack), so hare 0 is the jill and the others are
jacks. A third (a second jack) is placed only where three spots 64px apart
exist when they are placed, as the foxes are; it grazes on its own, joins a
chase on the first jack's heels when it is on the same ledge behind him, and
never boxes. The number is kept: a layout change re-places any hare that lost
its spot but never adds one beyond it.

They are stepped in turn in a fixed order (`lib/theme/group.ts`), each seeing
the others as they now are. Grazing and sitting, no two stand within 64px of
each other, centre to centre (a bound's footprint plus a gap). Boxing is the
one exception: two rearing hares face each other 28px apart, which their
narrow box footprints allow without overlapping.

### What a hare does

Each hare is a pure model in ledge-local x, so it rides with its card on
scroll. Its modes:

| Mode | Pose | What it does | Ends when | Then |
| --- | --- | --- | --- | --- |
| graze | graze | nibbles, head down, ears half back | 2 to 6s | sit, or a lope of 20 to 80px along its run, clear of the others |
| sit | sit | sits up, ears up, looks about | 1.5 to 3s | graze |
| lope | lope | the slow hop, 22px/s | it reaches its target | graze |
| run | bound | bounds along a trail (below) | the trail ends | sit |
| leap | leap | flies an arc between ledges on a trail | it lands | run |
| exit / away / enter | bound, fading | off a ledge's end and back in at another's | as the fox's | run |
| box | box | reared up facing the other, forepaws striking in turn | 2.5 to 4s | the bout goes on (below) |
| freeze | freeze | crouched low, ears up, head toward the cursor | 0.7 to 1.1s | bolt if the cursor is still within 200px, else sit |
| standoff | sit | sits up facing the other | 1.5 to 2.5s | graze |

### The courtship bout: box, then chase

The calendar's order, and how it fits a page that rarely has room to rear:

1. **Approach.** Every 15 to 35s, when every hare is calm (grazing or
   sitting) and none is near the cursor, the jack nearest the jill on her
   ledge lopes toward her. One on another ledge first makes a trip to hers
   (below), ending 64px or more from her. With no way there, no bout.
2. **Box, where there is room.** If the stretch round the two of them, a
   pair of box footprints 28px apart plus a margin each side (100px in all),
   has 40px clear, he comes to 28px from her, they turn to face each other,
   rear up and box, her forepaws striking, his parrying, for 2.5 to 4s.
   Otherwise he stops 72px from her and there is no box.
3. **The chase.** She bolts away from him, bounding; he follows on her trail;
   a second jack behind him on that ledge follows on his heels. The trail
   (below) runs to her run's end, then leaps to another ledge, or goes off
   the ledge's end and in at another's, and on, up to three ledges or 900px
   of trail, never back onto a ledge it has already crossed.
4. **The end.** Where the trail ends (her budget spent, or a dead end: a run
   stopping short of an obstacle or a bystander, with no leap and no ledge
   end), she turns to face him. If there is box room there they box again,
   then he lopes 40 to 80px away; otherwise a stand-off, both sat up facing,
   then they graze. Boxing at the end of a chase is how a cornered jill
   fends him off; there is never a third round.

**When the page has no box room** (most card tops), the bout is approach,
chase and stand-off: she bolts as soon as he is within 72px. When it does
(the heading rules), the hares are placed there first: the scene opens with
a pair facing each other on the widest box spot in view, and the first bout
comes 1.5 to 3s after they are placed. That is the calendar's "box on a wide
ledge, then chase", wherever the page allows it.

### The trail: one route, followed

A chase is one planned route, the **trail**, and the hares in it move along it
at the same speed, each a fixed distance (its lag, at least 64px) behind the
one ahead. They cannot catch each other up, so they never overlap, whatever
the route does. The trail is planned in full when the chase begins, from the
page as measured then, as a list of segments:

- **run**: along one ledge, from one ledge-local x to another, in one
  direction;
- **leap**: an arc from a run's end on one ledge to a spot on another;
- **away**: off one ledge's end and in at another's, out of sight, counted as
  160px of trail (two seconds at the chase's pace); the hare fades out over
  the last 14px before the end and in over the first 14px after, as the fox
  does.

The leader is placed on the trail ahead of the followers by their gaps when
it begins, so the trail starts at the last follower. A bolt is the same thing
with no followers, or with those of the scared hares on the same ledge that
are behind the leader in the way it flees, in file.

Speeds: the chase bounds at 85px/s, a bolt at 120px/s, a lope at 22px/s.
Distance along the trail drives the legs, so planted feet never slide, in a
leap as on a ledge.

### Leaping between ledges: the airspace contract

Leaping from ledge to ledge is new: every animal so far left a ledge only at
its end, out of sight. A leap is held to the robin's standard for flight: its
whole swept area is clear, not just its two ends.

- **Where.** From the end of a clear run (the end the hare is heading for) to
  a spot on another ledge in view, landing within 24px of a clear run's end
  that faces it, so it runs on the same way. The landing is 24 to 140px away
  across and at most 60px up or down; a landing spot must be 64px from every
  other hare and from where each is going.
- **The arc.** A parabola from take-off to landing that rises `hop` above the
  higher of the two (6 to 14px, the most that fits), flown at the trail's
  pace.
- **The swept box.** The bound's footprint (the leap's drawing stays inside
  it at every moment of the flight, which the rig's tests check), sampled
  every 4px along the arc. At every sample it must be clear of the page's
  content (text, controls, charts: no overlap at all); of every card's box,
  except the 6px reach into its empty bottom edge; of every other hare's
  footprint where it is or is going; and of every ledge's line, which it may
  only be above, or below by no more than the reach (the same allowance as
  standing beneath it). So a hare never flies through a card, a heading or
  its rule, and never over text. And the whole arc stays inside the window.
- **In practice** this gives leaps across the gaps between cards in a row
  (the KPI cards, the overview's queue and context cards), and from a heading
  rule's end down to a card that runs out past it. Where there are none, the
  trail goes off a ledge's end and in at another's.
- **A layout change mid-flight.** If both ledges are still there and the arc
  is still clear, the leap carries on. If not, it lands at once: on its
  landing spot if that is still on a clear run, else back on its take-off
  spot, else it is placed sitting at a new spot with no animation. Leaps last
  under half a second, so this is rare.
- **Reduced motion.** No leaps: nothing moves.

### A layout change

The page map changes on scroll, resize and mutation, as for every theme. A
chase or a bolt in progress ends: each hare on it that is on a ledge keeps
its place while the clear run under it holds its footprint and no other hare
is within 64px, and sits up there; one mid-leap is handled as above; one away
is placed sitting at a new spot. Any other hare keeps its ledge and mode
while the run under it still holds its footprint, pulled inside the run if it
shrank (a box needs its 40px still clear or becomes a stand-off); if not, it
is placed sitting at a new spot. A ledge scrolled out of view keeps its hare;
only new spots, trips and landings must be in view.

### The cursor: freeze, then bolt

The cursor is the last mouse or pen hover position (no buttons held), and is
forgotten on pointer down, leaving the window, blur, a hidden tab and a
reduced-motion change, as for every theme.

- **Freeze.** A cursor that moved in the last 150ms within 100px of a hare's
  middle freezes it, and every other hare within 240px of the cursor on the
  page: crouched low, ears up, head turned toward the cursor. A hare in the
  air or away cannot freeze: a chase or bolt carries on until every hare on
  it is on a ledge, then they all freeze, so none lands on a frozen one.
- **Bolt.** After 0.7 to 1.1s (each its own), a frozen hare bolts if the
  cursor is still within 200px of it, away from the cursor along its run.
  Frozen hares on one ledge on the same side of the cursor bolt in file on
  one trail, the one furthest along leading. The trail runs to the run's end,
  then leaps (preferring a landing further from the cursor) or goes off the
  ledge's end and away for 2.5 to 5s, in at another ledge's end 64px clear of
  the others, and on 40 to 80px; or, cornered (no leap, no ledge end), it
  stops and sits tight. A hare that bolted sits up when it stops, then grazes.
  With the cursor gone further than 200px, a frozen hare relaxes: it sits up,
  then grazes.

### Reduced motion

The hares sit up, each kept where it sat while that spot stays clear, so a
scroll never moves them; otherwise placed afresh at the middle of a free
stretch, apart. No blink, no breath, no head turn, no grass breeze, no
parting, no bouts, no freeze.

### Grass and daffodil shoots

- **Where.** Card tops and heading rules alike, only along `clearRuns(f,
  obstacles, 10)`, the tallest thing drawn (a shoot, 9px) plus a pixel, so
  nothing is drawn over a heading's text; inset 6px from each end.
- **What.** Each ledge is seeded by its id: a tuft (three to five blades,
  3 to 6px tall, leaning out from a common base) in about two thirds of its
  14px slots; a daffodil shoot (two or three blue-green spear leaves 6 to 9px
  tall, a third of them with a closed yellow-green bud on a stalk) in about a
  quarter of its 60px slots, never on top of a tuft.
- **Caps.** At most 160 tufts and 24 shoots on a page, shared out a ledge at
  a time (as the frost's glints are), so a long page costs no more and every
  ledge keeps some.
- **Motion.** The blades lean in a slow breeze, each tuft on its own 3 to 6s
  sway of at most 6 degrees, a gust running along the ledge now and then. A
  moving mouse or pen passing within 16px parts the tufts it brushes (they
  lean away from it, up to 25 degrees) and they spring back over 0.8s. The
  sway is computed from time alone; the parting from when it was last
  brushed. Shoots barely sway (a third of the grass's lean). Reduced motion
  draws every blade upright and nothing moves.
- **Behind the hares.** The grass is drawn behind them, so a hare is always
  seen whole.

### The lagomorph gait, shared

The bound, half-bound and slow hop are added to the shared `rig/gait.ts`
additively, for the hares now and April's rabbit next:

- `Landings` and `beatsFor`: an asymmetrical gait's footfalls given as when in
  the cycle each foot lands (the fore pair and the hind pair, near and far),
  turned into the rig's beats. A bound lands each pair together; a half-bound
  its hind pair together and its forefeet one after the other; the slow hop
  sets the forefeet one then the other and the hind pair together, with no
  flight.
- `flightOf`: whether every foot is off the ground at a moment of the cycle,
  and how far through that flight; and `flightLift`, the body's rise then, a
  parabola, so a gait with a flight phase carries its body up off the ground
  and down again by itself.
- `onSoles`: toe walkers let down onto their whole foot, the bone up from the
  toes laid flat behind them by a given amount (0 on its toes, 1 sole down
  from the hock to the toes): how a hare or rabbit sits.

Hare-only tuning (strides, stances, timings, reaches) stays in
`hares/hare-rig.ts`.

### The rig

- **Parts.** Cut from one drawing of the hare standing square
  (`hare-standing.png`) by image edits: the body (closed where the legs were,
  the tail on it), the head (a soft unoutlined back edge where it sits over
  the body), the ears (a pair, a soft unoutlined base under the head). The
  ears turn about their base: up, tilted back a little, sitting and freezing;
  laid back along the back running; flicking now and then grazing.
- **Legs.** Four legs on the shared rig, each a toe walker with three bones as
  the fox's: a hind leg hip, stifle, hock, toes, its thigh a thick haunch and
  its shank tapering to a sharp hock; a foreleg shoulder, elbow, wrist, toes,
  long and slim. The hind leg's long foot is the bone up from the toes, drawn
  with its own piece of art (a new optional `LegArt.hindFoot`, additive in
  `rig/rig.ts`), and let down flat sitting (`onSoles`). Every piece drawn
  outlined, then as fur alone, the near pair's fur over the body's edge.
- **Gaits.** Grazing it lopes (the slow hop); running it half-bounds, the
  hind feet landing together ahead of the forefeet's prints, with a flight
  phase stretched out after the hind feet push off. The body pitches with the
  stride, nose down as the forefeet take the landing and up as the hind feet
  drive, and the head steadies against it. In a leap it flies stretched out,
  forelegs reaching, hind legs trailing, then gathers to land.
- **Key poses** drawn as edits of the reference: sit, lope, bound reach (the
  flight, stretched out), bound gather (the hind feet swinging past the
  fore), box, freeze, bolt (the push-off), each laid over its mode in the
  critters lab and tuned against it.
- **Life.** The eye blinks on a seeded schedule (`rig/life.ts`); grazing, the
  jaw works (a small nod of the head) and an ear flicks now and then; sitting
  and freezing, the head turns toward a cursor within 160px (eased, at most 14
  degrees). Reduced motion: sat up, still, no blink.

### Accent

Hare russet `#dfa06a`: distinct from Halloween's orange (`#ff8f2e`, far more
saturated), from Bonfire's gold and the warning amber (both yellower), from
the bad ink's salmon (`#ea8478`, pinker), and from the default lime, which
spring green would sit too close to. Only the accent tokens move. A proposal:
easy to change in `styles/themes.css`.

### The shelf

A terracotta pot of daffodils, still. The month's motion is on the page; the
rail keeps no sky effect, as Christmas's does not.

## Integration

The calendar's checklist, as for the months before: the Go constant, `Themes`
and `time.March` in `seasonalThemes`, with calendar, boundary and override
cases (`hares_test.go`, and the neighbouring months' boundary tests); the
dashboard config API test; `THEMES`; App's shelf and layer branches; the
lab's theme pickers; the accent block; the config notes in
`config.example.json`, `internal/config/starter.json` and `config set`'s help;
the root README and the release notes; the calendar's status line and
March's entry.

## Art

Every source was generated on 2026-10-10 by the Codex CLI (`gpt-5.6-terra`)
through its built-in `$imagegen` path, each on a flat magenta `#FF00FF`
background. The pot and the reference were generated with
`design-docs/halloween/pumpkins.png`, `design-docs/bonfire/toffee-apples.png`
and `design-docs/aurora/winter-kit.png` (the pot), and
`design-docs/aurora/fox-standing.png` and
`design-docs/bonfire/hedgehog-standing.png` (the hare), as style references
only. Every other hare picture is an edit of `hare-standing.png`: the hare
seen exactly side on, facing right, standing on all four feet with every
limb separate, long black-tipped ears up, the hind legs showing the haunch,
stifle, hock and long foot.

- `hare-parts.png`: the hare cut into body, head (a soft, unoutlined back
  edge) and ears (a pair, a soft base). Its body left the chest and neck
  off, so the shipped body comes from `hare-torso.png` instead, a second
  edit asked for the torso with its chest and the whole neck, the neck's top
  a soft unoutlined tuft under the head.
- `hare-limbs.png`: five pieces from its own legs, in a row: a thigh piece
  thick at the hip, a leg bone, a hind foot with its heel turned up (not
  used: it reads as a foot and an ankle, the long foot is a leg bone
  instead), the hind toes and the fore toes. The leg bone's left end came
  out as a ragged cut, so `export.py` mirrors its rounded right half onto
  its left.
- Key poses (`hare-pose-*.png`), each asked for as this exact hare in a new
  pose: sit (on its haunches, hind feet flat, forelegs straight), graze
  (low, nose to the ground), lope (forefeet planted, hind pair swinging
  forward), bound reach (airborne, stretched out), bound gather (forefeet
  down, back arched, hind feet swinging past), box (reared on the long hind
  feet, forepaws striking), freeze (crouched, ears straight up) and bolt
  (the push off, hind legs straight behind).

| Source | Shipped as | Display size |
| --- | --- | --- |
| `daffodils.png` | `ui/src/lib/theme/hares/daffodils.webp` | 57x88 |
| `hare-standing.png` | `ui/src/lab/hare-reference.webp` (the lab's overlay) | 22.5x22.42 units |
| `hare-torso.png` | `hare-body.webp` | 20.42x10.42 units at (1, 7.21) |
| `hare-parts.png` | `hare-head.webp`, `hare-ears.webp` | 6.83x6.58 at (16.6, 5.99); 5.83x7.42 at (14.44, 1.14) |
| `hare-limbs.png` | `hare-thigh`, `hare-leg`, `hare-hind-toes`, `hare-fore-toes` (`.webp`, each with `-fur`) | thigh 2.4 units thick at the hip, leg 1.15 thick, toes 2.6 and 1.7 long |
| `hare-pose-*.png` | `ui/src/lab/hare-pose-*.webp` (the lab's overlays) | on the same eye scale |

The hare's pictures are in drawing units, all on one scale: each sheet's eye
(its dark outline and pupil, the blob `art.py`'s `feature` finds from a seed
point set in `export.py`) is measured and every picture exported so its eye
is 1.4 units, at 12 file pixels per unit; the torso, which has no eye, was
edited at the reference's own size and is exported on the reference's
scale. Each part is placed where it sat in the reference by matching
(`art.py`'s `place`, printed by `export.py`, checked by laying the parts
over the reference). The fur versions of the limb pieces have their outline
taken out (`fill_only`). Where the head, ears and body turn, the eye, the
hips and shoulders and the bones' lengths are set in `hare-rig.ts`, measured
against these exports (the lab's joints view shows them); regenerated parts
mean measuring again. `export.py` reproduces every shipped file (`uv run
design-docs/hares/export.py`).

## Verification

- Unit tests: the gait additions (`rig/gait.test.ts`: beats from landings,
  the flight and its lift, soles let down); the grass (`grass.test.ts`: only
  on clear runs, never under text, caps, seeded stability, still under
  reduced motion); the trail and leap planner (`trail.test.ts`: the swept box
  clear at every sample, never through a ledge line or a card, landings clear
  of others, followers never within their lag); the hare and the group
  (`hare.test.ts`, `hares.test.ts`: the mode table, the bout's order, box only
  with room, freeze then bolt, reconciliation, never two within 64px except
  boxing, long random runs); the rig (`hare-rig.test.ts`: every pose inside
  its footprint over its whole cycle, feet and long hind feet never below the
  ledge, the half-bound's hind pair together and landing ahead of the
  forefeet's prints, a flight phase, the soles flat sitting and on the toes
  running, blink, still under reduced motion).
- `e2e/hares.spec.ts` against the real daemon: palette and mounting, every
  descendant click-through, `aria-hidden`, below dialogs, at least two hares
  on the overview, freeze then bolt at a cursor, nothing over content on
  every route, a still scene under reduced motion, the phone layout.
- The critters lab: the hare registered with its modes, speeds, footprints,
  rig and drawings; its lab tests (parts decode, the bound steps, the sit
  stands on its soles, drawings laid over each mode).
- Looking: lab screenshots of every mode through its cycle, and the real page
  at 1440 and 1024, another route and a phone.

## Sources

- Animal Diversity Web, *Lepus europaeus* (ears long, black-tipped, grey-white
  inside; tail black above, white below; hind foot 142 to 161mm; crouching in
  a form by day; runs to escape; dodges):
  https://animaldiversity.org/accounts/Lepus_europaeus/
- The Wildlife Trusts, brown hare (larger than a rabbit, longer legs, longer
  black-tipped ears; boxing usually a female fending off a male):
  https://www.wildlifetrusts.org/wildlife-explorer/mammals/brown-hare
- Woodland Trust, why do hares box (long legs and stride; a jill rearing up
  on her hind legs and rebuffing a jack with her forelegs):
  https://www.woodlandtrust.org.uk/blog/2023/03/why-do-hares-box/
- Kent Wildlife Trust, brown hare (fights stood on the hind legs, striking
  with the front paws): https://www.kentwildlifetrust.org.uk/wildlife-explorer/mammals/brown-hare
- BBC Discover Wildlife, brown hare guide (boxing instigated by females
  fending off males; seen most in March when crops are low):
  https://www.discoverwildlife.com/how-to/watch-wildlife/brown-hare-guide
- Cornwall Mammal Group, brown hare (much longer legs than a rabbit; ears
  held flat along the back when running; jills box to fend off males):
  https://cornwallmammalgroup.org/brown-hare
- Better Planet Education (formerly YPTE), brown hare habits (the form; ears
  laid flat; freezing when disturbed; leaping up and running with the tail
  down; zig-zagging): https://betterplaneteducation.org.uk/factsheets/hare-brown-hare-habits
- Hildebrand, M. 1977, Analysis of asymmetrical gaits, *Journal of
  Mammalogy* 58 (the bound, half-bound and gallops; gathered and extended
  suspensions), and 1980, The adaptive significance of tetrapod gait
  selection, *American Zoologist* 20 (small agile mammals use the bound and
  half-bound with an extended suspension).
- Williams, S. B., Payne, R. C. and Wilson, A. M. 2007, Functional
  specialisation of the pelvic limb of the hare (*Lepus europeus*), *Journal
  of Anatomy* 210(4), 472-490 (hip extensors dominant; light distal limb with
  long tendons), and the same group's study of the hare's thoracic limb (a
  stiffer, strut-like foreleg): https://rvc-repository.worktribe.com/output/1433236
- Hall et al. 2022, Rabbit hindlimb kinematics and ground contact kinetics
  during the stance phase of gait, *PeerJ* (a plantigrade foot used in a
  digitigrade gait): https://peerj.com/articles/13611
- Hare tracks: Brunner, *Tracks and Tracking* (Project Gutenberg), and
  "Following the feetings" (fhithich.uk, 2023): hind prints side by side in
  front of the fore prints in a line, the groups further apart with speed,
  and when very slow the hind feet not passing the fore:
  https://www.gutenberg.org/ebooks/45578 and
  https://www.fhithich.uk/2023/03/11/following-the-feetings/
