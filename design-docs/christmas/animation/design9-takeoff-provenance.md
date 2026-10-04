# Take-off isolated-part retry provenance

Date: 2026-10-04. Design 1 with owner-authorized reference cut-out exception remains current. No repository changes.

Generator: built-in Codex image_gen.imagegen, separate calls per frame. Exposed arguments: prompt, referenced_image_paths (five paths below), transparent_background=false. Model version, seed, quality and resolution controls not exposed; no deterministic generation claim.

Guide consumed through guide.py read_published; completion pair hashes validated. Immutable guide SHA256 d30a769fbb7d74bb13c0d5bd47488c2181e8eab170a98e382abbfc5f77bbd609; immutable landmarks SHA256 772f435895331726e74c3e72ec9d4ab995e8f853bc21b933da32d5f972253dd9. Identity SHA256 e9d871e3f720fe55bf70fc40991e8dcc82a67514889038785d67e53e9a79237a.

Reference paths in exact input order:
/Users/paul/.local/state/app.paulie.crew-assistant/projects/e7e4ad3aec8c876df82792f9/tasks/1c314bae768af417c322b4f3/clone/internal/dashboard/ui/src/lib/theme/christmas/robin-perch.webp
/Users/paul/.local/state/app.paulie.crew-assistant/projects/e7e4ad3aec8c876df82792f9/tasks/1c314bae768af417c322b4f3/clone/design-docs/christmas/animation/reference-guide/d30a769fbb7d74bb13c0d5bd47488c2181e8eab170a98e382abbfc5f77bbd609-guide.png
/Users/paul/.local/state/app.paulie.crew-assistant/projects/e7e4ad3aec8c876df82792f9/tasks/1c314bae768af417c322b4f3/clone/design-docs/halloween/pumpkins.png
/Users/paul/.local/state/app.paulie.crew-assistant/projects/e7e4ad3aec8c876df82792f9/tasks/1c314bae768af417c322b4f3/clone/design-docs/halloween/candles.png
/Users/paul/.local/state/app.paulie.crew-assistant/projects/e7e4ad3aec8c876df82792f9/tasks/1c314bae768af417c322b4f3/clone/design-docs/halloween/spider-body-side.png

Finish SHA256 in order: e2b446f481495b9b618bd3c4b067e28ca7dcac13a7116b9a382cc4fd6de7567a; 51a6ce2ae518b24d97116f27456c9cfe088b1ac1509371b88f223d8863b5f771; 16a39040c9dc5d5dd3445a80a12af2393cf52e5b93824405f214717b3102daf7 (hashes from validated metadata).

Source landmarks: alpha bounds [2,6,105,99], torso [24,38,99,86], head [53,14,99,44], eye centre [84.881,32.4524], beak tip [104.5,33]. Shoulder (57,48) is the design rig root, not an automatically measured anatomical landmark. Target cell 128x112; virtual anchor (64,100); ground100; scale .35; display envelope x[-24,24], y[-37,0]. F1 target tip (24,29); F2 target tip (30,8). Source wing tracing proposals remain those of design 8; no certified segmentation.

## F1-part-d6-attempt01
Status: REJECTED visually. Heavier contour, separated rounded feather lobes and broad shape unlike identity wing; shoulder attachment not certified. Numerical geometry/palette gates not run. Output 1341x1173; corner RGB (4,249,253), not exact cyan. No cleanup performed.
SHA256 f18c2366356c87f3417bb9bc84516d369f9c4450e564b3c13166c21a7f6d121a
Original: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104df-802c-7b81-a00c-8f9153e3173f/exec-568d7fe0-2693-4cd4-915e-df3050f50600.png
Exact prompt:

Use case: precise-object-edit. Generate ONLY one isolated near-wing part of the right-facing robin in input 1. Input 1 is authoritative identity, palette and contour weight; input 2 is measured registration guide, never paint its markings; inputs 3-5 are finish references only, never copy their heavy black outlines or magenta. Flat uniform #00FFFF background, no gradient, no shadow, no text. Untrimmed coordinate cell 128x112, shoulder ROOT at (57,48), not centered in the canvas. Treat the canvas as exactly this normalized grid if output resolution is larger. Virtual foot anchor (64,100), ground y100; no body, head, beak, feet, tail, or guide marks. Match reference wing umber brown, restrained warm highlight, subtle dark-brown thin contour (approximately one native pixel), smooth antialiasing, four simplified overlapping feather groups connected into one continuous silhouette. No separated finger-like feather lobes, no thick outline, no feather noise. Root overlap area x53..63 y43..53 must be painted and blend into the reference shoulder. Preserve empty space in remainder of cell; never auto-center or crop. All support inside cell and above y100. Frame F1, take-off opening wing: a half-raised wing extending from root (57,48) towards upper-left, tip near (24,29), curved leading edge through (40,28), trailing feather groups through (31,48),(43,53). Width and shading belong to this exact small robin. Paint ONLY this wing.

## F2-part-d6-attempt01
Status: REJECTED visually. Thick dark contour and pronounced separated feather lobes; overly graphic finish relative to accepted bird; shoulder attachment not certified. Numerical geometry/palette gates not run. Output 1341x1173; corner RGB (4,250,252), not exact cyan. No cleanup performed.
SHA256 8febce92ce39e23da79c54abbc6e1b8acfc41b40d2d130d48b7c703471684fa7
Original: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104df-802c-7b81-a00c-8f9153e3173f/exec-6060a4bf-c8aa-4010-b353-d5d0a866e73a.png
Exact prompt:

Use case: precise-object-edit. Generate ONLY one isolated near-wing part of the right-facing robin in input 1. Input 1 is authoritative identity, palette and contour weight; input 2 is measured registration guide, never paint its markings; inputs 3-5 are finish references only, never copy their heavy black outlines or magenta. Flat uniform #00FFFF background, no gradient, no shadow, no text. Untrimmed coordinate cell 128x112, shoulder ROOT at (57,48), not centered in the canvas. Treat the canvas as exactly this normalized grid if output resolution is larger. Virtual foot anchor (64,100), ground y100; no body, head, beak, feet, tail, or guide marks. Match reference wing umber brown, restrained warm highlight, subtle dark-brown thin contour (approximately one native pixel), smooth antialiasing, four simplified overlapping feather groups connected into one continuous silhouette. No separated finger-like feather lobes, no thick outline, no feather noise. Root overlap area x53..63 y43..53 must be painted and blend into the reference shoulder. Preserve empty space in remainder of cell; never auto-center or crop. All support inside cell and above y100. Frame F2, take-off high wing: wing rises from root (57,48) to tip (30,8); leading edge through (37,11),(49,26); rounded trailing feather groups through (27,20),(34,34),(44,44), back to shoulder overlap. Compact continuous broad wing, four overlapping feather groups. Paint ONLY this wing.

Both untouched originals retained outside repository. Do not pack. Complete take-off group attempted, neither accepted. H1–H5, W0–W7, L1–L3, A1–A3 and exposed-body underpaint remain outstanding. Idle/blink/tilt remain implementer reference-rig work. Attachment outcomes reported in design response.
