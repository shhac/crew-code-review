# Robin production provenance: tilt and hop attempts

Date: 2026-10-03. Design 1 remains authoritative. Eight individual images generated with Codex built-in `image_gen.imagegen`; one request per frame/attempt. No cleanup, packing, acceptance, repository writes, tests, commit or integration. All eight are rejected for identity drift; attached originals are evidence, not runtime inputs.

## Generator and settings
Built-in Codex image generation. Underlying model/version, seed, quality and sampling parameters are not exposed by this tool and are unknown. Actual arguments: `referenced_image_paths` in the order below, `transparent_background:false`, exact `prompt` recorded per attempt. Requested background #00FFFF, logical cell 128x112. Actual output dimensions 1341x1173 (not final cells). No source landmarks measured; targets only are embedded in prompts. No numerical gate results. Pillow import failed (`ModuleNotFoundError`), so no pixel colour samples claimed. SHA-256 and PNG IHDR dimensions were read with Python standard library. Outputs retained unchanged in tool output directory.

## Reference inputs
Tool limit is five image paths. Supplying all references failed before generation: `referenced_image_paths must contain at most 5 paths`. Supplying attached SVG guide failed before generation: `unsupported image unknown`. Neither failed call produced an image. Successful calls supplied identity plus three Halloween originals; guide coordinates supplied numerically in prompt. This is a recorded input deviation, not full compliance with the fixed guide image requirement. Shipped Halloween WebPs were inspected, not submitted to successful calls.

- internal/dashboard/ui/src/lib/theme/christmas/robin-perch.webp: SHA-256 e9d871e3f720fe55bf70fc40991e8dcc82a67514889038785d67e53e9a79237a
- design-docs/halloween/pumpkins.png: SHA-256 e2b446f481495b9b618bd3c4b067e28ca7dcac13a7116b9a382cc4fd6de7567a
- design-docs/halloween/candles.png: SHA-256 51a6ce2ae518b24d97116f27456c9cfe088b1ac1509371b88f223d8863b5f771
- design-docs/halloween/spider-body-side.png: SHA-256 16a39040c9dc5d5dd3445a80a12af2393cf52e5b93824405f214717b3102daf7

Guide attachment robin-coordinate-guide.svg SHA-256 29184ebee28b86bd4043b78fe768d1b0b1b5ca3bee46b533b4b796a728190129. Fixed targets: cell 128x112, virtual anchor (64,100), ground y100, estimated torso bounds (26,35)-(98,86), head (70,15)-(103,48), torso centre (62,61), head (86.5,31.5), pelvis (61,83), shoulder (61,45). Estimates require calibration; no source-to-target registration performed.

Inspected shipped finish reference hashes: pumpkins.webp 1203afec8b4510d8c4bef3bb8558a2eb3289d5b15581d716a4c3004e95c9f58b; candles.webp 24095eae5200d772d22760625d2ac849788479143c11be499dd701641ee6c20b; spider-body.webp 8619b36147559e1534b0b50f82e8d39b360eeefd6444945bd58568670bdd6c6a.

## Earlier-turn inventory (inherited, not newly generated)
Exact prior prompts, actual generator settings and source landmarks are absent from this turn's accessible attachment record; they cannot be reconstructed honestly. Obtain original production logs before claiming complete provenance. Status below is inherited from design 3; hashes verified this turn.

- I0 attempt03 / I0-original.png: rejected: head/beak proportion drift and thickened toes; SHA-256 9b4b90678732692e7991fdf5a2cabd50c820742e3249450632678a039b6678a3.
- I0 attempt04: unaccepted candidate; SHA-256 5dec97a1a85c410a1694065635ece143ccf7eeef8135fcf26ee23ddb8f214738.
- I1 attempt02: unaccepted candidate; SHA-256 b35e3668d2d7dd36ca6be6e2050c1d7bef5b6c30c9f563b858ad0c386812f7e3.
- I2 attempt01: unaccepted candidate; SHA-256 8c22a95d04c2e9278d8276563f459ea6b9825971a745b861ebb894e96fa12585.
- I3 attempt01: unaccepted candidate; SHA-256 87a4fd695dd8f1c89fbf7c1bff80d4437d0c884df4b499bcd128734cdd2ae3fb.
- B1 attempt01: unaccepted candidate; SHA-256 8144ba2b04534ffa7360290ff3b5570c740afa9adff1d1ad04bd13b3521f5258.
- B2 attempt01: unaccepted candidate; SHA-256 7025cab3fae315a99ea32377a32b9cbc057d1baa77a5ff7ccd26dffc3f552bb4.
- I1 attempt01: inherited rejection, altered body proportions and pale artifact beside leg; original not attached, hash unavailable. Earlier candidates reportedly have backgrounds varying near cyan; no recoverability established here.

