import importlib.util
import json
from pathlib import Path
import tempfile
import subprocess
import unittest
from unittest.mock import patch

import guide
import pack
import rig

spec = importlib.util.spec_from_file_location("ship_rig", rig.ROOT / "ship-rig.py")
ship = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ship)


class ShippedRigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reference = pack.rgba(guide.REFERENCE)
        cls.masks = json.loads((rig.ROOT / "rig-masks.json").read_bytes())

    def test_partial_write_is_private_and_restart_preserves_runtime(self):
        with tempfile.TemporaryDirectory(dir=rig.ROOT) as directory:
            directory = Path(directory)
            manifest = directory / "manifest.json"
            manifest.write_bytes(b"previous runtime")
            payload = b"new complete evidence"
            final = directory / (pack.digest(payload) + "-frame.webp")
            def partial_write(path, data):
                path.write_bytes(data[:3])
                raise OSError("interrupted write")
            with patch.object(pack, "synced_write", side_effect=partial_write):
                with self.assertRaises(OSError):
                    ship.publish(directory / "frame.webp", payload)
            self.assertFalse(final.exists())
            self.assertEqual(manifest.read_bytes(), b"previous runtime")
            with patch.object(pack, "synced_write", side_effect=lambda path, data: path.write_bytes(data[:3])):
                with self.assertRaisesRegex(ValueError, "Incomplete staged artifact"):
                    ship.publish(directory / "frame.webp", payload)
            self.assertFalse(final.exists())
            ship.publish(directory / "frame.webp", payload)
            self.assertEqual(final.read_bytes(), payload)
            self.assertEqual(manifest.read_bytes(), b"previous runtime")

    def test_committed_gifs_coalesce_to_discrete_frames_without_contour_accumulation(self):
        root = rig.ROOT / "accepted"
        pointer = json.loads((root / "complete.json").read_bytes())
        inventory = json.loads((root / pointer["file"]).read_bytes())
        for preview in inventory["previews"].values():
            gif = root / preview["gif"]
            disposal = subprocess.check_output(["magick", "identify", "-format", "%D\\n", str(gif)], text=True)
            self.assertEqual(disposal.splitlines(), ["Background"] * len(preview["clip"]["frames"]))
            raw = subprocess.check_output(["magick", str(gif), "-depth", "8", "rgba:-"])
            coalesced = subprocess.check_output(["magick", str(gif), "-coalesce", "-depth", "8", "rgba:-"])
            self.assertEqual(len(raw), 128 * 112 * 4 * len(preview["clip"]["frames"]))
            self.assertEqual(raw[3::4], coalesced[3::4])
            for i in range(0, len(raw), 4):
                if raw[i + 3]:
                    self.assertEqual(raw[i:i + 3], coalesced[i:i + 3])

    def test_committed_inventory_has_exact_neutral_cells_gutters_and_source_identity(self):
        manifest = json.loads((ship.RUNTIME / "manifest.json").read_bytes())
        self.assertEqual(set(manifest["frames"]), set(ship.IDS))
        self.assertEqual(set(manifest["clips"]), {"breathing", "blink"})
        sheet_name = next(iter(manifest["sheets"]))
        sheet = pack.rgba(ship.RUNTIME / sheet_name)
        self.assertEqual(pack.digest((ship.RUNTIME / sheet_name).read_bytes()), manifest["sheets"][sheet_name]["sha256"])
        self.assertEqual(manifest["fallback"]["sha256"], guide.IDENTITY_HASH)
        for identifier, rectangle in manifest["frames"].items():
            expected = rig.bake(self.reference, self.masks, identifier)
            x, y = rectangle["x"], rectangle["y"]
            for row in range(112):
                start = ((y + row) * 780 + x) * 4
                self.assertEqual(sheet[start:start + 512], expected[row * 512:(row + 1) * 512])
                self.assertEqual(sheet[start - 4:start], bytes(4))
                self.assertEqual(sheet[start + 512:start + 516], bytes(4))
            self.assertFalse(pack.artwork.validate("robin-perch", 128, 112, expected[3::4]))
        self.assertEqual(sheet[:780 * 4], bytes(780 * 4))
        self.assertEqual(sheet[-780 * 4:], bytes(780 * 4))

    def test_reports_reject_identity_palette_source_and_foot_changes(self):
        for x, y in [(85, 30), (80, 92)]:
            pixels = bytearray(rig.bake(self.reference, self.masks, "I1"))
            pixels[(y * 128 + x) * 4] ^= 1
            with self.assertRaises(ValueError):
                ship.measurements(self.reference, bytes(pixels), self.masks, "I1")
        pixels = bytearray(self.reference)
        pixels[(40 * 128 + 90) * 4] ^= 1
        with self.assertRaises(ValueError):
            ship.measurements(self.reference, bytes(pixels), self.masks, "B1")
        pixels = bytearray(rig.bake(self.reference, self.masks, "I1"))
        pixels[(70 * 128 + 80) * 4:(70 * 128 + 80) * 4 + 3] = bytes([0, 0, 255])
        with self.assertRaisesRegex(ValueError, "palette drift"):
            ship.measurements(self.reference, bytes(pixels), self.masks, "I1")

    def test_repeat_publication_interruption_export_failure_and_writer_lock(self):
        with tempfile.TemporaryDirectory(dir=rig.ROOT) as directory:
            runtime, evidence = Path(directory) / "runtime", Path(directory) / "evidence"
            first = ship.generate(runtime, evidence)
            before = (runtime / "manifest.json").read_bytes()
            self.assertEqual(ship.generate(runtime, evidence), first)
            def interrupt(stage):
                if stage == "before-manifest":
                    raise RuntimeError("interrupted")
            with self.assertRaises(RuntimeError):
                ship.generate(runtime, evidence, interrupt)
            self.assertEqual((runtime / "manifest.json").read_bytes(), before)
            with patch.object(ship.rig, "png", side_effect=RuntimeError("export failure")):
                with self.assertRaises(RuntimeError):
                    ship.generate(runtime, evidence)
            self.assertEqual((runtime / "manifest.json").read_bytes(), before)
            self.assertFalse((runtime / ".publish.lock").exists())
            (runtime / ".publish.lock").write_text("123")
            with self.assertRaisesRegex(ValueError, "publisher active"):
                ship.generate(runtime, evidence)
            self.assertEqual((runtime / ".publish.lock").read_text(), "123")
            for sheet in first[0]["sheets"]:
                self.assertEqual(pack.digest((runtime / sheet).read_bytes()), first[0]["sheets"][sheet]["sha256"])

    def test_changed_inventory_failure_keeps_prior_sheet_then_restart_publishes_new_generation(self):
        with tempfile.TemporaryDirectory(dir=rig.ROOT) as directory:
            runtime, evidence = Path(directory) / "runtime", Path(directory) / "evidence"
            original, _ = ship.generate(runtime, evidence)
            previous = (runtime / "manifest.json").read_bytes()
            bake = rig.bake
            def changed(reference, masks, identifier):
                pixels = bytearray(bake(reference, masks, identifier))
                if identifier == "B1":
                    pixels[(30 * 128 + 83) * 4:(30 * 128 + 83) * 4 + 3] = reference[(31 * 128 + 80) * 4:(31 * 128 + 80) * 4 + 3]
                return bytes(pixels)
            def interrupted(stage):
                if stage == "before-manifest":
                    raise RuntimeError("interrupted changed inventory")
            with patch.object(ship.rig, "bake", side_effect=changed):
                with self.assertRaises(RuntimeError):
                    ship.generate(runtime, evidence, interrupted)
                self.assertEqual((runtime / "manifest.json").read_bytes(), previous)
                current, _ = ship.generate(runtime, evidence)
                self.assertNotEqual(current["sheets"], original["sheets"])
            for name, metadata in original["sheets"].items():
                self.assertEqual(pack.digest((runtime / name).read_bytes()), metadata["sha256"])


if __name__ == "__main__":
    unittest.main()
