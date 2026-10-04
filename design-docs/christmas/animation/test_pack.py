"""Synthetic acceptance records test publication, never certify generated art."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import pack


class PackingTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.index = self.root / "index.json"
        self.out = self.root / "packed"
        # Reuse accepted CCR-4 pixels as a test fixture ONLY. These are never
        # written into this task's accepted inventory or called generated frames.
        reference = Path(__file__).resolve().parents[1] / "aligned/robin-perch.webp"
        data = reference.read_bytes()
        (self.root / "fixture.webp").write_bytes(data)
        report = pack.encode_json({"status": "pass", "frame_sha256": pack.digest(data)})
        (self.root / "report.json").write_bytes(report)
        self.frames = {identifier: {"file": "fixture.webp", "sha256": pack.digest(data),
                       "report": "report.json", "report_sha256": pack.digest(report),
                       "numerical_status": "pass", "identity_status": "accepted"} for identifier in pack.IDS}
        self.write_index()

    def write_index(self):
        self.index.write_bytes(pack.encode_json({"frames": self.frames}))

    def test_deterministic_lossless_sheet_rectangles_and_gutters(self):
        manifest = pack.pack(self.index, self.out)
        first = (self.out / "manifest.json").read_bytes()
        self.assertEqual(pack.pack(self.index, self.out), manifest)
        self.assertEqual(first, (self.out / "manifest.json").read_bytes())
        sheet = pack.rgba(self.out / next(iter(manifest["sheets"])))
        pixels = pack.rgba(self.root / "fixture.webp")
        self.assertEqual(pack.rgba(self.out / manifest["fallback"]["file"]), pixels)
        for frame in manifest["frames"].values():
            for y in range(112):
                start = ((y + 1) * pack.WIDTH + frame["x"]) * 4
                self.assertEqual(sheet[start:start + 512], pixels[y * 512:(y + 1) * 512])
                self.assertEqual(sheet[start - 4:start], bytes(4))
                self.assertEqual(sheet[start + 512:start + 516], bytes(4))
        for animation in manifest["clips"].values():
            self.assertEqual(animation["terminalFrame"], animation["frames"][-1])
            self.assertEqual(animation["restFrame"], "I0")
            self.assertTrue(all(duration > 0 for duration in animation["durations"]))
            if animation["loop"]:
                self.assertNotEqual(animation["frames"][0], animation["frames"][-1])

    def test_failures_preserve_previous_manifest_and_release_lock(self):
        pack.pack(self.index, self.out)
        previous = (self.out / "manifest.json").read_bytes()
        for stage in ["validated", "encoded", "sheet-published", "manifest-staged"]:
            def interrupt(current):
                if stage == current:
                    raise RuntimeError("injected interruption")
            with self.assertRaises(RuntimeError):
                pack.pack(self.index, self.out, interrupt)
            self.assertEqual(previous, (self.out / "manifest.json").read_bytes())
            self.assertFalse((self.out / ".publish.lock").exists())
            self.assertFalse(list(self.out.glob(".pack-*")))
        self.assertEqual(pack.pack(self.index, self.out), json.loads(previous))

    def test_concurrent_publishers_cannot_remove_each_others_lock(self):
        self.out.mkdir()
        lock = self.out / ".publish.lock"
        lock.write_text("other publisher")
        with self.assertRaises(FileExistsError):
            pack.pack(self.index, self.out)
        self.assertEqual(lock.read_text(), "other publisher")

    def test_rejects_unaccepted_missing_and_mismatched_evidence(self):
        original = dict(self.frames["I0"])
        for change in [{"numerical_status": "failed"}, {"identity_status": "pending"},
                       {"sha256": "wrong"}, {"report_sha256": "wrong"},
                       {"file": "../fixture.webp"}, {"report": "absent.json"}]:
            self.frames["I0"] = {**original, **change}; self.write_index()
            with self.assertRaises((ValueError, FileNotFoundError)):
                pack.pack(self.index, self.out)
            self.assertFalse((self.out / "manifest.json").exists())
        del self.frames["I0"]; self.write_index()
        with self.assertRaises(ValueError):
            pack.pack(self.index, self.out)

    def test_exporter_failure_cannot_publish(self):
        with patch.object(pack.subprocess, "run", side_effect=OSError("export failed")):
            with self.assertRaises(OSError):
                pack.pack(self.index, self.out)
        self.assertFalse((self.out / "manifest.json").exists())
        self.assertFalse((self.out / ".publish.lock").exists())

    def test_restart_rejects_corrupt_previous_inventory(self):
        manifest = pack.pack(self.index, self.out)
        previous = (self.out / "manifest.json").read_bytes()
        (self.out / manifest["fallback"]["file"]).write_bytes(b"corrupt")
        with self.assertRaises(ValueError):
            pack.pack(self.index, self.out)
        self.assertEqual(previous, (self.out / "manifest.json").read_bytes())

    def test_input_replacement_after_hash_verification_decodes_only_snapshots(self):
        original_pixels = pack.rgba(self.root / "fixture.webp")
        replacement_pixels = bytearray(original_pixels)
        offset = next(i for i in range(0, len(replacement_pixels), 4) if replacement_pixels[i + 3] > 128)
        replacement_pixels[offset] = (replacement_pixels[offset] + 1) % 256
        replacement = pack.export_webp(self.root, "replacement", replacement_pixels, 128, 112)
        decode = pack.artwork.decode
        replaced = False

        def replace_sources(path):
            nonlocal replaced
            if not replaced:
                replaced = True
                (self.root / "fixture.webp").write_bytes(replacement)
                (self.root / "report.json").write_bytes(b"replacement report")
                self.index.write_bytes(b"replacement index")
            return decode(path)

        with patch.object(pack.artwork, "decode", side_effect=replace_sources):
            manifest = pack.pack(self.index, self.out)
        self.assertTrue(replaced)
        self.assertEqual(pack.digest(pack.rgba(self.out / manifest["fallback"]["file"])), pack.digest(original_pixels))

    def test_changed_inventory_failure_keeps_previous_generation_usable(self):
        first = pack.pack(self.index, self.out)
        previous = (self.out / "manifest.json").read_bytes()
        pixels = bytearray(pack.rgba(self.root / "fixture.webp"))
        pixel = next(i for i in range(0, len(pixels), 4) if pixels[i + 3] > 128)
        pixels[pixel] = (pixels[pixel] + 1) % 256
        raw = self.root / "changed.rgba"
        raw.write_bytes(pixels)
        changed = self.root / "changed.png"
        pack.subprocess.run(["magick", "-size", "128x112", "-depth", "8", f"rgba:{raw}", "-strip", str(changed)], check=True)
        data = changed.read_bytes()
        report = pack.encode_json({"status": "pass", "frame_sha256": pack.digest(data)})
        (self.root / "changed.json").write_bytes(report)
        self.frames["I0"].update(file="changed.png", sha256=pack.digest(data),
                                 report="changed.json", report_sha256=pack.digest(report))
        self.write_index()
        # Force a failure after a new generation has encoded. The old pointer
        # must not change even when the input evidence differs.
        def interrupt(stage):
            if stage == "encoded":
                raise RuntimeError("interrupted changed generation")
        with self.assertRaises(RuntimeError):
            pack.pack(self.index, self.out, interrupt)
        self.assertEqual(previous, (self.out / "manifest.json").read_bytes())
        self.assertEqual(pack.rgba(self.out / first["fallback"]["file"]), pack.rgba(self.root / "fixture.webp"))

    def test_process_termination_leaves_old_manifest_valid_and_requires_verified_lock_recovery(self):
        first = pack.pack(self.index, self.out)
        previous = (self.out / "manifest.json").read_bytes()
        pixels = bytearray(pack.rgba(self.root / "fixture.webp"))
        offset = next(i for i in range(0, len(pixels), 4) if pixels[i + 3] > 128)
        pixels[offset] = (pixels[offset] + 1) % 256
        raw = self.root / "new.rgba"
        raw.write_bytes(pixels)
        changed = self.root / "new.png"
        pack.subprocess.run(["magick", "-size", "128x112", "-depth", "8", f"rgba:{raw}", "-strip", str(changed)], check=True)
        data = changed.read_bytes()
        report = pack.encode_json({"status": "pass", "frame_sha256": pack.digest(data)})
        (self.root / "new.json").write_bytes(report)
        self.frames["I0"].update(file="new.png", sha256=pack.digest(data),
                                 report="new.json", report_sha256=pack.digest(report))
        self.write_index()
        for failure_stage in ["sheet-published", "manifest-staged"]:
            pid = os.fork()
            if pid == 0:
                def terminate(stage):
                    if stage == failure_stage:
                        os._exit(97)  # no finally/TemporaryDirectory cleanup
                pack.pack(self.index, self.out, terminate)
                os._exit(98)
            _, status = os.waitpid(pid, 0)
            self.assertEqual(os.waitstatus_to_exitcode(status), 97)
            self.assertEqual(previous, (self.out / "manifest.json").read_bytes())
            self.assertEqual(pack.digest((self.out / first["fallback"]["file"]).read_bytes()), first["fallback"]["sha256"])
            lock = self.out / ".publish.lock"
            self.assertEqual(int(lock.read_text()), pid)
            self.assertTrue(list(self.out.glob(".pack-*")))
            with self.assertRaises(FileExistsError):
                pack.pack(self.index, self.out)
            # The documented manual recovery verifies the owner is gone. Stale
            # staging is not reused or automatically deleted by a new publisher.
            with self.assertRaises(ProcessLookupError):
                os.kill(pid, 0)
            lock.unlink()
        recovered = pack.pack(self.index, self.out)
        self.assertNotEqual(recovered["fallback"]["sha256"], first["fallback"]["sha256"])
        self.assertEqual(pack.rgba(self.out / recovered["fallback"]["file"]), pixels)


if __name__ == "__main__":
    unittest.main()