## This turn: exact prompts and attempt records

### T1-attempt01-rejected-original.png
Status: generated, visually rejected; numerical checks not run.
Reason: Thickened toes, enlarged triangular beak; head/wing proportions differ from shipped identity.
Generator attempt identifier: exec-f07ade2e-a1de-4e10-bdad-9e1693acb542.png
SHA-256: a0b6c508a6dd0ca7492604023a6e9d9385c1d8d04b274e9a8ceda942baf1c1ac; bytes 1046822; dimensions 1341x1173.
Retained original: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a10360-972c-78a1-a791-c98298724a74/exec-f07ade2e-a1de-4e10-bdad-9e1693acb542.png
Exact prompt:
```text
Generate ONE complete right-facing European robin animation frame, not a sheet. Identity reference: image 1, the shipped robin-perch.webp; preserve its exact small eye, short beak, russet face/breast patch, umber back, ivory belly, dark contour, simplified feather groups and broad warm upper-left shading. Images 2–4 are Halloween FINISH references only, never copy subjects or magenta backgrounds. The fixed SVG coordinate guide is supplied numerically here (SVG image input is unsupported): logical 128x112 untrimmed cell, virtual foot anchor (64,100), ground y100, estimated torso bounds x26..98 y35..86, head bounds x70..103 y15..48, torso centre (62,61), head centre (86.5,31.5), pelvis (61,83), shoulder (61,45). Guide estimates are subordinate to identity image proportions. Keep body scale and registration fixed, whole silhouette inside x0..128 y0..100 with clear margins. Output larger raster if necessary but preserve logical 128:112 composition. Flat uniform exact cyan #00FFFF background; no gradient, texture, shadow, spill, guide markings, labels, ground or decorations. Do not translate whole bird for a jump; route provides its arc. Generate actual articulated pose, not rotated whole image. Requested frame: T1. Slight curious head tilt, 3 degrees about neck. Chest, folded wing and feet unchanged; head size and small eye unchanged.
```

### T1-attempt02-rejected-original.png
Status: generated, visually rejected; numerical checks not run.
Reason: Regeneration after T1 attempt01; beak and toes still enlarged, head/breast shapes still changed.
Generator attempt identifier: exec-dc97faa0-36b4-42cc-9972-431a28ce7ca2.png
SHA-256: fbd18b7be79b8ac012a1acbdbd38a63a2ccfbafcc8d8be6cc9c6f36fccb23311; bytes 1053490; dimensions 1341x1173.
Retained original: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a10360-972c-78a1-a791-c98298724a74/exec-dc97faa0-36b4-42cc-9972-431a28ce7ca2.png
Exact prompt:
```text
Edit the FIRST reference (shipped robin-perch.webp) into frame T1 of the same bird. Preserve ALL pixels' visual identity and anatomical proportions except tilt its head subtly clockwise by 3 degrees around its neck. Do not redraw its torso, wing, feathers, belly, tail or feet. Keep thin delicate toes and small narrow beak from FIRST reference, NOT generic chunky cartoon feet. Other three images only describe warm shaded finish, which the first bird ALREADY has; no restyling. Background must change to perfectly uniform #00FFFF. Logical cell 128x112, foot anchor (64,100), y100 ground invisible; keep first bird's original cell registration and body scale. Fixed guide numeric landmarks: torso centre (62,61), pelvis (61,83), shoulder (61,45), head centre (86.5,31.5); estimated torso bounds x26..98 y35..86, head x70..103 y15..48. Those estimates never override source anatomy. No ground, shadows, guide marks or text. Single complete bird frame, no sprite sheet. Cyan background only.
```

