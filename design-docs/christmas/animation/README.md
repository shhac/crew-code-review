# Robin idle and blink pipeline

The owner's final-round direction supersedes design 1's full 29-frame delivery
for this task. Ship reference-rigged breathing and blink; preserve existing
code-driven hop, flight and alert. Tilt rejects at the neck seam and is deferred.
[FOLLOW-UP.md](FOLLOW-UP.md) specifies the remaining artwork and generated-frame
cleanup. No local-edit trial or new image generation is claimed.

## Reproduction and evidence

Run from the repository root:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 design-docs/christmas/animation/ship-rig.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s design-docs/christmas/animation -p 'test_*.py'
make dashboard
```

Python uses the standard library. ImageMagick 7.1.2-32 Q16-HDRI and cwebp 1.6.0
are checked before export; WebP settings are CCR-4's
`-lossless -q 100 -m 6 -exact -metadata none`.
The publisher pins robin-perch.webp's bytes, reads the calibrated guide through
`guide.read_published`, and snapshots the versioned rig masks before decoding.
The reference, guide, mask, producer and rig-script hashes are recorded in the
accepted inventory. No accepted frame comes from a rejected generated redraw.

`accepted/complete.json` names the immutable inventory JSON and its hash.
That inventory links six individual WebPs, numerical reports and labelled
contact sheets/preview GIFs for both shipped clips. Read the pointer once and
verify all linked bytes. Source-derived identity acceptance and owner visual
review are separate: the owner has not yet reviewed this exact runtime in a
browser. Generation originals and rejected variants remain task attachments;
production-index.json retains their provenance and rejection records.

`ship-rig.py` uses an exclusive PID lock and private staging. Assets/reports
publish under hash names before the runtime manifest; the manifest replaces
last, after lossless decoding and all gates pass. Export failure or interruption
before that replacement leaves the previous usable runtime. Restart verifies
inputs and recomputes outputs; staging and unreferenced immutable files are never
acceptance records. After abrupt termination, verify the recorded PID is gone
before removing a stale lock. Do not steal a live writer's lock. Evidence's
completion pointer is refreshed after the runtime manifest; if interruption
occurs between those pointers, the runtime is usable and rerunning completes the
evidence pointer. No asset referenced by an earlier runtime is overwritten.

## Rig and engineering gates

Juniper's design-8 reference cut-out specification authorizes these derivatives.
I0 preserves decoded reference RGBA byte-for-byte, including invisible RGB.
Breathing transforms only torso pixels around (64,83), using premultiplied
bilinear filtering; head, folded wing, tail and feet stay fixed. Source torso
pixels close the stationary wing's interior overlap without inventing anatomy.
I1/I2/I3 scales are (1.004,1.006)/(1.010,1.012)/(1.005,1.007).
Blink overlays alter only measured eye support x[82,88), y[29,36), retain alpha,
sample adjacent source russet, and use a one-native-pixel closed-lid curve.

Every shipped frame checks exact feet and fixed identity regions, bounded blink
changes, transparent margins, fractional alpha, and the existing filtered
collision envelope in both facings. Reports include anchor offset, whole-cell
bounds drift, torso-mask dimensions and centre, requested body scale and palette
distance. The torso mask is a versioned tracing region, not a certified anatomical
segmentation. Its geometric gates are 3% dimensions and 1.5 native pixels centre
offset; the foot anchor is exact. These are design-1 engineering tolerances, not
published perceptual standards.

Palette mapping is unnecessary for already accepted reference pixels. The rig
uses source colours and their premultiplied interpolation. Material-wise nearest
source-colour Euclidean sRGB diagnostics gate median <=1, p95 <=3 and max <=24.
This calibration is specific to these six reference derivatives: observed median
is 0, largest p95 is 2.45 and largest maximum is 21.29; the bounds allow ordinary
interpolation while rejecting arbitrary material colours. It is NOT CIEDE2000
and is not a substitute for the follow-up's generated-frame palette research.
Chroma removal and matte recovery do not apply to an existing genuine-alpha
reference. Failed gates raise before manifest publication; no offending pixels
are clipped, toes erased or failing generated anatomy recoloured into compliance.

T1/T2 currently expose neck seams; rig.py reports their rejection without
publishing their bitmaps. They are not in the shipping manifest. Ignored
rig-draft evidence remains an optional tooling diagnostic, not a runtime or lab
test prerequisite.

## Packing and playback

The committed runtime manifest under ui/src/lib/theme/christmas/robin-frames
declares the idle-blink profile, six absolute 128x112 rectangles, transparent
gutters, native anchor (64,100), .35 scale, hashes, positive durations, loop status
and terminal/rest IDs. robin-perch.webp is the independent accepted I0 fallback.
Breathing is I0 I1 I2 I3 I2 I1 at 200ms each: exactly 1200ms, with no duplicate
endpoint or doubled wrap. Blink is I0 B1 B2 B1 I0 at 60/40/70/40/90ms.

ChristmasLayer samples createIdlePlayback using a cosmetic stream independent
of movement RNG. It selects a neutral boundary inside 4–8 seconds and repeats
blinks; deferred tilt never substitutes for a blink. Movement/alert pre-empt
cosmetics immediately. Layout reconciliation, visibility/preference changes and
teardown reset epochs. Missed blinks are skipped. Reduced motion selects I0 only.
Playback never modifies Bird, facing, movement routes or action deadlines.

RobinArt loads through idle-assets.ts. Validation rejects unknown/missing IDs,
rectangles, invalid timing, hashes and decoded dimensions. Verified bytes become
blob URLs, so a second fetch cannot substitute different pixels. URLs and
decoders are released on failures/teardown; cancelled loads cannot publish stale
assets. Missing/corrupt art falls back to the independent reference without
delaying movement. Legacy alert/flight sprites and rotating flight wing remain
under the owner's narrowed scope; their load errors also select neutral art.

## Vite-only review

```sh
npm --prefix internal/dashboard/ui run dev
# /lab/robin-rig.html : production renderer, timeline, mirroring, reference overlay
# /lab/scene.html?theme=christmas&clock=manual : actual production scene
# /lab/artwork.html : dark/white/checkerboard and seasonal comparison
cd internal/dashboard/ui
./node_modules/.bin/playwright test --config playwright.lab.config.ts
```

All lab evidence is committed: no ignored fixture or generation step is required
in a clean checkout. The server exposes only the accepted evidence directory;
the production app makes no API calls for animation. Browser regressions cover
the production scene, reduced motion, lifecycle resets, both DPRs and desktop/
narrow geometry, plus missing/corrupt sheets. The owner's browser acceptance
remains a separate post-landing check; check results/limitations are in STATUS.md.

The same registered-cell, immutable-publication, lossless-packing, validation and
discrete-playback contracts can support tree-light and spider work. Neither is
implemented here, and CCR-5's CSS lights remain unchanged. Full-articulation
timing/packing and local-edit scaffold tools are retained as documented follow-up
foundations; they do not enable unaccepted frames in production.

Preview GIFs use transparent Background disposal before each discrete frame;
coalescing is tested against raw decoded frames to reject contour accumulation.
Immutable accepted artifacts are fsynced in private staging on the destination
filesystem and renamed atomically, never streamed into final hash-named files.
A failed write cannot poison a final filename; discard abandoned staging only
after verifying its publisher is no longer active, then rerun the same command.
