import unittest
from pathlib import Path
import tempfile
import json
import shutil
import hashlib
from unittest.mock import patch

import strip_pipeline as pipeline


class GuideTests(unittest.TestCase):
    def test_reference_registration_in_every_slot(self):
        reference = bytearray(128 * 112 * 4)
        reference[(53 * 128 + 27) * 4:(53 * 128 + 27) * 4 + 4] = bytes([200, 80, 20, 255])
        pixels = pipeline.guide_pixels(reference)
        self.assertEqual(len(pixels), 1024 * 112 * 4)
        for cell in range(8):
            offset = (53 * 1024 + cell * 128 + 27) * 4
            self.assertEqual(pixels[offset:offset + 4], bytes([232, 199, 182, 255]))
            anchor = (100 * 1024 + cell * 128 + 64) * 4
            self.assertEqual(pixels[anchor:anchor + 4], bytes([210, 20, 150, 255]))

    def test_wrong_reference_geometry_rejects(self):
        with self.assertRaisesRegex(ValueError, "canonical"):
            pipeline.guide_pixels(bytes(127 * 112 * 4))


def fixture():
    width, height = 1024, 200
    pixels = bytearray([0, 255, 0, 255] * width * height)
    for cell in range(8):
        # Torso always has the same scale; the accessory gets wider, and
        # the last cell is raised. Neither may be fitted independently.
        for y in range(50, 143 - cell):
            for x in range(40, 80 + cell):
                off = (y * width + cell * 128 + x) * 4
                pixels[off:off + 4] = bytes([180, 70 + cell, 20, 255])
    return width, height, pixels


