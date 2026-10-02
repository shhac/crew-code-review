# Halloween decoration art (2026-10-02)

Sources for the dashboard's Halloween theme. They're kept here, outside `internal/dashboard`, so the full-size originals don't get embedded in the binary.

All images were generated on 2026-10-02 by the Codex CLI (`codex-cli 0.159.2`, model `gpt-6.1-sol`, effort high) using the built-in `$imagegen` path. Each was drawn on a solid magenta `#FF00FF` background, and `mascot-original.png` was the style reference.

| Source | Shipped as (`ui/src/lib/theme/halloween/`) | Notes |
| --- | --- | --- |
| `pumpkins.png` | `pumpkins.webp` | Rail shelf. |
| `candles.png` | `candles.webp` | Rail shelf. Generated without flames, because the page draws and animates the flames. |
| `candle-stubs.png` | `candle-stub-0/1/2.webp` | Three separate stubs that stand on the page's floors. Also flameless. |
| `spider-hanging-atlas.png` | `spider-hanging.webp` | A 2x2 sheet of four frames, aligned on the abdomen's top nub (where the silk is tied) and packed into a 1x4 strip. |
| `spider-body-side.png` | `spider-body.webp` | The walking spider's body, generated without legs. |
| `spider-leg-segments.png` | `leg-thigh.webp`, `leg-shin.webp` | Straight leg pieces that the page stretches along each moving bone. |
| `spider-walk-atlas.png` | (not shipped) | A walk cycle that was tried first. Its frames had near-identical leg poses and the far legs barely moved, so the legs are animated in code instead. Kept because it was the character reference for the body and the leg pieces. |

Every shipped file was made from its original in three steps:

1. Keyed out the magenta: alpha comes from `min(R,B) - G`, ramping between 60 and 140, with a half-strength despill.
2. Cropped to the art, or cut apart and aligned for the multi-piece sheets.
3. Exported with `cwebp`.

Some fractions are measured from the shipped art rather than set by hand: the wick tips (in `HalloweenShelf.svelte` and `HalloweenLayer.svelte`) and the silk anchor of the hanging strip. Regenerating the art means measuring them again.

The walking legs are code (`spidergait.ts`, drawn by `Limb.svelte`). Each foot plants on the floor and steps in an alternating gait driven by distance walked. Each bone is drawn with the generated leg art, mirrored where needed so its gloss faces the light. That choice is made once from the resting pose, so it can't flicker mid-stride. The webs are hand-written SVG (`Web.svelte`).
