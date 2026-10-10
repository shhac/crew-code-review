# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Keys, crops and exports the Mad March hares art. Run: uv run design-docs/hares/export.py

The steps are shared with the other themes (../art.py). The shelf's pot of
daffodils is exported at twice its display size. The hare's pictures are all
put on one scale, the eye's, so every pose is the same animal; they are
written at RES pixels per drawing unit, and hare-rig.ts sets how big a
drawing unit is on the page. It is put together from PARTS cut from
hare-standing.png (the whole hare standing square, its anatomy reference)
into hare-parts.png, each printed with where it sat in the reference: its
place in the rig. Its legs are pieces cut from the reference's own legs into
hare-limbs.png. The sizes printed are what the components lay out.
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import crop, export, export_with_fur, feature, ground, keyed, place, poses, rescaled  # noqa: E402
import numpy as np  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/hares'
LAB = HERE.parents[1] / 'internal/dashboard/ui/src/lab'
PARTS = ['hare-body', 'hare-head', 'hare-ears']
# Drawing units are the reference's, moved by this, so a frame round it has
# a margin.
MARGIN = 1
# The eye's size in drawing units (its dark outline and pupil together, the
# blob art.py's feature finds), and file pixels per drawing unit.
EYE = 1.4
RES = 12
# Where each sheet's eye is (source pixels), measured by eye.
EYES = {'hare-standing.png': (1160, 340), 'hare-parts.png': (1375, 335)}
# Key poses of the same hare, drawn from hare-standing.png, that the rig's
# poses are tuned toward; the lab lays each over its mode. Where each one's
# eye is (source pixels), measured by eye.
KEY_POSES = {
    'sit': (970, 315), 'graze': (1222, 705), 'lope': (1160, 340), 'bound-reach': (1245, 385),
    'bound-gather': (1135, 375), 'box': (897, 180), 'freeze': (1130, 432), 'bolt': (1270, 380),
}
# The limb pieces, left to right in hare-limbs.png, and how thick each is
# drawn, outline included, in drawing units: the thigh at the hip, the leg
# bone (its forelegs' thickness, also the shank and the long hind foot), and
# the toes by their length. The middle piece (a hind foot with its heel
# turned up) is not used: the long foot is a leg bone, with the toes on it.
LIMBS = ['hare-thigh', 'hare-leg', None, 'hare-hind-toes', 'hare-fore-toes']
THIGH = 2.4
LEG = 1.15
# Toes: length in drawing units, and where on them (as fractions of their
# box) the leg comes down.
TOES = {'hare-hind-toes': (2.6, (0.16, 0.5)), 'hare-fore-toes': (1.7, (0.2, 0.5))}


def eye_px(sheet: str) -> float:
    return feature(HERE / sheet, EYES[sheet])


def on_eye(sheet: str) -> float:
    return EYE / eye_px(sheet) * RES


def symmetric(piece: np.ndarray) -> np.ndarray:
    """A bar whose right end is drawn rounded and whose left end is a ragged
    cut: its right half mirrored onto its left, so both ends are rounded."""
    half = piece.shape[1] // 2
    right = piece[:, half:]
    return np.concatenate([right[:, ::-1][:, :piece.shape[1] - right.shape[1]], right], axis=1)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    # Display heights in page pixels, and how many file pixels to each.
    for name, height, density in [('daffodils', 88, 2)]:
        art = crop(keyed(HERE / f'{name}.png'))
        w, h = export(art, OUT, name, density * height / art.shape[0])
        print(f'{name}: display {w / density:g}x{h / density:g}')
    for sheet in EYES:
        print(f'{sheet}: eye {eye_px(sheet):.1f}px')
    # The reference, for the lab to lay over the rig, and where each part sat
    # in it: their places in the rig.
    reference = crop(keyed(HERE / 'hare-standing.png'))
    per_unit = eye_px('hare-standing.png') / EYE
    w, h = export(reference, LAB, 'hare-reference', on_eye('hare-standing.png'))
    print(f'hare-reference: {w / RES:.2f}x{h / RES:.2f} at {MARGIN}, {MARGIN}; ground {ground(reference) / per_unit + MARGIN:.2f}')
    for name, seed in KEY_POSES.items():
        path = HERE / f'hare-pose-{name}.png'
        eye = feature(path, seed)
        w, h = export(crop(keyed(path)), LAB, f'hare-pose-{name}', EYE / eye * RES)
        print(f'hare-pose-{name}: eye {eye:.1f}px; drawing units {w / RES:.2f}x{h / RES:.2f}')
    # The head and ears from the parts sheet; the body from hare-torso.png,
    # which keeps the chest and neck the sheet's body left off. The torso has
    # no eye to measure, and was edited at the reference's own size.
    parts = dict(zip(PARTS, (crop(p) for p in poses(keyed(HERE / 'hare-parts.png'), len(PARTS)))))
    parts['hare-body'] = crop(keyed(HERE / 'hare-torso.png'))
    k = eye_px('hare-standing.png') / eye_px('hare-parts.png')
    for name, art in parts.items():
        sheet = 'hare-standing.png' if name == 'hare-body' else 'hare-parts.png'
        w, h = export(art, OUT, name, on_eye(sheet))
        y, x = place(art if name == 'hare-body' else rescaled(art, k), reference)
        print(f'{name}: {w / RES:.2f}x{h / RES:.2f} at {x / per_unit + MARGIN:.2f}, {y / per_unit + MARGIN:.2f}')
    # Each limb piece as drawn and as fur alone, its outline taken out.
    pieces = dict(zip(LIMBS, (crop(p) for p in poses(keyed(HERE / 'hare-limbs.png'), len(LIMBS)))))
    w, h = export_with_fur(pieces['hare-thigh'], OUT, 'hare-thigh', THIGH * RES / pieces['hare-thigh'].shape[0])
    print(f'hare-thigh: {w / RES:.2f}x{h / RES:.2f}')
    bone = symmetric(pieces['hare-leg'])
    w, h = export_with_fur(bone, OUT, 'hare-leg', LEG * RES / bone.shape[0])
    print(f'hare-leg: {w / RES:.2f}x{h / RES:.2f}')
    for name, (length, (hx, hy)) in TOES.items():
        w, h = export_with_fur(pieces[name], OUT, name, length * RES / pieces[name].shape[1])
        print(f'{name}: {w / RES:.2f}x{h / RES:.2f}, heel {w * hx / RES:.2f}, {h * hy / RES:.2f}')


if __name__ == '__main__':
    main()
