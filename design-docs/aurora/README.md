# Northern lights (2026-10-08)

**Pins**: written against `3505bd7` (Bonfire Night and its structure pass).
Code-internal.

January's theme, from `decisions/2026-10-seasonal-theme-calendar.md`. The
config value is `aurora`; `auto` turns it on from 1 to 31 January in the
daemon's local time. This note settled the month's open questions before code,
as the calendar's checklist asks, and was tightened the same day after a
read-only review by Codex (`gpt-5.6-terra`): the clearance contract, the fox's
full state table, reconciliation precedence, frost safety under heading text,
quantified motion limits, input reset rules, and which behaviours the
end-to-end suite should leave to unit tests.

## What it shows

- **Rail shelf** (`AuroraShelf.svelte`): a tartan thermos, a striped bobble
  hat, mittens and a mug of cocoa, on a low snow drift drawn in code. Hidden on
  cramped rails like the other shelves.
- **Aurora** (`aurora.ts`): curtains of light rippling slowly in the rail's
  sky above the shelf, over a few faint stars.
- **Frost** (`frost.ts`): a thin rim with small clusters of crystals along the
  ledges, tinted by the aurora's current colour, and a few glints that catch
  the light on their own and when the cursor passes.
- **Arctic foxes** (`fox.ts`, drawn by `fox-rig.ts`): two, or three where
  the page has room, each asleep curled on its own ledge or well apart on a
  shared one. An ear twitches when the cursor passes; a cursor that stays
  close wakes that fox, and it stretches and trots off to sleep somewhere
  else while the others nearby look up. Now and then, on its own, one wakes
  and makes a mousing pounce.

## Decisions

### The rail sky is the shared sky surface; there is no header band

The calendar asked January to define a header band, a page-wide strip for the
aurora. November had already found that any band over the page covers heading
text and controls visually, click-through or not, and moved its fireworks to
the rail. The aurora goes there too, and the rail sky becomes a shared surface
in `lib/theme/sky.ts`, measured in one place (`measureRailSky`):

- **What it is**: the stretch of the rail from 16px below the nav's bottom
  down to the top of the theme shelf, as wide as the shelf, capped at 240px
  tall. A viewport rectangle (`left`, `top`, `width`, `height`).
- **What it excludes**: the nav, the brand, the shelf itself and everything on
  the page. It is null while the shelf is hidden (`offsetParent` null: phones,
  short windows) or has no element before it.
- **When it is remeasured** (`watchRailSky`): a ResizeObserver on the rail and
  on each of its direct children, because the nav gaining its leaderboard link
  or the brand settling moves the sky's top edge without resizing the rail;
  and on window resize.
- **Debugging**: `?theme-debug=1` draws it as a dashed box labelled
  `sky WxH`, in the same `Geometry.svelte` overlay as the ledges.

`BonfireShelf.svelte` moved onto it unchanged in behaviour (its e2e suite
passes as before). Each sky effect keeps its own minimum size (`roomy`):
fireworks need 120x90, the aurora 120x60.

### Aurora policy

Three curtains, each a rippling lower edge with rays fading upward. Each
curtain's opacity is at most 0.45 and drifts on its own 9, 13 or 17 second
breath; no frame changes it by more than 0.2 per second. The rays are seeded
stripes about 5px apart, 1.2 to 3.8px wide, each shimmering on its own 4 to
11 second beat, so they never form a regular pattern. The curtains fade out
over the outer fifth of the sky on each side rather than stopping at the
rail's edges. No flashes, no sound. Cost per frame: three paths and about 45
mask stripes, no per-pixel work beyond one 1.5px blur. Reduced motion draws
the curtains and rays once at a fixed moment (`STILL`, the start of the
cycle) and the stars without their twinkle.

### One colour clock

`auroraRgb(now)` is a pure function of time: green, teal, violet and round
again every 48s, eased between stops. The shelf and the page layer each call
it with their own frame's `performance.now()`, so the frost and the sky share
the same continuous phase to within a frame, without the components talking.
After a hidden tab resumes, both pick up at the current phase together.

### Clearance: one shared measurement

