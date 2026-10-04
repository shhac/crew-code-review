# Idle/blink surgical production provenance — design 1

Date: 2026-10-04. Generator: Codex built-in image_gen.imagegen. Backend model/version, seed, quality and fidelity settings are not exposed; no values inferred. Calls used referenced_image_paths in the order below, transparent_background=false, and exact prompts recorded below. Each call requested one individual image; no sprite sheet generated. Output originals untouched and retained outside repository. All seven outputs visually REJECTED; numerical acceptance, cleanup, palette mapping, packing and runtime checks NOT performed. No archive. No repository changes.

## Verified input snapshots

Identity: internal/dashboard/ui/src/lib/theme/christmas/robin-perch.webp
SHA256 e9d871e3f720fe55bf70fc40991e8dcc82a67514889038785d67e53e9a79237a

Guide: design-docs/christmas/animation/reference-guide/guide.png
SHA256 d30a769fbb7d74bb13c0d5bd47488c2181e8eab170a98e382abbfc5f77bbd609

Metadata: design-docs/christmas/animation/reference-guide/landmarks.json
SHA256 772f435895331726e74c3e72ec9d4ab995e8f853bc21b933da32d5f972253dd9

Finish reference 3: design-docs/halloween/pumpkins.png SHA256 e2b446f481495b9b618bd3c4b067e28ca7dcac13a7116b9a382cc4fd6de7567a
Finish reference 4: design-docs/halloween/candles.png SHA256 51a6ce2ae518b24d97116f27456c9cfe088b1ac1509371b88f223d8863b5f771
Finish reference 5: design-docs/halloween/spider-body-side.png SHA256 16a39040c9dc5d5dd3445a80a12af2393cf52e5b93824405f214717b3102daf7

All five reference hashes checked against metadata. guide.py imported with python3 -B; magick decoded reference; measure() matched every recorded measurement, and rasterize() matched decoded guide RGBA pixel for pixel. No mismatch. This verifies the present pair, not interruption-safe publication. Metadata has no independently recorded self-hash; the above is a newly computed snapshot digest.

## Source and target landmarks

Native cell 128x112; virtual anchor (64,100), ground y100, display scale .35; collision x[-24,+24], y[-37,0], native x[-4.5714286,132.5714286], y[-5.7142857,100]. Source nonzero alpha bounds [2,6,105,99]; torso region [24,38,99,86] centre (63.0555,60.5268); head region [53,14,99,44] centre (75.2286,30.8656); eye [82,29,88,36] centre (84.881,32.4524); beak [93,25,105,39], tip (104.5,33); breast [69,43,98,74], centre (84.8814,55.859); left foot [47,88,64,99] centre (55.8398,93.335), lowest (59,98.5); right foot [64,88,81,97] centre (72.3351,92.6134), lowest (75,96.5). Region-constrained torso/head bounds are measurement masks, not full anatomical silhouettes. Targets preserve these landmarks except breast contour I1 +0.5px, I2 +1px, I3 +0.25px easing toward neutral; B1/B2 only change eyelid within eye bounds. These are requested targets, not measured output achievements. All poses preserve reference-relative foot offsets.

## Transport failure

Initial I0 request with relative input paths failed before generation: `AbsolutePathBuf deserialized without a base path`. Same prompt retried using absolute paths; that generated output is I0-d4-surgical-attempt01. No recoverable output from the failed call, never accepted.

## Attempts

### I0-d4-surgical-attempt01-rejected-original.png

Status: generated; visually rejected; numerical gates not run.
Failure: Broadened beak, thickened hooked toes, redrawn face/breast proportions. Background also varies near cyan rather than exact flat #00FFFF. Do not repair anatomy with cleanup.
Generator attempt: exec-f2f7742c-722b-48f0-8ebe-6a03cd320ba3.png
Original path: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104ac-81fb-7a60-bda4-5c3f44117120/exec-f2f7742c-722b-48f0-8ebe-6a03cd320ba3.png
SHA256: a71b5590f6fe0e299016e7c576851b53bd55c8b080f39006d05492067bb7bf1e
Bytes: 1081594; decoded dimensions/background samples (0,0), (20,20), (1300,1100): 1341 1173 srgb(4,249,252) srgb(0,251,253) srgb(0,252,253)
Settings: transparent_background=false; five absolute referenced_image_paths, as listed in order above. All paths resolved against the clone; no extra generation arguments.
Exact prompt:
```text
Use case: identity-preserve edit. Produce ONE complete bird frame, not a sheet. Image 1 is the exact edit target robin-perch.webp; image 2 is a measured coordinate overlay used ONLY for registration; images 3-5 are Halloween finish references only. Replace transparent background with flat uniform #00FFFF. Preserve image 1's exact anatomy, short thin beak, tiny eye, fine toes, folded wing, tail, proportions, warm palette and smoothly antialiased illustrated contours. Do not redraw into a different bird; no pixelation, outline thickening, photographic feathers, ground, shadows, guide marks or text. Keep untrimmed logical 128x112 composition and unchanged scale; virtual foot anchor (64,100), ground y100, painted alpha bounds [2,6,105,99], torso region bounds [24,38,99,86] centre (63.0555,60.5268), head bounds [53,14,99,44], eye centre (84.881,32.4524), beak tip (104.5,33), breast centre (84.8814,55.859), left foot centre (55.8398,93.335), right foot centre (72.3351,92.6134). Preserve original toe offsets above ground. Hard native envelope x[-4.5714,132.5714], y[-5.7143,100]. If output resolution is larger keep same 128:112 cell proportions and normalized coordinates. Change only the requested tiny local feature; every other part remains the reference. Requested frame I0: neutral rest. Change ONLY the transparent background to cyan; preserve every painted bird feature and position.
```

