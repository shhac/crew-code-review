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
- **Hedgehog** (`hedgehog.ts`): lives in a woodpile on one ledge, well away
  from the bonfire. It peeks out after 2.5s without cursor movement, walks
  and sniffs along its own ledge for 20 to 40s, then goes home. A cursor
  moving within 80px makes it curl into a ball until things have been quiet
  for 2.5s, then it hurries home. It never changes ledge.

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

**Where it can live.** The dashboard's vertical gaps between cards are about
25px, which sized the art: the pile is 70x20 and the hedgehog 26x18. A home
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

All four sources were generated on 2026-10-08 by the Codex CLI
(`gpt-5.6-terra`) through its built-in `$imagegen` path, each on a flat
magenta `#FF00FF` background, with `design-docs/halloween/pumpkins.png` and
`candles.png` as style references.

| Source | Shipped as (`ui/src/lib/theme/bonfire/`) | Display size | Notes |
| --- | --- | --- | --- |
| `bonfire.png` | `bonfire.webp` | 80x92 | Generated unlit; flames are code. |
| `toffee-apples.png` | `toffee-apples.webp` | 54x34 | |
| `woodpile.png` | `woodpile.webp` | 70x20 | Den opens on the right; the page mirrors it. |
| `hedgehog-sheet.png` | `hedgehog-walk.webp`, `hedgehog-ball.webp` | 26x18, 18x18 | Split at the widest empty column run; both poses share one scale. |

`export.py` reproduces every shipped file (`uv run design-docs/bonfire/export.py`):
the Halloween keying recipe (alpha from `min(R,B) - G` ramping between 60 and
140, half-strength despill), a crop to the art plus a 6px margin, and WebP at
twice the display size. The flame tongue positions in `BonfireShelf.svelte`
were placed against `bonfire.webp`'s logs by eye; regenerated art means
placing them again.

## Verification

Unit tests for the three pure models (`bonfire/*.test.ts`), the Go calendar
and override cases (`internal/config/bonfire_test.go`), `e2e/bonfire.spec.ts`
against the real daemon (palette, pass-through, hedgehog out and curling,
fireworks bounded by the rail, reduced motion still, phone layout), and the
lab's shared shelf contract.
