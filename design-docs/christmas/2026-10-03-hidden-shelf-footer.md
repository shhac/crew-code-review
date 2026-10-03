# Shared shelf footer correction, 2026-10-03

Version pin: owner-tested draft 2 (`5063992`), followed by this code-internal CSS correction. This entry supplemented the earlier artwork and review records without changing their historical acceptance or failure reports.

## Measured failure and authorization

The owner ran `npm exec -- playwright test --config playwright.lab.config.ts shelf.spec.ts` against Vite only on their Mac. Draft 2 produced one pass and one failure: `Christmas vs theme-none at 1440×640`. Their reported rectangles had y=532 with a theme and y=456 under theme-none, with x=18, width=199 and height=28 in both. The original-holly and Halloween comparisons passed. This established a pre-existing seasonal/footer difference, rather than movement caused by replacing holly with the tree. It also demonstrated that the unchanged browser regression failed without the correction.

The owner explicitly requested: “Fix it in the shared shelf, for both themes” and “Keep the test as written.” That instruction expanded this task's earlier exclusion of shared rail CSS only as needed to repair the footer bug. No new art or design alternative was introduced; the optional pool of light remained unimplemented.

## Correction

The shared breakpoint already set the shelf to `display:none`. A hidden shelf therefore generated no layout box. However, `.theme-shelf + .viewer-chip` still overrode the identity chip's normal auto margin with zero, so hiding the shelf did not restore the same free-space allocation as removing it. At the existing height≤640 or width≤760 breakpoints, the shared CSS restored `margin-top:auto` to that following chip. Both production themes and the lab's old-holly fixture received the same correction; no visibility threshold changed.

Above the hide boundary, the shared shelf's automatic minimum height could also prevent its flex allocation from shrinking, letting the larger decoration push the footer down in a cramped rail. The shared shelf received `min-height:0` and `align-items:flex-end`. This allowed its allocated space to shrink while retaining full-sized artwork against the bottom of the allocation, above the chip. On roomy rails the 105px shelf and 192×83 stage remained unchanged. The art, dimensions, light coordinates and animation, robin, snow and theme activation were not changed.

The strict `shelf.spec.ts` was retained byte-for-byte: separate measurements of old holly, Christmas, Halloween and theme-none at all six planned viewports, including 640/641px heights, were still attached before equality assertions. No skips, tolerated offsets or requirement exceptions were added. The owner-run prior failure was the behavior regression evidence; no duplicate test merely restating the CSS was retained.

## Validation and next owner step

`GOPROXY=off GOSUMDB=off go vet ./...`, `GOPROXY=off GOSUMDB=off go test ./...`, `npm --prefix internal/dashboard/ui run check` and `npm --prefix internal/dashboard/ui run test` passed. Svelte-check reported zero errors and the same three existing warnings. All 363 frontend tests passed. `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s design-docs/christmas -p 'test_*.py'` passed all 13 offline artwork/export tests. No Python caches were retained.

Final command outputs, the unchanged shelf-test SHA-256, and two full `make dashboard` build inventories were recorded in `2026-10-03-hidden-shelf-validation.json`. The second build's filenames and SHA-256 hashes matched the first. The CSS correction changed the runtime bundle, so the earlier exact-draft browser acceptance did not validate this new bundle. The supplied original, canonical PNGs and runtime WebPs remained unchanged.

Local Playwright discovery successfully listed the two shelf tests using `playwright.lab.config.ts --list`. No server or browser was started locally: the known localhost sandbox restriction was not retried, and no daemon or API was accessed. No corrected identity rectangles or passing browser result was claimed. The 641px visible-shelf behavior, along with the measured 640px failure, still required owner execution against this draft.

The requested rerun was `cd internal/dashboard/ui && npm exec -- playwright test --config playwright.lab.config.ts shelf.spec.ts`. The owner needed to retain the identity JSON attachments and report both tests' results. Any remaining original-holly movement or theme-none difference required another fix before criteria 7–8 could be claimed complete.
