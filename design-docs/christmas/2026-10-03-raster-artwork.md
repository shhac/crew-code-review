# Christmas illustrated raster replacement (2026-10-03)

As of the uncommitted CCR-4 task working tree, CCR-3 was landed/done. Its
accepted mechanics and historical acceptance record were not changed. No commit
was created or Git metadata accessed. The tested artwork/source revision was
content-pinned in `2026-10-03-artwork-manifest.json`; its SHA-256 was
`a7902f5d7e913eed5bf24ecf54445eced2f4ba4f19cf418feb8373da3536bd15`.
This record did not accept browser rendering or screenshots.

## Sources and finish

Juniper's five untouched image-generated originals were retained in `originals/`.
The approved brief, supporting study, study provenance and exact generation
prompts/actual inputs were preserved verbatim in `references/`. The generation
tool was `image_gen.imagegen`, with genuine transparency requested; its underlying
model/version was not exposed. The generation record stated that no generated
variants were rejected, and documented the failed seven-reference invocation
which produced no image. It also documented the actual reference-limit deviations:
not all six Halloween references could be supplied to every call, composition
coordinates were transcribed rather than supplied as rasterized SVG guides, and
derived poses used the unaligned perch. No later rasterization was represented as
a historical generation input.

The original composition SVG stayed unchanged, SHA-256
`be2c96e5ae2f97a33d9b4c80abcf00169ebaf41b60a7b6e0c025eb7fd3394e7f`.
The former runtime SVG files were also retained as unused composition references.
Halloween originals and shipped WebPs were unchanged. The manifest pinned the
reference, original, aligned, runtime and relevant source hashes.

Static inspection of the supplied originals and shipped Halloween sprites showed
the intended dark contours, warm highlights and rounded shaded volumes. The
flight composite was inspected on a dark background in `aligned/flight-preview.png`.
That file was a nearest-neighbor 4× export preview, not a browser screenshot.
Small-scale readability, the alert brow's prominence, holly's brighter berries
and final style matching remained owner visual-acceptance decisions.

## Deterministic alignment and export

Tools actually used: ImageMagick **7.1.2-32 Q16-HDRI aarch64**, cwebp **1.6.0**
(libsharpyuv **0.4.2**). No installation, network, chroma key, despill, palette
quantization, silhouette clipping or background flattening was used for the
production sprites. All originals were already sRGB. ImageMagick's alpha-weighted
EWA Triangle distortion resampled premultiplied color and returned straight RGBA.
The output was written as 8-bit RGBA before lossless WebP encoding. Canonical PNG metadata was stripped to avoid timestamp-dependent exports.

| Layer | Uniform source scale | Translation into native cell |
| --- | --- | --- |
| perch | .09 | (-7.37, 1.59) |
| alert | .09 | (-7.37, 1.59) |
| flight body | .09 | (-7.37, 1.59) |
| flight wing | .085 | (3, -4) |
| holly | .0625 | (0, -.5) |

The three bodies used the same affine registration. The source toe span was
centered around source x793; this mapped to native x64. Conservative filtered foot
support ended at y99.5, within half a native pixel of the y100 anchor (.175 display
pixels). The wing's painted root surrounded the fixed (64,57) pivot; a seven-pixel
square of body and wing overlap had alpha greater than 240. Holly's filtered
baseline support ended at y54.5, within half a native pixel of y55. Cell dimensions,
outer foot anchors and placement remained literal constants from the approved
design, rather than being inferred from cropped image bounds.

The exporter first rendered onto a roomy 384×336 canvas with the target cell
offset by (128,112). It verified every exported nonzero-alpha pixel was inside
the target cell before padding to 128×112 (robin) or 96×64 (holly). This avoided
using cell clipping to hide bad alignment. Temporary outputs were decoded and
validated for all five layers before any canonical or runtime file was replaced.
Run only one exporter/build writer at a time. After interruption, rerun the entire
export and validation; `--ship` never promoted an incomplete set.

