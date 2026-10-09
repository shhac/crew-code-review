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
is on the page. Standing and walking, it is put together from PARTS cut from
hedgehog-standing.png (the whole hedgehog standing square, its anatomy
reference) into hedgehog-parts-3.png, each printed with where it sat in the
reference: its place in the rig. The sizes printed are what the components
lay out.
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import crop, export, export_with_fur, feature, ground, keyed, lum, pale, place, poses, rescaled  # noqa: E402
import numpy as np  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/bonfire'
LAB = HERE.parents[1] / 'internal/dashboard/ui/src/lab'
PARTS = ['hedgehog-body', 'hedgehog-head']
# Drawing units are the reference's, moved by this, so a frame round it has
# a margin.
MARGIN = 1
# The eye's size in drawing units, and file pixels per drawing unit.
EYE = 1.82
RES = 12
# Where each sheet's eye is (source pixels), measured by eye.
EYES = {'hedgehog-sheet.png': (705, 480), 'hedgehog-standing.png': (1165, 468), 'hedgehog-parts-3.png': (1460, 470)}
# Key poses of the same hedgehog, drawn from hedgehog-standing.png, that the
# rig's poses are tuned toward; the lab lays each over its mode. Where each
# one's eye is (source pixels), measured by eye.
KEY_POSES = {
    'walk-contact': (1170, 476), 'walk-pass': (1166, 474), 'hurry': (1180, 446),
    'sniff': (1200, 590), 'peek': (1220, 432),
}
# The legs' thickness, outline included, in drawing units; and each foot's
# length, and where on it (as fractions of its box) the leg comes down: its
# heel, as it walks on its soles. Both cut from the reference's legs into
# hedgehog-limbs.png: the front feet short and broad like little hands, the
# hind ones longer paws.
LEG = 2.6
FEET = {'hedgehog-hand': (3.4, (0.34, 0.325)), 'hedgehog-hind': (4.0, (0.29, 0.325))}


def eye_px(sheet: str) -> float:
    return feature(HERE / sheet, EYES[sheet])


def on_eye(sheet: str) -> float:
    return EYE / eye_px(sheet) * RES


def belly(body: np.ndarray) -> np.ndarray:
    """The commonest cream on the bottom of the body: its belly."""
    low = body[body.shape[0] * 3 // 4:]
    fill = low[(low[..., 3] > 200) & (lum(low) > 150)][:, :3]
    colours, counts = np.unique(fill // 4 * 4, axis=0, return_counts=True)
    return colours[counts.argmax()]


def flat(rgba: np.ndarray, colour: np.ndarray) -> np.ndarray:
    """A leg piece or foot with its fur one even cream, the belly's, so where
    the pieces cross each other and the belly's edge no change of shade
    shows; a bar's shading runs along it, so stood upright its shaded side
    would. Its outline and claws are kept."""
    out = rgba.copy()
    out[lum(rgba) > 130, :3] = colour
    return out


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
    # The reference, for the lab to lay over the rig, and where each part sat
    # in it: their places in the rig.
    reference = crop(keyed(HERE / 'hedgehog-standing.png'))
    per_unit = eye_px('hedgehog-standing.png') / EYE
    units['hedgehog-reference'] = export(reference, LAB, 'hedgehog-reference', on_eye('hedgehog-standing.png'))
    print(f'hedgehog-reference: at {MARGIN}, {MARGIN}; ground {ground(reference) / per_unit + MARGIN:.2f}')
    for name, seed in KEY_POSES.items():
        path = HERE / f'hedgehog-pose-{name}.png'
        w, h = export(crop(keyed(path)), LAB, f'hedgehog-pose-{name}', EYE / feature(path, seed) * RES)
        print(f'hedgehog-pose-{name}: drawing units {w / RES:.2f}x{h / RES:.2f}')
    parts = dict(zip(PARTS, (crop(p) for p in poses(keyed(HERE / 'hedgehog-parts-3.png'), len(PARTS)))))
    k = eye_px('hedgehog-standing.png') / eye_px('hedgehog-parts-3.png')
    for name, art in parts.items():
        units[name] = export(art, OUT, name, on_eye('hedgehog-parts-3.png'))
        y, x = place(rescaled(art, k), reference, mask=pale)
        print(f'{name}: at {x / per_unit + MARGIN:.2f}, {y / per_unit + MARGIN:.2f}')
    # Each leg is one bone piece, hip to heel (too short to show a knee),
    # standing on its foot; each also as fur alone, its outline taken out.
    bone, *feet = (crop(p) for p in poses(keyed(HERE / 'hedgehog-limbs.png'), 3))
    cream = belly(parts['hedgehog-body'])
    bone, feet = flat(bone, cream), [flat(f, cream) for f in feet]
    units['hedgehog-leg'] = units['hedgehog-leg-fur'] = export_with_fur(bone, OUT, 'hedgehog-leg', LEG * RES / bone.shape[0])
    for (name, (length, (hx, hy))), foot in zip(FEET.items(), feet):
        w, h = export_with_fur(foot, OUT, name, length * RES / foot.shape[1])
        print(f'{name}: {w / RES:.2f}x{h / RES:.2f}, heel {w * hx / RES:.2f}, {h * hy / RES:.2f}')
    for name, (w, h) in sizes.items():
        print(f'{name}: display {w:g}x{h:g}')
    for name, (w, h) in units.items():
        print(f'{name}: {w}x{h}, drawing units {w / RES:.2f}x{h / RES:.2f}')


if __name__ == '__main__':
    main()
