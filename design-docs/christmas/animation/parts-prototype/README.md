# Layered robin animation lab

The prototype generates complete components separately from the accepted canonical
robin, including concealed attachment artwork. It is a Vite-only lab; it does
not replace the production animation.

Open `/lab/robin-parts.html` after `npm --prefix internal/dashboard/ui run dev`.
Playback combines breathing, delayed head response, two blinks, two head gestures
and a tail flick in a 12-second loop. Individual modes isolate each movement.
The accepted standing rig is also the base for the new `hop`, `peck` and
`flight` review modes. `flight-up` and `flight-down` hold the stroke extremes.
The lab shows dashboard/native/enlarged sizes against the existing canonical,
with light/dark/checker surfaces, mirroring, reduced motion, layer visibility,
attachment guides, a neck toggle and a spread view. It honours the OS reduced
motion preference on mount; the checkbox permits an explicit lab override.

## Artwork

Twenty-eight active components are exported from `sources/`, with earlier artwork revisions retained: torso, head, neck,
foreground folded wing, tail, foreground leg/foot, background leg/foot and closed
eyelid. The open eye and beak remain part of the head. The far folded wing is
occluded in the standing view. Eight flight profiles per wing and two flight legs are generated separately against the accepted assembly. The raised/lowered wings and hanging toes also use the user-supplied flight photograph as an anatomy reference while retaining the illustrated style. A pecking torso lowers
the upright neck attachment while retaining the standing belly baseline.
Puffing, squinting and
turned-head drawings are still outside this experiment.

`generation.json` retains the exact prompts, canonical reference, generating
tool and original generated paths. All generation used the built-in image_gen
tool. `generation-flight.json` records the new component prompts and provenance.
`generation-peck.json` records the targeted pecking torso variant.
`generation-flight-repair.json` and `generation-flight-smoothing.json` retain
the reference-guided anatomy corrections and extra wing profiles, including
exact built-in-tool prompts, references, output paths and discarded candidates.
The `wing-shoulder` cover rotates around the near-wing root with the continuous
stroke trajectory. Its feather direction is calibrated separately from the
flight drawings; it no longer remains fixed over the torso.
The initially outlined head is retained as `head-outlined-v1.png`: its
lower dark edge formed a visible neck seam in the first browser assembly. A
targeted generated revision replaces that edge with coloured feather tips.
The tail and near foot also received targeted generated revisions; the near
foot now has three visible forward toes and one rear toe. Apparent glow in the
tool's black-background tail preview was not sufficient evidence of a rendered
halo: the exported alpha was inspected composited onto white and in the browser.

## Reproduction

```sh
node design-docs/christmas/animation/parts-prototype/prepare.mjs
node --experimental-strip-types design-docs/christmas/animation/parts-prototype/render.mjs
# Export the isolated movement loops:
node --experimental-strip-types design-docs/christmas/animation/parts-prototype/render.mjs --mode=hop
node --experimental-strip-types design-docs/christmas/animation/parts-prototype/render.mjs --mode=peck
node --experimental-strip-types design-docs/christmas/animation/parts-prototype/render.mjs --mode=flight
npm --prefix internal/dashboard/ui run check
npm --prefix internal/dashboard/ui test
make dashboard
```

Preparation uses ImageMagick 7.1.2-32 and Node, with no Pillow requirement.
The render command requires Node 22.6+ for TypeScript stripping. A harmless
MODULE_TYPELESS_PACKAGE_JSON warning can appear because the dashboard package
does not declare its module type.

There is no generated grid to slice. Each component's bounds are measured from
alpha above 1%, with eight source pixels of additional padding. This avoids
very faint alpha residue across generated canvases without thresholding or
recolouring the retained artwork. Components touching the source edge are
rejected. Aspect ratios are preserved; anatomical size, placement and pivots
are manually calibrated, not inferred from the source canvas centre. Variants
retain anatomical scale and attachment coordinates; flight drawings are
calibrated by their actual shoulder/hip roots rather than by equal outer
bounding-box sizes.

