# Robin animation production status

2026-10-04: production idle and blink ship under the owner's final-round scope
(note 6). This supersedes the conditional generation prerequisite. Remaining
articulation and generated-frame cleanup are proposed in FOLLOW-UP.md. Earlier
isolated-part failures are not counted as local-edit trials.

## Shipped inventory and behavior

Six accepted reference-rig cells I0–I3/B1–B2, measured reports, labelled contact
sheets and GIFs are linked by accepted/complete.json. Source, guide, masks, scripts
and pinned tools are hash-recorded. I0 decodes pixel-for-pixel to robin-perch.webp.
Breathing preserves fixed head, wing, tail and feet. Blink changes bounded eye RGB
only, with unchanged alpha. T1/T2 fail the neck-seam gate and do not ship.
The index retains 40 earlier generated attempts, available exact provenance and
explicit missing historical evidence. Generated originals/rejects remain attached
outside runtime; none is silently promoted.

RobinArt and ChristmasLayer consume the production manifest and lossless atlas.
Actual bytes are hashed, decoded and dimension-validated; rendering uses verified
blob snapshots. Invalid manifests, missing/corrupt sheets and decode failures select
the independent neutral reference without extending movement. Teardown aborts
loading and releases URLs.

Breathing displays I0 I1 I2 I3 I2 I1 at 200ms, exactly 1200ms. Blink displays
I0 B1 B2 B1 I0 at 60/40/70/40/90ms. Neutral variation boundaries stay within
4–8 seconds. Cosmetic randomness is independent of movement. Movement and alert
preempt cosmetics; layout, visibility, preference changes and teardown reset epochs.
Reduced motion selects I0 only. Routes, placement, scale and whole-bird mirroring
are unchanged. Existing hop/flight/alert reference sprites and flight wing behavior
remain as explicitly directed by the narrowed scope.

ship-rig.py supplies decoded geometry, fractional-alpha, identity, anchor and
reference-material RGB diagnostics; private staging, locking, immutable files and
manifest-last publication. Reference-interpolation limits are calibrated engineering
gates, not CIEDE2000 research or generated chroma cleanup. Those requirements move
to the dependent task. See README.md for generation/rig, rejection, packing,
playback, recovery, previews and reuse instructions.

## Finding audit

- Production playback: done for scoped idle/blink; remaining articulation deferred.
- Accepted artwork/workflow: six reference-rig cells ship; rejected tilt split off.
- Cleanup/research/calibration: reference reports/gates done; generated chroma/CIE work deferred.
- Production sheets/recovery: done for shipped inventory and independent neutral fallback.
- Production regressions: done offline; browser regressions supplied, Vite startup refused.
- Previews/workflow: both shipped clips done; seven other previews deferred.
- Owner package: scoped production Vite scene/rig lab ready; no browser acceptance claimed.
- Reproducible labs: committed evidence replaces ignored rig-draft prerequisites.
- Unrelated changes: scheduler, claim/reconciliation and CLI/pricing test changes removed;
  scheduler files restored to the project checkout; CLI/pricing tests now restored
  to the specified review base 4b93bddae51b48653552f0981d195201a3fdc37c.
  Draft 8's claim that the project checkout restored those two files was incorrect.
  Landed seasonal dependency changes are retained.
- Status/handoff: consolidated; superseded generation prerequisite labeled historical.

## Criteria and plan audit

1. Required run_check passes: Go vet, all Go tests and Svelte check (0 errors,
   3 existing warnings). The owner-enabled loopback setting applies to this check.
2. Controller, loader, decoded production pixels and publication regressions pass.
   Frozen idle mutation fails 3 tests; unchecked sheet mutation fails 2. Both restored.
3. Changes are limited to robin animation, evidence, labs and required built assets.
4. Production idle/blink replacement done; movement art retained by final owner scope.
5. Idle/blink done; rejected tilt and remaining articulation deferred.
6. Authorized reference-rig exception applied; no new Codex generation claimed.
7. Reference registration/scale/palette reports and rejection done; generated matte
   cleanup and researched CIE tolerances deferred without claiming compliance.
8. Shipped atlas/manifest/runtime recovery done; broader inventory deferred.
9. Positive exact timing, ordinary wrapping seam and one-shot completion tested.
10. Both shipped clips have contact sheets/GIFs and reusable documentation;
    remaining previews follow the deferred art. Tree lights/spider unchanged.
11. Final owner scope respected: only reference idle/blink ships, rejected tilt
    and remaining articulation/cleanup deferred, unrelated Go changes removed.

Plan provenance: shipped rig evidence done; historical missing prompts explicit.
Plan generation: deferred by final scope; designer/network unavailable here.
Plan cleanup: reference gates done; generated chroma stage deferred.
Plan tolerance research/calibration: reference limits documented; generated CIE research deferred.
Plan packing/previews: done for both shipped clips.
Plan atlas integration: done for idle/blink, preserving legacy movement art.
Plan idle variations: breathing/blink done; tilt deferred after seam rejection.
Plan movement timing: routes unchanged, earlier timing repairs retained.
Plan alert/lifecycle: existing alert preemption and lifecycle resets integrated;
new illustrated alert turn deferred.
Plan labs: production timelines, reference overlay and clean-checkout fixtures done.
Plan documentation: current workflow and dependent articulation handoff done.
Plan regressions: controller/loader/pixels/publication done; browser execution blocked.
Plan checks/builds: local frontend/raster checks pass; reproducible bundle rebuilt;
hosted project check passes; direct sandbox Vite binding still fails.
Plan owner review: exact scoped draft ready in /lab/robin-rig.html and /lab/scene.html;
post-landing visual acceptance remains the owner's check.

## Validation

400 frontend tests pass; local Svelte check: 0 errors and 3 existing warnings.
31 animation Python tests pass and cover committed pixel fidelity, fractional alpha, collision
bounds in both facings, identity/palette rejection, repeat publication, changed
inventory interruption, failed export and competing publishers. Two dashboard
builds have identical filenames/hashes; the accepted atlas is embedded.
Both frozen-idle and unchecked-sheet mutations fail their regressions and are restored.
Playwright lab tests were attempted through the prescribed Vite configuration;
startup fails with listen EPERM 127.0.0.1:5179. No browser pass or screenshot claimed.
Latest run_check exits 0 without timeout: Go vet/tests and Svelte check pass.
The direct implementation-sandbox Playwright attempt still cannot bind Vite.

## Draft 9 repairs

CLI/pricing tests match the actual specified review base, correcting the prior
restoration claim. Immutable accepted files are written and fsynced in private
staging, then atomically published; partial-write injection proves retry recovery
and preservation of the preceding manifest. Silent short writes are also rejected
before atomic publication by the shared packer. Both GIF exporters now use Background
disposal. Regenerated previews are tested after coalescing for identical alpha
and visible pixels, preventing obsolete contour accumulation. The full 31-test
animation suite passes; after the shared short-write verification change, all
6 shipping tests and 9 packer tests also pass. Direct-final-write and undefined-
disposal mutations both fail their regressions. Repeat pipeline output has
identical filenames/hashes; the dashboard rebuild succeeds.

## Historical drafts 1–7

Earlier timing/controller/manifest/guide/packer foundations and failed generation
rounds remain provenance, not current production acceptance. Earlier fifteen-original
inventories, empty accepted inventories, complete-bird idle regeneration instructions,
conditional generation prerequisite and npm crashes are superseded by this scope,
inventory and validation record. Detailed history remains in the task record.