### I0-d4-surgical-attempt02-rejected-original.png

Status: generated; visually rejected; numerical gates not run.
Failure: Broadened beak, thickened toes, softened/pixel-stepped contours; neutral bird redrawn. Background also varies near cyan rather than exact flat #00FFFF. Do not repair anatomy with cleanup.
Generator attempt: exec-c99bf05e-15a0-459d-8fea-8e5ece2cb4e6.png
Original path: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104ac-81fb-7a60-bda4-5c3f44117120/exec-c99bf05e-15a0-459d-8fea-8e5ece2cb4e6.png
SHA256: c172e191a37ff1b801a23deea4dc744dddc53d2f6e1286562ffd29e82bb5ba13
Bytes: 1097511; decoded dimensions/background samples (0,0), (20,20), (1300,1100): 1341 1173 srgb(4,249,252) srgb(0,251,253) srgb(1,251,254)
Settings: transparent_background=false; five absolute referenced_image_paths, as listed in order above. All paths resolved against the clone; no extra generation arguments.
Exact prompt:
```text
Edit image 1 surgically, preserving its exact bird rather than illustrating it again. Output one complete right-facing bird in the same untrimmed 128:112 composition, on perfectly flat #00FFFF. Image 2 is ONLY a positioning guide, never copy its marks. Images 3-5 describe finish only; image 1 overrides them. Keep the tiny short beak, thin delicate toes, exact head/wing/tail silhouette, shading, colour and smooth contours unchanged. Logical cell 128x112, virtual anchor (64,100), ground y100. Reference alpha bounds [2,6,105,99], eye (84.881,32.4524), beak tip (104.5,33), torso centre (63.0555,60.5268), torso region [24,38,99,86], head region [53,14,99,44]. Keep original foot registration and all painted support above y100; native collision envelope x[-4.5714,132.5714], y[-5.7143,100]. No rescaling of bird within canvas. No guide lines, ground, texture, shadows or text. Do not enlarge the beak or thicken toes. Frame I0. Change only the transparent background to cyan. Neutral pose, bird itself unchanged.
```

### I1-d4-surgical-attempt01-rejected-original.png

Status: generated; visually rejected; numerical gates not run.
Failure: Broadened beak and heavy toes; smaller body/changed registration rather than local slight inhale. Background also varies near cyan rather than exact flat #00FFFF. Do not repair anatomy with cleanup.
Generator attempt: exec-a3385f79-465f-48c0-829b-6cfc8ff4a184.png
Original path: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104ac-81fb-7a60-bda4-5c3f44117120/exec-a3385f79-465f-48c0-829b-6cfc8ff4a184.png
SHA256: 7ff115cd16f9bdb95d13a7788a17fadc2c55496588755790296835293ab83107
Bytes: 1055104; decoded dimensions/background samples (0,0), (20,20), (1300,1100): 1341 1173 srgb(4,249,252) srgb(0,251,253) srgb(0,252,254)
Settings: transparent_background=false; five absolute referenced_image_paths, as listed in order above. All paths resolved against the clone; no extra generation arguments.
Exact prompt:
```text
Edit image 1 surgically, preserving its exact bird rather than illustrating it again. Output one complete right-facing bird in the same untrimmed 128:112 composition, on perfectly flat #00FFFF. Image 2 is ONLY a positioning guide, never copy its marks. Images 3-5 describe finish only; image 1 overrides them. Keep the tiny short beak, thin delicate toes, exact head/wing/tail silhouette, shading, colour and smooth contours unchanged. Logical cell 128x112, virtual anchor (64,100), ground y100. Reference alpha bounds [2,6,105,99], eye (84.881,32.4524), beak tip (104.5,33), torso centre (63.0555,60.5268), torso region [24,38,99,86], head region [53,14,99,44]. Keep original foot registration and all painted support above y100; native collision envelope x[-4.5714,132.5714], y[-5.7143,100]. No rescaling of bird within canvas. No guide lines, ground, texture, shadows or text. Do not enlarge the beak or thicken toes. Frame I1. Change ONLY the breast contour outward by about half a logical pixel for slight inhale; head, beak, feet, tail and wing unchanged.
```

