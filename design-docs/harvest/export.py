# /// script
# dependencies = ["pillow", "numpy", "scipy"]
# ///
"""Keys, crops and exports the harvest art. Run: uv run design-docs/harvest/export.py

The steps are shared with the other themes (../art.py). The shelf's still
life and the scarecrow are written at twice their display size. The
scarecrow is cut into its body, hat and two sleeves (scarecrow-parts.png, an
edit of scarecrow.png), each placed where it sat in the reference, so the
shelf can lay them out and swing the sleeves about their shoulders; the
layout printed is what HarvestShelf.svelte uses.

The crow's pictures are all on one scale, the eye's, as every animal's are.
A crow is black all over, so its eye is not the dark blob art.py's feature
finds: it is measured by its brown iris instead (iris below). The parts are
cut from crow-standing.png (the anatomy reference) into crow-parts.png,
each printed with where it sat in the reference; the spread wing's two
pieces (crow-wing.png) are sized to the wing's true length, about the
bird's; the leg pieces (crow-limbs.png) to the reference's own legs. The
key poses are written for the lab to lay over the rig.

Pass --check to also write overlays of every placed part on its reference
into the scratch directory given after it, to look at.
"""
from pathlib import Path
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import EyeScale, crop, cut, export, export_with_fur, keyed, lum, opaque, place, poses, rescaled, rows  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/harvest'
LAB = HERE.parents[1] / 'internal/dashboard/ui/src/lab'
# The shelf art's display sizes, written at DENSITY file pixels to each.
DENSITY = 2
STILL_LIFE_WIDTH = 72
SCARECROW_HEIGHT = 64
SCARECROW_PARTS = ['scarecrow-hat', 'scarecrow-left-arm', 'scarecrow-body', 'scarecrow-right-arm']
# The crow's eye is EYE drawing units across, written at RES file pixels per
# unit; at the rig's scale of about a page pixel a unit, the reference
# standing is 26.5px tall.
EYE = 1.24
RES = 12
# Where each sheet's eye is (source pixels), measured by eye.
EYES = {'crow-standing.png': (1134, 186), 'crow-parts.png': (1175, 210)}
KEY_POSES = {
    'walk': (1134, 186), 'peck': (1202, 736), 'alert': (1061, 120), 'takeoff-2': (1110, 340),
    'flight-up-2': (1158, 530), 'flight-down-2': (1150, 198), 'land-2': (1015, 359),
}
# crow-parts.png's two rows, each left to right.
CROW_ROWS = [['crow-body', 'crow-head'], ['crow-tail', 'crow-wing-folded']]
# The spread wing, shoulder to the longest primary's tip, is this many of
# the bird's lengths (bill tip to tail tip): a carrion crow's span is about
# 2.1 times its length, less the body between the shoulders.
WING_LENGTH = 0.95
# The legs, measured off the reference: the bare tarsus's thickness, outline
# included, and the foot's length, claws included, in drawing units; and
# where on the foot (fractions of its box) the tarsus comes down.
TARSUS = 0.85
FOOT = 5.6
HEEL = (0.34, 0.12)


def brown(rgb: np.ndarray) -> np.ndarray:
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    return (r > b + 25) & (r > 45) & (g < r) & ~((r > 200) & (b > 200))


def iris(path: Path, seed: tuple[int, int]) -> float:
    """The eye's size in a picture of the crow: the widest of the brown
    iris's extents within 60px of seed. Its top is shaded nearly black, so
    the width is the steadier measure."""
    rgb = np.asarray(Image.open(path).convert('RGB'))
    ys, xs = np.nonzero(brown(rgb))
    near = (xs - seed[0]) ** 2 + (ys - seed[1]) ** 2 < 60 ** 2
    xs, ys = xs[near], ys[near]
    return float(max(xs.max() - xs.min() + 1, ys.max() - ys.min() + 1))


def bill_and_eye(rgba: np.ndarray) -> np.ndarray:
    """The grey bill and the brown eye: what the head is matched by, as its
    black outline alone fits all along the neck."""
    r, g, b = (rgba[..., i].astype(int) for i in range(3))
    grey = (lum(rgba) > 55) & (lum(rgba) < 150) & (np.abs(r - b) < 14) & (np.abs(g - b) < 14)
    return opaque(rgba) & (grey | brown(rgba))


def ink(rgba: np.ndarray) -> np.ndarray:
    """The black line work: the folded wing lies inside the body's
    silhouette, so it is matched by its own lines."""
    return opaque(rgba) & (lum(rgba) < 22)