Preparation exports lossless WebP and a manifest recording original bounds,
source/export SHA-256 hashes, native dimensions and registration. Motion uses
SVG groups containing the raster artwork. The legs are outside the breathing
group, so the feet stay planted. In this right-facing view the near leg is on
the left: it draws above the torso, while the far leg draws behind it. Their
component widths are 15.2 and 14.5 native pixels, respectively. The near leg
sits three pixels farther right than the preceding revision, overlapping the
belly outline, and its foot registers at approximately y=102.1 versus the far
foot's y=101.0. Different component aspect ratios and torso overlap make full
image height a poor comparison for the visible legs. The folded wing is 59
native pixels wide (up from 55), positioned at x=29, y=32 with a shoulder pivot
at (79, 43). It overlaps the back bump while sitting below the head; the latest
adjustment moves it two pixels left and 2.5 pixels down without changing size.
The tail draws above the torso and beneath the wing, and inherits breathing
from the body. Its right attachment has coloured feather tips rather than a dark
outer border, so the root blends into the rump. `generation-tail-root.json`
records the targeted edit; the original source-frame registration keeps the
tail's size and position stable despite changed alpha bounds.
The neck partly follows head rotation and overlaps both torso
and head. The eyelid inherits the head's transform. Its drawn lid is offset
within the generated feather patch, so registration aligns the ink rather
than the patch centre: the open eye is centred around (98.1, 24.0), and the
14-pixel-wide lid patch is placed at (89, 17.7). Its feather surround covers
the open-eye perimeter so no iris edge remains visible during a blink.

`render.mjs` exports `assembled.png`, `exploded.png`, `blink-comparison.png`
(open and closed at the same head pose) and `preview.gif`. It uses
the live rig's exact pose function and transform strings, converts those
transforms to affine matrices, and composites the generated artwork with
ImageMagick. The GIF has 150 frames at 80ms each, with no repeated closing
frame. Its background is opaque cream; component assets retain alpha. These
are rendered artwork previews, not browser screenshots.

The same renderer also exports `hop.gif`, `peck.gif`, `flight.gif`, individual
extreme-pose PNGs and `poses-comparison.png`. The isolated hop and peck loops
are four seconds at 25fps; the flight export contains two 600ms wing cycles at 50fps.
Live and exported views share both the camera and the complete layer plan.

## Movement registration

- Hop: a short planted anticipation, a 25-native-pixel lift with both feet,
  slight independent leg curl, then a landing compression and recovery.
- Peck: a 20-degree torso lean and a lower neck pivot at (82, 52) let the
  head reach the ground with three short taps. The torso remains above the
  feet. Both foot anchors remain planted during the whole motion.
- Flight: the torso leans 28 degrees, the head counter-rotates to retain its
  gaze, and separately generated near/far tucked legs replace planted feet.
  Near-wing root is (79, 43); far-wing root is (90, 42). Raised and lowered
  drawings and six intermediate profiles rotate at these roots, preserving
  volume. Wings are calibrated from a manually identified shoulder to the
  leading primary tip, rather than from the variable feather-fan bounds.
  Horizontal/recovery profiles deliberately shorten in projection.
  A continuous cosine shoulder-to-primary trajectory drives the stroke. Both
  drawings in a handoff rotate and scale uniformly to the SAME moving primary
  tip and shoulder. No axis is flattened, and projection length changes
  smoothly. Each 75ms drawing interval ends with a 34ms blend into its neighbour.
  SVG plus-lighter compositing adds weighted premultiplied artwork, retaining
  opaque overlap instead of dimming the shoulder. The raster exporter uses the
  same weighted-alpha blend. The foreground shoulder cover follows the same continuous
  wing angle around (79, 43), including during drawing handoffs. Flight legs draw above the torso and below the foreground wing,
  so overlapping feathers occlude the feet. The far stroke lags by 21ms in
  playback; held profile modes show both wings at the same stroke stage.

Flight and hop use wider cameras for wing/takeoff clearance; peck has a
slightly wider camera for the forward head. Viewport clearance grows the canvas
without shrinking the bird: enlarged, native and dashboard previews keep
3, 1 and 0.35 pixels per native unit, respectively, in every pose. The mobile
enlarged view uses 2.25 in every pose. Exports retain 3 pixels per native unit.
Standing registration is retained.
Reduced motion holds the accepted standing pose in every mode. These are
isolated loop studies; transitions between standing and flight are a later
integration step.

## Verification and remaining review

The browser assembly was inspected at rest, during a head tilt and blink, on
light/dark surfaces, and in the spread view. Bounding rectangles of the near
foot matched exactly before/after breathing. Mirroring, reduced motion and
layer isolation were exercised. Unit checks pin loop continuity, reduced
motion through every mode, isolated review modes, planted peck feet and beak
contact, both hop feet clearing the ground, fixed wing roots, an articulated shoulder,
source-pixel shoulder/tip registration, preserved wing
volume, coincident primary tips during blending, and flight layer order. Full frontend tests and the production dashboard
build pass; the lab remains outside the shipped bundle.

This is an anatomy/motion experiment, not accepted production artwork. The
assembled bird's proportions differ from the canonical. The standing
identity, rhythm and joints were accepted in the lab, and the flight motion was
reviewed with the owner. Standing-to-motion transitions and production integration
remain separate work.
