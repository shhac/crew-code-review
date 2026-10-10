# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Keys, crops and exports the seaside shelf art. Run: uv run design-docs/seaside/export_shelf.py

The steps are shared with the other themes (../art.py). The shelf's chips,
bucket and spade and 99 are one picture, exported at twice its display size.
The gull's pictures are exported by export.py; this step joins it there once
the gull's files are handed over.
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import crop, export, keyed  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/seaside'
# The kit's height on the shelf, in page pixels.
KIT_HEIGHT = 64


def shelf() -> None:
    kit = crop(keyed(HERE / 'seaside-kit-2.png'))
    size = export(kit, OUT, 'seaside-kit', 2 * KIT_HEIGHT / kit.shape[0])
    print(f'seaside-kit: display {size[0] / 2:g}x{size[1] / 2:g}')


if __name__ == '__main__':
    shelf()
