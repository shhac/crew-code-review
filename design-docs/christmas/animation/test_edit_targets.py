import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

import guide
import pack
import rig

spec = importlib.util.spec_from_file_location("edit_targets", rig.ROOT / "edit-targets.py")
edit_targets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(edit_targets)


class EditTargetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pixels = pack.rgba(guide.REFERENCE)
        cls.masks = json.loads((rig.ROOT / "rig-masks.json").read_bytes())

    def test_registered_targets_preserve_context_and_chroma(self):
        for polygon in edit_targets.POSES.values():
            target, mask = edit_targets.target(self.pixels, self.masks, polygon)
            self.assertEqual(len(target), len(self.pixels))
            self.assertEqual(target[:4], bytes([0, 255, 255, 255]))
            self.assertEqual(set(target[3::4]), {255})
            self.assertEqual(set(mask[0::4]), {0, 255})
            for i in range(128 * 112):
                if not rig.inside(i % 128 + .5, i // 128 + .5, polygon):
                    r, g, b, a = self.pixels[i * 4:i * 4 + 4]
                    expected = bytes([round(r * a / 255), round(g * a / 255 + 255 * (1 - a / 255)), round(b * a / 255 + 255 * (1 - a / 255)), 255])
                    self.assertEqual(target[i * 4:i * 4 + 4], expected)

    def test_publication_restart_and_competing_writer(self):
        with tempfile.TemporaryDirectory(dir=rig.ROOT) as directory:
            output = Path(directory)
            first = edit_targets.generate(output)
            pointer = (output / "targets.json").read_bytes()
            self.assertEqual(edit_targets.generate(output), first)
            def interrupt(stage):
                if stage == "F1-target.png":
                    raise RuntimeError("interrupted")
            with self.assertRaises(RuntimeError):
                edit_targets.generate(output, interrupt)
            self.assertEqual((output / "targets.json").read_bytes(), pointer)
            for entry in first["poses"].values():
                for filename, digest in entry["files"].items():
                    self.assertEqual(pack.digest((output / filename).read_bytes()), digest)
            (output / ".publish.lock").write_text("123")
            with self.assertRaisesRegex(ValueError, "publisher active"):
                edit_targets.generate(output)
            self.assertEqual((output / ".publish.lock").read_text(), "123")
            self.assertEqual(first["status"], "edit-scaffolds-not-artwork")


if __name__ == "__main__":
    unittest.main()