### T2-attempt01-rejected-original.png
Status: generated, visually rejected; numerical checks not run.
Reason: Thickened toes and enlarged triangular beak; tilt magnitude unmeasured.
Generator attempt identifier: exec-43d2e1a2-7850-4940-b1e2-ff65c443786a.png
SHA-256: b8e7c86fcb3eb913b7ade89eb15126c6d0bc5bff7c39524a60d7d667783add61; bytes 1053620; dimensions 1341x1173.
Retained original: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a10360-972c-78a1-a791-c98298724a74/exec-43d2e1a2-7850-4940-b1e2-ff65c443786a.png
Exact prompt:
```text
Generate ONE complete right-facing European robin animation frame, not a sheet. Identity reference: image 1, the shipped robin-perch.webp; preserve its exact small eye, short beak, russet face/breast patch, umber back, ivory belly, dark contour, simplified feather groups and broad warm upper-left shading. Images 2–4 are Halloween FINISH references only, never copy subjects or magenta backgrounds. The fixed SVG coordinate guide is supplied numerically here (SVG image input is unsupported): logical 128x112 untrimmed cell, virtual foot anchor (64,100), ground y100, estimated torso bounds x26..98 y35..86, head bounds x70..103 y15..48, torso centre (62,61), head centre (86.5,31.5), pelvis (61,83), shoulder (61,45). Guide estimates are subordinate to identity image proportions. Keep body scale and registration fixed, whole silhouette inside x0..128 y0..100 with clear margins. Output larger raster if necessary but preserve logical 128:112 composition. Flat uniform exact cyan #00FFFF background; no gradient, texture, shadow, spill, guide markings, labels, ground or decorations. Do not translate whole bird for a jump; route provides its arc. Generate actual articulated pose, not rotated whole image. Requested frame: T2. Maximum curious head tilt, 6 degrees about neck in same direction as T1. Chest, folded wing and feet unchanged; head size and eye unchanged.
```

### H1-attempt01-rejected-original.png
Status: generated, visually rejected; numerical checks not run.
Reason: Enlarged beak, heavier toes, changed head/body proportions; crouch limits unmeasured.
Generator attempt identifier: exec-cb8ee739-9358-4a3d-bf43-01f024fa011f.png
SHA-256: 4c9bcbef26bf8404e1cd70cefdf69c1d29898e787076cbb813be660cd32231dd; bytes 1028070; dimensions 1341x1173.
Retained original: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a10360-972c-78a1-a791-c98298724a74/exec-cb8ee739-9358-4a3d-bf43-01f024fa011f.png
Exact prompt:
```text
Generate ONE complete right-facing European robin animation frame, not a sheet. Identity reference: image 1, the shipped robin-perch.webp; preserve its exact small eye, short beak, russet face/breast patch, umber back, ivory belly, dark contour, simplified feather groups and broad warm upper-left shading. Images 2–4 are Halloween FINISH references only, never copy subjects or magenta backgrounds. The fixed SVG coordinate guide is supplied numerically here (SVG image input is unsupported): logical 128x112 untrimmed cell, virtual foot anchor (64,100), ground y100, estimated torso bounds x26..98 y35..86, head bounds x70..103 y15..48, torso centre (62,61), head centre (86.5,31.5), pelvis (61,83), shoulder (61,45). Guide estimates are subordinate to identity image proportions. Keep body scale and registration fixed, whole silhouette inside x0..128 y0..100 with clear margins. Output larger raster if necessary but preserve logical 128:112 composition. Flat uniform exact cyan #00FFFF background; no gradient, texture, shadow, spill, guide markings, labels, ground or decorations. Do not translate whole bird for a jump; route provides its arc. Generate actual articulated pose, not rotated whole image. Requested frame: H1. Shallow hop crouch: bend fine legs and compress torso at most 3 logical pixels downward, at most 5 percent compression, same head proportions, wings folded, toes at y100. CRITICAL: edit the first reference robin rather than redesigning it. Keep reference fine hair-thin toes and tiny narrow beak exactly; no chunky cartoon feet, triangular oversized beak, enlarged eye, thicker outlines or new feather pattern. Halloween references influence shading only.
```

