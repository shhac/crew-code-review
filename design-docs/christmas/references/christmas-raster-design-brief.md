# Current design: Christmas illustrated raster replacement

This is a generation and implementation brief, not delivered production artwork or acceptance. CCR-3 is recorded landed/done. Preserve its mechanics and all existing tests. Preserve design-docs/christmas/christmas-current-design.svg byte-for-byte.

## Visual choice
Use a right-facing European robin with russet breast/face, umber back, ivory belly, small charcoal beak and glossy dark eye. Match Halloween's dark contours, softly shaded volumes and broad upper-left warm highlights. The actual references are stylized illustrations, not photorealistic paintings: do not add fine feather noise, hard photographic lighting, halos or large mascot eyes. Holly has two toothed deep-green leaves and three muted red berries, warm cream glints and shaded undersides. No hats, particles, cast shadows outside the objects, extra decorations or new composition.

## Exact references
Shared style set S, used for EVERY generation:
- design-docs/halloween/pumpkins.png: warm orange shading, outline and highlights.
- design-docs/halloween/candles.png: warm ivory palette and restrained highlights.
- design-docs/halloween/spider-body-side.png: dark contours and rounded shaded finish.
- internal/dashboard/ui/src/lib/theme/halloween/pumpkins.webp
- internal/dashboard/ui/src/lib/theme/halloween/candles.webp
- internal/dashboard/ui/src/lib/theme/halloween/spider-body.webp
The shipped WebPs show actual small-scale finish; ignore their historical magenta fringe and ignore the originals' magenta backgrounds.
Composition set C: design-docs/christmas/christmas-current-design.svg, specifically robin-base plus robin-perch, robin-alert, robin-flight or holly as appropriate. Use a rasterized symbol guide as composition input where the image tool cannot consume SVG. Retain that guide alongside its SVG source and exact rasterization command/version.

## Deliverables and alignment
Five runtime files in internal/dashboard/ui/src/lib/theme/christmas/:
robin-perch.webp, robin-alert.webp, robin-flight.webp (BODY ONLY), robin-flight-wing.webp, holly.webp.
The extra fifth WebP is necessary: a flattened flight bird would rotate its body or lose the accepted independent-wing motion.
Each robin layer is an untrimmed transparent 128x112 cell. Common foot anchor (64,100), scale .35, rendered cell 44.8x39.2, rendered anchor (22.4,35). Master faces right. Mirror the WHOLE assembly once with CCR-3's existing outer transform; never mirror individual layers or swap facing anchors.
Holly remains untrimmed 96x64, baseline y55, displayed 48x32 (baseline 27.5), existing centered rail placement/padding/shared theme-shelf contract unchanged. Narrow/short rail hiding remains intentional.

Perch/alert should share body, feet, head and beak registration; alert differs subtly in eye/brow attention, as the original, not by standing taller. Flight shares that same base body; replace only the folded wing with a separate raised near wing. No new tail or leg pose.

## Generation prompts
Use built-in image generation with transparent_background=true. Supply S and the named C symbol guide. Each prompt is COMMON plus the exact variant below; record both verbatim, actual inputs and each refinement.

COMMON:
"Create one isolated illustrated raster sprite on genuine transparent RGBA. Match the supplied Halloween pumpkins, candles and spider-body references: confident dark warm-charcoal contours, softly blended painterly shading, simple rounded volumes and broad restrained warm upper-left highlights. Match their small-scale finish, without copying their magenta backgrounds. No text, ground, external cast shadow, glow, hat, snow or decoration. Follow the supplied Christmas composition guide for silhouette and registration. Draw clean antialiased alpha edges with no colored matte. Treat coordinates as a normalized design grid; exact final canvas alignment will be checked during export."

PERCH, refs S + C robin-base/robin-perch:
"One right-facing European robin, warm umber back and folded wing, russet orange face and breast, ivory belly, small dark beak and one glossy dark eye. In a 128x112 cell: body center (65,61), head center (84,38), beak tip near (115,44), tail left near (12,55). Two fine brown feet end at baseline y100, together centered about x64, toes near x51..77. Preserve the guide's proportions and silhouette. All art above or on y100. Leave the cell untrimmed. Feather groups must remain legible at 44.8x39.2, without photographic feather texture."

ALERT, refs S + C robin-alert + accepted aligned perch original:
"Derive the alert robin from this exact accepted perch character. Keep the body, folded wing, head, beak, feet, silhouette and registration fixed. Add only the supplied alert guide's subtle attentive eye/brow expression. Same right-facing 128x112 cell and foot anchor (64,100). No taller posture, new feathers, symbol or motion mark."

FLIGHT BODY, refs S + C robin-base/robin-flight + accepted aligned perch original:
"Derive this exact robin's flight body. Preserve the base head, breast, belly, tail, feet and coordinates. Remove the folded near wing; leave continuous shaded body beneath the future separate raised wing, with no hole or cutout. Do not paint any raised wing into this body layer. Right-facing untrimmed 128x112 cell, foot anchor (64,100), no art below y100. Match the character's established shading and contours."

FLIGHT WING, refs S + C robin-flight raised-wing guide + accepted aligned perch and flight-body originals:
"Draw ONLY the robin's raised near wing as a transparent overlay, no body, eye, tail or feet. Match the accepted robin's umber feather groups, dark outline and warm highlights. Use the SAME untrimmed 128x112 cell and exact guide placement: root overlaps the shoulder near (64,57), silhouette follows M51 59 Q28 38 29 7 Q50 15 72 47 L74 62 Z. Keep feather detail inside that silhouette. The root needs painted overlap onto the continuous body so rotating this layer five degrees either way opens no seam. Do not center or tightly crop the wing. No baked background or drop shadow."

