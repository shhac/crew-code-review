# /// script
# dependencies = ["pillow==12.3.0", "numpy==2.5.4"]
# ///
"""Keys, crops and exports the Mad March hares art. Run: uv run design-docs/hares/export.py

The steps are shared with the other themes (../art.py). The shelf's pot of
daffodils is exported at twice its display size. The hare's pictures are all
put on one scale, the eye's, so every pose is the same animal; they are
written at RES pixels per drawing unit, and hare-rig.ts sets how big a
drawing unit is on the page. It is put together from PARTS cut from
hare-standing.png (the whole hare standing square, its anatomy reference)
into hare-parts.png, each printed with where it sat in the reference: its
place in the rig. Its legs are pieces drawn after the reference's own legs in
hare-limbs-2.png. The sizes printed are what the components lay out.
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import EyeScale, crop, cut, export, keyed, opaque, place, rescaled, rows  # noqa: E402
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
# The limb pieces in hare-limbs-2.png: the hind leg's, left to right along
# the top row, and the foreleg's along the bottom. Each is exported as thick
# as it is drawn, outline included, in drawing units: the thigh at the hip,
# the shank at the knee, the long hind foot (the bone up from the toes), the
# upper arm at the elbow, the forearm and the short forefoot; the toes by
# their length.
HIND = ['hare-thigh', 'hare-shank', 'hare-hind-foot', 'hare-hind-toes']
FORE = ['hare-upper-arm', 'hare-foreleg', 'hare-fore-toes']
BARS = {'hare-thigh': 3.8, 'hare-shank': 1.44, 'hare-hind-foot': 1.25, 'hare-upper-arm': 1.6, 'hare-foreleg': 1.25, 'hare-forefoot': 1.25}
# The forefoot (wrist to toes, 1 unit) is laid along its bone as long as it
# is thick plus 1 unit: this many times as long as it is thick.
FOREFOOT = (1 + 1.25) / 1.25
# Toes: length in drawing units, and where on them (as fractions of their
# box) the leg comes down: high enough on them that a long foot laid flat,
# as thick as the leg, rests on the ledge level with their soles.
TOES = {'hare-hind-toes': (2.6, (0.16, 0.466)), 'hare-fore-toes': (1.7, (0.2, 0.17))}


def short(piece: np.ndarray, aspect: float) -> np.ndarray:
    """A short bar cut from a long one: its rounded right end, as long as
    half the bar it makes, mirrored onto its left, so a short bone is drawn
    with the long one's fur and rounded ends rather than squashed into it."""
    half = round(piece.shape[0] * aspect / 2)
    right = piece[:, -half:]
    return np.concatenate([right[:, ::-1], right], axis=1)


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
    hind, fore = rows(keyed(HERE / 'hare-limbs-2.png'), 2)
    pieces = cut(hind, HIND) | cut(fore, FORE)
    pieces['hare-forefoot'] = short(pieces['hare-foreleg'], FOREFOOT)
    for name, thick in BARS.items():
        hare.bar(name, pieces[name], OUT, thick)
    for name, (length, heel) in TOES.items():
        hare.foot(name, pieces[name], OUT, length, heel)


if __name__ == '__main__':
    main()
