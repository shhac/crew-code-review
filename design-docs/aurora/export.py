# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Keys, crops and exports the northern lights art. Run: uv run design-docs/aurora/export.py

The steps are shared with the other themes (../art.py). Everything is exported
at twice its display size for high-density screens; the display sizes printed
are what the components lay out (fox.ts's POSES and AuroraShelf.svelte).
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import crop, export, keyed, poses  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/aurora'
FOX = ['fox-curled', 'fox-alert', 'fox-trot', 'fox-bow', 'fox-pounce']
# The poses still shipped: curled up, asleep or looking up. Standing and
# moving, the fox is put together from PARTS, with legs drawn in code.
SHIPPED = ['fox-curled', 'fox-alert']
PARTS = ['fox-tail', 'fox-torso', 'fox-head']


def main() -> None:
    sizes = {}
    kit = crop(keyed(HERE / 'winter-kit.png'))
    sizes['winter-kit'] = export(kit, OUT, 'winter-kit', 2 * 62 / kit.shape[0])
    sheet = [crop(p) for p in poses(keyed(HERE / 'fox-sheet.png'), len(FOX))]
    # Every pose shares the trotting fox's scale: 19px tall standing.
    scale = 2 * 19 / sheet[FOX.index('fox-trot')].shape[0]
    for name, art in zip(FOX, sheet):
        if name in SHIPPED:
            sizes[name] = export(art, OUT, name, scale)
    # The parts at one scale, so they fit back together: the head as tall
    # as the trotting fox's was, ears to chin.
    parts = dict(zip(PARTS, (crop(p) for p in poses(keyed(HERE / 'fox-parts.png'), len(PARTS)))))
    part_scale = 2 * 10 / parts['fox-head'].shape[0]
    for name, art in parts.items():
        sizes[name] = export(art, OUT, name, part_scale)
    for name, (w, h) in sizes.items():
        print(f'{name}: {w}x{h} (display {w / 2:g}x{h / 2:g})')


if __name__ == '__main__':
    main()
