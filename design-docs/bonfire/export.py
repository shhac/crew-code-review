# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Keys, crops and exports the Bonfire Night art. Run: uv run design-docs/bonfire/export.py

The steps are shared with the other themes (../art.py). The shelf art is
exported at twice its display size, the woodpile, which sits by the
hedgehogs, at four times. The hedgehog's
pictures (its ball, and the parts it is put together from) are all put on
one scale, the eye's, so every pose is the same animal; they are written at
RES pixels per drawing unit, and hedgehog-rig.ts sets how big a drawing unit
is on the page. The sizes printed are what the components lay out.
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import crop, export, feature, fill_only, keyed, poses, rows  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/bonfire'
# The eye's size in drawing units, and file pixels per drawing unit.
EYE = 1.82
RES = 12
# Where each sheet's eye is (source pixels), measured by eye.
EYES = {'hedgehog-sheet.png': (705, 480), 'hedgehog-parts-2.png': (1487, 490)}
# The legs' thickness, outline included, in drawing units; and each foot's
# length, and where on it (as fractions of its box) the leg comes down: its
# heel, as it walks on its soles. The front feet are like little hands, the
# hind ones longer paws.
LEG = 2.3
FEET = {'hedgehog-hand': (3.4, (0.27, 0.35)), 'hedgehog-hind': (4.2, (0.2, 0.35))}


def on_eye(sheet: str) -> float:
    return EYE / feature(HERE / sheet, EYES[sheet]) * RES


def main() -> None:
    sizes = {}
    # Display heights in page pixels, and how many file pixels to each.
    for name, height, density in [('bonfire', 92, 2), ('toffee-apples', 34, 2), ('woodpile', 25, 4)]:
        art = crop(keyed(HERE / f'{name}.png'))
        size = export(art, OUT, name, density * height / art.shape[0])
        sizes[name] = (size[0] / density, size[1] / density)
    units = {}
    _, ball = (crop(h) for h in poses(keyed(HERE / 'hedgehog-sheet.png'), 2))
    units['hedgehog-ball'] = export(ball, OUT, 'hedgehog-ball', on_eye('hedgehog-sheet.png'))
    body, head = (crop(p) for p in poses(keyed(HERE / 'hedgehog-parts-2.png'), 2))
    units['hedgehog-body'] = export(body, OUT, 'hedgehog-body', on_eye('hedgehog-parts-2.png'))
    units['hedgehog-head'] = export(head, OUT, 'hedgehog-head', on_eye('hedgehog-parts-2.png'))
    # Each leg is one bone piece, hip to ankle (too short to show a knee),
    # standing on its foot; each also as fur alone, its outline taken out.
    bone, _ = (crop(p) for p in rows(keyed(HERE / 'hedgehog-legs.png'), 2))
    units['hedgehog-leg'] = export(bone, OUT, 'hedgehog-leg', LEG * RES / bone.shape[0])
    units['hedgehog-leg-fur'] = export(fill_only(bone), OUT, 'hedgehog-leg-fur', LEG * RES / bone.shape[0])
    for name, (length, (hx, hy)) in FEET.items():
        foot = crop(keyed(HERE / f'{name}.png'))
        w, h = export(foot, OUT, name, length * RES / foot.shape[1])
        export(fill_only(foot), OUT, f'{name}-fur', length * RES / foot.shape[1])
        print(f'{name}: heel {w * hx / RES:.2f}, {h * hy / RES:.2f}')
    for name, (w, h) in sizes.items():
        print(f'{name}: display {w:g}x{h:g}')
    for name, (w, h) in units.items():
        print(f'{name}: {w}x{h}, drawing units {w / RES:.2f}x{h / RES:.2f}')


if __name__ == '__main__':
    main()
