"""Offline regression tests for actual shelf exports and staged failure recovery."""
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('shelf', ROOT / 'export-shelf.py')
shelf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shelf)

class ShelfTests(unittest.TestCase):
    def test_actual_exports(self):
        manifest = json.loads((ROOT / '2026-10-03-shelf-manifest.json').read_text())
        self.assertEqual(shelf.sha(ROOT / 'originals/christmas-shelf-generated-original.png'), manifest['source_sha256'])
        runtime = ROOT.parents[1] / 'internal/dashboard/ui/src/lib/theme/christmas'
        for name in shelf.LAYERS:
            png, webp = ROOT / f'aligned/{name}.png', runtime / f'{name}.webp'
            self.assertEqual(shelf.validate(name, png), shelf.validate(name, webp))
            self.assertEqual(shelf.sha(png), manifest['outputs'][png.name])
            self.assertEqual(shelf.sha(webp), manifest['outputs'][webp.name])

    def test_invalid_candidates(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            path = Path(temporary) / 'invalid.png'
            for size, color in [('176x166', 'white'), ('175x166', 'none'), ('176x166', 'none')]:
                subprocess.run(['magick', '-size', size, f'xc:{color}', str(path)], check=True)
                with self.assertRaises(ValueError): shelf.validate('tree', path)
            path.write_bytes(b'corrupt')
            with self.assertRaises(subprocess.CalledProcessError): shelf.validate('tree', path)
            path.unlink()
            with self.assertRaises(subprocess.CalledProcessError): shelf.validate('tree', path)

    def test_shifted_asset_invalidates_evidence(self):
        manifest = json.loads((ROOT / '2026-10-03-shelf-manifest.json').read_text())
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            path = Path(temporary) / 'tree.png'
            subprocess.run(['magick', str(ROOT / 'aligned/tree.png'), '-roll', '+1+0', str(path)], check=True)
            with self.assertRaises(ValueError): shelf.verify('tree', path, manifest)

    def test_wrong_tool_stops_export(self):
        with patch.object(shelf.subprocess, 'check_output', return_value='1.5.0'):
            with self.assertRaises(RuntimeError): shelf.export()

    def test_bulb_centroids_and_foreground_clearance(self):
        _, rgba = shelf.decode(ROOT / 'aligned/tree.png')
        estimates = [(298,400), (413,379), (525,325), (363,511), (517,548), (642,550), (417,663)]
        for (sx, sy), (x, y) in zip(estimates, shelf.BULBS):
            cx, cy = 5 + (sx-60)*166/784, (sy-60)*166/784
            points = [(i % 176, i // 176) for i in range(176*166)
                      if abs(i % 176-cx) < 4 and abs(i // 176-cy) < 4
                      and rgba[i*4] > 225 and rgba[i*4+1] > 205
                      and rgba[i*4+2] > 145 and rgba[i*4+3] > 240]
            self.assertEqual([round(sum(p[k] for p in points)/len(points), 2) for k in (0,1)], [x,y])
            self.assertLess(x/2 + 4, 68)  # Entire halo clears the foreground cell.

    def test_interruption_and_rerun(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            root = Path(temporary)
            (root / 'originals').mkdir()
            source = root / 'originals/christmas-shelf-generated-original.png'
            shutil.copyfile(ROOT / 'originals/christmas-shelf-generated-original.png', source)
            runtime = root / 'runtime'
            runtime.mkdir()
            (runtime / 'tree.webp').write_bytes(b'previous')
            def fail(command, **kwargs):
                if 'presents.png' in command[-1]: raise RuntimeError('injected interruption')
                return subprocess.run(command, **kwargs)
            with self.assertRaises(RuntimeError): shelf.export(root, runtime, fail)
            self.assertEqual((runtime / 'tree.webp').read_bytes(), b'previous')
            shelf.export(root, runtime)
            # Recover a mixed promotion by regenerating the complete pair.
            (runtime / 'tree.webp').write_bytes(b'interrupted promotion')
            shelf.export(root, runtime)
            for name in shelf.LAYERS:
                self.assertEqual(shelf.sha(runtime / f'{name}.webp'), shelf.sha(ROOT / f'aligned/{name}.webp'))
            source.write_bytes(b'changed')
            with self.assertRaises(ValueError): shelf.export(root, runtime)

if __name__ == '__main__': unittest.main()