### H2-attempt01-rejected-original.png
Status: generated, visually rejected; numerical checks not run.
Reason: Enlarged beak and heavy toes; extended legs visible but torso registration and spring limits unmeasured.
Generator attempt identifier: exec-ce8e95ae-e962-436d-8982-58ff86b565ef.png
SHA-256: 6f950dbbc2e0042c34b4017cd295261904d19287d55902fe972a44653d92f234; bytes 1052001; dimensions 1341x1173.
Retained original: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a10360-972c-78a1-a791-c98298724a74/exec-ce8e95ae-e962-436d-8982-58ff86b565ef.png
Exact prompt:
```text
Generate ONE complete right-facing European robin animation frame, not a sheet. Identity reference: image 1, the shipped robin-perch.webp; preserve its exact small eye, short beak, russet face/breast patch, umber back, ivory belly, dark contour, simplified feather groups and broad warm upper-left shading. Images 2–4 are Halloween FINISH references only, never copy subjects or magenta backgrounds. The fixed SVG coordinate guide is supplied numerically here (SVG image input is unsupported): logical 128x112 untrimmed cell, virtual foot anchor (64,100), ground y100, estimated torso bounds x26..98 y35..86, head bounds x70..103 y15..48, torso centre (62,61), head centre (86.5,31.5), pelvis (61,83), shoulder (61,45). Guide estimates are subordinate to identity image proportions. Keep body scale and registration fixed, whole silhouette inside x0..128 y0..100 with clear margins. Output larger raster if necessary but preserve logical 128:112 composition. Flat uniform exact cyan #00FFFF background; no gradient, texture, shadow, spill, guide markings, labels, ground or decorations. Do not translate whole bird for a jump; route provides its arc. Generate actual articulated pose, not rotated whole image. Requested frame: H2. Hop spring: extend fine legs and articulate torso at most 2 logical pixels upward; same body scale, wings folded. No extra jump displacement. Preserve first reference anatomy exactly, especially very fine feet and narrow short beak; do not copy cartoon proportions from Halloween subjects.
```

### H3-attempt01-rejected-original.png
Status: generated, visually rejected; numerical checks not run.
Reason: Heavy hooked toes and enlarged beak; torso appears smaller than earlier attempts. No measured stable-scale compliance.
Generator attempt identifier: exec-1026ee30-afd5-4e3e-b735-85a871a72574.png
SHA-256: 9de909cb7abb59a05c2a00050186ccd121e01e1f2ac49e3c3f4559e887578bb2; bytes 1010912; dimensions 1341x1173.
Retained original: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a10360-972c-78a1-a791-c98298724a74/exec-1026ee30-afd5-4e3e-b735-85a871a72574.png
Exact prompt:
```text
Generate ONE complete right-facing European robin animation frame, not a sheet. Identity reference: image 1, the shipped robin-perch.webp; preserve its exact small eye, short beak, russet face/breast patch, umber back, ivory belly, dark contour, simplified feather groups and broad warm upper-left shading. Images 2–4 are Halloween FINISH references only, never copy subjects or magenta backgrounds. The fixed SVG coordinate guide is supplied numerically here (SVG image input is unsupported): logical 128x112 untrimmed cell, virtual foot anchor (64,100), ground y100, estimated torso bounds x26..98 y35..86, head bounds x70..103 y15..48, torso centre (62,61), head centre (86.5,31.5), pelvis (61,83), shoulder (61,45). Guide estimates are subordinate to identity image proportions. Keep body scale and registration fixed, whole silhouette inside x0..128 y0..100 with clear margins. Output larger raster if necessary but preserve logical 128:112 composition. Flat uniform exact cyan #00FFFF background; no gradient, texture, shadow, spill, guide markings, labels, ground or decorations. Do not translate whole bird for a jump; route provides its arc. Generate actual articulated pose, not rotated whole image. Requested frame: H3. Hop tucked ascent: torso and pelvis remain at reference registration, fine feet tucked upward above virtual ground anchor; wings folded; same head and torso dimensions. Preserve first reference anatomy exactly, especially very fine feet and narrow short beak; do not copy cartoon proportions from Halloween subjects.
```

