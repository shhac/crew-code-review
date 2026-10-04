# Current scope: owner final direction

Owner note 6 supersedes the conditional generation prerequisite: ship reference-rig
idle and blink now, keep existing hop/flight, and defer rejected tilt and remaining
articulation. Production assets are in `accepted/complete.json`; see README.md and
FOLLOW-UP.md. No new designer production is required for this narrowed task.

The handoff below is historical specification for the dependent articulation task,
not a blocker or instruction to regenerate shipped idle/blink.

# Production hand-off to Juniper — unchanged design 1

The owner authorizes the reference cut-out exception after design 7's identity
failures. Juniper's design 8 specifies the rig below; complete-bird regeneration
for idle, blink and tilt is superseded. Timing and acceptance gates remain design 1.
Use these draft files for every generation attempt:

- Identity: `internal/dashboard/ui/src/lib/theme/christmas/robin-perch.webp`.
- Fixed raster guide: `design-docs/christmas/animation/reference-guide/guide.png`.
- Measured features: `design-docs/christmas/animation/reference-guide/landmarks.json`.
- Finish references: `design-docs/halloween/pumpkins.png`,
  `design-docs/halloween/candles.png`, `design-docs/halloween/spider-body-side.png`;
  they affect shading/finish only. Their hashes are in the landmark JSON.
- Pose/timing target: `design-docs/christmas/animation/design.md` (design 1).

Resolve the guide through `guide.read_published(Path("reference-guide"))` from
the animation script directory. It reads `complete.json` once, verifies both
immutable files and their cross-reference, and returns validated PNG/JSON bytes.
Use those returned bytes together for generation. The familiar guide.png and
landmarks.json paths above are browsing copies only and may mismatch after a
crash. Never consume those separately as production evidence.

## Owner-authorized rig, specified by Juniper in design 8

Trace versioned tail, feet/legs, torso, folded-wing and head masks against actual
reference contours. Preserve fractional alpha; measurement regions are not
segmentation masks. Publish masks and seam overlays before accepting poses.
Head includes beak/eye, proposed neck seam (50,40)–(99,43), pivot (75,42).
Feet retain all support below the belly seam near y84 without erosion. Folded
wing tracing proposal: (27,57),(34,45),(47,37),(60,34),(69,40),(70,48),
(60,59),(44,68),(27,69), root (57,48). Refine against feather contours.
Torso is complementary support; complementary masks must not double alpha.
I0 reconstruction must match the reference pixel-for-pixel.

Breathing keeps feet, head, tail and wing fixed. Scale torso about (64,83):
I1 (1.004,1.006), I2 (1.010,1.012), I3 (1.005,1.007). Blink overlays stay
within [81,28,89,37]; B1 covers upper eye half; B2 uses adjacent russet plus
a closed-lid curve at most one native pixel thick, preserving orbital contour.
T1/T2 rotate only the head -3/-6 degrees around (75,42). Request generated
underpaint if the neck seam cannot close from original overlap.

Composite: far limbs, torso underpaint, tail, torso, near legs behind belly
fringe, head, near wing, eye overlay. Bake complete frames offline. Juniper
generates isolated parts for hop, wing cycles, take-off, landing and alert,
plus exposed-body underpaint. No runtime wing rotation or added route arc.
Design 8's F1/F2 parts are rejected and require regeneration.

## Current implementation hand-off

The reference rig is implemented in `rig.py` with versioned tracing proposals in
`rig-masks.json`. Run it to recreate ignored draft evidence. I0/I1/I2/I3/B1/B2
pass the limited rig invariants; visual identity acceptance remains pending.
T1/T2 expose neck seams and reject. Their bitmaps are not published. Supply
matched neck underpaint before tilt acceptance; do not relax the seam gate.

The owner's latest workflow supersedes isolated-wing generation: run
`edit-targets.py` for F1/F2 whole-bird local-edit scaffolds. Resolve
`edit-targets/targets.json` once and verify every listed immutable input hash.
It records the guide hash, fixed cell/anchor/ground and shoulder registration.
The silhouettes connect design 10's stated pose landmarks; the reference wing
patches are edit scaffolding, never accepted art. Generate local wing edits in
whole-bird context, extracting only the articulated part and retaining prompts,
originals and numerical/identity review. Built-in Codex generation only.

