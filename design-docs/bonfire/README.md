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
  for 2.5s, then it hurries home. They never change ledge. A sniffing head,
dipped and turned toward a cursor below, turns at most 18 degrees, which keeps
the drawing inside its 30x18 footprint (the rig's tests check this).

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

**Drawn from parts (added 2026-10-09).** The first version slid one walking
picture along the ledge, which looked stiff. Now the body (spines and belly)
and the head are separate generated parts and the four legs are drawn in code
(`lib/theme/rig/`): thin cream strokes with the art's outline, stepping in a
four-beat walk driven by distance walked, so planted feet never slide. The far
pair is a shade darker. The head is tucked behind the body's front, nods with
each step, dips and twitches its nose when sniffing, and turns toward a cursor
within 160px (by at most 14 degrees). The eye blinks every 1.5 to 6.5s on a
schedule seeded per hedgehog, so they never blink together. Curled up, the
ball breathes. Reduced motion stands each on four feet, head level, with no
blink. The workbench is `lab/critters.html`.

**Where it can live.** The dashboard's vertical gaps between cards are about
25px, which sized the art: the pile is 70x20 and a hedgehog 30x18 (26x18 as
first drawn). A home
needs 220px of ledge, 22px of headroom to the next floor, and a band 22px
tall above the ledge free of the page's obstacles (text, controls, charts and
the cards themselves). Heading rules qualify along the stretch their own text
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
`candles.png` as style references. `hedgehog-parts.png` was generated the same
way on 2026-10-09, with `hedgehog-sheet.png`'s walking pose as the character
reference: the body without legs or head, and the head with a neck tab that
tucks behind the body.

| Source | Shipped as (`ui/src/lib/theme/bonfire/`) | Display size | Notes |
| --- | --- | --- | --- |
| `bonfire.png` | `bonfire.webp` | 80x92 | Generated unlit; flames are code. |
| `toffee-apples.png` | `toffee-apples.webp` | 54x34 | |
| `woodpile.png` | `woodpile.webp` | 70x20 | Den opens on the right; the page mirrors it. |
| `hedgehog-sheet.png` | `hedgehog-ball.webp` | 18x18 | Split at the widest empty column run; the ball keeps the walking pose's scale. The walking pose is no longer shipped. |
| `hedgehog-parts.png` | `hedgehog-body.webp`, `hedgehog-head.webp` | 20.5x15, 13x8.5 | Both at the body's scale, so they fit back together. Where they sit, the neck pivot, the eye and the hips are set in `hedgehog-rig.ts`, measured against these exports; regenerated parts mean measuring again. |

`export.py` reproduces every shipped file (`uv run design-docs/bonfire/export.py`):
the Halloween keying recipe (alpha from `min(R,B) - G` ramping between 60 and
140, half-strength despill), a crop to the art plus a 6px margin, and WebP at
twice the display size. The flame tongue positions in `BonfireShelf.svelte`
were placed against `bonfire.webp`'s logs by eye; regenerated art means
placing them again.

## Verification

Unit tests for the pure models and the rig (`bonfire/*.test.ts`,
`rig/*.test.ts`), the Go calendar and override cases
(`internal/config/bonfire_test.go`), `e2e/bonfire.spec.ts` against the real
daemon (palette, pass-through, at least two hedgehogs out and one curling,
fireworks bounded by the rail, reduced motion still, phone layout), the
critters lab tests (parts decode, legs step and hold, still under reduced
motion) and the lab's shared shelf contract.
