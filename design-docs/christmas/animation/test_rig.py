"""Reference rig regressions; identity acceptance remains a visual decision."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

import guide
import rig


class RigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.spec = json.loads((rig.ROOT / "rig-masks.json").read_bytes())
        cls.pixels = subprocess.check_output(["magick", "webp:-", "-depth", "8", "rgba:-"], input=guide.REFERENCE.read_bytes())

    def test_neutral_is_reference_including_invisible_rgb(self):
        self.assertEqual(rig.bake(self.pixels, self.spec, "I0"), self.pixels)

    def test_fixed_feet_and_reference_identity_regions(self):
        layers = rig.segmentation(self.spec)
        self.assertEqual(len(layers), 128 * 112)
        self.assertEqual(set(layers), {"feet", "tail", "torso", "head", "wing"})
        for identifier in rig.IDS:
            result = rig.bake(self.pixels, self.spec, identifier)
            self.assertEqual(result[84 * 128 * 4:], self.pixels[84 * 128 * 4:])
            if identifier.startswith("I"):
                for i, layer in enumerate(layers):
                    if layer in ("head", "wing", "tail") and self.pixels[i * 4 + 3]:
                        self.assertEqual(result[i * 4:i * 4 + 4], self.pixels[i * 4:i * 4 + 4])
            self.assertEqual(rig.report(self.pixels, result, identifier)["identity_status"], "visual-pending")

    def test_blink_is_bounded_and_preserves_alpha(self):
        for identifier in ("B1", "B2"):
            result = rig.bake(self.pixels, self.spec, identifier)
            self.assertTrue(result != self.pixels, "Blink must change eye pixels")
            self.assertEqual(result[3::4], self.pixels[3::4])
            for i in range(128 * 112):
                if result[i * 4:i * 4 + 4] != self.pixels[i * 4:i * 4 + 4]:
                    self.assertTrue(82 <= i % 128 < 88 and 29 <= i // 128 < 36)

    def test_premultiplied_filter_does_not_include_transparent_matte(self):
        pixels = bytearray(128 * 112 * 4)
        pixels[:8] = bytes([200, 100, 20, 255, 0, 255, 255, 0])
        sample = rig.sample(pixels, ["torso"] * (128 * 112), "torso", .5, 0)
        self.assertEqual(sample, [100, 50, 10, 127.5])

    def test_seam_failure_never_becomes_acceptance(self):
        result = bytearray(self.pixels)
        result[(60 * 128 + 80) * 4 + 3] = 0
        report = rig.report(self.pixels, result, "I2")
        self.assertEqual(report["numerical_status"], "reject")
        self.assertGreater(report["uncovered_opaque_pixels"], 0)
        self.assertNotIn("status", report)  # Not a packer acceptance record.

    def test_loop_has_one_period_and_positive_seam_timing(self):
        clip = rig.CLIPS["breathing"]
        self.assertEqual(clip["frames"], ["I0", "I1", "I2", "I3", "I2", "I1"])
        self.assertEqual(sum(clip["durations"]), 1200)
        for clip in rig.CLIPS.values():
            self.assertEqual(len(clip["frames"]), len(clip["durations"]))
            self.assertTrue(all(ms > 0 for ms in clip["durations"]))
            self.assertEqual(clip["terminalFrame"], clip["frames"][-1])
            self.assertEqual(clip["restFrame"], "I0")

    def test_repeat_export_lossless_and_interruption_preserves_completion(self):
        with tempfile.TemporaryDirectory(dir=rig.ROOT) as directory:
            output = Path(directory)
            first = rig.generate(output)
            pointer = (output / "complete.json").read_bytes()
            self.assertEqual(rig.generate(output), first)
            def interrupt(stage):
                if stage == "I2.webp":
                    raise RuntimeError("interrupted")
            with self.assertRaises(RuntimeError):
                rig.generate(output, interrupt)
            self.assertEqual((output / "complete.json").read_bytes(), pointer)
            self.assertFalse((output / ".publish.lock").exists())
            (output / ".publish.lock").write_text("123")
            with self.assertRaisesRegex(ValueError, "publisher active"):
                rig.generate(output)
            self.assertEqual((output / ".publish.lock").read_text(), "123")
            self.assertEqual(first["status"], "draft-not-accepted")
            sheet = rig.pack.rgba(output / first["files"]["sheet.webp"]["file"])
            for identifier in rig.IDS:
                index = rig.IDS.index(identifier)
                if first["frames"][identifier]["numerical_status"] == "reject":
                    self.assertNotIn(f"{identifier}.webp", first["files"])
                    for y in range(114):
                        start = (y * 1040 + index * 130) * 4
                        self.assertEqual(sheet[start:start + 520], bytes(520))
                    continue
                entry = first["files"][f"{identifier}.webp"]
                expected = rig.bake(self.pixels, self.spec, identifier)
                self.assertEqual(rig.pack.rgba(output / entry["file"]), expected)
                for y in range(112):
                    start = ((y + 1) * 1040 + index * 130 + 1) * 4
                    self.assertEqual(sheet[start:start + 512], expected[y * 512:(y + 1) * 512])
                    self.assertEqual(sheet[start - 4:start], bytes(4))
                    self.assertEqual(sheet[start + 512:start + 516], bytes(4))
            self.assertEqual(sheet[:1040 * 4], bytes(1040 * 4))
            self.assertEqual(sheet[-1040 * 4:], bytes(1040 * 4))


if __name__ == "__main__":
    unittest.main()
