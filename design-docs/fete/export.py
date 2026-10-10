# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Keys, crops and exports the village fête art. Run: uv run design-docs/fete/export.py

The steps are shared with the other themes (../art.py). The fête table is
exported at twice its display size, and the two places the wasps use on it
(the cake's sugared top and the blackcurrant jar's lid) are printed as
fractions of its box and in stage pixels: FeteShelf.svelte and fete/table.ts
carry them, so regenerated art means measuring them again.

The wasp's pictures (the parts it is put together from, its open wing, the
standing reference and the key poses the lab lays over it) are all put on
one scale, the eye's, so every pose is the same animal; they are written at
RES pixels per drawing unit, and the wasp's rig sets how big a drawing unit
is on the page. A wasp is black where its outlines are, so the eye is
measured as the dark grey inside its outline (iris), not as the dark blob
art.py's feature finds, which would run into the whole thorax. The parts are
cut from wasp-standing.png (the whole wasp standing on six legs, its anatomy
reference) into wasp-parts.png, each printed with where it sat in the
reference: its place in the rig. The open wing is cut from the hovering key
pose (wasp-wing.png) and placed by hand at its hinge.
"""
from collections import deque
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import EyeScale, crop, cut, export, keyed, lum, opaque, rescaled  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/fete'
LAB = HERE.parents[1] / 'internal/dashboard/ui/src/lab'
# The table's display width in page pixels, and file pixels to each.
TABLE = (168, 2)
# Measured by eye on fete-table.png (source pixels): the middle of the
# cake's sugared top and its half-width there, and the top of the right-hand
# (blackcurrant) jar's gingham lid and its half-width.
CAKE = ((905, 185), 235)
JAR = ((1712, 396), 70)
PARTS = ['wasp-gaster', 'wasp-thorax', 'wasp-head', 'wasp-wing-folded']
# The eye's size in drawing units, and file pixels per drawing unit.
EYE = 2
RES = 12
# Where each sheet's eye is (source pixels), measured by eye.
EYES = {'wasp-standing.png': (1100, 410), 'wasp-parts.png': (1282, 345), 'wasp-pose-hover.png': (1040, 360)}
KEY_POSES = {'hover': (1040, 360), 'cruise': (1100, 410), 'land': (1040, 380), 'feed': (1090, 570)}
# The open wing's hinge (the tegula's knob) on wasp-wing.png, source pixels.
HINGE = (1066, 597)


def iris(path: Path, seed: tuple[int, int]) -> float:
    """The eye's size: the square root of the area of the dark grey inside
    its black outline, which holds still whatever angle the eye is drawn
    at, where its box would not."""
    total = np.asarray(Image.open(path).convert('RGB')).astype(int).sum(axis=-1)
    grey = (total > 90) & (total < 230)
    start = (seed[1], seed[0])
    seen, todo, count = {start}, deque([start]), 0
    while todo:
        y, x = todo.popleft()
        count += 1
        for n in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= n[0] < grey.shape[0] and 0 <= n[1] < grey.shape[1] and grey[n] and n not in seen:
                seen.add(n)
                todo.append(n)
    return count ** 0.5


class IrisScale(EyeScale):
    def px(self, sheet: str, seed: tuple[int, int] | None = None) -> float:
        return iris(self.here / sheet, seed or self.eyes[sheet])

    def key_poses(self, prefix: str, seeds: dict[str, tuple[int, int]], out: Path, key=keyed) -> None:
        for pose, seed in seeds.items():
            name = f'{prefix}{pose}'
            path = self.here / f'{name}.png'
            eye = iris(path, seed)
            size = export(crop(key(path)), out, name, self.eye / eye * self.res)
            print(f'{name}: eye {eye:.1f}px; drawing units {self.units(size)}')

    def placed(self, name: str, art: np.ndarray, out: Path, scale: float, k: float, mask=None) -> tuple[int, int]:
        size = export(art, out, name, scale)
        per_unit = self.per_unit()
        y, x = matched(rescaled(art, k), self.standing)
        PLACED[name] = (x / per_unit + self.margin, y / per_unit + self.margin)
        print(f'{name}: {self.units(size)} at {PLACED[name][0]:.2f}, {PLACED[name][1]:.2f}')
        return size


def colours(rgba: np.ndarray) -> np.ndarray:
    """Each pixel as nothing (0), yellow (1), black (2) or anything else (3):
    what to match a part by, since a black or striped part's shape alone
    fits anywhere inside the whole wasp, but its pattern of yellow and black
    fits in one place."""
    rgb = rgba[..., :3].astype(int)
    yellow = (rgb[..., 0] > 180) & (rgb[..., 1] > 150) & (rgb[..., 2] < 120)
    black = lum(rgba) < 90
    out = np.where(yellow, 1, np.where(black, 2, 3))
    return np.where(opaque(rgba), out, 0)


def matched(part: np.ndarray, whole: np.ndarray, step: int = 4) -> tuple[int, int]:
    """Where a part sits in the whole (its top left, in the whole's pixels):
    the offset where most of its opaque pixels are the same colour as the
    whole's beneath them, found on copies shrunk step times, then refined."""
    a, b = colours(part), colours(whole)

    def best(a: np.ndarray, b: np.ndarray, ys, xs) -> tuple[int, int]:
        h, w = a.shape
        solid = a > 0

        def score(y: int, x: int) -> int:
            window = b[y:y + h, x:x + w]
            return int((window[solid] == a[solid]).sum())
        return max(((y, x) for y in ys for x in xs), key=lambda p: score(*p))

    sa, sb = a[::step, ::step], b[::step, ::step]
    cy, cx = best(sa, sb, range(sb.shape[0] - sa.shape[0] + 1), range(sb.shape[1] - sa.shape[1] + 1))
    h, w = a.shape
    ys = range(max(0, cy * step - step), min(b.shape[0] - h, cy * step + step) + 1)
    xs = range(max(0, cx * step - step), min(b.shape[1] - w, cx * step + step) + 1)
    return best(a, b, ys, xs)


# Where each part sat in the reference, in drawing units, for the overlay.
PLACED: dict[str, tuple[float, float]] = {}


def table() -> None:
    art = keyed(HERE / 'fete-table.png')
    ys, xs = np.nonzero(art[..., 3] > 8)
    top, left = max(0, ys.min() - 6), max(0, xs.min() - 6)
    art = crop(art)
    k = TABLE[1] * TABLE[0] / art.shape[1]
    w, h = export(art, OUT, 'fete-table', k)
    print(f'fete-table: display {w / TABLE[1]:g}x{h / TABLE[1]:g}')
    for name, ((x, y), half) in {'cake': CAKE, 'jar': JAR}.items():
        fx, fy, fh = (x - left) / art.shape[1], (y - top) / art.shape[0], half / art.shape[1]
        print(f'{name}: fractions {fx:.4f}, {fy:.4f}, half {fh:.4f}; display {fx * w / TABLE[1]:.1f}, {fy * h / TABLE[1]:.1f}, half {fh * w / TABLE[1]:.1f}')


def wasp() -> None:
    scale = IrisScale(HERE, EYES, EYE, RES)
    units = {'wasp-reference': scale.reference('wasp-standing.png', LAB, 'wasp-reference')}
    scale.key_poses('wasp-pose-', KEY_POSES, LAB)
    parts = cut(keyed(HERE / 'wasp-parts.png'), PARTS)
    units.update(scale.parts(parts, 'wasp-parts.png', OUT))
    wing = keyed(HERE / 'wasp-wing.png')
    ys, xs = np.nonzero(wing[..., 3] > 8)
    top, left = max(0, ys.min() - 6), max(0, xs.min() - 6)
    wing = crop(wing)
    size = export(wing, OUT, 'wasp-wing', scale.on_eye('wasp-pose-hover.png'))
    hx, hy = (HINGE[0] - left) / wing.shape[1], (HINGE[1] - top) / wing.shape[0]
    print(f'wasp-wing: {scale.units(size)}, hinge {hx * size[0] / RES:.2f}, {hy * size[1] / RES:.2f}')
    for name, (w, h) in units.items():
        print(f'{name}: {w}x{h}, drawing units {w / RES:.2f}x{h / RES:.2f}')


def main() -> None:
    OUT.mkdir(exist_ok=True)
    table()
    wasp()


if __name__ == '__main__':
    main()
