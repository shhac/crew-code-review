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
    # The ball keeps the scale of the walking hedgehog it was drawn beside.
    sizes['hedgehog-ball'] = export(ball, OUT, 'hedgehog-ball', 2 * 26 / walk.shape[1])
    # The parts the walking hedgehog is put together from (legs are code):
    # both at the body's scale, so they fit back together.
    body, head = (crop(p) for p in poses(keyed(HERE / 'hedgehog-parts.png'), 2))
    scale = 2 * 15 / body.shape[0]
    sizes['hedgehog-body'] = export(body, OUT, 'hedgehog-body', scale)
    sizes['hedgehog-head'] = export(head, OUT, 'hedgehog-head', scale)
    for name, (w, h) in sizes.items():
        print(f'{name}: {w}x{h} (display {w / 2:g}x{h / 2:g})')


if __name__ == '__main__':
    main()
