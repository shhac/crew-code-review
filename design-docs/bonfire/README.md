# Bonfire Night (2026-10-08)

**Pins**: built on `99822ab` (the shared page-geometry refactor). Code-internal.

November's theme, from `decisions/2026-10-seasonal-theme-calendar.md`. The
config value is `bonfire`; `auto` turns it on from 1 to 30 November in the
daemon's local time.

## What it shows

- **Rail shelf** (`BonfireShelf.svelte`): an unlit bonfire with a stuffed guy
  on top and three toffee apples. The flames (five tongues along the base of
  the stack), the glow and a few rising sparks are drawn in code. Hidden on
  cramped rails like the other shelves.
- **Fireworks** (`fireworks.ts`): in the rail's free space between the nav and
  the shelf, not in a header band over the page as the calendar first
  proposed. The rail is the only place a burst can never cover page content,
  so the "exclude heading text and controls" requirement holds by
  construction. The sky is measured from the shelf up to the nav (less 16px),
  capped at 240px; under 90px tall or 120px wide there are none. Everything
  in the rail is observed, because the nav moves without the rail resizing.
- **Embers** (`embers.ts`): seeded per ledge id along card tops (never heading
  rules, which carry text), each smouldering on its own 18 to 32 second cycle
  between ash grey and a glow. A moving mouse or pen within about 28px fans
  them; the flare halves every 1.4s. Heat is computed from time alone.
- **Hedgehogs** (`hedgehog.ts`, drawn by `hedgehog-rig.ts`): two or three
  share a woodpile on one ledge, well away from the bonfire. After 2.5s
  without cursor movement they peek out one at a time, then walk and sniff
  along their ledge for 20 to 40s each before going home. A cursor moving
  within 80px of one makes it curl into a ball until things have been quiet
  for 2.5s, then it hurries home. They never change ledge.

## Decisions

**Fireworks policy.** One burst at a time, 7 to 15s apart (so never two in
the air), 18 to 26 sparks in two rings, fading in over the first 8% of the
burst and out over the rest, capped at 0.8 opacity, no full-screen or
background flash, no sound. Reduced motion shows one burst held still at 0.4
opacity.

**Hedgehog locomotion is its own.** Not the robin's model (hops, flight curves,
wing envelopes) and not the spider's (walls, drops, silk): a pure ledge-only
walker with its own size, clearance and cursor rule. Reduced motion sits it
beside its pile, facing out, and never steps it.

**Two or three, sharing one pile (added 2026-10-09).** The calendar's
animal rule (at least two of each). They share the pile rather than having
one each, because few pages have two ledges with room for a home. Three when
the range has room for three to sniff apart and still move about (four
bodies and gaps, 144px), else two; decided when they move in, and kept while
the home is kept. Rules that keep them apart, a body (30px) and a 6px gap:

- Only one at the pile's mouth at a time, and none comes out while another is
  coming in; one peeking ducks back in for one coming home. One peeking
  counts as standing at the mouth, so nobody walks up to it, and if it finds
  no room clear of the others it goes back in.
- A walk picks its spot between its nearest neighbours; one that finds
  another in its way sniffs where it stands instead.
- One going home waits behind another rather than walking through it. Every
  step is checked for room, the last one onto a spot included.
- One that flees sends any between it and the pile hurrying home ahead of
  it, so the way in is clear.
- After a layout change that shrinks the range, one crowded onto another is
  tucked back into the pile.

They are stepped as a group, in a fixed order, each seeing the others as they
now are (`lib/theme/group.ts`, shared with the foxes). Reduced motion sits them in a row by the pile, spaced, and keeps the
row across scrolls.

**Drawn from parts (added 2026-10-09, revised the same day, then rebuilt
from one drawing).** The first version slid one walking picture along the
ledge, which looked stiff. Now it is put together from generated parts on the
shared rig (`lib/theme/rig/`). As with the fox, every part comes from one
drawing of the hedgehog standing square (`hedgehog-standing.png`): the body
and head were cut from it by an image edit, each placed in the rig where it
sat in the drawing (`export.py` finds the spot by matching the part's pale
fur against the drawing's, since a head's outline alone fits anywhere inside
the spines), and the legs and feet were cut from its near legs, so their
thickness and size are the drawing's. Before that, the parts came from an old
walking sprite and the legs were sized by guesswork.

- **Body and head.** The head sits in front of the body's cream chest; its
  back edge is soft fur with no outline, so no line crosses the neck (a first
  try tucked the head behind the body, whose outline then crossed it).
