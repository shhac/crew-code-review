# Design 1: idle/blink production, 2026-10-04

Design 1 remains authoritative. Twelve individual Codex image-generation outputs, six first attempts and six regenerations. ALL REJECTED on visual review; zero accepted frames. Six attempt02 originals attached untouched as rejected production evidence. No cleanup, numerical acceptance, packing, repository changes, tests, commits or landing. Originals remain outside repository. No rejected archive.

## Generator and settings

Built-in `image_gen.imagegen` invoked through `tools.image_gen__imagegen`. Every successful call has exact arguments `prompt` as recorded below, `referenced_image_paths` = ordered absolute paths below, `transparent_background=false`; num_last_images_to_include omitted. Model/version, seed, quality, resolution controls and sampler settings are not exposed by this tool; do not infer them. Actual output dimensions and hashes below. Date 2026-10-04. Initial preflight call used relative paths and failed before generation: `AbsolutePathBuf deserialized without a base path`; retried using absolute paths, no output for failed call. Not counted among twelve artwork outputs.

## Verified inputs

1. /Users/paul/.local/state/app.paulie.crew-assistant/projects/e7e4ad3aec8c876df82792f9/tasks/1c314bae768af417c322b4f3/clone/internal/dashboard/ui/src/lib/theme/christmas/robin-perch.webp
   SHA-256 e9d871e3f720fe55bf70fc40991e8dcc82a67514889038785d67e53e9a79237a
2. /Users/paul/.local/state/app.paulie.crew-assistant/projects/e7e4ad3aec8c876df82792f9/tasks/1c314bae768af417c322b4f3/clone/design-docs/christmas/animation/reference-guide/guide.png
   SHA-256 d30a769fbb7d74bb13c0d5bd47488c2181e8eab170a98e382abbfc5f77bbd609
3. /Users/paul/.local/state/app.paulie.crew-assistant/projects/e7e4ad3aec8c876df82792f9/tasks/1c314bae768af417c322b4f3/clone/design-docs/halloween/pumpkins.png
   SHA-256 e2b446f481495b9b618bd3c4b067e28ca7dcac13a7116b9a382cc4fd6de7567a
4. /Users/paul/.local/state/app.paulie.crew-assistant/projects/e7e4ad3aec8c876df82792f9/tasks/1c314bae768af417c322b4f3/clone/design-docs/halloween/candles.png
   SHA-256 51a6ce2ae518b24d97116f27456c9cfe088b1ac1509371b88f223d8863b5f771
5. /Users/paul/.local/state/app.paulie.crew-assistant/projects/e7e4ad3aec8c876df82792f9/tasks/1c314bae768af417c322b4f3/clone/design-docs/halloween/spider-body-side.png
   SHA-256 16a39040c9dc5d5dd3445a80a12af2393cf52e5b93824405f214717b3102daf7

Measurements: design-docs/christmas/animation/reference-guide/landmarks.json SHA-256 772f435895331726e74c3e72ec9d4ab995e8f853bc21b933da32d5f972253dd9. Both expected reference/guide hashes match actual files. Fresh in-memory guide.py measure() exactly matches every measured JSON field; rasterize() exactly matches every decoded guide pixel. Publication atomicity was not changed.

## Landmarks and pose targets

Logical cell 128x112; virtual anchor (64,100), ground y100, scale .35; source support [2,6,105,99]. Torso region [24,38,99,86], centre (63.0555,60.5268); head region [53,14,99,44], centre (75.2286,30.8656); eye (84.881,32.4524); beak tip (104.5,33); breast (84.8814,55.859); left foot [47,88,64,99], right [64,88,81,97]. These torso/head rectangles describe region-constrained masks, not full anatomy. Virtual anchor is not lowest painted toe. Per-output source landmarks have NOT been measured: rejected before cleanup. All targets pin head and feet. Pelvis/shoulder are not measured in supplied JSON and are not invented here.

Breathing target I0 neutral, I1 slight inhale, I2 full inhale, I3 easing outward; contour excursion <=2 native pixels. The recorded I3 prompt asks for 2px expansion while saying easing outward: this does not establish proper easing and must be corrected on regeneration. Blink target B1 half lid, B2 thin closed lid. Timing unchanged: I0 I1 I2 I3 I2 I1, 200ms each; blink I0 B1 B2 B1 I0 at 60/40/70/40/90ms. Remaining 23 frame IDs: T1 T2 H1 H2 H3 H4 H5; W0–W7; F1 F2 L1 L2 L3 A1 A2 A3. Idle/blink still require successful regeneration too.