`clearance(f, obstacles, x0, x1)` in `floors.ts` returns how tall something
can stand on ledge `f` over the ledge-local stretch `x0..x1`: the ledge's
headroom, lowered to `f.y - bottom` for every obstacle that overhangs the
stretch. An obstacle overhangs when its top is more than 1px above the ledge
and it overlaps the stretch horizontally (open intervals); the card whose top
is the ledge starts at the ledge, so it never counts. `clearRuns(f, obstacles,
height)` samples it every 4px, inset 8px from each end by default, and
returns the stretches where `height` fits. The hedgehog's obstacle check is
now `clearance(...) < 22`, which is the test it made before (its home already
required 22px of headroom); its unit and e2e tests pass unchanged.

### Frost

Drawn only where `clearRuns(f, obstacles, 4)` says 4px is clear, on card tops
and heading rules alike. The overlay sits above the page, so frost under a
heading's text would be drawn over it; `room` is not used, because it is
measured from boxes rather than from the text and controls themselves. Each
ledge is one stroked path: the rim, plus clusters of three crystals (a fan, at
most 3.5px tall) in about two thirds of the 40px slots, seeded by ledge id.
Glints: about one per 90px in half the slots, at most 40 on a page. A glint
swells softly to 0.8 opacity and back over 0.6s once in its own 7 to 15
second period; a moving mouse or pen passing within 24px starts the same
swell, unless it is already glinting. Reduced motion draws the rim in the
`STILL` colour and no glints.

### Fox size, measured from the page

A survey of every route at 1440 and 1024px wide (ledge by ledge, how tall a
band above it is free of text, controls, charts and cards) found room in two
places only: the page heading's rule (26 to 30px clear along most of it, more
in places) and the first row of card tops (22px, up to the rule above). Every
deeper card top has another card's body within a few pixels. So the fox lies
and trots only where 22px is clear, as the hedgehog does. The other poses
are conditional on the space where the fox is. Since 2026-10-09 the moving
poses are drawn from parts (see "Drawn from parts" below), and their sizes are
the box the drawing stays inside at every moment of its stride or leap, which
`fox-rig.test.ts` checks:

| Pose | Footprint | Used for | Needs clear above it |
| --- | --- | --- | --- |
| curled | 20x16.5 | asleep | 22px (where it may lie) |
| alert | 20x18.5 | the ear twitch, waking, looking up | 22px |
| trot | 31x21 | trotting, entering, leaving, settling | 22px |
| bow | 33x20 | the stretch, the crouch | 20px over its width |
| pounce | 39x24 | the leap and the dig | 24px plus the hop, over the whole leap |

(As first drawn, as single pictures, they were trot 32x19, bow 26.5x23.5 and
pounce 25x30.) Every pose is anchored at its bottom centre on the ledge and
mirrored to face the way the fox is going (the art faces right). A pose that
does not fit is skipped: no room to stretch means it gets up and trots; no
room to pounce means no pounce.

### Fox behaviour

A pure ledge walker in ledge-local x, so it rides with its card on scroll. It
never leaves a ledge except at a ledge's end, and is never drawn crossing the
page. The cursor is the last mouse or pen hover position (no buttons held, as
for every theme's passive pointer). It is forgotten on pointer down, leaving
the window, blur, a hidden tab and a reduced-motion change. Layout changes
keep it, since it is in viewport coordinates like the ledges.

| Mode | Pose | Ends when | Then |
| --- | --- | --- | --- |
| asleep | curled (alert while the ear is up) | a cursor has stayed within 64px of it for 1.5s, moving or not; or its restless time comes | waking |
| waking | alert | 0.5s | woken by the cursor: stretch if the bow fits, else depart. Restless: crouch if a pounce fits, else depart |
| stretch | bow | 1.1s | depart |
| crouch | bow | 0.5s | leap |
| leap | pounce | 0.6s: 36px forward (its facing way first), lifted 4·hop·t(1−t) | dig |
| dig | pounce, on the ledge | 0.9s | settle |
| trot | trot | it reaches its target at 40px/s | settle |
| exit | trot, fading over the last 14px | it reaches its ledge's end | away |
| away | not drawn | 1.2 to 2.5s | enter at the trip's ledge end, if that is still clear and in view; else placed asleep at a new spot |
| enter | trot, fading in over the first 14px | it reaches its spot | settle |
| settle | trot, turning about every 0.3s | 0.9s (two turns) | asleep, restless again in 40 to 90s |

- **Ear twitch** (asleep only): a cursor event in the last 120ms within 110px
  raises the ear for 0.45s, then not again for 1.2s.
- **Depart**: if its own clear run reaches one of its ledge's ends, and
  another ledge in view has a clear run at least 90px long that reaches one of
  that ledge's ends, it trips there: out by its own end (the one farther from
  the cursor when the cursor woke it, else the nearer), in at the other's
  end, to a spot 30px or more inside. The destination is the one farthest
  from the cursor when the cursor woke it, else random. Otherwise it trots at
  least 60px along its own run, to the side away from the cursor if the
  cursor woke it; with no 60px either way, it settles where it is.