### I2-d4-surgical-attempt01-rejected-original.png

Status: generated; visually rejected; numerical gates not run.
Failure: Broadened beak and heavy toes; changed body scale/registration; peak expansion not established. Background also varies near cyan rather than exact flat #00FFFF. Do not repair anatomy with cleanup.
Generator attempt: exec-f94dbfe7-4d50-4762-8cf5-c9545e57b406.png
Original path: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104ac-81fb-7a60-bda4-5c3f44117120/exec-f94dbfe7-4d50-4762-8cf5-c9545e57b406.png
SHA256: f6c214dd0639e49fa79d2ebd159ca716d14617558163098fe29e79f48d88a5a5
Bytes: 1078546; decoded dimensions/background samples (0,0), (20,20), (1300,1100): 1341 1173 srgb(4,249,252) srgb(0,251,253) srgb(0,252,253)
Settings: transparent_background=false; five absolute referenced_image_paths, as listed in order above. All paths resolved against the clone; no extra generation arguments.
Exact prompt:
```text
Edit image 1 surgically, preserving its exact bird rather than illustrating it again. Output one complete right-facing bird in the same untrimmed 128:112 composition, on perfectly flat #00FFFF. Image 2 is ONLY a positioning guide, never copy its marks. Images 3-5 describe finish only; image 1 overrides them. Keep the tiny short beak, thin delicate toes, exact head/wing/tail silhouette, shading, colour and smooth contours unchanged. Logical cell 128x112, virtual anchor (64,100), ground y100. Reference alpha bounds [2,6,105,99], eye (84.881,32.4524), beak tip (104.5,33), torso centre (63.0555,60.5268), torso region [24,38,99,86], head region [53,14,99,44]. Keep original foot registration and all painted support above y100; native collision envelope x[-4.5714,132.5714], y[-5.7143,100]. No rescaling of bird within canvas. No guide lines, ground, texture, shadows or text. Do not enlarge the beak or thicken toes. Frame I2. Change ONLY the breast contour outward by one logical pixel for peak inhale; head, beak, feet, tail and wing unchanged.
```

### I3-d4-surgical-attempt01-rejected-original.png

Status: generated; visually rejected; numerical gates not run.
Failure: Broadened beak and heavy toes; changed scale/registration rather than isolated easing contour. Background also varies near cyan rather than exact flat #00FFFF. Do not repair anatomy with cleanup.
Generator attempt: exec-388ad678-f427-4e06-91e4-57f6e82cc09f.png
Original path: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104ac-81fb-7a60-bda4-5c3f44117120/exec-388ad678-f427-4e06-91e4-57f6e82cc09f.png
SHA256: 748c464dd80c9ff41e119fb8f174bb4064590bbd798bfcacbfca62402376e841
Bytes: 1094926; decoded dimensions/background samples (0,0), (20,20), (1300,1100): 1341 1173 srgb(4,250,252) srgb(0,252,253) srgb(1,252,254)
Settings: transparent_background=false; five absolute referenced_image_paths, as listed in order above. All paths resolved against the clone; no extra generation arguments.
Exact prompt:
```text
Edit image 1 surgically, preserving its exact bird rather than illustrating it again. Output one complete right-facing bird in the same untrimmed 128:112 composition, on perfectly flat #00FFFF. Image 2 is ONLY a positioning guide, never copy its marks. Images 3-5 describe finish only; image 1 overrides them. Keep the tiny short beak, thin delicate toes, exact head/wing/tail silhouette, shading, colour and smooth contours unchanged. Logical cell 128x112, virtual anchor (64,100), ground y100. Reference alpha bounds [2,6,105,99], eye (84.881,32.4524), beak tip (104.5,33), torso centre (63.0555,60.5268), torso region [24,38,99,86], head region [53,14,99,44]. Keep original foot registration and all painted support above y100; native collision envelope x[-4.5714,132.5714], y[-5.7143,100]. No rescaling of bird within canvas. No guide lines, ground, texture, shadows or text. Do not enlarge the beak or thicken toes. Frame I3. Change ONLY the breast contour outward by one quarter logical pixel: easing outward from peak inhalation toward neutral, less expanded than I1. Everything else unchanged.
```

