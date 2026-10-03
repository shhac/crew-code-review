"""Offline export-gate regressions: python3 -m unittest discover -s this-directory."""
import importlib.util
import math
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("artwork", ROOT / "validate-artwork.py")
artwork = importlib.util.module_from_spec(spec)
spec.loader.exec_module(artwork)


class ArtworkTests(unittest.TestCase):
    def test_actual_lossless_exports(self):
        for name in artwork.NAMES:
            with self.subTest(name=name):
                webp = artwork.decode(ROOT / "aligned" / f"{name}.webp")
                png = artwork.decode(ROOT / "aligned" / f"{name}.png")
                self.assertEqual(webp, png)
                runtime = ROOT.parents[1] / "internal/dashboard/ui/src/lib/theme/christmas" / f"{name}.webp"
                actual = artwork.decode(runtime)
                self.assertEqual(artwork.validate(name, *actual), [])
                self.assertEqual(actual[:2], (96, 64) if name == "holly" else (128, 112))
                self.assertEqual(runtime.read_bytes(), (ROOT / "aligned" / f"{name}.webp").read_bytes())
                self.assertEqual(webp[:2], (96, 64) if name == "holly" else (128, 112))
                self.assertIn(0, webp[2])
                self.assertTrue(any(0 < v < 255 for v in webp[2]))
                self.assertEqual(artwork.validate(name, *webp), [])
                for path in (runtime, ROOT / "aligned" / f"{name}.png"):
                    rgba = subprocess.check_output(["magick", str(path), "-depth", "8", "rgba:-"])
                    if path == runtime:
                        runtime_rgba = rgba
                    else:
                        self.assertEqual(runtime_rgba, rgba)

    def test_faint_pixel_below_feet_is_rejected(self):
        a = bytearray(128 * 112)
        a[40 * 128 + 64] = 128
        self.assertEqual(artwork.validate("robin-perch", 128, 112, a), [])
        a[106 * 128 + 64] = 1
        self.assertEqual(artwork.validate("robin-perch", 128, 112, a)[0]["pixel"], [64, 106])

    def test_wrong_dimensions_empty_and_opaque_assets(self):
        for w, h, a in [(127, 112, bytes(127 * 112)), (128, 112, bytes(128 * 112)),
                        (128, 112, bytes([255]) * (128 * 112))]:
            with self.assertRaises(ValueError):
                artwork.validate("robin-perch", w, h, a)

    def test_missing_and_corrupt_assets(self):
        for path in (ROOT / "missing.webp", ROOT / "validate-artwork.py"):
            with self.assertRaises(subprocess.CalledProcessError):
                artwork.decode(path)

    def test_rotation_interior_extrema(self):
        angle = math.radians(2)
        low, high = artwork.extrema(math.cos(angle), math.sin(angle),
                                    -math.radians(5), math.radians(5))
        self.assertAlmostEqual(high, 1)
        self.assertLess(low, high)
        endpoints = [math.cos(angle) * math.cos(t) + math.sin(angle) * math.sin(t)
                     for t in (-math.radians(5), math.radians(5))]
        self.assertGreater(high, max(endpoints))

    def test_shifted_registration_is_rejected(self):
        a = bytearray(128 * 112)
        a[98 * 128 + 64] = 128
        self.assertEqual(artwork.validate("robin-perch", 128, 112, a), [])
        a[100 * 128 + 64] = 128
        self.assertTrue(artwork.validate("robin-perch", 128, 112, a))

    def test_painted_overlap_surrounds_wing_pivot(self):
        # The rotation-invariant radius-three root disk stays on continuous
        # body paint. This does not replace visual inspection of feather seams.
        for name in ("robin-flight", "robin-flight-wing"):
            w, _, alpha = artwork.decode(ROOT / "aligned" / f"{name}.webp")
            for y in range(54, 61):
                for x in range(61, 68):
                    self.assertGreater(alpha[y * w + x], 240)


if __name__ == "__main__":
    unittest.main()