class ExtractionTests(unittest.TestCase):
    def test_flying_registration_ignores_tucked_feet_and_wing_bounds(self):
        width, height = 1024, 112
        pixels = bytearray([0, 255, 0, 255] * width * height)
        for cell in range(8):
            for y in range(30, 90 - cell):
                for x in range(40, 80 + cell):
                    off = (y * width + cell * 128 + x) * 4
                    pixels[off:off + 4] = bytes([180, 70, 20, 255])
        frames, transform = pipeline.extract(width, height, pixels, registration='canonical-layout')
        self.assertEqual(transform['scale'], 1)
        self.assertEqual(transform['source_anchor'], [64, 100])
        self.assertEqual(transform['slot_boundaries'], list(range(0, 1025, 128)))
        for cell, frame in enumerate(frames):
            self.assertEqual(frame[(30 * 128 + 40) * 4:(30 * 128 + 40) * 4 + 4], bytes([180, 70, 20, 255]))
            self.assertEqual(frame[(89 - cell) * 128 * 4 + 40 * 4 + 3], 255)
            self.assertEqual(frame[(90 - cell) * 128 * 4 + 40 * 4 + 3], 0)
        pipeline.validate_frames(frames)

    def test_canonical_layout_rejects_stretch_and_records_shared_scale(self):
        with self.assertRaisesRegex(ValueError, 'uniform scaling'):
            pipeline.extract(*fixture(), registration='canonical-layout')
        transform = pipeline.canonical_transform(2048, 224)
        self.assertEqual(transform['scale'], .5)
        self.assertEqual(transform['source_anchor'], [128, 200])
        self.assertEqual(transform['slot_boundaries'], list(range(0, 2049, 256)))

    def test_common_transform_preserves_width_and_virtual_root_offset(self):
        frames, transform = pipeline.extract(*fixture())
        self.assertEqual(transform['scale'], 1)
        self.assertEqual(transform['source_anchor'], [19.5, 138.5])
        bounds = []
        for f in frames:
            positions = [(i // 4 % 128, i // 4 // 128) for i in range(0, len(f), 4) if f[i + 3]]
            bounds.append((min(x for x, y in positions), max(x for x, y in positions), max(y for x, y in positions)))
        self.assertEqual(bounds[-1][0], bounds[0][0])
        self.assertEqual(bounds[-1][1] - bounds[0][1], 7)
        self.assertEqual(bounds[0][2] - bounds[-1][2], 7)
        pipeline.validate_frames(frames)

    def test_idle_alpha_components_keep_translucent_edges_without_chroma_recovery(self):
        width, height, green = fixture()
        pixels = bytearray(len(green))
        for off in range(0, len(green), 4):
            if green[off] == 180:
                pixels[off:off + 4] = green[off:off + 4]
        for y in range(50, 143):
            off = (y * width + 40) * 4
            pixels[off:off + 4] = bytes([180, 70, 20, 100])
        pixels[:4] = bytes([20, 20, 20, 255])  # Opaque dust at the source edge.
        frames, transform = pipeline.extract(width, height, pixels)
        self.assertEqual(len(transform['component_bounds']), 8)
        self.assertEqual(frames[0][(61 * 128 + 44) * 4:(61 * 128 + 44) * 4 + 4], bytes([180, 70, 20, 50]))

    def test_matte_cleanup_preserves_fractional_alpha(self):
        self.assertEqual(pipeline.clean_pixel(0, 249, 0, 255), (0, 0, 0, 0))
        # 50% red composited over green must recover red and half coverage.
        for colour in [(200, 0, 0), (30, 20, 10), (240, 230, 200)]:
            for coverage in [.25, .5, .8]:
                mixed = [round(colour[c] * coverage + [0, 255, 0][c] * (1 - coverage)) for c in range(3)]
                recovered = pipeline.clean_pixel(*mixed, 255, colour)
                for actual, expected in zip(recovered, [*colour, round(255 * coverage)]):
                    self.assertAlmostEqual(actual, expected, delta=3)
        self.assertEqual(pipeline.clean_pixel(100, 20, 10, 0), (0, 0, 0, 0))

    def test_nearby_foreground_estimator_recovers_toe_and_feather_edges(self):
        width, height = 24, 24
        for colour in [(200, 0, 0), (30, 20, 10), (240, 230, 200)]:
            pixels = bytearray([0, 255, 0, 255] * width * height)
            for y in range(5, 19):
                for x in range(5, 19):
                    coverage = .5 if x == 5 else .8 if x == 6 else 1
                    off = (y * width + x) * 4
                    pixels[off:off + 4] = bytes([round(colour[c] * coverage + [0, 255, 0][c] * (1 - coverage)) for c in range(3)] + [255])
            cleaned = pipeline.clean_rgba(width, height, pixels)
            for x, coverage in [(5, .5), (6, .8)]:
                off = (12 * width + x) * 4
                for actual, expected in zip(cleaned[off:off + 4], [*colour, round(255 * coverage)]):
                    self.assertAlmostEqual(actual, expected, delta=3)

    def test_vertical_source_clipping_is_rejected_before_resampling(self):
        for y in [0, 199]:
            width, height, pixels = fixture()
            for yy in range(0, 51) if y == 0 else range(141, 200):
                for x in range(55, 65):
                    off = (yy * width + x) * 4
                    pixels[off:off + 4] = bytes([180, 70, 20, 255])
            with self.assertRaisesRegex(ValueError, 'Source clipping'):
                pipeline.extract(width, height, pixels)

    def test_wrong_count_empty_slot_and_source_clipping_reject(self):
        with self.assertRaisesRegex(ValueError, 'eight'):
            pipeline.extract(*fixture(), count=7)
        width, height, pixels = fixture()
        for y in range(height):
            start = (y * width + 7 * 128) * 4
            pixels[start:start + 128 * 4] = bytes([0, 255, 0, 255] * 128)
        with self.assertRaisesRegex(ValueError, 'exactly 8 bird components; found 7'):
            pipeline.extract(width, height, pixels)
        width, height, pixels = fixture()
        for x in range(41):
            for y in range(55, 65):
                off = (y * width + x) * 4
                pixels[off:off + 4] = bytes([180, 60, 20, 255])
        with self.assertRaisesRegex(ValueError, 'clipping'):
            pipeline.extract(width, height, pixels)

    def test_validation_rejects_clipping_key_guide_duplicates_and_hidden_rgb(self):
        frames, _ = pipeline.extract(*fixture())
        for pixel, reason in [([0, 0, 0, 255], 'Clipping'), ([20, 220, 20, 255], 'Key residue'),
                              ([20, 40, 220, 255], 'Guide colour'), ([1, 0, 0, 0], 'Invisible RGB')]:
            changed = bytearray(frames[0])
            off = 0 if reason == 'Clipping' else (60 * 128 + 60) * 4
            changed[off:off + 4] = bytes(pixel)
            with self.assertRaisesRegex(ValueError, reason):
                pipeline.validate_frames([bytes(changed), *frames[1:]])
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            pipeline.validate_frames([frames[0]] * 8)

    def test_composition_keeps_unavailable_rows_transparent(self):
        frames, _ = pipeline.extract(*fixture())
        atlas = pipeline.compose(frames)
        self.assertEqual(len(atlas), 1024 * 672 * 4)
        self.assertFalse(any(atlas[1024 * 112 * 4:]))
        for cell in range(8):
            for y in range(112):
                start = (y * 1024 + cell * 128) * 4
                self.assertEqual(atlas[start:start + 128 * 4], frames[cell][y * 128 * 4:(y + 1) * 128 * 4])

    def test_failed_processing_preserves_existing_evidence_and_excludes_writer(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            output = Path(directory)
            previous = output / 'atlas.webp'
            previous.write_bytes(b'previous')
            with patch.object(pipeline, 'decode', side_effect=ValueError('bad source')):
                with self.assertRaisesRegex(ValueError, 'bad source'):
                    pipeline.process(Path('missing'), output)
            self.assertEqual(previous.read_bytes(), b'previous')
            self.assertFalse((output / '.processing.lock').exists())
            (output / '.processing.lock').write_text('other writer')
            with self.assertRaises(FileExistsError):
                pipeline.process(Path('missing'), output)
            self.assertEqual(previous.read_bytes(), b'previous')


@unittest.skipUnless(shutil.which('magick') and shutil.which('cwebp'), 'ImageMagick/cwebp required')
class EvidenceTests(unittest.TestCase):
    def test_prepare_uses_explicit_canonical_and_records_contract(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            root = Path(directory)
            reference = root / 'canonical.png'
            pixels = bytearray(128 * 112 * 4)
            pixels[(50 * 128 + 40) * 4:(50 * 128 + 40) * 4 + 4] = bytes([180, 70, 20, 255])
            pipeline.write_image(reference, pixels, 128, 112)
            pipeline.prepare(root / 'guide', reference)
            self.assertEqual(pipeline.decode(root / 'guide/guide.png'),
                             (1024, 112, pipeline.guide_pixels(pixels)))
            contract = json.loads((root / 'guide/guide-contract.json').read_text())
            self.assertEqual(contract['extraction'], 'canonical-layout')
            self.assertEqual(contract['anchor'], [64, 100])
            self.assertEqual(contract['transform'], pipeline.canonical_transform(1024, 112))

    def test_publication_snapshots_pixels_under_processing_exclusion(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            root = Path(directory)
            evidence, runtime = root / 'review', root / 'runtime'
            evidence.mkdir()
            source = root / 'source.png'
            source_width, source_height, source_pixels = fixture()
            pipeline.write_image(source, source_pixels, source_width, source_height)
            frames, _ = pipeline.extract(*fixture())
            pipeline.write_image(evidence / 'atlas.webp', pipeline.compose(frames), 1024, 672)
            pipeline.write_image(evidence / 'canonical.png', frames[0], 128, 112)
            (evidence / 'validation.json').write_text(json.dumps(pipeline.validate_frames(frames)))
            original_art = (evidence / 'atlas.webp').read_bytes()
            original_decode = pipeline.decode
            def interleave(path):
                if path.name == 'atlas.webp':
                    # A cooperating processor cannot invalidate this snapshot.
                    with self.assertRaises(FileExistsError):
                        pipeline.process(source, evidence)
                    # Even an uncoordinated replacement cannot change the bytes
                    # decoded and subsequently published from the private copy.
                    (evidence / 'atlas.webp').write_bytes(b'not decoded artwork')
                return original_decode(path)
            with patch.object(pipeline, 'decode', side_effect=interleave):
                pipeline.publish_runtime(evidence, runtime)
            manifest = json.loads((runtime / 'manifest.json').read_text())
            self.assertEqual((runtime / next(iter(manifest['sheets']))).read_bytes(), original_art)
            self.assertEqual(pipeline.decode(runtime / manifest['fallback']['file']), (128, 112, frames[0]))
            (evidence / '.processing.lock').write_text('another writer')
            with self.assertRaises(FileExistsError):
                pipeline.publish_runtime(evidence, runtime)
            self.assertEqual((evidence / '.processing.lock').read_text(), 'another writer')

    def test_canonical_is_regenerated_and_interrupted_evidence_is_not_complete(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            root = Path(directory)
            source, output = root / 'source.png', root / 'review'
            width, height, pixels = fixture()
            pipeline.write_image(source, pixels, width, height)
            pipeline.process(source, output)
            self.assert_neutral_matches(output)
            previous = (output / 'canonical.png').read_bytes()
            for off in range(0, len(pixels), 4):
                if pixels[off] == 180:
                    pixels[off] = 190
            pipeline.write_image(source, pixels, width, height)
            original = Path.replace
            def fail_contact(path, target):
                if path.name == 'contact.png':
                    raise OSError('interrupted evidence')
                return original(path, target)
            with patch.object(Path, 'replace', fail_contact):
                with self.assertRaisesRegex(OSError, 'interrupted evidence'):
                    pipeline.process(source, output)
            self.assertFalse((output / 'validation.json').exists())
            with self.assertRaises(FileNotFoundError):
                pipeline.publish_runtime(output, root / 'runtime')
            pipeline.process(source, output)
            self.assert_neutral_matches(output)
            self.assertNotEqual((output / 'canonical.png').read_bytes(), previous)

    def assert_neutral_matches(self, output):
        width, height, atlas = pipeline.decode(output / 'atlas.webp')
        neutral = b''.join(atlas[y * width * 4:(y * width + 128) * 4] for y in range(112))
        self.assertEqual(pipeline.decode(output / 'canonical.png'), (128, 112, neutral))
        self.assertTrue((output / 'validation.json').exists())
        self.assertEqual((width, height), (1024, 672))
        self.assertFalse(any(atlas[1024 * 112 * 4:]))

    def test_runtime_manifest_last_restart_and_writer_exclusion_preserve_previous_assets(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            root = Path(directory)
            evidence, runtime = root / 'evidence', root / 'runtime'
            evidence.mkdir()
            frames, _ = pipeline.extract(*fixture())
            def write_evidence(frames):
                pipeline.write_image(evidence / 'atlas.webp', pipeline.compose(frames), 1024, 672)
                pipeline.write_image(evidence / 'canonical.png', frames[0], 128, 112)
                (evidence / 'validation.json').write_text(json.dumps(pipeline.validate_frames(frames)))
            write_evidence(frames)
            pipeline.publish_runtime(evidence, runtime)
            previous = (runtime / 'manifest.json').read_bytes()
            old = json.loads(previous)
            old_assets = {name: (runtime / name).read_bytes() for name in [*old['sheets'], old['fallback']['file']]}
            # A different processed strip causes new immutable names.
            changed = []
            for frame in frames:
                pixels = bytearray(frame)
                for off in range(0, len(pixels), 4):
                    if pixels[off + 3]:
                        pixels[off] = min(255, pixels[off] + 3)
                changed.append(bytes(pixels))
            write_evidence(changed)
            original = Path.replace
            def fail_manifest(path, target):
                if path.name == 'manifest.json':
                    raise OSError('interrupted publication')
                return original(path, target)
            with patch.object(Path, 'replace', fail_manifest):
                with self.assertRaisesRegex(OSError, 'interrupted publication'):
                    pipeline.publish_runtime(evidence, runtime)
            self.assertEqual((runtime / 'manifest.json').read_bytes(), previous)
            for name, pixels in old_assets.items():
                self.assertEqual((runtime / name).read_bytes(), pixels)
            (runtime / '.publication.lock').write_text('another writer')
            with self.assertRaises(FileExistsError):
                pipeline.publish_runtime(evidence, runtime)
            self.assertEqual((runtime / 'manifest.json').read_bytes(), previous)
            (runtime / '.publication.lock').unlink()
            pipeline.publish_runtime(evidence, runtime)
            current = json.loads((runtime / 'manifest.json').read_text())
            self.assertNotEqual(current['sheets'], old['sheets'])
            self.assertFalse(current['rows']['idle']['available'])
            self.assertTrue(all(not row['available'] for row in current['rows'].values()))
            verdict = root / 'verdict.json'
            verdict.write_text(json.dumps({'status': 'accepted', 'designer': 'Someone else'}))
            with self.assertRaisesRegex(ValueError, 'Juniper'):
                pipeline.publish_runtime(evidence, runtime, verdict)
            self.assertEqual(json.loads((runtime / 'manifest.json').read_text()), current)
            with patch.object(pipeline, 'write_image', side_effect=OSError('partial export')):
                with self.assertRaisesRegex(OSError, 'partial export'):
                    pipeline.publish_runtime(evidence, runtime)
            self.assertEqual(json.loads((runtime / 'manifest.json').read_text()), current)
            pipeline.write_image(evidence / 'canonical.png', frames[0], 128, 112)
            with self.assertRaisesRegex(ValueError, 'Stale canonical'):
                pipeline.publish_runtime(evidence, runtime)
            pipeline.write_image(evidence / 'canonical.png', changed[0], 128, 112)
            # Only a synthetic verdict in this disposable fixture exercises
            # activation. It grants no acceptance to repository production art.
            verdict.write_text(json.dumps({'status': 'accepted', 'designer': 'Juniper',
                                           'atlas_sha256': next(iter(current['sheets'].values()))['sha256']}))
            pipeline.publish_runtime(evidence, runtime, verdict)
            self.assertTrue(json.loads((runtime / 'manifest.json').read_text())['rows']['idle']['available'])
            digest = next(iter(current['sheets'].values()))['sha256']
            owner_verdict = {
                'status': 'accepted', 'atlas_sha256': digest,
                'designer_review': {'designer': 'Juniper', 'status': 'static-identity-supported', 'atlas_sha256': digest},
                'owner_acceptance': {'reviewer': 'owner', 'status': 'accepted', 'atlas_sha256': digest}}
            for section, field, invalid in [
                    ('owner_acceptance', 'status', 'pending'),
                    ('owner_acceptance', 'reviewer', 'Someone else'),
                    ('owner_acceptance', 'atlas_sha256', 'stale'),
                    ('designer_review', 'designer', 'Someone else'),
                    ('designer_review', 'status', 'hold'),
                    ('designer_review', 'atlas_sha256', 'stale')]:
                changed_verdict = json.loads(json.dumps(owner_verdict))
                changed_verdict[section][field] = invalid
                verdict.write_text(json.dumps(changed_verdict))
                with self.assertRaisesRegex(ValueError, 'owner acceptance'):
                    pipeline.publish_runtime(evidence, runtime, verdict)
            verdict.write_text(json.dumps(owner_verdict))
            pipeline.publish_runtime(evidence, runtime, verdict)
            self.assertTrue(json.loads((runtime / 'manifest.json').read_text())['rows']['idle']['available'])

    def test_export_failure_cleans_private_frames_and_preserves_outputs(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            output = Path(directory)
            for name in ['atlas.webp', 'contact.png', 'preview.gif', 'validation.json']:
                (output / name).write_bytes(b'previous')
            with patch.object(pipeline, 'decode', return_value=fixture()), \
                    patch.object(pipeline, 'write_image', side_effect=RuntimeError('export failed')):
                with self.assertRaisesRegex(RuntimeError, 'export failed'):
                    pipeline.process(Path('source'), output)
            self.assertEqual(sorted(p.name for p in output.iterdir()),
                             ['atlas.webp', 'contact.png', 'preview.gif', 'validation.json'])
            for path in output.iterdir():
                self.assertEqual(path.read_bytes(), b'previous')
            self.assertFalse((output / '.processing.lock').exists())


class FlyingTests(unittest.TestCase):
    def test_components_preserve_cross_boundary_birds_and_ignore_specks(self):
        width, height = 600, 112
        pixels = bytearray(width * height * 4)
        starts = [115, 231, 365, 521]  # First bird crosses old x=150 cut.
        for i, start in enumerate(starts):
            for y in range(30, 85):
                for x in range(start, start + 40 + i):
                    off = (y * width + x) * 4
                    pixels[off:off + 4] = bytes([180, 70 + i, 20, 255])
        pixels[:4] = bytes([180, 70, 20, 255])  # Opaque speck, not just alpha dust.
        shared = {'scale': 1, 'source_anchor': [24, 100]}
        frames, transform = pipeline.extract(width, height, pixels, count=4,
                                            registration='shared-transform', shared=shared)
        self.assertEqual(transform['component_bounds'], [[x, 30, x + 39 + i, 84] for i, x in enumerate(starts)])
        self.assertEqual(transform['component_origins'], starts)
        for i, frame in enumerate(frames):
            self.assertEqual(frame[(40 * 128 + 79 + i) * 4:(40 * 128 + 79 + i) * 4 + 4], bytes([180, 70 + i, 20, 255]))
        pipeline.validate_frames(frames)
        with self.assertRaisesRegex(ValueError, 'Clipping cell'):
            pipeline.extract(width, height, pixels, count=4, registration='shared-transform',
                             shared={**shared, 'scale': 3})

    def test_component_count_touching_overlap_and_threshold_reject(self):
        width, height = 80, 40
        def mask(boxes):
            pixels = bytearray(width * height * 4)
            for left, top, right, bottom in boxes:
                for y in range(top, bottom):
                    for x in range(left, right):
                        off = (y * width + x) * 4
                        pixels[off:off + 4] = bytes([180, 70, 20, 255])
            return pixels
        boxes = [[2, 2, 12, 12], [20, 2, 30, 12], [40, 2, 50, 12], [60, 2, 70, 12]]
        for changed in [boxes[:3], boxes + [[2, 20, 12, 30]],
                        [boxes[0], [12, 2, 30, 12], *boxes[2:]]]:
            with self.assertRaisesRegex(ValueError, 'exactly 4 bird components'):
                pipeline.bird_components(width, height, mask(changed), 4)
        with self.assertRaisesRegex(ValueError, 'Overlapping'):
            pipeline.bird_components(width, height, mask([boxes[0], [5, 20, 15, 30], *boxes[2:]]), 4)
        with self.assertRaisesRegex(ValueError, 'threshold'):
            pipeline.bird_components(width, height, mask(boxes), 4, minimum_pixels=0)

    def test_shared_four_slot_mapping_preserves_alpha_body_and_tucked_feet(self):
        pixels = bytearray(512 * 112 * 4)
        for i in range(4):
            for y in range(30, 85):
                for x in range(40, 80 + i):
                    off = (y * 512 + i * 128 + x) * 4
                    pixels[off:off + 4] = bytes([180, 70, 20, 255])
            off = (29 * 512 + i * 128 + 40) * 4
            pixels[off:off + 4] = bytes([180, 70, 20, 100])
        pixels[-4:] = bytes([0, 0, 0, 1])  # Empty-padding alpha dust.
        shared = {'scale': 1, 'source_anchor': [24, 100]}
        frames, transform = pipeline.extract(512, 112, pixels, count=4, registration='shared-transform', shared=shared)
        self.assertEqual(transform['source_anchor'], [24, 100])
        self.assertEqual(transform['scale'], 1)
        self.assertEqual(frames[0][(29 * 128 + 40) * 4:(29 * 128 + 40) * 4 + 4], bytes([180, 70, 20, 100]))
        self.assertEqual(pipeline.validate_frames(frames, [50] * 4)['cells'], 4)
        idle, _ = pipeline.extract(*fixture())
        before = pipeline.compose(idle)
        after = pipeline.compose(frames, row=1, base=before)
        self.assertEqual(after[:1024 * 112 * 4], before[:1024 * 112 * 4])
        self.assertFalse(any(after[1024 * 224 * 4:]))
        for i, frame in enumerate(frames):
            self.assertEqual(b''.join(after[((y + 112) * 1024 + i * 128) * 4:((y + 112) * 1024 + i * 128 + 128) * 4] for y in range(112)), frame)
        for y in range(31):
            for x in range(40, 50):
                off = (y * 512 + x) * 4
                pixels[off:off + 4] = bytes([180, 70, 20, 255])
        with self.assertRaisesRegex(ValueError, 'clipping'):
            pipeline.extract(512, 112, pixels, count=4, registration='shared-transform', shared=shared)


@unittest.skipUnless(shutil.which('magick') and shutil.which('cwebp'), 'ImageMagick/cwebp required')
class FlyingPublicationTests(unittest.TestCase):
    def test_retained_source_has_complete_wings_at_canonical_body_scale(self):
        root = Path(__file__).parent
        source = root / 'flying-strip/source-revised-attempt-1.png'
        shared = json.loads((root / 'flying-strip/transform-revised-attempt-1.json').read_text())
        decoded = pipeline.decode(source)
        frames, transform = pipeline.extract(*decoded, count=4, registration='shared-transform', shared=shared)
        self.assertEqual([b[0] for b in transform['component_bounds']], [89, 599, 1115, 1634])
        self.assertEqual(transform['component_bounds'][0][2], 554)
        self.assertGreater(transform['component_bounds'][0][2], decoded[0] // 4)
        self.assertGreater(transform['scale'], .21)
        self.assertEqual(transform['scale'], .28)
        self.assertGreater(transform['cell_size'][1], 112)
        self.assertTrue(all(v % 2 == 0 for v in transform['cell_size']))
        pipeline.validate_frames(frames, [50] * 4, transform['cell_size'])
        # Different silhouette origins must not affect eye registration.
        anchor = transform['anchor']
        for landmark in transform['landmarks']:
            eye = landmark['eye']
            self.assertEqual([anchor[0] + (eye[0]-eye[0])*.28,
                              anchor[1] + (eye[1]-eye[1])*.28], anchor)
        bad = {**shared, 'landmarks': shared['landmarks'][:-1]}
        with self.assertRaisesRegex(ValueError, 'landmark'):
            pipeline.extract(*decoded, count=4, registration='shared-transform', shared=bad)

    def test_process_flying_uses_shared_mapping_and_keeps_interrupted_evidence_unpublishable(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            root = Path(directory)
            frames, _ = pipeline.extract(*fixture())
            source, reference, output = root / 'source.png', root / 'canonical.png', root / 'review'
            pixels = b''.join(b''.join(frame[y * 128 * 4:(y + 1) * 128 * 4] for frame in frames[:4]) for y in range(112))
            pipeline.write_image(source, pixels, 512, 112)
            pipeline.write_image(reference, frames[0], 128, 112)
            shared = {'scale': 1, 'source_anchor': [20, 100],
                      'reference_sha256': hashlib.sha256(reference.read_bytes()).hexdigest()}
            pipeline.process(source, output, row='flying', count=4, shared=shared, reference=reference)
            report = json.loads((output / 'validation.json').read_text())
            self.assertEqual(report['durations_ms'], [50] * 4)
            self.assertEqual(report['comparison_durations_ms'], [140] * 4)
            self.assertEqual(report['transform']['source_anchor'], [20, 100])
            self.assertEqual(report['atlas_sha256'], hashlib.sha256((output / 'atlas.webp').read_bytes()).hexdigest())
            self.assertEqual(pipeline.decode(output / 'atlas.webp')[2], pipeline.compose(frames[:4], row=1))
            self.assertEqual(pipeline.decode(output / 'canonical.png'), pipeline.decode(reference))
            self.assertEqual(sorted(p.name for p in output.iterdir()), ['atlas.webp', 'canonical.png', 'contact.png', 'preview.gif', 'validation.json'])
            previous = (output / 'atlas.webp').read_bytes()
            with self.assertRaisesRegex(ValueError, 'reference mismatch'):
                pipeline.process(source, output, row='flying', count=4, shared={**shared, 'reference_sha256': 'stale'}, reference=reference)
            self.assertEqual((output / 'atlas.webp').read_bytes(), previous)
            original = Path.replace
            def fail_contact(path, target):
                if path.name == 'contact.png':
                    raise OSError('interrupted flying evidence')
                return original(path, target)
            with patch.object(Path, 'replace', fail_contact):
                with self.assertRaisesRegex(OSError, 'interrupted flying evidence'):
                    pipeline.process(source, output, row='flying', count=4, shared=shared, reference=reference)
            self.assertFalse((output / 'validation.json').exists())
            with self.assertRaises(FileNotFoundError):
                pipeline.publish_runtime(output, root / 'runtime', row='flying')
            pipeline.process(source, output, row='flying', count=4, shared=shared, reference=reference)
            self.assertEqual((output / 'atlas.webp').read_bytes(), previous)

    def test_flying_merge_uses_latest_idle_gates_joins_and_restarts_atomically(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            root = Path(directory)
            idle, flying, runtime = root / 'idle', root / 'flying', root / 'runtime'
            idle.mkdir(); flying.mkdir()
            frames, _ = pipeline.extract(*fixture())
            for folder, row, cells in [(idle, 0, frames), (flying, 1, frames[:4])]:
                pipeline.write_image(folder / 'atlas.webp', pipeline.compose(cells, row=row), 1024, 672)
                pipeline.write_image(folder / 'canonical.png', frames[0], 128, 112)
                digest = hashlib.sha256((folder / 'atlas.webp').read_bytes()).hexdigest()
                (folder / 'validation.json').write_text(json.dumps({**pipeline.validate_frames(cells), 'atlas_sha256': digest}))
            verdict = root / 'verdict.json'
            verdict.write_text(json.dumps({'status': 'accepted', 'designer': 'Juniper', 'atlas_sha256': hashlib.sha256((idle / 'atlas.webp').read_bytes()).hexdigest()}))
            pipeline.publish_runtime(idle, runtime, verdict)
            before = (runtime / 'manifest.json').read_bytes()
            old = json.loads(before)
            old_art = (runtime / old['frames']['I0']['sheet']).read_bytes()
            original_replace = Path.replace
            def interrupt(path, target):
                if path.name == 'manifest.json':
                    raise OSError('interrupted flying publication')
                return original_replace(path, target)
            with patch.object(Path, 'replace', interrupt):
                with self.assertRaisesRegex(OSError, 'interrupted flying'):
                    pipeline.publish_runtime(flying, runtime, row='flying')
            self.assertEqual((runtime / 'manifest.json').read_bytes(), before)
            self.assertEqual((runtime / old['frames']['I0']['sheet']).read_bytes(), old_art)
            # The latest idle metadata is read after the evidence snapshot.
            snapshot = pipeline.snapshot_evidence
            def update_idle(evidence):
                result = snapshot(evidence)
                current = json.loads((runtime / 'manifest.json').read_text())
                current['rows']['idle']['review_note'] = 'latest acceptance retained'
                (runtime / 'manifest.json').write_text(json.dumps(current))
                return result
            with patch.object(pipeline, 'snapshot_evidence', update_idle):
                pipeline.publish_runtime(flying, runtime, row='flying')
            current = json.loads((runtime / 'manifest.json').read_text())
            self.assertEqual(current['rows']['idle']['review_note'], 'latest acceptance retained')
            self.assertTrue(current['rows']['idle']['available'])
            self.assertEqual(current['clips']['idle'], old['clips']['idle'])
            self.assertEqual(current['fallback'], old['fallback'])
            self.assertFalse(current['rows']['flying']['available'])
            base = pipeline.decode(runtime / old['frames']['I0']['sheet'])[2]
            combined = pipeline.decode(runtime / current['frames']['I0']['sheet'])[2]
            self.assertEqual(base[:1024 * 112 * 4], combined[:1024 * 112 * 4])
            self.assertFalse(any(combined[1024 * 224 * 4:]))
            pipeline.publish_runtime(flying, runtime, row='flying')
            self.assertEqual(json.loads((runtime / 'manifest.json').read_text()), current)
            with self.assertRaisesRegex(ValueError, 'discard flying'):
                pipeline.publish_runtime(idle, runtime)
            (runtime / '.publication.lock').write_text('another writer')
            with self.assertRaises(FileExistsError):
                pipeline.publish_runtime(flying, runtime, row='flying')
            (runtime / '.publication.lock').unlink()
            (flying / '.processing.lock').write_text('another processor')
            with self.assertRaises(FileExistsError):
                pipeline.publish_runtime(flying, runtime, row='flying')
            (flying / '.processing.lock').unlink()
            with patch.object(pipeline, 'write_image', side_effect=OSError('export failure')):
                with self.assertRaisesRegex(OSError, 'export failure'):
                    pipeline.publish_runtime(flying, runtime, row='flying')
            self.assertEqual(json.loads((runtime / 'manifest.json').read_text()), current)
            digest = hashlib.sha256((flying / 'atlas.webp').read_bytes()).hexdigest()
            verdict.write_text(json.dumps({'status': 'accepted', 'designer': 'Juniper', 'atlas_sha256': 'stale', 'joins': 'accepted'}))
            with self.assertRaisesRegex(ValueError, 'Juniper loop'):
                pipeline.publish_runtime(flying, runtime, verdict, row='flying')
            for joins, enabled in [('pending', False), ('accepted', True)]:
                verdict.write_text(json.dumps({'status': 'accepted', 'designer': 'Juniper', 'atlas_sha256': digest, 'joins': joins}))
                pipeline.publish_runtime(flying, runtime, verdict, row='flying')
                self.assertEqual(json.loads((runtime / 'manifest.json').read_text())['rows']['flying']['available'], enabled)
            (flying / 'validation.json').write_text(json.dumps({'status': 'pass', 'atlas_sha256': 'stale'}))
            with self.assertRaisesRegex(ValueError, 'Stale processing'):
                pipeline.publish_runtime(flying, runtime, row='flying')
            (flying / 'validation.json').unlink()
            with self.assertRaises(FileNotFoundError):
                pipeline.publish_runtime(flying, runtime, row='flying')



class LandmarkGeometryTests(unittest.TestCase):
    def test_registration_ignores_component_left_and_preserves_uniform_scale(self):
        boxes = [[10,10,110,140], [210,20,330,150], [430,10,550,140], [650,15,760,145]]
        eyes = [[90,60],[310,60],[530,60],[750,60]]
        shared = {'scale':.28, 'canonical_eye':[97.1,26.7],
                  'landmarks':[{'eye':e,'beak_base':[e[0]+2,e[1]],'breast_centre':[e[0]-5,e[1]+20]} for e in eyes]}
        geometry = pipeline.landmark_geometry(boxes, shared)
        self.assertEqual(geometry['canonical_anchor'], [97.1,26.7])
        for box, eye in zip(boxes,eyes):
            x,y = geometry['anchor']
            self.assertGreaterEqual(x+(box[0]-eye[0])*.28,4)
            self.assertGreaterEqual(y+(box[1]-eye[1])*.28,4)
            self.assertLess(x+(box[2]-eye[0])*.28,geometry['cell_size'][0]-4)
            self.assertLess(y+(box[3]-eye[1])*.28,geometry['cell_size'][1]-4)
        for bad in [{**shared,'scale':float('nan')},{**shared,'canonical_eye':[]},
                    {**shared,'landmarks':[{}]*4}]:
            with self.assertRaises(ValueError):
                pipeline.landmark_geometry(boxes,bad)

    def test_eye_pixels_stay_registered_when_wing_extrema_change(self):
        width,height = 800,180
        pixels = bytearray(width*height*4)
        landmarks = []
        for i in range(4):
            eye = [i*200+120,70]
            landmarks.append({'eye':eye,'beak_base':[eye[0]+10,70],'breast_centre':[eye[0]-10,90]})
            for y in range(50,110):
                for x in range(eye[0]-40-i*8,eye[0]+20):
                    off=(y*width+x)*4
                    pixels[off:off+4]=bytes([150,80,30,255])
            off=(eye[1]*width+eye[0])*4
            pixels[off:off+4]=bytes([20,20,20,255])
        frames, transform = pipeline.extract(width,height,pixels,count=4,registration='shared-transform',
            shared={'scale':1,'canonical_eye':[97.1,26.7],'landmarks':landmarks})
        cw,ch=transform['cell_size']; x,y=transform['anchor']
        for f in frames:
            self.assertEqual(f[(y*cw+x)*4:(y*cw+x)*4+4],bytes([20,20,20,255]))
        pipeline.validate_frames(frames,[50]*4,[cw,ch])

@unittest.skipUnless(shutil.which('magick') and shutil.which('cwebp'), 'ImageMagick/cwebp required')
class VariableFlyingPublicationTests(unittest.TestCase):
    def test_variable_publication_preserves_idle_and_rejects_stale_geometry_and_writers(self):
        root = Path(__file__).parent
        runtime_source = root.parents[2] / 'internal/dashboard/ui/src/lib/theme/christmas/robin-atlas'
        with tempfile.TemporaryDirectory(dir=root) as directory:
            stage = Path(directory)
            runtime = stage/'runtime'; evidence = stage/'evidence'
            shutil.copytree(runtime_source,runtime)
            shutil.copytree(root/'flying-strip/review-attempt-1',evidence)
            before = json.loads((runtime/'manifest.json').read_text())
            idle_file = before['frames']['I0']['sheet']
            idle = pipeline.decode(runtime/idle_file)
            report = json.loads((evidence/'validation.json').read_text())
            original = Path.replace
            def fail_manifest(path,target):
                if path.name == 'manifest.json':
                    raise OSError('interrupted')
                return original(path,target)
            with patch.object(Path,'replace',fail_manifest):
                with self.assertRaises(OSError):
                    pipeline.publish_runtime(evidence,runtime,row='flying')
            self.assertEqual(json.loads((runtime/'manifest.json').read_text()),before)
            for folder, lock in [(runtime,'.publication.lock'),(evidence,'.processing.lock')]:
                (folder/lock).write_text('writer')
                with self.assertRaises(FileExistsError):
                    pipeline.publish_runtime(evidence,runtime,row='flying')
                (folder/lock).unlink()
            pipeline.publish_runtime(evidence,runtime,row='flying')
            after = json.loads((runtime/'manifest.json').read_text())
            self.assertEqual(after['fallback'],before['fallback'])
            self.assertEqual(after['rows']['idle'],before['rows']['idle'])
            self.assertEqual(after['clips']['idle'],before['clips']['idle'])
            self.assertEqual(after['frames']['I0'],before['frames']['I0'])
            self.assertEqual(pipeline.decode(runtime/idle_file),idle)
            self.assertEqual(after['rows']['flying']['cell_size'],[142,134])
            self.assertFalse(after['rows']['flying']['available'])
            verdict = stage/'verdict.json'
            verdict.write_text(json.dumps({'status':'accepted','designer':'Juniper',
                'atlas_sha256':report['atlas_sha256'],'joins':'accepted'}))
            with self.assertRaisesRegex(ValueError,'geometry'):
                pipeline.publish_runtime(evidence,runtime,verdict,row='flying')
            report['transform']['anchor'][0] += 1
            (evidence/'validation.json').write_text(json.dumps(report))
            with self.assertRaisesRegex(ValueError,'geometry'):
                pipeline.publish_runtime(evidence,runtime,row='flying')
            self.assertEqual(json.loads((runtime/'manifest.json').read_text()),after)


if __name__ == "__main__":
    unittest.main()