def tip_at(art: np.ndarray, whole: np.ndarray) -> tuple[int, int]:
    """Where a tail sits in the whole picture (its top left, in the whole's
    pixels), lined up by its tip: the leftmost thing in either, its middle
    at that column. The reference's wing covers most of its tail, so nothing
    else of it is there to match."""
    def tip(rgba: np.ndarray) -> tuple[int, float]:
        cols = np.nonzero(opaque(rgba).any(axis=0))[0]
        x = int(cols.min()) + 4
        ys = np.nonzero(opaque(rgba)[:, x])[0]
        return x, (ys.min() + ys.max()) / 2
    (ax, ay), (bx, by) = tip(art), tip(whole)
    return round(by - ay), bx - ax


def straw(rgba: np.ndarray) -> np.ndarray:
    """The yellow straw: a sleeve is matched by its cuff, since its inner end
    runs on under the jacket where the reference shows nothing."""
    r, g, b = (rgba[..., i].astype(int) for i in range(3))
    return opaque(rgba) & (r > 200) & (g > 150) & (b < 90)


def pieces(rgba: np.ndarray, names: list[str]) -> dict[str, np.ndarray]:
    """A sheet split into its len(names) largest separate shapes, named in
    reading order (top to bottom, then left to right, by their middles),
    each cropped; a stray strand of straw goes with the shape nearest it.
    For sheets whose pieces overlap across, so no empty row or column runs
    between them."""
    labels, count = ndimage.label(rgba[..., 3] > 8)
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, count + 1))
    big = [int(i) + 1 for i in np.argsort(sizes)[::-1][:len(names)]]
    middles = {i: ndimage.center_of_mass(labels == i) for i in big}
    order = sorted(big, key=lambda i: (round(middles[i][0] / 200), middles[i][1]))
    owner = {i: i for i in big}
    for i in range(1, count + 1):
        if i not in owner:
            y, x = ndimage.center_of_mass(labels == i)
            owner[i] = min(big, key=lambda j: (middles[j][0] - y) ** 2 + (middles[j][1] - x) ** 2)
    out = {}
    for name, i in zip(names, order):
        mine = np.isin(labels, [j for j, o in owner.items() if o == i])
        piece = rgba.copy()
        piece[~mine, 3] = 0
        out[name] = crop(piece)
    return out


def scarecrow(check: Path | None) -> None:
    """The scarecrow's parts, each placed where it sat in the reference and
    laid out together SCARECROW_HEIGHT tall (the parts sheet was drawn a
    little smaller than the reference, so the scale is the parts' own)."""
    reference = crop(keyed(HERE / 'scarecrow.png'))
    parts = pieces(keyed(HERE / 'scarecrow-parts.png'), SCARECROW_PARTS)
    masks = {'scarecrow-hat': opaque, 'scarecrow-body': opaque, 'scarecrow-left-arm': straw, 'scarecrow-right-arm': straw}
    placed = {name: (*place(art, reference, mask=masks[name])[::-1], art) for name, art in parts.items()}
    left = min(x for x, _, _ in placed.values())
    top = min(y for _, y, _ in placed.values())
    right = max(x + a.shape[1] for x, _, a in placed.values())
    bottom = max(y + a.shape[0] for _, y, a in placed.values())
    k = DENSITY * SCARECROW_HEIGHT / (bottom - top)
    at = lambda x, y: f'{(x - left) * k / DENSITY:.1f}, {(y - top) * k / DENSITY:.1f}'
    for name, (x, y, art) in placed.items():
        w, h = export(art, OUT, name, k)
        print(f'{name}: {w / DENSITY:g}x{h / DENSITY:g} at {at(x, y)}')
    # Each sleeve swings about its shoulder: the middle of its inner end's
    # height, where the body's side is at that height, a little inside it.
    body_x, body_y, body = placed['scarecrow-body']
    for name, side in [('scarecrow-left-arm', -1), ('scarecrow-right-arm', 1)]:
        x, y, art = placed[name]
        ys = np.nonzero(opaque(art).any(axis=1))[0]
        mid = y + (ys.min() + ys.max()) / 2
        row = np.nonzero(opaque(body)[int(mid) - body_y])[0] + body_x
        edge = row.min() + 10 if side < 0 else row.max() - 10
        print(f'{name}: shoulder at {at(edge, mid)}')
    print(f'scarecrow: display {(right - left) * k / DENSITY:.1f}x{SCARECROW_HEIGHT}')
    if check:
        overlay(reference, [placed[n] for n in SCARECROW_PARTS], check / 'scarecrow-overlay.png')


