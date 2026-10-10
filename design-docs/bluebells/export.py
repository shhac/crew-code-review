# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Keys, crops and exports the bluebell wood's art. Run: uv run design-docs/bluebells/export.py

The steps are shared with the other themes (../art.py). The bee is put on
one scale like every animal, but not by its eye: art.py's feature measures
a dark blob, and a bumblebee's eye sits in a black head, so the blob it
finds is the whole head. The golden band across the abdomen (T2) is measured
instead, by its area, which holds whatever angle the abdomen is drawn at.
"""
from collections import deque
from pathlib import Path
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import MARGIN, EyeScale, cut, keyed, opaque, pale  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/bluebells'
LAB = HERE.parents[1] / 'internal/dashboard/ui/src/lab'
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


def main() -> None:
    scale = EyeScale(HERE, BANDS, BAND, RES, measure=band)
    scale.reference('bee-standing.png', LAB, 'bee-reference')
    x, y = collar('bee-standing', BANDS['bee-standing.png'], STANDING_COLLAR)
    print(f'bee-reference: collar at {x + scale.margin:.2f}, {y + scale.margin:.2f}')
    scale.key_poses('bee-pose-', {pose: seeds[0] for pose, seeds in KEY_POSES.items()}, LAB)
    for pose, (band_seed, collar_seed) in KEY_POSES.items():
        x, y = collar(f'bee-pose-{pose}', band_seed, collar_seed)
        print(f'bee-pose-{pose}: collar at {x:.2f}, {y:.2f}')
    scale.parts(cut(keyed(HERE / 'bee-parts.png'), PARTS), 'bee-parts.png', OUT, masks=MASKS)


if __name__ == '__main__':
    main()
