# Easter egg hunt (2026-10-10)

**Pins**: written against `ea7e9d5`. Code-internal.

April's theme, from `decisions/2026-10-seasonal-theme-calendar.md`. The
config value is `easter`; `auto` turns it on from 1 to 30 April in the
daemon's local time. Easter itself moves and can fall in late March; the
month-keyed calendar cannot follow it, and an April-long hunt works whatever
the date (the calendar's own reasoning). This note settles the month's open
questions before code, as the calendar's checklist asks, and follows every
rule the fox and the hedgehog set (the calendar's "Animals" section and
`.ai-cache/brief-seasonal-month.md`).

## What it shows

- **Rail shelf** (`EasterShelf.svelte`): a wicker basket of painted eggs with
  three chicks, one peeking out of the basket and one beside a hatched shell,
  on a strip of spring grass drawn in code. Hidden on cramped rails like the
  other shelves.
- **Eggs** (`eggs.ts`, `hunt.ts`): painted eggs tucked into the ends of the
  page's ledges, only their tops peeping over the edge. Passing the cursor
  close to one makes it pop up and stand on the ledge: found. A small counter
  by the brand, found/total, keeps score for the session.
- **Rabbits** (`rabbit.ts`, drawn by `rabbit-rig.ts`, grouped in
  `rabbits.ts`): two, or three where the page has room, European wild
  rabbits sitting on the ledges, twitching their noses, grooming, and hopping
  along. Now and then one nudges a new egg into a ledge's end and hops away
  from it. A cursor coming near makes one sit up on alert; a cursor that
  lingers makes it thump and bolt for cover, its white scut showing, and it
  turns up later on another ledge.

## Research

### The European rabbit, and how it differs from March's hare

*Oryctolagus cuniculus* is about 40cm long and 1.2 to 2kg, much smaller than
the brown hare (up to 70cm, 2 to 5kg). It is rounder, an egg-shaped body on
proportionately shorter legs; its ears are 6.5 to 8cm from the back of the
skull, about as long as its head, with **no black tips** (a hare's are about
10cm, tipped black); its eye is dark (a hare's is amber). Its fur is
grey-brown agouti with a rusty nape, a pale belly and chest, and buff, fully
furred feet. The tail is short, dark on top and **white underneath**; the
white "scut" is flashed when it runs for cover (tail flagging). The hind
limbs are much longer and stronger than the forelimbs, the hind foot 8 to
10cm long. Rabbits live in groups and dig burrows, never straying far from
them; hares are mostly solitary and live above ground in a form.

March's hares are built in parallel by another agent; the two are kept
apart on purpose:

| | Rabbit (April) | Hare (March) |
| --- | --- | --- |
| Build | small, round, short legs | larger, lanky, long legs |
| Ears | short, no black tips, beige inside | long, black tipped |
| Tail | white scut, flashed when fleeing | black topped |
| Colour | grey-brown, rusty nape, dark eye | golden brown, amber eye |
| Moves | slow hops along a ledge, pausing; dashes for cover | bounding leaps, ledge to ledge |
| Leaves a ledge | at its end, into cover, as into a burrow | by leaping across |
| Does | sits, twitches its nose, grooms, thumps | boxes, freezes, bolts |

### Anatomy, joint by joint

The names the rig and the lab's joints view use:

- **Hind leg**: the **hip** high in the rump, inside the round haunch; the
  thigh runs down and forward to the **stifle** (the true knee) at the
  belly; the shank runs back down to the **hock** (the ankle, the tarsus);
  from there the **long hind foot** (metatarsus and four toes, no dewclaw)
  runs forward. Rabbits have a plantigrade foot but move digitigrade (Hall
  et al. 2022): sitting or standing, the whole foot from hock to toes lies
  flat on the ground; pushing off, the hock lifts and the foot rolls up onto
  its toes (peak plantarflexion at toe-off).
- **Foreleg**: short and slim. The **shoulder** in the chest, the **elbow**
  at the chest's foot, the forearm near straight down to the **wrist** (the
  carpus), and a small rounded **forepaw**.
- **Sitting**: the body a rounded hump on its haunches, the hind legs folded
  tight under it (stifle forward under the belly, hock at the back on the
  ground), both hind feet flat beside the body, forepaws straight down just
  ahead of the hind toes, ears up or tilted back.

### The hop

Rabbits are saltatorial: they move by hopping, not by walking or trotting,
and their slow gait and their fast one are both forms of the **half-bound**.
The forefeet land one after the other (a forelimb lead), the hind feet land
almost together; a hindlimb push sends the body through a flight phase, and
the hind feet swing forward under the arched back to land beside or ahead of
where the forefeet were (Bertram and Gutmann 2008, who contrast the
jackrabbit's slow hindlimb-initiated half-bound with the domestic rabbit's
forelimb-initiated one; WikiVet's gait page describes the half-bound as a
hindlimb spring and landing on one forefoot before the other, as in rabbits
and hares). Foraging, a rabbit moves in single hops with pauses between
them, stopping to look and sniff.

One hop, as the rig draws it (`hop.ts`), from sitting to sitting:

| Part of the hop | Feet | Body |
| --- | --- | --- |
| push (first 30%) | hind feet planted, heels peeling up onto the toes; forefeet lift and reach | rises and stretches, nose up |
| flight (to 62%) | all off the ground, hind legs trailing, then swinging forward | arcs over, levels, nose down |
| forefeet land (62%, the far one 6% later) | forefeet planted where they will stay | takes the weight on its chest |
| gather (to the end) | hind feet swing forward under the arched back and land together beside the forefeet | rump comes down, settling |

Every planted foot is held at its place on the ledge (worked out from where
the hop began and where it ends), so nothing slides; the body's own travel
within the hop is eased (quick in flight, slow while gathering), and the
feet follow from it. It is rabbit-only motion, in this theme's own files;
the shared `rig/gait.ts` is untouched (its lagomorph additions are the
hare's agent's; see "Shared code" below).

### Behaviour

- **Nose**: a rabbit's nose twitches constantly, faster when alarmed (up to
  about 120 a minute), and stops for a moment when it is suddenly frightened.
  Drawn as small quick snuffles of the head (`rig/life.ts`'s `snuffle`),
  stilled while it is alert.
- **Grooming**: it licks its forepaws and washes them over its face, then the
  ears, sitting up on its haunches; often after eating or waking.
- **Thumping**: a stamp of the hind feet, a warning to the group of danger.
  The others nearby sit up on alert when one thumps.
- **Alert**: sitting up tall on its haunches, ears pricked (the periscope).
- **Fleeing**: a dash back to cover, the white scut flagged.
- **Binky**: a leap straight up with a twist of the body and head, a sign of
  a happy rabbit. Left out: see "Settled questions".

## Settled questions

### Where the counter sits, and how it stays out of the way

"The top bar" is the rail's head, beside the brand: on a phone the rail is
the page's top bar, on a desktop its top. The counter is drawn by the
theme's own overlay (the same fixed, `aria-hidden`, click-through layer as
the rest), not by a slot in `App.svelte`: it is placed against the brand's
measured box (`.rail .brand`), right-aligned to it and centred on it, in the
empty space to the right of the brand's words, and shown only where it fits
there with 8px to spare (on the 236px rail the words end about 50px short of
the rail's edge; the counter is about 34px). So it never covers the brand,
the nav or any control, needs no change to the shared shell, and keeps the
overlay's z-index below dialogs. It is re-placed whenever the scene is
measured (scroll, resize, layout), so on a phone, where the rail scrolls
with the page, it scrolls away with the brand. It shows a small egg and
`found/total`, and gives a little bounce when an egg is found (none under
reduced motion). With no eggs on the page and none found it is not drawn.

### Eggs: how many, where, how they hide, how they are found

- **Tucked into a ledge end**: an egg stands centred 10px in from one end of
  a ledge, in the corner of its card or heading rule. Hidden, it is drawn
  clipped at the ledge's line and sunk so only its top third (about 4px)
  peeps over the edge, as if tucked behind the card's corner. Every 7 to 13
  seconds (seeded) a hidden egg gives a small wobble, so a watchful eye can
  spot one.
- **Only where clear**: an egg needs 14px clear over the 12px around its
  spot (`clearance` with the animals' 6px reach), so a revealed egg never
  stands over text, controls or charts; heading rules qualify only where
  their own text leaves room.
- **How many**: when a ledge is first seen, its id seeds whether it gets an
  egg (two in five) and at which end; a page starts with at most 5 hidden
  eggs, at most one per ledge end. A rabbit may add more, up to 8 hidden on
  the page at once.
- **Found by hover, never by a click**: the overlay never takes pointer
  events, so finding is by the passive cursor (the same mouse or pen hover
  every theme uses): a stroke passing within 26px of an egg's top reveals
  it. It pops up over 0.4s with a small overshoot and stands on the ledge,
  with a brief four-pointed glint, and stays found for the rest of the
  session on that ledge.
- **Rabbits' eggs**: a rabbit leaving an egg first hops to near a free,
  clear ledge end, faces it and nudges with its nose for 0.9s (the "nudge"
  key pose); the egg then appears there, hidden like the rest, and the
  rabbit hops away from it. One in three times a rabbit is ready to move
  on, if a free end is within its clear run and the page has fewer than 8
  hidden.
- **The tally is the session's, never stored**: found counts every egg found
  since the page loaded; total is that plus the eggs still hidden on the page
  now. Leaving a route takes its hidden eggs out of the total (they can no
  longer be found) and keeps the found ones counted; the next route hides
  its own. Nothing is persisted: a reload starts a new hunt. The tally lives
  in the layer's memory only.
- **Drawn under the rabbits**, so a rabbit hopping past an egg is in front.
- **Reduced motion**: the hunt is held as it stands: hidden eggs peep, found
  ones stand, nothing wobbles, and nothing is found (the shared scene cycle
  forgets the cursor under reduced motion, as it does for every theme), so
  the scene stays still with the cursor over it.

### Crossing between ledges: at ledge ends, like the fox

A rabbit leaves a ledge only at one of its ends, hopping out and fading over
the last 14px, then after 1.5 to 3s hops in at the end of another ledge in
view, fading in, to a spot 30px or more inside. It is never drawn crossing
the page. A hop across a gap between two level ledges was weighed and left
out: it needs a flier's airspace contract for the arc, the hares' bounding
leaps between ledges are March's idea, and slipping out of sight at a
ledge's end is what a rabbit does anyway, dashing into cover or a burrow.

### Size and room

The first row of card tops has 22px up to the heading rule, plus the 6px a
creature may reach into a card's or rule's empty edge; the gaps between
deeper cards are less. So everything a rabbit does fits under 27px over its
width, counting that reach, and its footprints (the box each pose stays
inside at every moment, which the rig's tests check over whole cycles,
along with no foot sinking below the ledge) are set from its drawing:

| Pose | Used for |
| --- | --- |
| sit | sitting, the nose twitch, looking about, settling, the still pose |
| alert | sitting up on alert |
| groom | washing its face |
| hop | every hop: along a ledge, in, out, bolting |
| nudge | leaving an egg |
| thump | the stamp before it bolts |

(Sizes in "Footprints" below, once measured.) A pose that does not fit
where the rabbit is, is skipped: no room to sit up means no alert pose (it
crouches instead, the sit), no room to groom means it does not.

### Behaviour, as a state table

A pure ledge walker in ledge-local x, so it rides with its card on scroll.
The cursor is the last mouse or pen hover position, forgotten on pointer
down, leaving the window, blur, a hidden tab and a reduced-motion change.

| Mode | Pose | Ends when | Then |
| --- | --- | --- | --- |
| sit | sit, nose twitching | its restless time comes (3 to 8s); a cursor passing within 90px; a cursor staying within 60px for 1s | restless: groom (one in four, if it fits), else move on; passing: alert; lingering: thump |
| alert | alert | 1.2 to 2s with no cursor near | sit |
| groom | groom | 2.4s | sit |
| hop | hop | it reaches its target, a hop at a time (20px a hop, 0.36s each, 0.1 to 0.35s sitting between) | sit |
| nudge | nudge | 0.9s | an egg left at that end; hop away 40px or more |
| thump | thump | 0.5s (two stamps) | bolt |
| bolt | hop, quick (28px a hop, 0.3s, no pause), ears back, scut up | it reaches its ledge's end | away |
| exit | hop, fading over the last 14px | it reaches its ledge's end | away |
| away | not drawn | 1.5 to 3s | enter at the trip's end if still clear and in view; else placed sitting at a new spot |
| enter | hop, fading in over the first 14px | it reaches its spot | sit |

- **Move on**: out by its ledge's end to another ledge in view (as the fox
  does) one time in three if it can, leave an egg one time in three if it
  can, else hop 40 to 140px along its own clear run, to the side with more
  room.
- **Bolt**: away from the cursor, to the end of its run farther from it if
  that end is its ledge's end and has nobody in the way, out of sight and
  in elsewhere; if not, just as far as it can, then it sits and stays alert.
- **First placement**: sitting on the longest clear runs in view, 16px
  inside them, restless in 2 to 6s.
- **Layout changes**: as the fox's: an `away` rabbit keeps its trip, checked
  when it arrives; any other keeps its ledge and mode while the run under it
  is still clear, pulled back inside it if it shrank; otherwise it is placed
  sitting somewhere new without animation. A ledge scrolled out of view
  keeps its rabbit; only a new spot must be in view.
- **Reduced motion**: every rabbit sitting, still, its nose not twitching,
  no blink; kept where it sat across measurements while its spot stays
  clear.

### Two or three, sharing the page

The calendar's animal rule. Rabbits live in groups, so unlike the foxes they
may share a ledge more closely, but never overlap: 60px centre to centre
(a hop pose and a gap). Three where three such spots exist in view when they
are placed, else two; never more after that. They are stepped in turn
(`group.ts`'s `inTurn`), each seeing the others as they now are; a hop stops
60px short of another rabbit and never passes one, an entry only goes where
the way in keeps that distance. Only one rabbit is up to something big at a
time (a thump, a bolt, a nudge or a trip): the others sit and look about.
One thumping makes the others within 260px sit up on alert for 1.2 to 2s,
as a warren does.

### Binky: left out

A binky is a leap straight up with a twist, by a happy rabbit. Done
properly it needs more height than the 27px a ledge has, and a twist the
side-on parts rig cannot draw; a small one would read as a hop on the spot.
Left out rather than done badly.

## Drawn from parts

As the fox and the hedgehog: one drawing of the rabbit standing on all four
feet (`rabbit-standing.png`) is the anatomy reference; every other picture is
an image edit of it. The parts sheet (`rabbit-parts.png`) splits it into the
tail, the body (legs, head, ears and tail taken off, closed where they were),
the head (no ears, its back edge soft fur with no outline) and the ears; each
is placed where it sat in the reference (`art.py`'s `place`). The ears are a
part of their own so they can stand up, tilt back or lie flat along the neck
in a hop; the tail so it can flag up. The limbs sheet (`rabbit-limbs.png`)
cuts a tapered haunch, a hind leg bar, the long hind foot, a foreleg bar and
a forepaw from its near legs, so their thickness is the drawing's.

- **Hind leg**: three bones as a rabbit's: hip in the haunch to stifle
  (the haunch piece, thick at the hip), stifle to hock (the leg bar,
  tapering to the hock's point), and the long hind foot from the hock,
  standing flat as a sole walker's foot (`walksOn: sole`), its heel peeling
  up over its toes as it pushes off.
- **Foreleg**: shoulder to elbow to wrist, a slim bar, on a small forepaw.
- **Outlines only on the silhouette**: each piece drawn outlined and again as
  fur alone (`fill_only`), the near legs' fur over the body's edge; the far
  pair a shade darker.
- **Key poses** (`rabbit-pose-*.png`), each an edit of the standing drawing:
  sit, alert, hop gather, hop extend, groom, nudge (an egg) and thump,
  registered as its drawings in the critters lab and laid over each mode to
  tune against.
- **One scale**: every picture exported so its eye is the same size, at 12
  file pixels per drawing unit; `rabbit-rig.ts` sets one page scale for every
  pose.
- **Signs of life**: the eye blinks on a seeded schedule (`rig/life.ts`), the
  nose snuffles while sitting, the head turns a little toward a cursor within
  160px (eased), an ear now and then turns back to listen. Reduced motion:
  sitting, head level, no blink.

## Shared code

Additive only. The hop is the rabbit's own (`easter/hop.ts`), on
`rig/gait.ts`'s `legsTo` and sole walker as they stand; nothing in
`rig/gait.ts` is changed, and the March agent's lagomorph additions there are
used if they land and fit. `e2e/content.ts` already checks every `<image>`
inside a located element, which covers the eggs too (they are images, each in
its own element with a `data-id`), so it needs no change.

## Accent

Spring lilac `#c4a8f2`, an Easter pastel clear of the default lime, the info
blue (`#7fb9ea`), the warning amber and every other month's accent so far.
Only the accent tokens move. A proposal: easy to change in
`styles/themes.css`.

## Art

Generated on 2026-10-10 by the Codex CLI (`gpt-5.6-terra`) through its
built-in `$imagegen` path, each on a flat magenta `#FF00FF` background, with
`design-docs/halloween/pumpkins.png`, `design-docs/bonfire/toffee-apples.png`,
`design-docs/aurora/winter-kit.png`, `fox-standing.png` and
`hedgehog-standing.png` as style references. Every prompt kept pink and
purple out of the art so the magenta key cannot eat it (the rabbit's inner
ears are a warm beige-tan). `export.py` reproduces every shipped file
(`uv run design-docs/easter/export.py`). The table is filled in as the art
is exported.

## Verification

- Unit tests for the pure models: the hunt (seeding, caps, clearance, ends,
  reveal by stroke, the tally across routes, nothing under reduced motion),
  the rabbit's state table, trips, bolt, nudge and reconciliation, the
  group's count, spacing and one-at-a-time over long random runs, the hop's
  planted feet holding still on the ledge, the rig's footprints over whole
  cycles, blink and stillness.
- The Go calendar, boundary and override cases.
- `e2e/easter.spec.ts` against the real daemon: mounting and the palette,
  every descendant click-through, `aria-hidden`, below dialogs, a still scene
  under reduced motion, at least two rabbits, an egg revealed by hovering
  and counted, nothing over content on every route (rabbits and eggs), the
  counter clear of the brand and nav, and the phone layout. The longer
  random behaviours are left to the unit tests and the lab.
- The critters lab (the rabbit's modes, parts, joints and drawings) and the
  lab's shared shelf contract.

## Sources

- Wikipedia, *European rabbit* (size, ears without black tips, white tail
  underside shown when escaping, buff fully furred feet, hind limbs much
  longer than forelimbs, saltatorial, thumping, burrows):
  https://en.wikipedia.org/wiki/European_rabbit
- Discover Wildlife, rabbit vs hare (rabbits up to 40cm and 1.2 to 2kg,
  hares to 70cm and 2 to 5kg; hares' black-tipped ears and black-topped
  tails, amber eyes; rabbits rounder):
  https://www.discoverwildlife.com/animal-facts/mammals/rabbit-vs-hare-whats-the-difference
- Countryfile, the difference between rabbits and hares (rabbits' scurrying
  hop against the hare's long-legged lope; hare's ears about 10cm):
  https://www.countryfile.com/wildlife/wildlife-guide-whats-the-difference-between-rabbits-and-hares
- The Mammal Society, "Hare today gone tomorrow" (hares larger, long
  limbed, solitary; rabbits social, burrowing):
  https://mammal.org.uk/blog/2017/04/hare-today-gone-tomorrow
- Hall, Stubbs, Anderson, Greenacre and Crouch 2022, *Rabbit hindlimb
  kinematics and ground contact kinetics during the stance phase of gait*,
  PeerJ 10:e13611 (plantigrade foot, digitigrade locomotion; ankle
  plantarflexion peaking at toe-off): https://peerj.com/articles/13611
- Bertram and Gutmann 2008, *Motions of the running horse and cheetah
  revisited*, J. R. Soc. Interface 6:549 (the half-bound: hind feet landing
  almost together, forefeet together or slightly apart; the jackrabbit's
  slow and the domestic rabbit's fast half-bound):
  https://pmc.ncbi.nlm.nih.gov/articles/PMC2696142/
- WikiVet, gait (the half-bound as a hindlimb spring and landing on one
  forefoot before the other, in rabbits and hares).
- Hildebrand 1977, *Analysis of asymmetrical gaits*, J. Mammalogy 58:131
  (the bound and half-bound as asymmetrical gaits with a forelimb lead).
- Petplan, rabbit behaviour explained (thumping as a warning), and the
  RSPCA and House Rabbit Society's behaviour notes (grooming by washing the
  face with licked forepaws, the alert sit, the binky):
  https://www.petplan.co.uk/pet-information/rabbit/advice/rabbit-behaviour-explained/
- PangoVet, why rabbits' noses twitch (faster when frightened, up to about
  120 a minute; a pause when suddenly startled):
  https://info.pangovet.com/pet-behavior/rabbits/why-do-rabbits-noses-twitch-and-wiggle
