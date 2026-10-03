# Shelf review follow-up, 2026-10-03

As of this follow-up, version pin: owner-accepted draft 1 (`bd869eb`), with code-internal lab/test and ignore-rule changes only. This entry supplemented the original artwork and validation records; their sandbox failure and earlier coverage limitations remained historical facts.

## Owner acceptance of draft 1

The owner's task response reported **14 of 14 Vite-only lab tests passing** on their Mac using Playwright Chromium, with no daemon. The owner accepted `christmas-comparison-1440.png` against `halloween-comparison-1440.png`: the illustrated tree, warm fairy lights and three presents matched Halloween's visual weight, scale and finish. The response explicitly covered the existing shelf tests at short desktop heights and reported acceptance including the previous holly identity baseline. The exact Chromium build and absolute screenshot paths were not supplied; none were invented here. This resolved draft 1's sandbox-blocked browser/visual acceptance. The owner's optional pool-of-light suggestion was nonblocking and was not implemented because design 1 remained the target.

## Review changes

Bram's coverage finding was addressed with a frozen, lab-only `LegacyChristmasShelf.svelte` reproducing the pre-change holly import, 48×32 rendering, 22px top padding, classes and click-through styling. The synthetic scene exposed it through `/lab/scene.html?theme=christmas&clock=manual&shelf=holly`; production used no legacy branch.

The identity test removed both short-height exclusions. It measured the original holly rectangle first, then Christmas, Halloween and theme-none at **1440×900, 480×900, 760×900, 761×900, 1440×640 and 1440×641**. Every viewport had strict rectangle equality assertions against the original holly, Halloween and theme-none, with no skips, adjusted offsets or accepted movement. Measured rectangles were attached as JSON before assertions so any failure would identify the actual difference. Existing placement, visibility, real pointer-click, animation and reduced-motion tests remained intact. No production shelf, rail, identity, snow or robin code changed in this follow-up.

These strengthened browser assertions were **not executed locally**. The previous localhost `EPERM` restriction was not retried, as requested by the review. Draft 1's owner acceptance did not establish that newly added assertions passed. Owner execution of the new identity test was therefore still required; any detected movement required a fix or an explicit requirement exception before claiming criteria 7–8 complete. No exception had been requested or assumed.

Bram and Odile's generated-file findings were addressed by deleting all four `design-docs/christmas/__pycache__/*.cpython-314.pyc` files and adding repository-wide `__pycache__/` and `*.pyc` ignore rules. A repository-wide file search found no other `.pyc` files outside dependencies. Offline tests ran with `PYTHONDONTWRITEBYTECODE=1` to avoid regenerating them.

## Checks

`GOPROXY=off GOSUMDB=off go vet ./...` and `GOPROXY=off GOSUMDB=off go test ./...` passed. `npm --prefix internal/dashboard/ui run check` passed with zero errors and the same three existing warnings. `npm --prefix internal/dashboard/ui run test` passed all **363 tests** in 32 files. `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s design-docs/christmas -p 'test_*.py'` passed all **13 tests**. A mistaken initial `npm run check` from the repository root failed because that directory had no package; the corrected prefixed command above passed.

Playwright test discovery used only `playwright.lab.config.ts` with `--list`, without a server or browser: all 15 lab tests were discovered, including both shelf tests in a targeted second listing. Both final `make dashboard` builds passed and had identical filenames and SHA-256 hashes; the entire resulting bundle also matched draft 1's accepted bundle. The comparison was recorded in `2026-10-03-shelf-followup-builds.json`. Runtime artwork and composition remained identical to the accepted draft. A final repository search found no `.pyc` files outside dependencies. No daemon, API, deployment, network call, commit or branch operation was performed.

To execute only the new browser coverage on the owner's machine: `cd internal/dashboard/ui && npm exec -- playwright test --config playwright.lab.config.ts shelf.spec.ts`. This command used the Vite-only configuration; its identity JSON attachments would provide the missing automated baseline evidence.