- **Legs.** A hedgehog walks on its soles (plantigrade), its belly about an
  inch off the ground, its legs mostly hidden under the skirt of spines and
  only really seen when it runs. Each leg is one stubby piece laid from hip to
  heel (too short to show a knee), drawn over its foot, its rounded end the
  heel. The front feet are short and broad like little hands; the hind ones
  are longer. Legs and feet share the belly's cream, so no change of shade
  shows where they cross each other or the belly's edge. Each piece is drawn
  twice: outlined, then as fur alone with its outline taken out, so outlines
  only run round the leg's silhouette; the near pair's fur is drawn over the
  body's edge, so the legs grow out of it. The far pair is a shade darker.
- **Gait.** Steps are driven by distance walked, so planted feet never slide.
  Walking, it uses a lateral-sequence walk, as slow pygmy hedgehogs and most
  small mammals do: a hind foot, then the forefoot on its side, then the
  other side's, evenly spaced, three feet always down. Hurrying, it trots,
  the diagonal pairs together, its body lifted higher on straighter legs.
  Each foot stays flat through most of its time down, then the heel peels up
  and the foot rolls over its toe tips as it pushes off, swings low and lands
  flat. No study of the European hedgehog's walk turned up; the sequence and
  the shift to a trot come from Biknevicius et al. on the African pygmy
  hedgehog (SICB abstract), the foot roll from plantigrade walking in general
  (rabbit stance foot angles, PeerJ 2022), and the posture from Animal
  Diversity Web, Britannica and Hedgehog Street (sources below).
- **Movement.** Walking, the body rises and falls a little with each stride
  and rocks slowly, the head nodding behind it, at a quarter of the stride's
  pace (its strides are short and quick, about four a second), so it waddles
  rather than flickers. Sniffing, the front of the body dips and the nose
  goes to the ground, with a brief snuffle now and then. Peeking from the
  pile, it stretches its neck out, nose lifted to test the air, a forefoot
  raised to creep out. Otherwise the head turns toward a cursor
  within 160px (at most 14 degrees), eased so it turns smoothly. The eye
  blinks every 1.5 to 6.5s on a schedule seeded per hedgehog. Curled up, the
  ball breathes. Reduced motion stands each on four feet, head level, with no
  blink.
- **One scale.** Every picture (the ball and the parts) is exported so its eye
  is the same size, so curled up it is the same hedgehog; `hedgehog-rig.ts`
  sets one page scale (1.52 page pixels per drawing unit) for every pose.
- **Key poses.** Each mode was tuned against a drawing of it, an edit of the
  standing drawing (`hedgehog-pose-*.png`: a walk's contact and passing
  moments, the hurry, the sniff and the peek).

The workbench is `lab/critters.html`: every pose, the layers one by one, the
art each is drawn from, the joints and the footprint, with the standing
drawing or a key pose laid over the rig (each mode picks its own).

**Where it can live.** The pile is 88x25 and a hedgehog's footprint 41x26.5
(the box its drawing stays inside whatever it does, which the rig's tests
check, along with its feet never sinking into the ledge and its nose staying
above it; first drawn at 26x18, then 47x26.5 before the rebuild, whose
rounder drawing is shorter nose to tail). A home needs 260px of ledge and 27px of clear
space above it, free of the page's content (text, controls, charts), up to the
next floor and the bottom of any card above. It may count 6px past those, into
the empty bottom edge of a card or heading above, but never over content:
the first row of cards has 22px up to the heading rule and the gaps between
cards are about 25px, so this is what lets a hedgehog a quarter bigger than
first drawn live there. An end-to-end test walks the routes and checks no
hedgehog's drawing overlaps any text, control or chart. Heading rules qualify along the stretch their own text
leaves free; on the queue page that is the hero rule under the add form. The
pile sits 24px in from the ledge's right end with its den facing left, and
the hedgehog roams left until the first obstacle. An existing home is kept
while its card scrolls out of view, so the pile never jumps to another card;
only a new home must be in view.

**Bonfire and hedgehog kept apart.** The hedgehog shelters in an unlit pile on
the page; the lit bonfire is on the rail. A hedgehog coming out of a burning
bonfire would read as an animal escaping a fire.

**Accent.** Sparkler gold `#f4c25b`, chosen to be distinct from Halloween's
orange and from the warning amber (`#d9b13c`). Only the accent tokens move,
as for the other themes. A proposal: easy to change in `styles/themes.css`.

**No Catherine wheel.** The calendar listed one on the shelf; the fireworks
cover the pyrotechnics, and the rail stays less busy without it.

## Art