### B1-d4-surgical-attempt01-rejected-original.png

Status: generated; visually rejected; numerical gates not run.
Failure: Broadened beak and heavy toes; enlarged head/eye and changed overall registration despite eyelid-only request. Background also varies near cyan rather than exact flat #00FFFF. Do not repair anatomy with cleanup.
Generator attempt: exec-414eb39e-624a-4459-b2a5-7ce25c1eeb91.png
Original path: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104ac-81fb-7a60-bda4-5c3f44117120/exec-414eb39e-624a-4459-b2a5-7ce25c1eeb91.png
SHA256: c9627fb131d485ecc3e9ecc9103491aa3c3bac884b1926df23e67ea21cf553f2
Bytes: 1129858; decoded dimensions/background samples (0,0), (20,20), (1300,1100): 1341 1173 srgb(4,249,252) srgb(0,251,253) srgb(1,251,253)
Settings: transparent_background=false; five absolute referenced_image_paths, as listed in order above. All paths resolved against the clone; no extra generation arguments.
Exact prompt:
```text
Edit image 1 surgically, preserving its exact bird rather than illustrating it again. Output one complete right-facing bird in the same untrimmed 128:112 composition, on perfectly flat #00FFFF. Image 2 is ONLY a positioning guide, never copy its marks. Images 3-5 describe finish only; image 1 overrides them. Keep the tiny short beak, thin delicate toes, exact head/wing/tail silhouette, shading, colour and smooth contours unchanged. Logical cell 128x112, virtual anchor (64,100), ground y100. Reference alpha bounds [2,6,105,99], eye (84.881,32.4524), beak tip (104.5,33), torso centre (63.0555,60.5268), torso region [24,38,99,86], head region [53,14,99,44]. Keep original foot registration and all painted support above y100; native collision envelope x[-4.5714,132.5714], y[-5.7143,100]. No rescaling of bird within canvas. No guide lines, ground, texture, shadows or text. Do not enlarge the beak or thicken toes. Frame B1. Change ONLY the eye's upper eyelid to halfway closed within original eye bounds [82,29,88,36]. Every other painted feature unchanged.
```

### B2-d4-surgical-attempt01-rejected-original.png

Status: generated; visually rejected; numerical gates not run.
Failure: Broadened beak and heavy toes; oversized thick closed-eye crescent; changed body registration. Background also varies near cyan rather than exact flat #00FFFF. Do not repair anatomy with cleanup.
Generator attempt: exec-64d9ccea-0f12-4610-a18d-a585a560c821.png
Original path: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104ac-81fb-7a60-bda4-5c3f44117120/exec-64d9ccea-0f12-4610-a18d-a585a560c821.png
SHA256: fa8b0662132c68a12598b91f725ad4387c7420304e3cc7ad41efbf6a1ce4df75
Bytes: 1106222; decoded dimensions/background samples (0,0), (20,20), (1300,1100): 1341 1173 srgb(4,250,252) srgb(0,251,253) srgb(1,251,254)
Settings: transparent_background=false; five absolute referenced_image_paths, as listed in order above. All paths resolved against the clone; no extra generation arguments.
Exact prompt:
```text
Edit image 1 surgically, preserving its exact bird rather than illustrating it again. Output one complete right-facing bird in the same untrimmed 128:112 composition, on perfectly flat #00FFFF. Image 2 is ONLY a positioning guide, never copy its marks. Images 3-5 describe finish only; image 1 overrides them. Keep the tiny short beak, thin delicate toes, exact head/wing/tail silhouette, shading, colour and smooth contours unchanged. Logical cell 128x112, virtual anchor (64,100), ground y100. Reference alpha bounds [2,6,105,99], eye (84.881,32.4524), beak tip (104.5,33), torso centre (63.0555,60.5268), torso region [24,38,99,86], head region [53,14,99,44]. Keep original foot registration and all painted support above y100; native collision envelope x[-4.5714,132.5714], y[-5.7143,100]. No rescaling of bird within canvas. No guide lines, ground, texture, shadows or text. Do not enlarge the beak or thicken toes. Frame B2. Change ONLY the eye to a small closed eyelid within original eye bounds [82,29,88,36]. Every other painted feature unchanged.
```

## Handoff

Design 1 remains current. All seven originals rejected; six retries attached separately, first neutral attempt retained at its original path and identified here. No accepted idle/blink inventory. T1–T2/H1–H5, W0–W7 and F1–F2/L1–L3/A1–A3 remain outstanding, as does successful idle/blink regeneration. Preserve gates; no production frame may be promoted from this rejected inventory. No cleanup, tests, commits, landing or approval.
