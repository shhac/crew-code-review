# /// script
# dependencies = ["pillow==12.3.0", "numpy==2.5.4"]
# ///
"""Writes outlines.ts for pictures no export.py writes: the Halloween spider's,
drawn before the theme exports kept outlines, and the Christmas robin's
parts, which its parts-prototype/prepare.mjs writes with ImageMagick. Each
picture's outline (art.py's) is read off the shipped WebP itself.
Run: uv run design-docs/outlines.py
"""
from pathlib import Path
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from art import OUTLINES, outline, write_outlines  # noqa: E402

THEME = Path(__file__).resolve().parents[1] / 'internal/dashboard/ui/src/lib/theme'
# Each folder, and the pictures in it that a critter draws.
FOLDERS = {
    'halloween': ['spider-body', 'leg-thigh', 'leg-shin'],
    'christmas/robin-parts': sorted(p.stem for p in (THEME / 'christmas/robin-parts').glob('*.webp')),
}


def main() -> None:
    for folder, names in FOLDERS.items():
        out = THEME / folder
        for name in names:
            OUTLINES.setdefault(out, {})[name] = outline(np.asarray(Image.open(out / f'{name}.webp').convert('RGBA')))
        write_outlines(out, 'design-docs/outlines.py')


if __name__ == '__main__':
    main()