- **First placement**: asleep on the longest clear run (at least 40px) of the
  ledges in view, at a random spot 16px inside it; restless in 20 to 40s.
- **Layout changes**: an `away` fox keeps its trip; the trip is checked when
  it arrives. Any other fox keeps its ledge and mode while the 22px run under
  it still exists, with its position, target and leap start pulled inside
  that run if it shrank. If the ledge is gone or the run under it is covered,
  it is placed asleep at a new spot with no animation. A ledge scrolled out
  of view keeps its fox; only a new spot or a trip's destination must be in
  view.
- **Reduced motion**: asleep, never twitching, never stepped. It keeps its
  spot across measurements while that spot stays clear, so scrolling does not
  make it jump; otherwise it lies in the middle of the best run. (The
  hedgehogs now keep theirs too.)

### Two or three foxes (added 2026-10-09)

The calendar's animal rule: at least two. They sleep apart rather than as a
pair, because a long enough clear run for two side by side is rare.

- **How many**: three where three spots 120px apart (on one ledge) or on
  different ledges exist when they are placed, else two; fewer only when the
  page has no room. That number is kept: a layout change re-places any fox
  that lost its spot, or now lies or is heading within 120px of another (in
  id order, so the same fox keeps a contested spot), clear of every other fox
  and where each is going, and may put back one that had no room, but never
  adds beyond it, so scrolling never grows the group.
- **Where**: ledges with no fox come first, then the longest free stretch, so
  they spread out.
- **Only one up at a time**: while one is awake, the others sleep on. A cursor
  lingering by a sleeping one only makes it look up (the alert pose); its own
  restless time is put off 4 to 9s at a time.
- **Never near another**: a trot stops 120px short of any other fox, and never
  passes one; a trip only leaves by an end with no fox in the way and only
  goes in where the way from the entry to the spot keeps 120px from any fox
  there, or where one is heading; a pounce only lands clear of them. One
  arriving where another now lies is placed elsewhere instead.
- **Looking up**: one startled awake makes any other asleep within 220px on
  the page look up for 1.2 to 2s.

