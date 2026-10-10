# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Keys, crops and exports the bluebell wood's art. Run: uv run design-docs/bluebells/export.py

The steps are shared with the other themes (../art.py). The shelf is
exported at twice its display size; the ledge clumps and moss cushions,
which are small on the page, at four times, all five cut from one sheet at
its empty column runs and drawn at one scale (the tallest clump CLUMP px
tall), so a cushion is as big beside a clump as it was drawn.

A bee perches on top of a bell, so every bell of every flower is found in
the art (each a blob of the bells' blue between their outlines) and printed
as the middle of its top edge, in fractions of the exported box: the
perches bluebells/art.ts holds. They are measured again here whenever the
art is regenerated.

The bee is put on one scale like every animal, but not by its eye: art.py's
feature measures a dark blob, and a bumblebee's eye sits in a black head, so
the blob it finds is the whole head. The golden band across the abdomen
(T2) is measured instead, by its area, which holds whatever angle the
abdomen is drawn at.
"""
from collections import deque
from pathlib import Path
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import MARGIN, EyeScale, crop, cut, export, keyed, opaque, pale, poses  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/bluebells'
LAB = HERE.parents[1] / 'internal/dashboard/ui/src/lab'
# Display height in page px, and file px to each.
SHELF = (72, 2)
CLUMP = (20, 4)
# Left to right in ledge-clumps.png.
PIECES = ['clump-0', 'cushion-0', 'clump-1', 'cushion-1', 'clump-2']
# Blobs of blue smaller than this share of the piece's area are a sliver of
# a bell between two lines, not a bell.
SPECK = 0.0008

# The bee's pictures are all on one scale, its golden band's: BAND drawing
# units across (the square root of its area), written at RES file pixels
# per unit. bee-rig.ts draws a unit as a page pixel, so the bee is 18px from
# its jaws to the tip of its tail.
BAND = 3.2
RES = 12
# Where each sheet's golden band is (source pixels), measured by eye.
BANDS = {'bee-standing.png': (420, 458), 'bee-parts.png': (360, 340)}
# Key poses of the same bee, edits of the reference, for the lab to lay over
# each mode: where each one's band is, and its collar (the golden front of
# the thorax), which the lab lines up with the rig's.
KEY_POSES = {
    'perch': ((497, 344), (878, 312)), 'crawl': ((420, 495), (976, 406)), 'hover': ((539, 550), (937, 312)),
    'fly': ((518, 494), (999, 430)), 'land': ((496, 554), (957, 411)), 'bonk': ((588, 662), (836, 370)),
}
STANDING_COLLAR = (983, 390)
# The parts sheet, left to right, cut from the reference: the abdomen, the
# thorax with its legs and wings taken off, the head with its antennae taken
# off and its back edge soft, and the near pair of wings as one piece.
PARTS = ['bee-abdomen', 'bee-thorax', 'bee-head', 'bee-wings']


def golden(rgba: np.ndarray) -> np.ndarray:
    r, g, b = (rgba[..., i].astype(int) for i in range(3))
    return (r > 200) & (g > 140) & (g < 215) & (b < 90)


def patch(path: Path, seed: tuple[int, int]) -> tuple[np.ndarray, np.ndarray]:
    """The golden patch nearest seed, as its pixels' rows and columns."""
    gold = golden(np.asarray(Image.open(path).convert('RGB')))
    ys, xs = np.nonzero(gold)
    start = min(zip(ys, xs), key=lambda p: (p[0] - seed[1]) ** 2 + (p[1] - seed[0]) ** 2)
    seen, todo = {start}, deque([start])
    while todo:
        y, x = todo.popleft()
        for n in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= n[0] < gold.shape[0] and 0 <= n[1] < gold.shape[1] and gold[n] and n not in seen:
                seen.add(n)
                todo.append(n)
    rows, cols = zip(*seen)
    return np.array(rows), np.array(cols)


def band(path: Path, seed: tuple[int, int]) -> float:
    """The golden patch's size: the square root of its area, so a band drawn
    at a slant measures the same as one drawn level."""
    return len(patch(path, seed)[0]) ** 0.5


def collar(name: str, band_seed: tuple[int, int], seed: tuple[int, int]) -> tuple[float, float]:
    """The middle of the collar in a cropped, exported picture, in drawing
    units: where the lab lines a key pose up with the rig."""
    path = HERE / f'{name}.png'
    rows, cols = patch(path, seed)
    alpha = keyed(path)[..., 3] > 8
    top = max(0, np.nonzero(alpha.any(axis=1))[0].min() - MARGIN)
    left = max(0, np.nonzero(alpha.any(axis=0))[0].min() - MARGIN)
    per_unit = band(path, band_seed) / BAND
    return (cols.mean() - left) / per_unit, (rows.mean() - top) / per_unit


def eye(rgba: np.ndarray) -> np.ndarray:
    """The dark brown of the compound eye and its white glint: the head is
    matched by them, since its black fur would fit anywhere in the body."""
    r, g, b = (rgba[..., i].astype(int) for i in range(3))
    brown = (r > 35) & (r < 110) & (r - b > 12) & (g < 80)
    glint = (r > 225) & (g > 225) & (b > 225)
    return opaque(rgba) & (brown | glint)


def stripes(rgba: np.ndarray) -> np.ndarray:
    """The golden bands and the buff tail: what the abdomen and thorax are
    matched by, since their black fur is one shape with the rest."""
    r, g, b = (rgba[..., i].astype(int) for i in range(3))
    buff = (r > 220) & (g > 200) & (b > 150) & (b < 225)
    return opaque(rgba) & (golden(rgba) | buff)


MASKS = {'bee-abdomen': stripes, 'bee-thorax': stripes, 'bee-head': eye, 'bee-wings': pale}


def blue(rgba: np.ndarray) -> np.ndarray:
    r, g, b = (rgba[..., i].astype(int) for i in range(3))
    return (rgba[..., 3] > 200) & (b > 110) & (b - g > 70) & (b - r > 15)


def blobs(mask: np.ndarray) -> list[list[tuple[int, int]]]:
    seen = np.zeros(mask.shape, bool)
    found = []
    for start in zip(*np.nonzero(mask)):
        if seen[start]:
            continue
        seen[start] = True
        todo, blob = deque([start]), []
        while todo:
            y, x = todo.popleft()
            blob.append((y, x))
            for n in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= n[0] < mask.shape[0] and 0 <= n[1] < mask.shape[1] and mask[n] and not seen[n]:
                    seen[n] = True
                    todo.append(n)
        found.append(blob)
    return found


def bells(rgba: np.ndarray) -> list[tuple[float, float]]:
    """The top of each bell, as fractions of the piece's box: the middle of
    the bell's blue across, a little above its highest blue row (its
    outline)."""
    h, w = rgba.shape[:2]
    tops = []
    for blob in blobs(blue(rgba)):
        if len(blob) < SPECK * h * w:
            continue
        ys, xs = zip(*blob)
        top = min(ys)
        row = [x for y, x in blob if y <= top + max(2, (max(ys) - top) // 6)]
        tops.append(((min(row) + max(row)) / 2 / w, max(0, top - 0.03 * (max(ys) - top) - 1) / h))
    return sorted(tops, key=lambda t: -t[1])


def report(name: str, art: np.ndarray, size: tuple[int, int], density: int) -> None:
    print(f'{name}: display {size[0] / density:g}x{size[1] / density:g}')
    for x, y in bells(art):
        print(f'  bell {x:.3f}, {y:.3f}')


def flowers() -> None:
    OUT.mkdir(exist_ok=True)
    shelf = crop(keyed(HERE / 'bluebell-shelf.png'))
    height, density = SHELF
    report('bluebell-shelf', shelf, export(shelf, OUT, 'bluebell-shelf', density * height / shelf.shape[0]), density)
    pieces = dict(zip(PIECES, (crop(p) for p in poses(keyed(HERE / 'ledge-clumps.png'), len(PIECES)))))
    height, density = CLUMP
    tallest = max(p.shape[0] for p in pieces.values())
    for name, art in pieces.items():
        report(name, art, export(art, OUT, name, density * height / tallest), density)



def bee() -> None:
    scale = EyeScale(HERE, BANDS, BAND, RES, measure=band)
    scale.reference('bee-standing.png', LAB, 'bee-reference')
    x, y = collar('bee-standing', BANDS['bee-standing.png'], STANDING_COLLAR)
    print(f'bee-reference: collar at {x + scale.margin:.2f}, {y + scale.margin:.2f}')
    scale.key_poses('bee-pose-', {pose: seeds[0] for pose, seeds in KEY_POSES.items()}, LAB)
    for pose, (band_seed, collar_seed) in KEY_POSES.items():
        x, y = collar(f'bee-pose-{pose}', band_seed, collar_seed)
        print(f'bee-pose-{pose}: collar at {x:.2f}, {y:.2f}')
    scale.parts(cut(keyed(HERE / 'bee-parts.png'), PARTS), 'bee-parts.png', OUT, masks=MASKS)


def main() -> None:
    flowers()
    bee()


if __name__ == '__main__':
    main()
