# /// script
# dependencies = ["pillow==12.3.0", "numpy==2.5.4", "scipy==1.18.1"]
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
each printed with where it sat in the reference, the body from its redraw
with the rump and undertail coverts kept (crow-body-4.png); the spread
wing's two pieces (crow-wing.png) are sized to the wing's true length,
about the bird's; the leg pieces (crow-limbs.png) to the reference's own
legs. The key poses are written for the lab to lay over the rig.

Pass --check to also write overlays of every placed part on its reference
into the scratch directory given after it, to look at.
"""
from pathlib import Path
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import MARGIN, EyeScale, crop, crop_origin, cut, export, export_with_fur, keyed, knobbed, lum, opaque, place, poses, rescaled, rows, span_up  # noqa: E402

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
# crow-parts.png's two rows, each left to right. Its body stopped short
# behind, where the reference's folded wing hid the rump, so a gap showed
# under the wing between the tail's root and the belly; the body is cut from
# crow-body-4.png instead, redrawn with its rear running back over the
# tail's root, beside the same head.
CROW_ROWS = [['crow-body', 'crow-head'], ['crow-tail', 'crow-wing-folded']]
BODY_SHEET = ['crow-body', 'crow-head']
# The redrawn body is written in two pieces, cut across at RUMP drawing
# units from the reference's left (overlapping by RUMP_OVERLAP so no seam
# shows): the body, as far back as the old one reached, and the rump behind
# it, each its own picture. One picture would have a box reaching far behind
# and above the rump, empty there, that tipped forward to peck rises over
# the crow's footprint.
RUMP = 15.5
RUMP_OVERLAP = 0.25
# The spread wing, shoulder to the longest primary's tip, is this many of
# the bird's lengths (bill tip to tail tip): a carrion crow's span is about
# 2.1 times its length, less the body between the shoulders.
WING_LENGTH = 0.95
# The legs, measured off the reference: the bare tarsus's thickness, outline
# included, and the foot's length, claws included, in drawing units; and
# where on the foot (fractions of its box) the tarsus comes down, where the
# toes part.
TARSUS = 0.85
# The feathered drumstick (crow-drumstick.png, its feathered end at the
# knee, its bare end at the intertarsal joint), as thick as the trousers
# where they leave the belly in the reference (about 52px).
DRUMSTICK = 1.6
FOOT = 5.6
HEEL = (0.39, 0.34)
# Where the tarsus comes down on the curled foot, and how wide a knob of it
# each foot keeps round that joint (art.py's knobbed), and its outline, in
# drawing units: the tarsus's own bar draws the rest.
CURLED_HEEL = (0.35, 0.26)
KNOB = 0.4
KNOB_LINE = 0.06


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


def iris_middle(path: Path, seed: tuple[int, int]) -> tuple[float, float]:
    """The middle of the brown iris's extents within 60px of seed, keyed as
    the picture is exported."""
    ys, xs = np.nonzero(brown(keyed(path)))
    near = (xs - seed[0]) ** 2 + (ys - seed[1]) ** 2 < 60 ** 2
    return (xs[near].min() + xs[near].max()) / 2, (ys[near].min() + ys[near].max()) / 2


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


def defringed(rgba: np.ndarray) -> np.ndarray:
    """A black bird's picture with the magenta its soft edges kept taken out:
    the keying's despill leaves a cut edge's half-clear feathers purple
    where the background showed through, which on a black crow reads as a
    pink fringe. Those (red and blue well above green) are drawn the dark
    of its feathers instead."""
    r, g, b = (rgba[..., i].astype(int) for i in range(3))
    fringe = np.minimum(r, b) - g > 25
    out = rgba.copy()
    out[fringe, :3] = (34, 40, 52)
    return out


def unreddened(rgba: np.ndarray) -> np.ndarray:
    """A picture of the crow's body with the red cast its redraw's outline
    came with taken out: nothing on a crow's body is red, so wherever red
    stands above green and blue it is brought down to the higher of them,
    leaving the outline black."""
    out = rgba.copy()
    out[..., 0] = np.minimum(rgba[..., 0], np.maximum(rgba[..., 1], rgba[..., 2]))
    return out


def matched(rgba: np.ndarray, like: np.ndarray) -> np.ndarray:
    """A picture's colours brought to another's: each channel of its opaque
    pixels moved and stretched to the other's mean and spread. The body's
    redraw came back a greener, paler black than the head and the wing cut
    with the first body, so it is matched to that body's colours."""
    out = rgba.copy()
    mine, theirs = opaque(rgba), opaque(like)
    for c in range(3):
        a, b = rgba[..., c][mine].astype(np.float32), like[..., c][theirs].astype(np.float32)
        out[..., c][mine] = np.clip((a - a.mean()) * (b.std() / a.std()) + b.mean(), 0, 255).astype(np.uint8)
    return out


def crow_keyed(path: Path) -> np.ndarray:
    return defringed(keyed(path))


def underside(rgba: np.ndarray) -> np.ndarray:
    """A wing's underside from its upper side: its colours drawn a third of
    the way toward a mid grey-brown, the outline kept."""
    out = rgba.copy()
    feathers = lum(rgba) > 30
    grey = np.array([88, 86, 84], dtype=np.float32)
    out[feathers, :3] = (rgba[feathers, :3].astype(np.float32) * 0.65 + grey * 0.35).astype(np.uint8)
    return out


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