def overlay(whole: np.ndarray, parts: list[tuple[int, int, np.ndarray]], out: Path) -> None:
    """The reference faded, with each part laid where it was placed, half
    see-through, to check the placements by eye."""
    canvas = Image.fromarray(whole, 'RGBA')
    faded = Image.new('RGBA', canvas.size, (255, 255, 255, 255))
    faded.alpha_composite(Image.blend(Image.new('RGBA', canvas.size, (255, 255, 255, 0)), canvas, 0.35))
    for x, y, art in parts:
        piece = art.copy()
        piece[..., 3] = (piece[..., 3] * 0.7).astype(np.uint8)
        layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
        layer.paste(Image.fromarray(piece, 'RGBA'), (x, y))
        faded.alpha_composite(layer)
    faded.save(out)


def crow(check: Path | None) -> None:
    scale = EyeScale(HERE, EYES, EYE, RES, measure=iris)
    scale.reference('crow-standing.png', LAB, 'crow-reference')
    scale.key_poses('crow-pose-', KEY_POSES, LAB)
    sheet = keyed(HERE / 'crow-parts.png')
    parts = {name: art for row, names in zip(rows(sheet, 2), CROW_ROWS) for name, art in cut(row, names).items()}
    masks = {'crow-head': bill_and_eye, 'crow-body': ink, 'crow-wing-folded': ink, 'crow-tail': None}
    scale.parts(parts, 'crow-parts.png', OUT, masks=masks)
    onto = scale.px(scale.standing_sheet) / scale.px('crow-parts.png')
    ty, tx = tip_at(rescaled(parts['crow-tail'], onto), scale.standing)
    print(f'crow-tail: placed by its tip at {tx / scale.per_unit() + scale.margin:.2f}, {ty / scale.per_unit() + scale.margin:.2f}')
    per_unit = scale.per_unit()
    length = scale.standing.shape[1] / per_unit
    print(f'crow-reference: {length:.2f} units from bill tip to tail tip, margins included')
    # The spread wing: both pieces on one scale, so that from the arm's root
    # to the hand's tip, less the gap they were drawn apart by, it is the
    # wing's true length.
    arm, hand = (crop(p) for p in poses(keyed(HERE / 'crow-wing.png'), 2))
    k = WING_LENGTH * length * RES / (arm.shape[1] + hand.shape[1])
    for name, art in [('crow-wing-arm', arm), ('crow-wing-hand', hand)]:
        w, h = export(art, OUT, name, k)
        print(f'{name}: {w / RES:.2f}x{h / RES:.2f} units')
    # The legs: the tarsus at its thickness, and the feet at the foot's
    # length, the curled one on the same scale as the open one.
    tarsus, foot, curled = (crop(p) for p in poses(keyed(HERE / 'crow-limbs.png'), 3))
    w, h = export_with_fur(tarsus, OUT, 'crow-tarsus', TARSUS * RES / tarsus.shape[0])
    print(f'crow-tarsus: {w / RES:.2f}x{h / RES:.2f} units')
    scale.foot('crow-foot', foot, OUT, FOOT, HEEL)
    w, h = export_with_fur(curled, OUT, 'crow-foot-curled', FOOT * RES / foot.shape[1])
    print(f'crow-foot-curled: {w / RES:.2f}x{h / RES:.2f} units')
    if check:
        laid = []
        for name in ['crow-tail', 'crow-body', 'crow-wing-folded', 'crow-head']:
            art = rescaled(parts[name], onto)
            y, x = tip_at(art, scale.standing) if name == 'crow-tail' else place(art, scale.standing, mask=masks[name])
            laid.append((x, y, art))
        overlay(scale.standing, laid, check / 'crow-overlay.png')


def main() -> None:
    check = Path(sys.argv[sys.argv.index('--check') + 1]) if '--check' in sys.argv else None
    still = crop(keyed(HERE / 'harvest-still-life.png'))
    w, h = export(still, OUT, 'harvest-still-life', DENSITY * STILL_LIFE_WIDTH / still.shape[1])
    print(f'harvest-still-life: display {w / DENSITY:g}x{h / DENSITY:g}')
    scarecrow(check)
    crow(check)


if __name__ == '__main__':
    main()