The first four sources were generated on 2026-10-08 by the Codex CLI
(`gpt-5.6-terra`) through its built-in `$imagegen` path, each on a flat
magenta `#FF00FF` background, with `design-docs/halloween/pumpkins.png` and
`candles.png` as style references. The hedgehog's parts were generated the
same way on 2026-10-09, with `hedgehog-sheet.png`'s walking pose as the
character reference. They were rebuilt the same day from
`hedgehog-standing.png` (the whole hedgehog standing square, generated with
the sheet and the first parts as references), each later image an edit of it:
`hedgehog-parts-3.png` (the body without legs or head, closed underneath, and
the head with a soft unoutlined back edge to sit over the body),
`hedgehog-limbs.png` (a leg piece and the two feet, cut from its near legs)
and the key poses (`hedgehog-pose-walk-contact.png`, `-walk-pass`, `-hurry`,
`-sniff`, `-peek`). Earlier parts sheets (a neck tab tucked behind the body;
thin legs on a long foot that read as a human foot, then on a paw with an
ankle stub, then on separate hand and hind feet) were each replaced.

| Source | Shipped as (`ui/src/lib/theme/bonfire/`) | Display size | Notes |
| --- | --- | --- | --- |
| `bonfire.png` | `bonfire.webp` | 80x92 | Generated unlit; flames are code. |
| `toffee-apples.png` | `toffee-apples.webp` | 54x34 | |
| `woodpile.png` | `woodpile.webp` | 88x25 | Den opens on the right; the page mirrors it. Exported at four times its size. |
| `hedgehog-sheet.png` | `hedgehog-ball.webp` | 17x16.6 units | Split at the widest empty column run. The walking pose is no longer shipped. |
| `hedgehog-standing.png` | `../../lab/hedgehog-reference.webp` | 24.4x16.6 units | For the lab only; `export.py` prints where each part sat in it. |
| `hedgehog-parts-3.png` | `hedgehog-body.webp`, `hedgehog-head.webp` | 20.3x14.6, 11.7x10.1 units | Placed at (1.91, 1.27) and (13.69, 6.46). |
| `hedgehog-limbs.png` | `hedgehog-leg.webp`, `hedgehog-hand.webp`, `hedgehog-hind.webp`, each with a `-fur` version | leg 2.6 units thick; feet 3.4x2 and 4x2 units | The fur versions have their outline taken out (`art.py`'s `fill_only`); the fur of all three is recoloured the belly's cream. Each foot's heel (where the leg comes down) is set in `export.py` as a fraction of its box and printed. |
| `hedgehog-pose-*.png` | `../../lab/hedgehog-pose-*.webp` | about 24-26 units wide | Key poses, for the lab only. |

The hedgehog's pictures are in drawing units, all on one scale: each sheet's
eye is measured (`art.py`'s `feature`, from a seed point set in `export.py`)
and every picture is exported so its eye is 1.82 units, at 12 file pixels per
unit, sharp at the lab's zoom. Where parts sit, the neck pivot, the eye, the
hips and the feet's heels are set in `hedgehog-rig.ts`, measured against these
exports (the lab's joints view shows them); regenerated parts mean measuring
again.

`export.py` reproduces every shipped file (`uv run design-docs/bonfire/export.py`):
the Halloween keying recipe (alpha from `min(R,B) - G` ramping between 60 and
140, half-strength despill), a crop to the art plus a 6px margin, and WebP at
twice the display size (the shelf art) or as above. The flame tongue positions in `BonfireShelf.svelte`
were placed against `bonfire.webp`'s logs by eye; regenerated art means
placing them again.

## Verification

Unit tests for the pure models and the rig (`bonfire/*.test.ts`,
`rig/*.test.ts`), the Go calendar and override cases
(`internal/config/bonfire_test.go`), `e2e/bonfire.spec.ts` against the real
daemon (palette, pass-through, at least two hedgehogs out and one curling,
fireworks bounded by the rail, reduced motion still, phone layout, no
hedgehog over content), the critters lab tests (parts decode, legs step and
hold, still under reduced motion, the drawings laid over each mode) and the
lab's shared shelf contract. The rig's tests also check the walk's footfall
order, the trot's diagonal pairs, three soles always down walking, and each
foot rolling over its toes.

## Sources

- Animal Diversity Web, *Erinaceus europaeus* and Erinaceidae (plantigrade;
  belly about an inch off the ground; five clawed toes):
  https://animaldiversity.org/accounts/Erinaceus_europaeus/
- Hedgehog Street, hedgehog biology (legs mostly hidden, seen when running;
  front feet wider like little hands, back feet slimmer and longer):
  https://www.hedgehogstreet.org/about-hedgehogs/hedgehog-biology/
- Biknevicius et al., SICB abstract on African pygmy hedgehog gait
  (lateral-sequence walk at slow speeds, toward a trot faster):
  https://sicb.org/?p=28291
- Britannica, hedgehog (body raised high off the ground when running):
  https://www.britannica.com/animal/hedgehog-mammal
- Hildebrand 1980, the adaptive significance of tetrapod gait selection
  (walk and trot by duty factor).
- PeerJ 2022, rabbit hindlimb stance (the foot rolling up toward toe-off):
  https://peerj.com/articles/13611