Reproduction from the repository root:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 design-docs/christmas/export-artwork.py --ship
PYTHONDONTWRITEBYTECODE=1 python3 design-docs/christmas/validate-artwork.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s design-docs/christmas
make dashboard
```

The exporter recorded its exact affine command in code. Each WebP used
`cwebp -lossless -q 100 -m 6 -exact -metadata none INPUT.png -o OUTPUT.webp`.
These were explicit Christmas settings, not claimed historical Halloween flags.
Canonical PNGs and identical export WebPs were kept in `aligned/`; runtime copies
lived in the existing Christmas asset directory. Large originals stayed outside
the embedded dashboard tree. Vite inlined the small wing WebP into the bundle;
the other four Christmas WebPs were emitted as standalone files.

Rejected implementation trials: an integer `114x100!` resize with manual alpha
association/disassociation and extent offsets retained two alpha-1 pixels below
the perch's feet at row106. Box, Lanczos, Mitchell and Gaussian variants of that
pipeline also retained those pixels. It also failed transparent-margin/holly
baseline checks. These were processing trials of the same originals, not rejected
generated images. Uniform fractional EWA registration replaced that pipeline;
the final decoded five-layer set passed without alpha thresholding or clipping.

## Rendering and regressions

All runtime Christmas art imports became Vite WebP URLs. `RobinArt` rendered an
untrimmed native 128×112 stage scaled once by .35. Flight had independent body
and wing images; only the wing rotated, with border-box origin (64px,57px).
ChristmasLayer's existing placement, whole-assembly mirroring and inherited wing
angle were preserved. ChristmasShelf retained its 48×32 size, rail padding,
shared shelf class and responsive hiding. No snow/model/timing/pointer/lifecycle/
collision/reduced-motion code or existing tests were edited.

Seven offline artwork tests decoded actual WebPs, compared full RGBA with the
canonical PNGs, checked shipped copies, logical cells, transparent margins,
partial alpha, painted root overlap and the unchanged collision envelope. Every
nonzero-alpha texel included half a native pixel of bilinear support. Rotated
wing corner bounds included analytic interior extrema over the entire −5°..+5°
interval and both mirrored directions. All five exports had zero violating
pixels. Synthetic missing/corrupt, dimension, registration and interior-extremum
cases tested the validator itself.

New frontend tests rendered the actual Svelte artwork/shelf through SSR, checked
separate flight layers and compiled CSS scaling/pivot, and pinned the production
integration/outer registration. Temporary mutations of missing, corrupt, resized,
shifted and excess-alpha runtime assets each made the offline suite exit1.
Changing scale to .4, pivot to (63,57), or removing the wing image each made the
frontend artwork tests exit1. All eight mutations were restored before final
passing tests and freshness verification.

The new Vite-only `/lab/artwork.html` reused the production component. It exposed
perch/alert/flight, both directions, −5°/0°/+5° flight angles, 1×/4× detail and
dark/white/checker backgrounds beside Halloween sprites. It included isolated
48×32 holly without changing production responsive CSS. Two new lab tests checked
decoded loading, computed stage/mirror/pivot transforms, dimensions and zero API
requests, then captured matched seasonal scene windows at 1440×900 and 480×900.
They remained unexecuted because localhost binding was blocked.

## Commands and acceptance evidence

| Command | Actual result |
| --- | --- |
| `GOPROXY=off GOSUMDB=off go vet ./...` | exit0 |
| `GOPROXY=off GOSUMDB=off go test ./...` | exit0, all packages passed |
| `npm --prefix internal/dashboard/ui run check` | exit0, zero errors, three existing warnings |
| `npm --prefix internal/dashboard/ui test` | exit0, 361 tests in 32 files |
| `python3 -m unittest discover -s design-docs/christmas` | exit0, seven artwork tests |
| `python3 design-docs/christmas/export-artwork.py --ship` | exit0, all five exports decoded and validated |
| `python3 design-docs/christmas/validate-artwork.py` | exit0, zero violations in all five assets |
| lab `tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --types node --skipLibCheck lab-tests/artwork.spec.ts playwright.lab.config.ts` | exit0 |
| lab `playwright test --config playwright.lab.config.ts --list` | exit0, 13 tests discovered |
| `make dashboard`, repeated | exit0 twice; all 11 output filenames/SHA-256 hashes matched, pinned in manifest |
| lab `npx --no-install playwright test --config playwright.lab.config.ts` | exit1 before browser startup, `listen EPERM: operation not permitted 127.0.0.1:5179` |

Frontend tools were Svelte **5.56.4**, Vite **7.3.6**, Vitest **4.1.10** and
Playwright **1.62.1**. The Playwright command launched only
`npm run dev -- --port 5179 --strictPort`. No daemon or API was started/accessed.
No browser version, screenshot acceptance or pixel comparison was measured.
Historical CCR-3 acceptance was not reused to accept the replacement art.

Owner acceptance remained explicit: from `internal/dashboard/ui`, run the lab
Playwright command above on a machine allowed to bind localhost. Review
`test-results/**/artwork-1440.png`, `artwork-480.png`,
`halloween-comparison-{1440,480}.png`, `christmas-comparison-{1440,480}.png`, and
the existing Christmas pose/interaction captures. These were planned output
paths, not files claimed to exist. Inspect both scene windows side by side at
1440×900 and 480×900; use the static artwork fixture for every pose/direction/
angle, magnification and background, and isolated narrow holly. Record the tested
manifest/revision, browser/version, actual screenshot paths, manual time0/seed,
poses/directions/angles and reviewer observations. Check wing seams/clipping,
foot alignment, alert subtlety, muted berry palette, desktop shelf placement,
narrow/short shelf hiding, hop/perch art and interaction geometry.

## Criterion audit

| Criterion | Outcome as of this record |
| --- | --- |
| 1: Go vet/test and svelte-check | Passed |
| 2: tests fail without change | New render/asset regressions and eight restored mutations passed sensitivity checks |
| 3: task-only scope | Artwork, minimal rendering, new lab fixtures/tests, artwork tooling/docs and regenerated bundle only |
| 4: Halloween finish | Generated from documented Halloween references; final small-scale visual match assigned to owner |
| 5: wait for CCR-3; preserve mechanics | Landed dependency verified through task record; mechanics and existing tests untouched |
| 6: designer generation and WebP convention | Five supplied Juniper originals retained; five transparent lossless WebPs exported |
| 7: cells/anchors/scale/mirroring/wing/holly | Preserved; decoded continuous-envelope, SSR and CSS checks passed; computed browser checks pending |
| 8: all runtime SVG uses replaced; provenance | WebP imports everywhere; original SVG/study/generation records preserved |
| 9: regeneration documentation | Exact actual generation prompts/references, hashes, tools, affine transforms and encoder flags retained |
| 10: lab comparisons/geometry/interaction/freshness | Existing pure checks and freshness passed; Vite browser/visual checks assigned to owner after EPERM |
| 11: accurate browser evidence | No browser/screenshot pass claimed; owner acceptance explicitly outstanding |

The rough planning file estimate grew because originals, canonical/export pairs,
actual provenance, offline validation and the isolated comparison fixture were
retained. Product scope did not grow; no extra behavior, integrations or layout
changes were introduced.
