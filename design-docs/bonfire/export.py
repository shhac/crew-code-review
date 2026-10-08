# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Keys, crops and exports the Bonfire Night art. Run: uv run design-docs/bonfire/export.py

The steps are shared with the other themes (../art.py). Everything is exported
at twice its display size for high-density screens; the display sizes below
are what the components lay out.
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import crop, export, keyed, poses  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/bonfire'


def main() -> None:
    sizes = {}
    # Display heights in page pixels; exported at twice that.
    for name, height in [('bonfire', 92), ('toffee-apples', 34)]:
        art = crop(keyed(HERE / f'{name}.png'))
        sizes[name] = export(art, OUT, name, 2 * height / art.shape[0])
    pile = crop(keyed(HERE / 'woodpile.png'))
    sizes['woodpile'] = export(pile, OUT, 'woodpile', 2 * 20 / pile.shape[0])
    walk, ball = (crop(h) for h in poses(keyed(HERE / 'hedgehog-sheet.png'), 2))
    # Both poses share the walking hedgehog's scale, so the ball is its size.
    scale = 2 * 26 / walk.shape[1]
    sizes['hedgehog-walk'] = export(walk, OUT, 'hedgehog-walk', scale)
    sizes['hedgehog-ball'] = export(ball, OUT, 'hedgehog-ball', scale)
    for name, (w, h) in sizes.items():
        print(f'{name}: {w}x{h} (display {w / 2:g}x{h / 2:g})')


if __name__ == '__main__':
    main()
