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
from art import EyeScale, crop, cut, export, export_with_fur, keyed, opaque, place, rescaled  # noqa: E402
import numpy as np  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/hares'
LAB = HERE.parents[1] / 'internal/dashboard/ui/src/lab'
PARTS = ['hare-body', 'hare-head', 'hare-ears']
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
# box) the leg comes down: high enough on them that a long foot laid flat,
# as thick as the leg, rests on the ledge level with their soles.
TOES = {'hare-hind-toes': (2.6, (0.16, 0.375)), 'hare-fore-toes': (1.7, (0.2, 0.25))}


def symmetric(piece: np.ndarray) -> np.ndarray:
    """A bar whose right end is drawn rounded and whose left end is a ragged
    cut: its right half mirrored onto its left, so both ends are rounded."""
    half = piece.shape[1] // 2
    right = piece[:, half:]
    return np.concatenate([right[:, ::-1][:, :piece.shape[1] - right.shape[1]], right], axis=1)


def fitted(part: np.ndarray, like: np.ndarray) -> float:
    """The scale at which part's shape best overlaps like's (by the share of
    their opaque pixels they have in common, part placed where it fits
    best), tried in steps of 1%."""
    def overlap(k: float) -> float:
        a = rescaled(part, k)
        if a.shape[0] > like.shape[0] + 40 or a.shape[1] > like.shape[1] + 40:
            return 0.0
        pad = np.zeros((like.shape[0] + 80, like.shape[1] + 80, 4), dtype=like.dtype)
        pad[40:40 + like.shape[0], 40:40 + like.shape[1]] = like
        y, x = place(a, pad)
        mine = np.zeros(pad.shape[:2], bool)
        mine[y:y + a.shape[0], x:x + a.shape[1]] = opaque(a)
        theirs = opaque(pad)
        return (mine & theirs).sum() / (mine | theirs).sum()
    return max((k / 100 for k in range(70, 111)), key=overlap)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    # Display heights in page pixels, and how many file pixels to each.
    for name, height, density in [('daffodils', 88, 2)]:
        art = crop(keyed(HERE / f'{name}.png'))
        w, h = export(art, OUT, name, density * height / art.shape[0])
        print(f'{name}: display {w / density:g}x{h / density:g}')
    hare = EyeScale(HERE, EYES, EYE, RES)
    for sheet in EYES:
        print(f'{sheet}: eye {hare.px(sheet):.1f}px')
    hare.reference('hare-standing.png', LAB, 'hare-reference')
    hare.key_poses('hare-pose-', KEY_POSES, LAB)
    # The head and ears from the parts sheet; the body from hare-torso-2.png
    # (see the note's Art section). The torso has no eye to measure: it is
    # put on the reference's scale by fitting it to hare-torso.png, an edit
    # that kept the reference's own size and differs only in its haunch.
    parts = cut(keyed(HERE / 'hare-parts.png'), PARTS)
    first = crop(keyed(HERE / 'hare-torso.png'))
    torso = crop(keyed(HERE / 'hare-torso-2.png'))
    t = fitted(torso, first)
    print(f'hare-torso-2: {t:.3f} of the reference scale')
    hare.placed('hare-body', torso, OUT, t * hare.on_eye('hare-standing.png'), t)
    hare.parts({name: art for name, art in parts.items() if name != 'hare-body'}, 'hare-parts.png', OUT)
    # Each limb piece as drawn and as fur alone, its outline taken out.
    pieces = cut(keyed(HERE / 'hare-limbs.png'), LIMBS)
    w, h = export_with_fur(pieces['hare-thigh'], OUT, 'hare-thigh', THIGH * RES / pieces['hare-thigh'].shape[0])
    print(f'hare-thigh: {w / RES:.2f}x{h / RES:.2f}')
    bone = symmetric(pieces['hare-leg'])
    w, h = export_with_fur(bone, OUT, 'hare-leg', LEG * RES / bone.shape[0])
    print(f'hare-leg: {w / RES:.2f}x{h / RES:.2f}')
    for name, (length, heel) in TOES.items():
        hare.foot(name, pieces[name], OUT, length, heel)


if __name__ == '__main__':
    main()