## Exact prompts

Prompt bytes are COMMON + frame suffix, with no separator other than COMMON's trailing space. No other refinements.

Attempt01 COMMON:
```
Use case: identity-preserve. Create ONE complete right-facing robin animation frame, not a sheet. Image 1 is the exact identity to preserve; image 2 is a coordinate guide ONLY, never copy its lines; images 3–5 are finish references only, never copy their subjects or magenta. Preserve image 1's tiny short charcoal beak, fine brown toes, small glossy eye, exact head/body proportions, folded wing and tail, orange face/breast, ivory belly, umber shading and broad upper-left highlights. No redesign, thickened feet, big beak, photographic feathers, text, guide marks, ground, shadows or decorations. Flat uniform #00FFFF background, opaque output for later chroma cleanup, no gradients/spill. Untrimmed logical 128x112 cell, aspect 8:7. If generated at larger resolution preserve this exact proportional grid. Virtual anchor (64,100), ground y100; no art below y100. Reference all-alpha bounds [2,6,105,99]; torso region bounds [24,38,99,86], centre (63.0555,60.5268); head region [53,14,99,44], centre (75.2286,30.8656); eye centre (84.881,32.4524), beak tip (104.5,33); breast centre (84.8814,55.859); left foot bounds [47,88,64,99], right [64,88,81,97]. Region bounds are measurement masks, not instructions to draw rectangular anatomy. Keep head, tail, feet and body registration fixed. Feet are above virtual ground exactly as reference; do not shift to touch it. Draw only the single bird on cyan. Pose: 
```

Attempt02 COMMON:
```
Use case: identity-preserve, precise minimal sprite edit. EDIT the FIRST supplied image; do not redraw or reinterpret this character. Keep its existing pixels and silhouette wherever the requested tiny animation change does not require editing. The source is a small 128x112 sprite, NOT a concept-art suggestion. Preserve its tiny pointed narrow beak and very thin angular toes exactly; do not turn the toes into round sausage shapes. Preserve eye size, head size, folded wing feather arrangement, tail, breast patch and smooth shaded finish exactly. Second image is registration guide only: never output coloured lines or rectangles. Images 3–5 are background/style context only and must not influence robin anatomy or contour thickness. Output one isolated complete right-facing bird in the source composition, untrimmed 8:7 canvas corresponding exactly to 128x112. Replace transparent background with perfectly flat opaque RGB(0,255,255), no gradient, texture, shadow, halo, ground or labels. Do not upscale the bird within the canvas: alpha support must correspond to source [2,6,105,99], virtual anchor (64,100), ground y100. Torso measured region [24,38,99,86], head region [53,14,99,44], eye centre (84.881,32.4524), beak tip (104.5,33); left foot [47,88,64,99], right [64,88,81,97]. Preserve all registration and leave margins. Earlier outputs failed because they broadened beaks, thickened toes, shifted anatomy and used bold outlines. Make a near-identical copy of the FIRST image with only this specified change: 
```

### I0

Both attempts' suffix:
```
Neutral resting pose, reproduce identity silhouette and open eye exactly.
```
### I1

Both attempts' suffix:
```
Slight inhale: breast contour expands outward by 0.7 native pixel relative to neutral, head and feet unchanged.
```
### I2

Both attempts' suffix:
```
Full inhale: breast contour expands outward by 1.4 native pixels relative to neutral, no body enlargement, head and feet unchanged.
```
### I3

Both attempts' suffix:
```
Easing outward: breast contour expands outward by 2 native pixels maximum relative to neutral, head and feet unchanged.
```
### B1

Both attempts' suffix:
```
Neutral resting body exactly; upper eyelid half closes the existing eye. Preserve eye dimensions and position, no brow or head motion.
```
### B2

Both attempts' suffix:
```
Neutral resting body exactly; existing eye fully closed as a fine curved lid in the same eye bounds. No head/body motion.
```
Attempt02 appends exactly:
```
 The closed lid must be a THIN line, not a filled crescent or black patch.
```

## Attempt inventory and failures