HOLLY, refs S + C holly:
"One holly sprig in the supplied 96x64 composition: two spreading toothed deep-green leaves, three muted crimson berries around (43,36), (55,38), (49,47). Match Halloween's shaded illustrated finish with warm cream glints and restrained vein detail. Preserve leaf silhouettes, baseline y55 and empty margins. No bow, extra berries, snow, sparkle or shadow beyond the silhouette. Read clearly at 48x32."

Generation does not guarantee pixel coordinates. Inspect and align deterministically, or regenerate if substantial warping would be needed. Do not accept a beautiful illustration that violates the footprint.

## Raster flight rendering
Keep the existing .robin outer box, position, scaleX(dir), anchor and --wing value unchanged. Inside flight only, use an absolutely positioned native 128x112 stage scaled .35 about (0,0). Stack the 128x112 body image first and same-size wing image second. Wing keeps class raised-wing, transform rotate(var(--wing)), transform-origin 64px 57px and transform-box border-box. The stage owns .35 scaling; images do not also scale. This preserves the literal pivot and applies CCR-3's existing wing angle to only the wing.
A native-grid SVG wrapper containing two raster <image> elements is also geometrically valid, but prefer the HTML stage to avoid raw-SVG injection and keep the assets as imported Vite URLs.
Keep pointer-events and aria-hidden inherited from the accepted decoration. No timers, route model, snow or layout changes.

CCR-3's swept envelope relative to the feet is x[-24,+24], y[-37,0] before flight rise. For each direction and every angle in [-5,+5], all rendered nonzero-alpha artwork must remain inside it. Test after transforms, including filtered edge support; feet cannot paint below the floor. Native cells supply ample horizontal clearance; the wing needs margin at the top during rotation. Do not enlarge the collision envelope or clip offending art as a shortcut.

## Reproducible export
Halloween's README specifies cwebp but no quality flags; do not invent historical settings. Continue its standalone imported WebP convention, adding these explicit settings for Christmas:
- Save untouched generator PNG originals outside the embed tree in design-docs/christmas/originals/.
- Save aligned canonical RGBA PNGs separately in design-docs/christmas/aligned/.
- Work in sRGB, straight RGBA. Preserve direct generated transparency; no magenta key or despill.
- For any resampling, filter premultiplied RGBA then unpremultiply into straight RGBA; avoid dark or colored edge fringes. Preserve partial alpha. Keep a documented deterministic scale/translation per source, with exact tool versions. No autocrop, quantization, background flattening or optimizer that trims margins.
- Pad to the exact logical cells. Keep body/wing on a common canvas throughout processing. Inspect alpha over dark dashboard, white and checkerboard backgrounds.
- Pin libwebp/cwebp 1.6.0 (available here): cwebp -lossless -q 100 -m 6 -exact -metadata none aligned/NAME.png -o NAME.webp
- Lossless encoding preserves RGB and alpha; -exact preserves transparent RGB. Color conversion must happen before encoding; no ICC metadata is embedded.
- Record dimensions, anchors, SHA-256 hashes, actual generator/tool identity, generation date, complete prompts/refinements, reference paths/hashes, alignment commands and encoder version. Retain generated originals, rejected refinements needed to explain choices, and the original SVG. Keep large originals outside internal/dashboard/assets.

## Validation and evidence for the implementation
This brief has not run browser, screenshot, Go or frontend acceptance and has not exported production sprites.
Use npm run dev and /lab/scene.html only. Compare Halloween and Christmas side by side in matching browser windows at 1440x900 and 480x900, with a repeatable seed/manual clock, controls moved out of the capture area. Inspect both rendered-size scenes and magnified sprites. All three poses, both facing directions, flight at -5/0/+5 degrees: inspect contour weight, palette, light, seam closure, clipping and identical foot registration. Confirm hopping still uses perch art.
At desktop inspect holly in the real rail above identity. At narrow confirm shelf stays hidden. Add a lab-only inspection fixture with isolated holly at its unchanged 48x32 size, alongside Halloween shelf assets; do not override production responsive CSS.
Run existing Vite-only playwright.lab.config.ts geometry/interaction checks, all relevant Christmas and shared/Halloween frontend tests, go vet ./..., go test ./..., npm run check, and make dashboard. Build again and compare generated filenames and SHA-256 hashes. Do not use default playwright.config.ts or npm test:e2e because that configuration boots the daemon.
Add asset-focused regressions without changing existing tests: exact decoded WebP dimensions and alpha, all runtime poses load raster sources, flight renders separate body/wing, unchanged outer bounds/anchors and holly size, and transformed alpha envelope/pivot/mirror alignment. Demonstrate each regression fails for the corresponding missing/wrong asset or rendering mutation. New tests must check actual decoding/rendering rather than only filename strings.
Acceptance log must identify commit, commands, exit statuses, browser/version, viewport, facing/pose/angle/time, screenshot paths and reviewer observations. Historical CCR-3 acceptance does not accept these new assets. If a Codex role encounters EPERM binding localhost, record the exact attempted command/error and assign browser/screenshot acceptance to the owner on an unrestricted machine. Never mark it passed without actual evidence. No daemon, API, production data or integrations.

## Scope
Only generated art, minimal asset loading/rendering, regenerated dashboard bundle and artwork documentation. Any synthetic inspection must remain lab-only. Preserve snow, behavior, timings, route safety, reduced motion, geometry and existing tests.
