# Generated idle strip

## Flying generation preparation (CCR-16)

The flying guide uses accepted atlas I0, rather than the historical perch:

```sh
python3 design-docs/christmas/animation/strip_pipeline.py prepare \
  --reference design-docs/christmas/animation/idle-strip/review/canonical.png \
  --output design-docs/christmas/animation/flying-strip
```

`flying-strip/guide.png` repeats the canonical at its existing registration and
scale, without cropping its transparent padding. Ghosts and guide marks are
registration aids only; idle wings and planted feet do not constrain flight.
`guide-contract.json` records the reference, dimensions and native transform.
For the original eight-slot guide-layout mode, S/128 = H/112.
`extract(..., registration="canonical-layout")` records actual source dimensions,
slot boundaries, uniform source-to-native scale and virtual anchor. Sampling uses
pixel centres: source = (native + .5)/scale - .5. All slots share that mapping.
Feet and wing bounds never determine flying registration. Source clipping is
rejected before resampling; native four-pixel margins remain mandatory.
Idle remains the default registration mode. Generated-row extraction now finds
connected birds rather than cutting equal slots; the accepted shipped idle
pixels and metadata are preserved when flying is published.

The owner's revised instructions supersede aspect-ratio rejection and the
eight-phase generation requirement. Generate four to six phases, tucked feet,
one facing and no closing duplicate. Ordered references are accepted canonical,
shipped flight body (pose reference), guide (registration only), shipped wing
(feather context). Geometry belongs to extraction; content and motion determine
acceptance. Do not apply the idle silhouette-height/foot-baseline extraction to
flight. Do not apply the old guide-layout ratio test to padded generated art.

### Revised flying attempt 1

The original PNG and exact Juniper prompt/settings/reference hashes are retained
as `flying-strip/source-revised-attempt-1.png` and
`provenance-revised-attempt-1.json`. The historical rejection remains unchanged
in provenance. The owner subsequently reviewed the original, accepted its
identity and tucked feet, and judged its up/swept/folded/rising poses a plausible
small-bird flap and acceptable fallback. That is source-content support, not
an extracted-loop or production-join verdict.

The latest owner instruction selects retained revised attempt 1 and closes
generation. `provenance-revised-attempt-2.json` retains the exact prompt and
Juniper's static rejection for extended legs/spread toes, but its original was
not retained; comparison is
impossible. The earlier empty hand-off alone is not evidence of rejection.
No further asset request or comparison is required. Future production hand-offs
must attach every original raster.

Juniper's design 6 review finds static identity satisfactory for lab review:
tucked feet, attached near wing, plausibly occluded far wing, no obvious swapped
or doubled parts. She withdrew the rejection based solely on folded-pose
similarity and retained the shared transform provisionally. Compact flying
posture is not grounds for silhouette fitting. Her timed-motion and join verdicts
remain historical UNOBSERVED observations: her viewer showed only a GIF still.
The owner subsequently accepted draft-3 loop motion in both facings, rejected
canonical scale at approximately 70–75% of idle neutral, and deferred join review
until extraction, scale and two ambiguous lab selectors were fixed. These are
separate verdicts; owner motion acceptance does not establish scale or joins.
`review-attempt-1/identity.json` records these separately attributed findings.

Juniper's design 8 assessment now covers the corrected .28, 142×134 candidate
(`200ee8966324de8042e267288b86015b6fb628485951b34ab94d799e12281ca3`).
She supports its static identity, compatible body scale, stable eye/beak
registration and complete wings with clear surrounding space. Exact alpha
clearance remains a pipeline result. Her image viewer showed a GIF still, so
corrected timed motion and legacy joins remain UNOBSERVED; this assessment is
design advice, not production approval. The owner's separate corrected
scale/registration, loop and join decisions remain pending. Historical reviews
are retained rather than rewritten as observations of the corrected pixels.

Reproduce extraction without generating again:

```sh
python3 design-docs/christmas/animation/strip_pipeline.py process \
  --row flying --count 4 \
  --source design-docs/christmas/animation/flying-strip/source-revised-attempt-1.png \
  --reference design-docs/christmas/animation/idle-strip/review/canonical.png \
  --transform design-docs/christmas/animation/flying-strip/transform-revised-attempt-1.json \
  --output design-docs/christmas/animation/flying-strip/review-attempt-1
```

The pipeline finds eight-connected components of cleaned alpha, ignoring
components below 100 source pixels and coverage below 2%. It requires exactly
the expected bird count, orders them left to right and rejects touching source
edges or overlapping horizontal bounds. This applies to idle and flying; the
canonical-layout mode remains an exact-guide diagnostic. Opaque specks are
removed by component size, not only by alpha. Each complete bird is sampled
within its actual box, so uneven spacing or crossing a nominal slot boundary
cannot cut a wing or import a neighbour. The transform report retains absolute
component boxes and origins. No frame-specific scale is applied.