- I0-d4-guide-attempt01: generated, visual REJECTED. Original /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104a4-13b7-7790-a595-2a591335d148/exec-b8597026-15fe-430f-92a4-a48869b66498.png; bytes 1071176; SHA-256 43583dd03e9e3b87650ce59ec962b14bc3e77244127629e9f6e9b9b1e8a8c964; dimensions and background samples (0,0), (10,10), (100,100): 1341 1173 srgb(4,249,252) srgb(1,253,253) srgb(1,251,253). Broader beak, heavier rounded toes and changed body registration/proportions; background samples differ from requested flat cyan. No matte recoverability or numeric geometry/palette pass claimed.
- I0-d4-guide-attempt02: generated, visual REJECTED. Original /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104a4-13b7-7790-a595-2a591335d148/exec-e039f963-8d48-492b-99b9-8f6091e18b4d.png; bytes 1084189; SHA-256 2c42b175e01ab647a766ebe2210ad316aed40bf3a18b88df8861de4fc2d74789; dimensions and background samples (0,0), (10,10), (100,100): 1341 1173 srgb(5,250,252) srgb(1,252,254) srgb(0,251,253). Persistent heavy toes/contours, visibly pixelated finish and inconsistent body scale/registration across group; background samples differ from requested flat cyan. No matte recoverability or numeric geometry/palette pass claimed.
- I1-d4-guide-attempt01: generated, visual REJECTED. Original /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104a4-13b7-7790-a595-2a591335d148/exec-9ab12a80-c028-44ac-90c4-f4a1039687d4.png; bytes 1049056; SHA-256 cf4cca2e0efc3788e8f3ca37fc605b263e81c7d24bc6c51ebe3469a15c0d2597; dimensions and background samples (0,0), (10,10), (100,100): 1340 1174 srgb(4,248,252) srgb(1,253,254) srgb(0,251,252). Broader beak, heavier rounded toes and changed body registration/proportions; background samples differ from requested flat cyan. No matte recoverability or numeric geometry/palette pass claimed.
- I1-d4-guide-attempt02: generated, visual REJECTED. Original /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104a4-13b7-7790-a595-2a591335d148/exec-abe91cc9-36c6-4ba1-b160-5175808f3830.png; bytes 1097966; SHA-256 fe82988b37204972cc894492b799b322ddeec520cfe6a7fb30d95bc008c1e4ab; dimensions and background samples (0,0), (10,10), (100,100): 1341 1173 srgb(4,250,252) srgb(1,252,254) srgb(1,251,253). Persistent heavy toes/contours, visibly pixelated finish and inconsistent body scale/registration across group; background samples differ from requested flat cyan. No matte recoverability or numeric geometry/palette pass claimed.
- I2-d4-guide-attempt01: generated, visual REJECTED. Original /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104a4-13b7-7790-a595-2a591335d148/exec-b1eec60b-9cad-480b-b017-4504d3af2a35.png; bytes 1048792; SHA-256 82219e10cfea26249d03ad54b1c99cbad63dfc312bcf1756999d32ee0cb4216d; dimensions and background samples (0,0), (10,10), (100,100): 1341 1173 srgb(4,249,252) srgb(1,252,254) srgb(0,252,252). Broader beak, heavier rounded toes and changed body registration/proportions; background samples differ from requested flat cyan. No matte recoverability or numeric geometry/palette pass claimed.
- I2-d4-guide-attempt02: generated, visual REJECTED. Original /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104a4-13b7-7790-a595-2a591335d148/exec-5962ac12-3468-4eaa-88cd-82facdfc6824.png; bytes 1044910; SHA-256 64f560b99ee891a9219929809c4de2163e1a4ebf9be720f1669eaf5c0f079385; dimensions and background samples (0,0), (10,10), (100,100): 1341 1173 srgb(4,250,252) srgb(1,253,253) srgb(0,252,253). Persistent heavy toes/contours, visibly pixelated finish and inconsistent body scale/registration across group; notable whole-bird shrinkage, inconsistent with inhale; background samples differ from requested flat cyan. No matte recoverability or numeric geometry/palette pass claimed.
- I3-d4-guide-attempt01: generated, visual REJECTED. Original /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104a4-13b7-7790-a595-2a591335d148/exec-58150711-c673-4e94-a444-e13e8198c459.png; bytes 1084080; SHA-256 acb337f7fe38808ba6e457d656c0f901387500524d264dd414c4e04edaf176fa; dimensions and background samples (0,0), (10,10), (100,100): 1340 1174 srgb(4,249,252) srgb(1,253,253) srgb(1,251,252). Broader beak, heavier rounded toes and changed body registration/proportions; background samples differ from requested flat cyan. No matte recoverability or numeric geometry/palette pass claimed.
- I3-d4-guide-attempt02: generated, visual REJECTED. Original /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104a4-13b7-7790-a595-2a591335d148/exec-b67ab7c6-87f2-4cdb-8e94-a3863a269647.png; bytes 1072255; SHA-256 31581af64d36237f51f01ca3367d90a90058dcec3ab14f619ed9351bc87df12a; dimensions and background samples (0,0), (10,10), (100,100): 1341 1173 srgb(4,250,252) srgb(1,252,253) srgb(0,251,252). Persistent heavy toes/contours, visibly pixelated finish and inconsistent body scale/registration across group; background samples differ from requested flat cyan. No matte recoverability or numeric geometry/palette pass claimed.
- B1-d4-guide-attempt01: generated, visual REJECTED. Original /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104a4-13b7-7790-a595-2a591335d148/exec-22e89de3-6234-428e-beb7-202359a37c0f.png; bytes 1073712; SHA-256 f4a67b099e439f18c0da2447dc264d788946547ea67151c324376409508ae11a; dimensions and background samples (0,0), (10,10), (100,100): 1340 1174 srgb(4,250,252) srgb(1,253,253) srgb(0,252,252). Broader beak, heavier rounded toes and changed body registration/proportions; lid introduces eyebrow-like shape; background samples differ from requested flat cyan. No matte recoverability or numeric geometry/palette pass claimed.
- B1-d4-guide-attempt02: generated, visual REJECTED. Original /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104a4-13b7-7790-a595-2a591335d148/exec-bf024183-88db-4951-b2c9-6a6067aa53da.png; bytes 1088131; SHA-256 d42e18bb6be143675cfb49955fc48d963fff42fff407e1bf2d8831e1e307e4b7; dimensions and background samples (0,0), (10,10), (100,100): 1341 1173 srgb(4,249,252) srgb(1,253,253) srgb(0,251,252). Persistent heavy toes/contours, visibly pixelated finish and inconsistent body scale/registration across group; lid introduces eyebrow-like shape; background samples differ from requested flat cyan. No matte recoverability or numeric geometry/palette pass claimed.
- B2-d4-guide-attempt01: generated, visual REJECTED. Original /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104a4-13b7-7790-a595-2a591335d148/exec-8ad24672-6f1b-4af1-9ec0-a83e886231f8.png; bytes 1064017; SHA-256 d883075d2bd43a54c9a3191c391e7b7b34787003abacdb87f1cb6b8a103399c6; dimensions and background samples (0,0), (10,10), (100,100): 1341 1173 srgb(4,248,252) srgb(1,253,253) srgb(0,251,252). Broader beak, heavier rounded toes and changed body registration/proportions; closed eye is a thick filled crescent rather than thin lid; background samples differ from requested flat cyan. No matte recoverability or numeric geometry/palette pass claimed.
- B2-d4-guide-attempt02: generated, visual REJECTED. Original /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104a4-13b7-7790-a595-2a591335d148/exec-909249fb-65ea-43fa-aec4-4545bed9744f.png; bytes 1095860; SHA-256 5c0c3fa9224e7a61d3fddc50b64db62dee7488b37f7a637a47cd3f35d0118e44; dimensions and background samples (0,0), (10,10), (100,100): 1341 1173 srgb(4,250,252) srgb(1,253,253) srgb(1,252,252). Persistent heavy toes/contours, visibly pixelated finish and inconsistent body scale/registration across group; background samples differ from requested flat cyan. No matte recoverability or numeric geometry/palette pass claimed.

## Earlier inventory

Earlier I0-attempt04, I1-attempt02, I2-attempt01, I3-attempt01, B1-attempt01 and B2-attempt01 remain unaccepted: complete prompts/settings unavailable. I0-original (attempt03) rejected for head/beak identity drift and thickened toes; earlier I1-attempt01 rejected for proportion change and pale leg artifact. Estimated SVG guide superseded for production by verified measured raster guide. Prior T1-attempt01/02, T2-attempt01, H1–H5-attempt01 remain rejected for enlarged beaks, heavier toes and changed proportions, as existing provenance records. No historical attempt is promoted here.

## Handoff

Do not recolour, warp or pack these rejects. Retain design 1 and its gates. Next production should correct I3 semantics and use a tightly scoped identity edit with stronger source registration; retries show prompt-only preservation is insufficient. Future generated originals still need cleanup, measured source landmarks, numerical gates and rendered-size inspection. No implementation check was run in this design-only turn. Read-only hash/decode/reproduction verification passed; a shell here-document inspection failed because read-only execution disallowed its temporary file, then the same read-only inspection succeeded via python -c.