No attempt with this workflow has occurred. Earlier design-8/9/10 isolated-part
failures do not count toward the owner's two-attempt limit. If two local-edit
attempts fail identity, stop generating, ship only rig frames that pass identity
and all gates while retaining existing code-driven hop/flight, and propose the
remaining articulation as the owner-authorized follow-up. Do not claim that
conditional fallback is already authorized to activate based on older failures.

`guide.py` measures the native reference byte snapshot. No guess about a
generated pose substitutes for those reference measurements. The guide shows
the unchanged bird, whole alpha bounds (gray), measured torso-region bounds
(cyan), measured head-region bounds (purple), y100 ground/envelope edge (green)
and virtual foot anchor (64,100) (red cross). Eye/breast/foot markers are measured
support centroids; the red beak marker is its rightmost support. Search masks
and half-open bounds are recorded in JSON. Head/torso region bounds intentionally
exclude parts outside their anatomical search regions; they are not proof of
generated-pose scale compliance. Do not copy guide marks into generated images.
The hard native envelope extends outside the 128×112 cell at top/left/right;
its exact limits are recorded in JSON. No acceptance gates or timing changed.

Keep the native untrimmed 128×112 composition and reference proportions, virtual
anchor (64,100), y100 ground, .35 display scale and warm reference palette.
Generate one required isolated right-facing part per image, flat uniform #00FFFF, no
guide lines/text/ground/shadow. Use the shipped identity and raster guide on
every attempt. Feet in airborne poses tuck above the virtual anchor; never
translate the complete bird for a jump—the existing route supplies the arc.

Earlier tilt/hop attempts enlarged beaks, thickened toes and changed head/body
proportions. They are rejected. Earlier idle/blink candidates are unaccepted and
lack complete prompt/settings evidence; recover that evidence or regenerate.
Cleanup cannot repair identity drift. Preserve the tiny eye, narrow short beak,
fine toes, original dark contours and simplified feather groups.

Supply complete groups of individual frames, at most nine images plus a small
provenance attachment per turn, provenance first. Implementer bakes idle/blink/
tilt from reference masks; designer supplies remaining isolated-part groups:

1. I0 neutral; I1 slight inhale; I2 full inhale; I3 easing outward. Breast excursion
   ≤2 native pixels, feet/head stable. B1 half lid, B2 fully closed, unchanged eye.
2. T1 slight head tilt, T2 maximum six-degree neck tilt. H1 shallow crouch (≤3px
   torso lowering, ≤5% compression), H2 spring (≤2px articulation), H3 tucked
   ascent, H4 descending/reaching feet, H5 landing flex. Change articulated pose
   and silhouette; do not rotate the complete bird or add a second jump arc.
3. W0 high wing, W1 downward diagonal, W2 horizontal downstroke, W3 low wing,
   W4 low turnaround/flexed feathers, W5 narrow horizontal recovery, W6 upward
   diagonal, W7 nearly high recovery. Eight distinct phases, one flap period.
4. F1 take-off compression, F2 opening wing/toe release. L1 braking/fanning and
   legs extending, L2 folding/reaching feet, L3 landing flex. A1 attentive neck,
   A2 modest head turn, A3 settled attention (≤10° rotation, ≤3px head shift).

Reuse I0 as rest and W0 for take-off/landing endpoints. Exact playback timings
remain those in design 1. All 29 unique IDs need complete baked frames; the
owner-authorized rig supplies idle/blink/tilt and individually generated parts
supply the remaining articulation. No generated sheet-cutting is permitted.

For each attempt record exact prompt, exposed generator/settings/date/attempt ID,
reference/guide hashes, pose target landmarks, status and rejection reason.
Retain untouched originals outside the repository. Latest owner instruction
drops the rejected archive: name each rejected attempt and its failure in the
provenance. Generated status is not numerical or identity acceptance. Return
the isolated-part groups for cleanup,
calibration and rejection by the implementer. No further visual design needed.