For the selected strip the boxes begin at x=89,599,1115,1634. W0 extends to
x=554, crossing the obsolete x=537 slot cut. The owner's larger-canvas override
now permits canonical body scale without cutting the raised wing. All four
frames use .28, derived from Juniper's crown-to-belly comparison (.27–.29).
Recorded eye centres register each complete component to one common anchor;
beak-base and breast-centre landmarks corroborate the placements. These are
approximate visual measurements, pending rendered acceptance, not silhouette
fits or per-frame scales. Transparent artwork retains straight RGBA.

The union in eye coordinates, including bilinear support and four clear pixels,
produces even 142×134 flying cells. The row eye anchor is recorded in validation
and manifest, corresponding to canonical eye (97.1,26.7). Idle stays 128×112
with virtual foot anchor (64,100). AtlasFrame offsets the larger clipping window
inside the same scene footprint at unchanged .35 scale; parent mirroring remains
responsible for facing. No runtime enlargement or additional world arc is added.

Evidence is the retained original and provenance, contact.png, preview.gif
(140ms per cell), atlas.webp (flying-only sheet), unchanged canonical.png,
validation.json and identity.json. Corrected pixels invalidate earlier extracted
acceptance. Draft-3 owner motion acceptance and scale rejection remain historical;
corrected scale, loop and legacy joins remain pending, never inferred from
numerical validation. Production keeps complete legacy flight.

Frames remain temporary. `/lab/robin-timing.html` adds the exact 200ms browser
loop and the slower comparison, plus actual legacy departure/arrival angles,
both facings, native/.35 sizes and light/dark backgrounds at 450–750ms durations.
It labels its availability override as candidate inspection; production metadata
is never changed by the lab. Use its manual clock for joins and its Play checkbox
for repeated wraps. No temporal or join observation is claimed from the GIF's
first frame or contact sheet.

### Flying publication and playback

`publish --row flying` adds the logical flying row using a separate immutable sheet while holding
the publication lock. It preserves current idle pixels, metadata, timing and
independent neutral, checks the evidence canonical against that neutral, and
leaves rows 2–5 transparent. New immutable artwork precedes atomic manifest
replacement. Missing/stale reports, mismatched verdicts, concurrent writers,
failed exports and interrupted manifest writes fail without replacing active
metadata. Idle-only publication refuses to discard a populated flying row.

Without a verdict it publishes a disabled candidate, as currently shipped:

```sh
python3 design-docs/christmas/animation/strip_pipeline.py publish --row flying \
  --source design-docs/christmas/animation/flying-strip/review-attempt-1 \
  --output internal/dashboard/ui/src/lib/theme/christmas/robin-atlas
```

A flying verdict must identify the evidence atlas, name Juniper and accept the
loop; production additionally requires `joins: "accepted"`. Loop acceptance
alone leaves flying unavailable. Never turn these fields on to compensate for a
missing review. Current production retains complete legacy flight.

Current checks: 27 pipeline tests and 426 Vitest tests pass; go vet and
the daemon-hosted project check pass (Go tests, svelte-check: zero errors and
three existing warnings). Dashboard assets are regenerated. Local Playwright
still cannot start Vite: `listen EPERM 127.0.0.1:5179`. No browser-control tool
is exposed in this seat; hosted run_check provides Go/Svelte checks only.
The corrected revision still needs the complete Vite lab suite and separate
owner scale/registration, loop and legacy-join acceptance at 450/750ms in both
facings. Juniper's design 8 corrected static assessment is recorded separately
in identity.json as corrected_designer_review for atlas
200ee8966324de8042e267288b86015b6fb628485951b34ab94d799e12281ca3.
It supports identity, body scale/registration and complete wings in static
inspection; timed loop and legacy joins remain explicitly UNOBSERVED. Earlier
design 6 advice and draft-3 owner observations remain historical and do not
establish temporal acceptance of the corrected candidate.

Playback derives only articulation from the existing action clock. It preserves
legacy flight before .20D and from .80D onward; the middle fits
N=max(1,round(.60D/200)) complete cycles. Each cell lasts .60D/(count*N), without
endpoint holds, a legacy wing overlay or another world-motion arc. Unavailable,
corrupt or failed assets retain the old renderer. Reduced motion stays neutral;
interruption and skipped ticks cannot extend an action deadline.

No daemon or production data was accessed. To verify playback outside the
local socket restriction, run from internal/dashboard/ui:
`./node_modules/.bin/playwright test --config playwright.lab.config.ts`,
then review /lab/robin-timing.html with the Vite dev server. This is acceptance
of the corrected candidate, not authorization to generate again.

A corrected flying acceptance record must match both atlas_sha256 and the
complete validation transform as geometry, preventing earlier pixel or
registration verdicts from enabling a changed row.
