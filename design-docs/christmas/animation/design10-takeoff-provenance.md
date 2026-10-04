# Take-off part production provenance

Date: 2026-10-04. Design 1 remains current with owner-authorized cut-out rig exception. No repository changes, cleanup, numerical acceptance, packing or implementation validation.

Generator: built-in Codex image_gen.imagegen; individual calls. Exposed arguments: prompt (verbatim below), referenced_image_paths (five ordered paths below), transparent_background=false. Model/version, seed, quality, output resolution and edit-mask parameters are not exposed. No deterministic generation claim.

Guide resolution: imported guide.py with Python -B and called read_published(reference-guide); completion hashes and pair linkage validated. Never used browsing copies as generation inputs.
Identity SHA256: e9d871e3f720fe55bf70fc40991e8dcc82a67514889038785d67e53e9a79237a
Guide SHA256: d30a769fbb7d74bb13c0d5bd47488c2181e8eab170a98e382abbfc5f77bbd609
Landmarks SHA256: 772f435895331726e74c3e72ec9d4ab995e8f853bc21b933da32d5f972253dd9
Finish hashes (ordered): e2b446f481495b9b618bd3c4b067e28ca7dcac13a7116b9a382cc4fd6de7567a; 51a6ce2ae518b24d97116f27456c9cfe088b1ac1509371b88f223d8863b5f771; 16a39040c9dc5d5dd3445a80a12af2393cf52e5b93824405f214717b3102daf7. Independently hashed all references this turn.

Exact ordered input paths:
/Users/paul/.local/state/app.paulie.crew-assistant/projects/e7e4ad3aec8c876df82792f9/tasks/1c314bae768af417c322b4f3/clone/internal/dashboard/ui/src/lib/theme/christmas/robin-perch.webp
/Users/paul/.local/state/app.paulie.crew-assistant/projects/e7e4ad3aec8c876df82792f9/tasks/1c314bae768af417c322b4f3/clone/design-docs/christmas/animation/reference-guide/d30a769fbb7d74bb13c0d5bd47488c2181e8eab170a98e382abbfc5f77bbd609-guide.png
/Users/paul/.local/state/app.paulie.crew-assistant/projects/e7e4ad3aec8c876df82792f9/tasks/1c314bae768af417c322b4f3/clone/design-docs/halloween/pumpkins.png
/Users/paul/.local/state/app.paulie.crew-assistant/projects/e7e4ad3aec8c876df82792f9/tasks/1c314bae768af417c322b4f3/clone/design-docs/halloween/candles.png
/Users/paul/.local/state/app.paulie.crew-assistant/projects/e7e4ad3aec8c876df82792f9/tasks/1c314bae768af417c322b4f3/clone/design-docs/halloween/spider-body-side.png

Source: cell128x112, alpha bounds[2,6,105,99], torso[24,38,99,86], head[53,14,99,44], eye centre[84.881,32.4524], beak tip[104.5,33]. Virtual anchor(64,100), ground100, shoulder root(57,48) (design landmark, not measured anatomy), display scale .35 and envelope x[-24,24],y[-37,0]. Target coordinates appear in exact prompts.

## F1-part-draft6-retry02
Status: REJECTED visually. Deep separated rounded feather lobes, heavier contour and oversized/displaced wing/root relative to requested guide. Shoulder registration not certified. Numerical cleanup gates NOT RUN. Original 1340x1174. Corner RGB(2,249,253), not requested #00FFFF; background uniformity not measured. SHA256 e482f9b5d6a266bede4f7c7642b1f6e73747e6aaec461fd8a70d36dc6d5c8d94.
Untouched original: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104e2-7479-7361-ae07-5ecbeb12ea92/exec-54aff5e6-bc7c-4159-93f1-6047aa36fea4.png

