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
from art import EyeScale, crop, cut, export, export_with_fur, keyed, lum, pale, poses  # noqa: E402
import numpy as np  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/bonfire'
LAB = HERE.parents[1] / 'internal/dashboard/ui/src/lab'
PARTS = ['hedgehog-body', 'hedgehog-head']
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
    hedgehog = EyeScale(HERE, EYES, EYE, RES)
    units = {}
    _, ball = (crop(h) for h in poses(keyed(HERE / 'hedgehog-sheet.png'), 2))
    units['hedgehog-ball'] = export(ball, OUT, 'hedgehog-ball', hedgehog.on_eye('hedgehog-sheet.png'))
    units['hedgehog-reference'] = hedgehog.reference('hedgehog-standing.png', LAB, 'hedgehog-reference')
    hedgehog.key_poses('hedgehog-pose-', KEY_POSES, LAB)
    parts = cut(keyed(HERE / 'hedgehog-parts-3.png'), PARTS)
    units.update(hedgehog.parts(parts, 'hedgehog-parts-3.png', OUT, mask=pale))
    # Each leg is one bone piece, hip to heel (too short to show a knee),
    # standing on its foot; each also as fur alone, its outline taken out.
    bone, *feet = (crop(p) for p in poses(keyed(HERE / 'hedgehog-limbs.png'), 3))
    cream = belly(parts['hedgehog-body'])
    bone, feet = flat(bone, cream), [flat(f, cream) for f in feet]
    units['hedgehog-leg'] = units['hedgehog-leg-fur'] = export_with_fur(bone, OUT, 'hedgehog-leg', LEG * RES / bone.shape[0])
    for (name, (length, heel)), foot in zip(FEET.items(), feet):
        hedgehog.foot(name, foot, OUT, length, heel)
    for name, (w, h) in sizes.items():
        print(f'{name}: display {w:g}x{h:g}')
    for name, (w, h) in units.items():
        print(f'{name}: {w}x{h}, drawing units {w / RES:.2f}x{h / RES:.2f}')


if __name__ == '__main__':
    main()
