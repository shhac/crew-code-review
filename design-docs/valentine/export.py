# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Keys, crops and exports the Valentine's art. Run: uv run design-docs/valentine/export.py

The steps are shared with the other themes (../art.py), except the keying:
this month's art is pink and red, near the magenta every earlier sheet was
drawn on, and magenta keying eats any pink with enough blue in it. So the
cupid is drawn on flat green #00FF00 (it has no green anywhere) and the
shelf art, whose rose has a green stem, on flat blue #0000FF (it has no blue
or purple). Each is keyed on its own colour with the magenta recipe's ramp,
the spill taken as that channel's excess over the other two, and the
fringe of that colour pulled out of the edge pixels.
"""
from pathlib import Path
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import MARGIN as ART_MARGIN, crop, export, export_with_fur, feature, opaque, pale, place, poses, rescaled  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/valentine'
LAB = HERE.parents[1] / 'internal/dashboard/ui/src/lab'
GREEN, BLUE = 1, 2
# The shelf picture's height on the page; it is written at twice that.
KIT_HEIGHT = 70
# The cupid's pictures are all on one scale, the eye's: EYE drawing units
# across, written at RES file pixels per unit; cupid-rig.ts sets how big a
# unit is on the page. Drawing units are the reference's, moved by MARGIN.
EYE = 1.6
RES = 12
MARGIN = 1
# Where each sheet's eye is (source pixels), measured by eye.
EYES = {
    'cupid-reference': (925, 290), 'cupid-parts': (915, 535),
    'cupid-pose-flit': (1080, 380), 'cupid-pose-aim': (894, 280),
    'cupid-pose-release': (890, 296), 'cupid-pose-dodge': (794, 286),
}
# Key poses of the same cupid, edits of the reference, for the lab to lay
# over each mode.
KEY_POSES = ['cupid-pose-flit', 'cupid-pose-aim', 'cupid-pose-release', 'cupid-pose-dodge']
# The parts sheet, left to right, cut from the reference: the body with
# its arms, legs, head and wings taken off; the head, its neck edge soft;
# the near wing.
PARTS = ['cupid-body', 'cupid-head', 'cupid-wing']


def tunic(rgba: np.ndarray) -> np.ndarray:
    """The red of the tunic: what the body is matched by, since the edit
    closed it where the limbs were and its outline no longer fits."""
    r, g, b = (rgba[..., i].astype(int) for i in range(3))
    return opaque(rgba) & (r > 170) & (g < 110) & (b < 120)


# The head is matched by its pale skin and curls, since its outline alone
# would fit in many places; the body by its tunic.
MASKS = {'cupid-head': pale, 'cupid-body': tunic}
# The limb pieces, left to right, cut from the reference's own limbs, and
# each one's size in drawing units: a capsule's thickness (its height), the
# hand's height and the foot's length, measured off the reference.
LIMBS = ['cupid-arm', 'cupid-hand', 'cupid-thigh', 'cupid-shin', 'cupid-foot']
LIMB_SIZE = {
    'cupid-arm': (2.0, 'height'), 'cupid-hand': (2.1, 'height'), 'cupid-thigh': (2.8, 'height'),
    'cupid-shin': (2.2, 'height'), 'cupid-foot': (3.2, 'width'),
}


def keyed_on(path: Path, channel: int) -> np.ndarray:
    """Alpha from how far the key channel stands above the other two,
    ramping between 60 and 140 as the magenta recipe does, and half that
    excess taken back out of the key channel so edges carry no fringe."""
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    others = np.max(np.delete(rgb, channel, axis=-1), axis=-1)
    spill = rgb[..., channel] - others
    alpha = 1 - np.clip((spill - 60) / 80, 0, 1)
    out = rgb.copy()
    out[..., channel] -= np.maximum(spill, 0) * 0.5
    return np.clip(np.dstack([out, alpha * 255]), 0, 255).astype(np.uint8)


def eye_px(sheet: str) -> float:
    return feature(HERE / f'{sheet}.png', EYES[sheet])


def on_eye(sheet: str) -> float:
    return EYE / eye_px(sheet) * RES


def cupid(name: str) -> np.ndarray:
    return keyed_on(HERE / f'{name}.png', GREEN)


def eye_in(name: str) -> tuple[float, float]:
    """The middle of the eye in a cropped, exported picture, in drawing
    units: where the lab lines a key pose up with the rig's eye."""
    rgb = np.asarray(Image.open(HERE / f'{name}.png').convert('RGB')).astype(int)
    dark = rgb.sum(axis=-1) < 200
    sx, sy = EYES[name]
    ys, xs = np.nonzero(dark[sy - 60:sy + 60, sx - 60:sx + 60])
    near = (ys - 60) ** 2 + (xs - 60) ** 2 < 40 ** 2
    cy, cx = ys[near].mean() + sy - 60, xs[near].mean() + sx - 60
    alpha = cupid(name)[..., 3] > 8
    top, left = np.nonzero(alpha.any(axis=1))[0].min() - ART_MARGIN, np.nonzero(alpha.any(axis=0))[0].min() - ART_MARGIN
    per_unit = eye_px(name) / EYE
    return (cx - max(0, left)) / per_unit, (cy - max(0, top)) / per_unit


def main() -> None:
    kit = crop(keyed_on(HERE / 'valentine-kit.png', BLUE))
    size = export(kit, OUT, 'valentine-kit', 2 * KIT_HEIGHT / kit.shape[0])
    print(f'valentine-kit: display {size[0] / 2:g}x{size[1] / 2:g}')
    # The reference, for the lab to lay over the rig, and where each part
    # sat in it: their places in the rig, in drawing units with a MARGIN.
    reference = crop(cupid('cupid-reference'))
    per_unit = eye_px('cupid-reference') / EYE
    w, h = export(reference, LAB, 'cupid-reference', on_eye('cupid-reference'))
    ex, ey = eye_in('cupid-reference')
    print(f'cupid-reference: {w / RES:.2f}x{h / RES:.2f} units at {MARGIN}, {MARGIN}, eye at {ex + MARGIN:.2f}, {ey + MARGIN:.2f}')
    for name in KEY_POSES:
        art = crop(cupid(name))
        w, h = export(art, LAB, name, on_eye(name))
        ex, ey = eye_in(name)
        print(f'{name}: {w / RES:.2f}x{h / RES:.2f} units, eye at {ex:.2f}, {ey:.2f}')
    k = eye_px('cupid-reference') / eye_px('cupid-parts')
    for name, art in zip(PARTS, (crop(p) for p in poses(cupid('cupid-parts'), len(PARTS)))):
        w, h = export(art, OUT, name, on_eye('cupid-parts'))
        # The wing is placed by hand (the near wing in the reference is
        # partly behind the far one), the rest where they match best.
        at = '' if name == 'cupid-wing' else ' at {1:.2f}, {0:.2f}'.format(*(v / per_unit + MARGIN for v in place(rescaled(art, k), reference, mask=MASKS.get(name, opaque))))
        print(f'{name}: {w / RES:.2f}x{h / RES:.2f} units{at}')
    # The limb pieces, each sized to the reference's limbs: across, in
    # drawing units, outline included.
    for name, art in zip(LIMBS, (crop(p) for p in poses(cupid('cupid-limbs'), len(LIMBS)))):
        thick, by = LIMB_SIZE[name]
        scale = thick * RES / (art.shape[0] if by == 'height' else art.shape[1])
        w, h = export_with_fur(art, OUT, name, scale)
        print(f'{name}: {w / RES:.2f}x{h / RES:.2f} units')


if __name__ == '__main__':
    main()