They are stepped as a group, in a fixed order, each seeing the others as they
now are, so the rules hold every frame (`foxes.ts`, on the shared
`lib/theme/group.ts`; one fox's night stays in `fox.ts`).

### Drawn from parts (added 2026-10-09)

Single pictures slid along the ledge looked stiff. The tail, torso and head
are now separate generated parts, and the four legs are drawn in code
(`lib/theme/rig/`, shared with the hedgehogs): thin white strokes with the
art's outline, all four behind the torso so no hip shows on its fur, the far
pair a shade bluer. Trotting, diagonal pairs step together, driven by
distance trotted so planted paws never slide; the head nods and the tail
swishes with the stride. The bow tilts the body down onto forelegs reaching
forward with the tail up; the crouch lowers it; the leap arcs it nose up then
nose down, hind legs trailing, then forelegs reaching for the snow; the dig
puts its nose down with the forepaws scrabbling in turn. The head sits over
the chest, with a little fur painted over where its outline would cross it.
Its eye blinks on a schedule seeded per fox. Curled up it is still one
picture (asleep, or looking up), breathing slowly. Reduced motion stands it
square, head level, no blink. The workbench is `lab/critters.html`.

### Accent

Aurora teal `#72e0cf`, distinct from the default lime accent and from the info
blue (`#7fb9ea`). Only the accent tokens move. The page gets a faint static
aurora glow in its top-left corner, behind everything, as Bonfire's firelight
sits in the bottom-left. A proposal: easy to change in `styles/themes.css`.

## Integration

The calendar's checklist, as done for January: `ThemeAurora` in
`internal/config/theme.go` (`Themes` and `time.January` in `seasonalThemes`),
with calendar, boundary and override cases (`aurora_test.go`, and the
Christmas test's 1 January now expecting `aurora`); the dashboard config API
test; `THEMES` in `lib/theme/theme.ts`; App's shelf and layer branches; the
lab's theme picker and branches; the accent block; the config notes in
`config.example.json`, `internal/config/starter.json` and `config set`'s help;
the root README and the release notes.

## Art

The first two sources were generated on 2026-10-08 by the Codex CLI
(`gpt-5.6-terra`) through its built-in `$imagegen` path, each on a flat
magenta `#FF00FF` background, with `design-docs/halloween/pumpkins.png`,
`candles.png` and `design-docs/bonfire/toffee-apples.png` as style
references. `fox-parts.png` was generated the same way on 2026-10-09, with
`fox-sheet.png`'s trotting pose as the character reference.

| Source | Shipped as (`ui/src/lib/theme/aurora/`) | Display size |
| --- | --- | --- |
| `winter-kit.png` | `winter-kit.webp` | 124x62 |
| `fox-sheet.png` | `fox-curled.webp`, `fox-alert.webp` | see the pose table |
| `fox-parts.png` | `fox-tail.webp`, `fox-torso.webp`, `fox-head.webp` | 10.5x11, 13x7.5, 10.5x10 |

The fox sheet is split into its five poses at the four widest runs of empty
columns; every pose shares the trot pose's scale (19px tall), and only the
two curled ones are still shipped. The parts sheet is split the same way into
its three parts, all at one scale (the head 10px tall). Where they sit, the
pivots, the eye, the seam patch and the hips are set in `fox-rig.ts`,
measured against these exports; regenerated parts mean measuring again. `export.py`
reproduces every shipped file with the Halloween keying recipe, now shared
with Bonfire's export through `design-docs/art.py` (Bonfire's files come out
byte-identical through it).

## Verification

- Unit tests for the pure models (`aurora/*.test.ts`: the fox's state table,
  trips, pounce bounds, reconciliation and resting pose; the group's count,
  spreading, one-up-at-a-time, looking up and spacing over long random runs;
  the rig's footprints, trot, blink and stillness; the aurora's colour
  cycle, opacity cap, rate of change and bounds; the frost's crystal heights,
  gaps under text, glint cap and timing), and for the shared `clearance`,
  `clearRuns` and `measureRailSky`.
- The Go calendar, boundary and override cases.
- `e2e/aurora.spec.ts` against the real daemon, kept to what is deterministic
  and quick: the palette and mounting, every descendant click-through,
  `aria-hidden` and below dialogs, the aurora inside the rail sky, the ear
  twitch and a lingering cursor waking a fox, at least two foxes on the
  overview, a still scene under reduced motion (every fox, the curtains and no
  glints, with the cursor nearby), and the phone layout; and the critters lab
  tests (parts decode, the trot steps, curled has no legs). Changing ledge and the pounce are timed and random, so
  they are left to the unit tests.
- The lab's shared shelf contract, now including `aurora` (the 760/761px and
  640px-tall boundaries).
- The Bonfire suites unchanged after the sky and clearance extractions.

## Addendum: after the structure pass (2026-10-08)

A seven-lens structure review of the finished theme found three behaviours
that broke the rules above, fixed with regression tests:

- **The fox's body, not just its middle, stays on the clear run.** Where it
  lies, trots to, pounces to or is clamped after a layout change, the whole
  32px trotting body must fit; before, its tail could stop under text at the
  end of a run.
- **An exit whose ledge end gets covered becomes a trot.** If a layout change
  covers the end a leaving fox was heading for, it trots to where the run now
  stops and settles there, instead of fading out mid-ledge.
- **The 40-glint cap is shared out a ledge at a time.** Before, it kept the
  first 40 in document order, which left the heading rule and every later
  card bare on a long page.

The same pass moved the measure, step and cursor cycle that the Aurora and
Bonfire layers had each written out into one `ledgeScene()` in
`lib/theme/layout.ts`, so the next month starts from it.