### H4-attempt01-rejected-original.png
Status: generated, visually rejected; numerical checks not run.
Reason: Enlarged beak and heavier reaching feet; torso appears smaller than earlier attempts. No measured stable-scale compliance.
Generator attempt identifier: exec-f97d91c4-17f3-47b6-b093-e19ce78221ae.png
SHA-256: c19feff460c1d4d655f8644b3038d5daeeb2ab5085034113adc0f05d005f089d; bytes 1018289; dimensions 1341x1173.
Retained original: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a10360-972c-78a1-a791-c98298724a74/exec-f97d91c4-17f3-47b6-b093-e19ce78221ae.png
Exact prompt:
```text
Generate ONE complete right-facing European robin animation frame, not a sheet. Identity reference: image 1, the shipped robin-perch.webp; preserve its exact small eye, short beak, russet face/breast patch, umber back, ivory belly, dark contour, simplified feather groups and broad warm upper-left shading. Images 2–4 are Halloween FINISH references only, never copy subjects or magenta backgrounds. The fixed SVG coordinate guide is supplied numerically here (SVG image input is unsupported): logical 128x112 untrimmed cell, virtual foot anchor (64,100), ground y100, estimated torso bounds x26..98 y35..86, head bounds x70..103 y15..48, torso centre (62,61), head centre (86.5,31.5), pelvis (61,83), shoulder (61,45). Guide estimates are subordinate to identity image proportions. Keep body scale and registration fixed, whole silhouette inside x0..128 y0..100 with clear margins. Output larger raster if necessary but preserve logical 128:112 composition. Flat uniform exact cyan #00FFFF background; no gradient, texture, shadow, spill, guide markings, labels, ground or decorations. Do not translate whole bird for a jump; route provides its arc. Generate actual articulated pose, not rotated whole image. Requested frame: H4. Hop tucked descent: torso and pelvis at reference registration, feet begin reaching downward compared with H3 while remaining above y100, folded wings; same body scale. Preserve first reference anatomy exactly, especially very fine feet and narrow short beak; do not copy cartoon proportions from Halloween subjects.
```

### H5-attempt01-rejected-original.png
Status: generated, visually rejected; numerical checks not run.
Reason: Enlarged beak and heavier toes, overlapping foot forms; compression unmeasured.
Generator attempt identifier: exec-80fb247b-2af9-46b5-9983-daf9e021b479.png
SHA-256: cc1721888311e1bd31312af36ca1f78c15bc88f4d389fdbe17fe6769a122e90a; bytes 1037230; dimensions 1341x1173.
Retained original: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a10360-972c-78a1-a791-c98298724a74/exec-80fb247b-2af9-46b5-9983-daf9e021b479.png
Exact prompt:
```text
Generate ONE complete right-facing European robin animation frame, not a sheet. Identity reference: image 1, the shipped robin-perch.webp; preserve its exact small eye, short beak, russet face/breast patch, umber back, ivory belly, dark contour, simplified feather groups and broad warm upper-left shading. Images 2–4 are Halloween FINISH references only, never copy subjects or magenta backgrounds. The fixed SVG coordinate guide is supplied numerically here (SVG image input is unsupported): logical 128x112 untrimmed cell, virtual foot anchor (64,100), ground y100, estimated torso bounds x26..98 y35..86, head bounds x70..103 y15..48, torso centre (62,61), head centre (86.5,31.5), pelvis (61,83), shoulder (61,45). Guide estimates are subordinate to identity image proportions. Keep body scale and registration fixed, whole silhouette inside x0..128 y0..100 with clear margins. Output larger raster if necessary but preserve logical 128:112 composition. Flat uniform exact cyan #00FFFF background; no gradient, texture, shadow, spill, guide markings, labels, ground or decorations. Do not translate whole bird for a jump; route provides its arc. Generate actual articulated pose, not rotated whole image. Requested frame: H5. Hop landing flex: fine legs bend, toes meet y100, torso compresses at most 3 logical pixels downward and at most 5 percent; folded wings; preserve exact character. Preserve first reference anatomy exactly, especially very fine feet and narrow short beak; do not copy cartoon proportions from Halloween subjects.
```

## Handoff and remaining inventory
T1/T2 are tilt (not take-off); F1/F2 are take-off under design 1. All seven requested tilt/hop IDs now have original attempts, but no usable/accepted group: all require regeneration. Prior six idle/blink candidates remain unaccepted. W0-W7 and F1-F2/L1-L3/A1-A3 (16 IDs) remain ungenerated this turn. Preserve design 1 rather than recolouring/warping identity failures into apparent compliance. Future production should supply a rasterized fixed guide and strengthen shipped-reference fidelity before further groups. This turn cannot rasterize to disk because filesystem permissions are read-only. No compressed archive or inline image data used.