Exact prompt:
Precise-object-edit / identity-preserve. Produce ONE isolated near-wing articulation part for the exact robin in reference 1. Reference 2 is registration guide only; references 3–5 are subordinate finish references, ignore magenta and do not copy their thick outlines. The robin identity controls palette, thin softly shaded warm-brown contours, broad amber highlights and simplified overlapping feather groups. Preserve the folded wing's visual language. No heavy black outline, no finger-shaped feather lobes, no deep cuts between feathers, no photographic texture. Canvas aspect 128:112, untrimmed normalized 128×112 cell, all coordinates in that grid. Only wing pixels; omit bird body, head, eye, beak, tail, feet, labels, guide lines, shadow. Flat uniform #00FFFF background. Shoulder root at (57,48), overlapping attachment patch x52..63 y43..53. Virtual foot anchor (64,100), ground y100 remain invisible registration landmarks. Do not center or crop the part. Soft antialiased contour. Use continuous silhouette with shallow feather notches, just three broad feather group highlights. This is a new articulated wing, not a rotation of the folded wing. Frame F1: take-off opening wing, half-open lifting backward/upward left from shoulder root (57,48), outer tip (25,26), upper bend (39,25), lower trailing edge (39,48). Broad compact connected wing, rounded edge, small painted overlap at root. Keep all support in x23..65 y23..54.

## F2-part-draft6-retry02
Status: REJECTED visually. Deep separated rounded feather lobes, heavy graphic contour and overly broad wing; root registration not certified. Numerical cleanup gates NOT RUN. Original1341x1173. Corner RGB(4,250,252), not requested #00FFFF; background uniformity not measured. SHA256 0bb0d65d100538a8a0087bd801eb86b26396722374e6a5381454ca62e6561270.
Untouched original: /Users/paul/.local/state/app.paulie.crew-assistant/roles/codex/generated_images/01a104e2-7479-7361-ae07-5ecbeb12ea92/exec-0ecf4d0d-bc48-4376-906a-414af5f4e38e.png

Exact prompt:
Precise-object-edit / identity-preserve. Produce ONE isolated near-wing articulation part for the exact robin in reference 1. Reference 2 is registration guide only; references 3–5 are subordinate finish references, ignore magenta and do not copy their thick outlines. The robin identity controls palette, thin softly shaded warm-brown contours, broad amber highlights and simplified overlapping feather groups. Preserve the folded wing's visual language. No heavy black outline, no finger-shaped feather lobes, no deep cuts between feathers, no photographic texture. Canvas aspect 128:112, untrimmed normalized 128×112 cell, all coordinates in that grid. Only wing pixels; omit bird body, head, eye, beak, tail, feet, labels, guide lines, shadow. Flat uniform #00FFFF background. Shoulder root at (57,48), overlapping attachment patch x52..63 y43..53. Virtual foot anchor (64,100), ground y100 remain invisible registration landmarks. Do not center or crop the part. Soft antialiased contour. Use continuous silhouette with shallow feather notches, just three broad feather group highlights. This is a new articulated wing, not a rotation of the folded wing. Frame F2: take-off high wing, fully lifted backward/upward left from shoulder root (57,48), outer tip (29,8), upper bend (42,12), lower trailing edge (43,35). Connected tapered broad wing, rounded edge, small painted overlap at root. Keep all support in x26..65 y6..54.

Do not pack either output. Full take-off group attempted; no accepted articulation parts. Later groups not started because this group failed. H1–H5, W0–W7, L1–L3, A1–A3 and necessary underpaint remain outstanding. Idle/blink/tilt remain implementer reference-rig work.

Proposed owner decision: retain timing and gates, but use designer-approved explicit pose silhouette guides, rasterized by implementer as registered edit targets containing reference-colour/texture patches, and request local wing-region edits in whole-bird context, extracting only the generated part. This is a proposed production adjustment, not approved artwork or permission to replace anatomy by code. Use built-in generation; no API purchases. First prove F1/F2 before producing later groups. If built-in local edits still cannot preserve finish, return to owner rather than accepting drift.
