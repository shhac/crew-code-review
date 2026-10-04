import unittest
from pathlib import Path
import tempfile
import json
import shutil
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
    def test_common_transform_preserves_width_and_virtual_root_offset(self):
        frames, transform = pipeline.extract(*fixture())
        self.assertEqual(transform['scale'], 1)
        self.assertEqual(transform['source_anchor'], [59.5, 138.5])
        bounds = []
        for f in frames:
            positions = [(i // 4 % 128, i // 4 // 128) for i in range(0, len(f), 4) if f[i + 3]]
            bounds.append((min(x for x, y in positions), max(x for x, y in positions), max(y for x, y in positions)))
        self.assertEqual(bounds[-1][0], bounds[0][0])
        self.assertEqual(bounds[-1][1] - bounds[0][1], 7)
        self.assertEqual(bounds[0][2] - bounds[-1][2], 7)
        pipeline.validate_frames(frames)

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
            off = (y * width + 60) * 4
            pixels[off:off + 4] = bytes([180, 70, 20, 255])
            with self.assertRaisesRegex(ValueError, 'Source vertical clipping'):
                pipeline.extract(width, height, pixels)

    def test_wrong_count_empty_slot_and_source_clipping_reject(self):
        with self.assertRaisesRegex(ValueError, 'eight'):
            pipeline.extract(*fixture(), count=7)
        width, height, pixels = fixture()
        for y in range(height):
            start = (y * width + 7 * 128) * 4
            pixels[start:start + 128 * 4] = bytes([0, 255, 0, 255] * 128)
        with self.assertRaisesRegex(ValueError, 'Empty source cell 7'):
            pipeline.extract(width, height, pixels)
        pixels[(60 * width) * 4:(60 * width) * 4 + 4] = bytes([180, 60, 20, 255])
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


if __name__ == "__main__":
    unittest.main()
