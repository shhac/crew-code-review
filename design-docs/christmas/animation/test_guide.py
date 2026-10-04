"""Native-reference measurement and deterministic production-guide regressions."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import guide


class GuideTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = guide.REFERENCE.read_bytes()
        cls.pixels = subprocess.check_output(["magick", "webp:-", "-depth", "8", "rgba:-"], input=cls.source)

    def test_reference_identity_and_all_nonzero_alpha_are_measured(self):
        result = guide.measure(self.pixels)
        self.assertEqual(hashlib.sha256(self.source).hexdigest(), guide.IDENTITY_HASH)
        self.assertEqual(result["alpha_bounds"], [2, 6, 105, 99])
        faint = bytearray(self.pixels)
        faint[(5 * 128 + 120) * 4 + 3] = 1
        self.assertEqual(guide.measure(faint)["alpha_bounds"], [2, 5, 121, 99])

    def test_measurements_include_eye_beak_breast_feet_and_toe_support(self):
        result = guide.measure(self.pixels)
        features = result["landmarks"]
        self.assertEqual(features["eye"]["bounds"], [82, 29, 88, 36])
        self.assertEqual(features["beak"]["tip"], [104.5, 33.0])
        self.assertEqual(features["breast"]["bounds"], [69, 43, 98, 74])
        self.assertEqual(features["left_foot"]["toe_extrema"]["lowest"], [59.0, 98.5])
        self.assertEqual(features["right_foot"]["toe_extrema"]["right"], [80.5, 93.5])
        self.assertEqual(result["virtual_foot_anchor"], [64, 100])
        self.assertNotEqual(result["virtual_foot_anchor"], features["left_foot"]["centre"])
        self.assertEqual(result["ground_y"], 100)
        native = result["collision_envelope_native"]
        self.assertAlmostEqual((native["x"][0] - 64) * .35, -24)
        self.assertAlmostEqual((native["y"][0] - 100) * .35, -37)

    def test_empty_missing_landmarks_and_wrong_cell_fail_instead_of_estimating(self):
        for pixels in [b"", self.pixels[:-4], bytes(128 * 112 * 4)]:
            with self.assertRaises(ValueError):
                guide.measure(pixels)
        no_eye = bytearray(self.pixels)
        left, top, right, bottom = guide.REGIONS["eye"]
        for y in range(top, bottom):
            for x in range(left, right):
                no_eye[(y * 128 + x) * 4:(y * 128 + x) * 4 + 4] = bytes(4)
        with self.assertRaises(ValueError):
            guide.measure(no_eye)

    def test_regeneration_matches_committed_png_json_and_preserves_reference_bytes(self):
        with tempfile.TemporaryDirectory(dir=guide.ROOT) as temporary:
            output = Path(temporary)
            for _ in range(2):
                guide.generate(output)
                for name in ["guide.png", "landmarks.json"]:
                    self.assertEqual((output / name).read_bytes(), (guide.ROOT / "reference-guide" / name).read_bytes())
            metadata = json.loads((output / "landmarks.json").read_bytes())
            self.assertEqual(metadata["guide_sha256"], hashlib.sha256((output / "guide.png").read_bytes()).hexdigest())
            self.assertEqual(guide.REFERENCE.read_bytes(), self.source)

    def test_changed_identity_requires_search_region_review(self):
        with tempfile.TemporaryDirectory(dir=guide.ROOT) as temporary:
            reference = Path(temporary) / "changed.webp"
            reference.write_bytes(self.source + b"different source")
            with patch.object(guide, "REFERENCE", reference):
                with self.assertRaisesRegex(ValueError, "Identity reference changed"):
                    guide.generate(Path(temporary) / "output")

    def test_interrupted_pair_preserves_completed_generation_and_restart(self):
        with tempfile.TemporaryDirectory(dir=guide.ROOT) as temporary:
            output = Path(temporary)
            guide.generate(output)
            previous = guide.read_published(output)
            pointer = (output / "complete.json").read_bytes()
            for stage in ["guide.png", "landmarks.json", "before-completion"]:
                def interrupt(current):
                    if current == stage:
                        raise RuntimeError("interrupted")
                with patch.object(guide, "rasterize", return_value=bytes([255]) * 128 * 112 * 4):
                    with self.assertRaisesRegex(RuntimeError, "interrupted"):
                        guide.generate(output, interrupt)
                self.assertEqual((output / "complete.json").read_bytes(), pointer)
                self.assertEqual(guide.read_published(output), previous)
                self.assertFalse((output / ".publish.lock").exists())
            guide.generate(output)
            self.assertEqual(guide.read_published(output), previous)

    def test_competing_publisher_and_corrupted_evidence_reject(self):
        with tempfile.TemporaryDirectory(dir=guide.ROOT) as temporary:
            output = Path(temporary)
            def compete(stage):
                with self.assertRaisesRegex(ValueError, "publisher active"):
                    guide.generate(output)
            guide.generate(output, compete)
            pointer = json.loads((output / "complete.json").read_bytes())
            (output / pointer["guide.png"]["file"]).write_bytes(b"corrupt")
            with self.assertRaisesRegex(ValueError, "Mismatched"):
                guide.read_published(output)


if __name__ == "__main__":
    unittest.main()