def rump_and_body(scale: EyeScale, body: np.ndarray, first: np.ndarray, sheet: str) -> tuple[float, float]:
    """The redrawn body, on sheet's scale as the first body is, placed where
    the first body sits (its front by line work over the first's, which the
    rig's legs and wing were fitted to), then written cut across at RUMP,
    each piece cropped and printed with where it sits; returns where the
    whole body sits, in drawing units."""
    per_unit = scale.per_unit()
    y, x = scale.find(rescaled(first, scale.px(scale.standing_sheet) / scale.px(sheet)), ink)
    on_sheet = scale.px(sheet) / scale.eye
    pad = 60
    under = np.zeros((first.shape[0] + 2 * pad, first.shape[1] + 2 * pad, 4), np.uint8)
    under[pad:-pad, pad:-pad] = first
    behind = body.shape[1] - first.shape[1] - 20
    fy, fx = place(body[:, behind:], under, mask=ink, step=2)
    at = (x / per_unit + scale.margin + (fx - pad - behind) / on_sheet, y / per_unit + scale.margin + (fy - pad) / on_sheet)
    column = round((RUMP - at[0]) * on_sheet)
    overlap = round(RUMP_OVERLAP * on_sheet)
    for name, left, piece in [('crow-rump', 0, body[:, :column + overlap]), ('crow-body', column - overlap, body[:, column - overlap:])]:
        dx, dy = crop_origin(piece)
        size = export(crop(piece), OUT, name, scale.on_eye(sheet))
        print(f'{name}: {scale.units(size)} at {at[0] + (left + dx) / on_sheet:.2f}, {at[1] + dy / on_sheet:.2f}')
    return at


def crow(check: Path | None) -> None:
    scale = EyeScale(HERE, EYES, EYE, RES, measure=iris, middle=iris_middle)
    scale.reference('crow-standing.png', LAB, 'crow-reference')
    scale.key_poses('crow-pose-', KEY_POSES, LAB)
    sheet = crow_keyed(HERE / 'crow-parts.png')
    parts = {name: art for row, names in zip(rows(sheet, 2), CROW_ROWS) for name, art in cut(row, names).items()}
    first = parts.pop('crow-body')
    masks = {'crow-head': bill_and_eye, 'crow-body': ink, 'crow-wing-folded': ink, 'crow-tail': None}
    scale.parts(parts, 'crow-parts.png', OUT, masks=masks)
    body = matched(unreddened(cut(crow_keyed(HERE / 'crow-body-4.png'), BODY_SHEET)['crow-body']), first)
    # The redraw came back a little bigger than the first body beside the
    # same head, so it is drawn as tall as that body was.
    body = rescaled(body, (first.shape[0] - 2 * MARGIN) / (body.shape[0] - 2 * MARGIN))
    body_at = rump_and_body(scale, body, first, 'crow-parts.png')
    onto = scale.px(scale.standing_sheet) / scale.px('crow-parts.png')
    ty, tx = tip_at(rescaled(parts['crow-tail'], onto), scale.standing)
    print(f'crow-tail: placed by its tip at {tx / scale.per_unit() + scale.margin:.2f}, {ty / scale.per_unit() + scale.margin:.2f}')
    per_unit = scale.per_unit()
    length = scale.standing.shape[1] / per_unit
    print(f'crow-reference: {length:.2f} units from bill tip to tail tip, margins included')
    # The spread wing: both pieces on one scale, so that from the arm's root
    # to the hand's tip, less the gap they were drawn apart by, it is the
    # wing's true length.
    # The rig's wings are drawn span up the picture, leading edge right
    # (rig/wings.ts), so the sheet's pieces, drawn shoulder left and leading
    # edge up, are turned a quarter left and mirrored. A crow's underwing is
    # as black, a little greyer and flatter in its shading, so the underside
    # is the upper side greyed rather than another drawing.
    arm, hand = (span_up(crop(p)) for p in poses(crow_keyed(HERE / 'crow-wing.png'), 2))
    k = WING_LENGTH * length * RES / (arm.shape[0] + hand.shape[0])
    for name, art in [('crow-wing-arm', arm), ('crow-wing-hand', hand)]:
        w, h = export(art, OUT, name, k)
        export(underside(art), OUT, f'{name}-under', k)
        print(f'{name}: {w / RES:.2f}x{h / RES:.2f} units, span up')
    scale.bar('crow-drumstick', crop(crow_keyed(HERE / 'crow-drumstick.png')), OUT, DRUMSTICK)
    # The legs: the tarsus at its thickness, and the feet at the foot's
    # length, the curled one on the same scale as the open one.
    tarsus, foot, curled = (crop(p) for p in poses(keyed(HERE / 'crow-limbs.png'), 3))
    scale.bar('crow-tarsus', tarsus, OUT, TARSUS)
    per_unit = foot.shape[1] / FOOT
    knob = (KNOB * per_unit, KNOB_LINE * per_unit)
    scale.foot('crow-foot', knobbed(foot, HEEL, *knob), OUT, FOOT, HEEL)
    w, h = export_with_fur(knobbed(curled, CURLED_HEEL, *knob), OUT, 'crow-foot-curled', FOOT * RES / foot.shape[1])
    print(f'crow-foot-curled: {w / RES:.2f}x{h / RES:.2f} units, heel {w * CURLED_HEEL[0] / RES:.2f}, {h * CURLED_HEEL[1] / RES:.2f}')
    if check:
        laid = []
        for name in ['crow-tail', 'crow-body', 'crow-wing-folded', 'crow-head']:
            art = rescaled(body if name == 'crow-body' else parts[name], onto)
            if name == 'crow-body':
                x, y = (round((u - scale.margin) * per_unit) for u in body_at)
            else:
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
