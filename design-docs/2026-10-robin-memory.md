# Robin memory investigation, 2026-10-05

The reported browser crash was not reproduced. Headless Chromium showed no
unbounded retained-memory growth in the current dashboard renderer. This does
not establish the cause of a crash in Zen or another desktop browser.

## Findings and fixes

The lab's nested `{#key manual}` wrapper retained two detached text nodes per
theme mount. Thirty remounts added 60 nodes. Heap snapshots traced the nodes
through the lab's `manual` source reactions into the keyed branch closures.
Replacing that wrapper with explicit manual/real-clock branches stopped the
growth: thirty further remounts added zero nodes or event listeners. The
production dashboard does not use this wrapper.

The Christmas layer rebuilt snow samples and both SVG paths on every robin
frame, even for stationary snow. Each mounted snow cap now keeps one previous
drawing, invalidating on sample or foot-position changes. Wiped snow updates
at 10 Hz and settles once its remaining depth change is below .001 px. The
cache is owned by the cap and disappears when the cap unmounts.

The animation frame, layout observer, pointer listeners, reduced-motion and
visibility listeners, and geometry interval have matching cleanup. Flight
distance tables use weak keys; they do not retain expired routes. Production
robin components total approximately 11.5 MiB of decoded RGBA pixels before
browser-specific raster/compositing overhead; the original large PNG sources
are not shipped as runtime components.

## Measurements

Tests collect garbage before recording the JavaScript heap and DOM counters.
Warm-up precedes measurements to avoid counting initial image decoding,
renderer templates and module compilation as leaks.

| Check | Before | After |
| --- | ---: | ---: |
| Built dashboard: 12 simulated minutes, heap bytes | 3,360,600 | 3,490,960 |
| Same run: DOM nodes / listeners | 622 / 35 | 622 / 35 |
| Ten more History/Logs round trips, heap bytes | 4,118,336 | 4,190,788 |
| Same navigation batch: nodes / listeners | 779 / 37 | 779 / 37 |
| Another ten round trips, heap bytes | 4,190,788 | 4,188,780 |
| Lab: 30 unmounted theme cycles, nodes / listeners | 523 / 36 | 523 / 36 |
| Same lab cycles: browser process RSS bytes | 383,893,504 | 391,544,832 |

The accelerated animation sessions run for tens of seconds of wall time;
they exercise repeated behavior and retain real browser rendering/polling.
They are not an hours-long desktop-browser or GPU-memory soak. RSS includes
all processes in the isolated browser and varies with raster caches and GC.

## Reproduce

From `internal/dashboard/ui`, with the lab's port 5179 available:

```sh
npx --no-install playwright test -c playwright.lab.config.ts lab-tests/robin-memory.spec.ts
npx --no-install playwright test e2e/christmas-memory.spec.ts
```

Both use Playwright's dedicated headless shell. The dashboard test builds the
embedded bundle and starts a scratch daemon with discovery and reviews off.
It never opens the user's desktop browser or uses the production store.
The specs print memory measurements and attach JSON to the test result.
