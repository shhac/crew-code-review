# /// script
# dependencies = ["pillow==12.3.0", "numpy==2.5.4"]
# ///
"""Cuts the standing legs' pieces out of sources/robin-legs-sheet.png.
Run: uv run design-docs/christmas/animation/parts-prototype/legs.py, then prepare.mjs.

The sheet (magenta keyed out by ../../../art.py) draws the near leg as three
pieces standing straight: the drumstick's feathered end, the bare tarsus
and the toes. Each is turned to the angle its bone stands at in the robin
at rest, written as a transparent source beside the others (sources/leg-
near-*.png, and the far leg's, a shade darker), and registered by its joint:
sources/legs-registration.json says where in each source its joint and a
second point along it are, and how far apart they are in the robin's
units, so prepare.mjs places it with the root on its joint, as it places
the flight wings; and where each leg's joints are, for the manifest.
"""
import json
import math
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from art import keyed  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

HERE = Path(__file__).resolve().parent
SOURCES = HERE / 'sources'
# The robin's units per sheet pixel: the toes as wide (rear claw to front
# claw, 538 pixels) as the one-piece legs' toes were, 12.4 units.
SCALE = 12.4 / 538
# The far leg is the near one a shade darker, as its one-piece drawing was
# against the near one's (its fill 0.8 of the near's).
FAR = 0.8
# Each piece's columns in the sheet, its joint (where the bone above or
# below meets it) and a second point along its bone, in sheet pixels,
# measured by eye: the drumstick from the ankle, its rounded end, up to its
# top; the tarsus from its knob at the ankle down to its end at the toes;
# the toes from the pad the tarsus comes down on, forward.
PIECES = {
    'drumstick': {'columns': (300, 600), 'root': (437, 470), 'tip': (430, 350)},
    'tarsus': {'columns': (900, 1150), 'root': (1027, 195), 'tip': (1032, 575)},
    'toes': {'columns': (1400, 2060), 'root': (1627, 435), 'tip': (1727, 435)},
}
# Where each leg's bones stand at rest, in the robin's units (the manifest's
# joints): the knee in the belly, the ankle where the tarsus leaves it, the
# toes' pad. The tarsus keeps the one-piece legs' slope, and the pad is set
# so the claws come down where theirs did.
LEGS = {
    'near': {'knee': (67.17, 78.86), 'ankle': (60.12, 88.93), 'toes': (63.51, 97.0)},
    'far': {'knee': (80.45, 77.68), 'ankle': (73.4, 87.75), 'toes': (76.34, 96.0)},
}
# Each piece's bone, from its joint: the drumstick up from the ankle to the
# knee, the tarsus down from the ankle to the toes; the toes lie as drawn.
BONES = {'drumstick': ('ankle', 'knee'), 'tarsus': ('ankle', 'toes'), 'toes': None}
PAD = 200


def angle(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))


def turned(art: np.ndarray, root: tuple[float, float], tip: tuple[float, float], by: float) -> tuple[np.ndarray, tuple[float, float], tuple[float, float]]:
    """The piece turned by degrees (clockwise as drawn, y down) about its
    joint on a canvas with room round it, and where its two points are."""
    h, w = art.shape[:2]
    canvas = np.zeros((h + 2 * PAD, w + 2 * PAD, 4), np.uint8)
    canvas[PAD:PAD + h, PAD:PAD + w] = art
    r = (root[0] + PAD, root[1] + PAD)
    img = Image.fromarray(canvas, 'RGBA').rotate(-by, resample=Image.BICUBIC, center=r)
    t = math.radians(by)
    dx, dy = tip[0] - root[0], tip[1] - root[1]
    return np.asarray(img), r, (r[0] + dx * math.cos(t) - dy * math.sin(t), r[1] + dx * math.sin(t) + dy * math.cos(t))


def main() -> None:
    sheet = keyed(SOURCES / 'robin-legs-sheet.png')
    registration = {'joints': {f'{side}{joint.title()}': list(at) for side, joints in LEGS.items() for joint, at in joints.items()}, 'parts': {}}
    for side, joints in LEGS.items():
        for name, piece in PIECES.items():
            a, b = piece['columns']
            art = sheet[:, a:b].copy()
            # The faint key left in the background (art.py crops at it too).
            art[art[..., 3] <= 8] = 0
            root, tip = (piece['root'][0] - a, piece['root'][1]), (piece['tip'][0] - a, piece['tip'][1])
            bone = BONES[name]
            by = angle(joints[bone[0]], joints[bone[1]]) - angle(root, tip) if bone else 0.0
            art, root, tip = turned(art, root, tip, by)
            if side == 'far':
                art = art.copy()
                art[..., :3] = (art[..., :3] * FAR).astype(np.uint8)
            ys, xs = np.nonzero(art[..., 3] > 2)
            art = art[:ys.max() + PAD // 2, :xs.max() + PAD // 2]
            file = f'leg-{side}-{name}.png'
            Image.fromarray(art, 'RGBA').save(SOURCES / file)
            span = math.hypot(tip[0] - root[0], tip[1] - root[1]) * SCALE
            registration['parts'][f'leg-{side}-{name}'] = {
                'source': file, 'rootSource': [round(root[0], 2), round(root[1], 2)], 'tipSource': [round(tip[0], 2), round(tip[1], 2)],
                'projectedSpan': round(span, 4), 'pivot': list(joints['ankle' if name != 'toes' else 'toes']),
            }
            print(f'leg-{side}-{name}: turned {by:.1f} degrees, {span:.2f} units joint to point')
    (SOURCES / 'legs-registration.json').write_text(json.dumps(registration, indent=2) + '\n')


if __name__ == '__main__':
    main()
