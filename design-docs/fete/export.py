# /// script
# dependencies = ["pillow==12.3.0", "numpy==2.5.4"]
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
from collections.abc import Callable
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import EyeScale, blob, crop, crop_origin, cut, export, keyed, lum, opaque, search  # noqa: E402
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


def grey_eye(path: Path, seed: tuple[int, int]) -> tuple[float, tuple[float, float]]:
    """The dark grey inside the eye's black outline: the square root of its
    area, which holds still whatever angle the eye is drawn at where its box
    would not, and its middle (source pixels)."""
    total = np.asarray(Image.open(path).convert('RGB')).astype(int).sum(axis=-1)
    points = blob((total > 90) & (total < 230), seed)
    ys, xs = zip(*points)
    return len(points) ** 0.5, (sum(xs) / len(xs), sum(ys) / len(ys))


def iris(path: Path, seed: tuple[int, int]) -> float:
    return grey_eye(path, seed)[0]


def iris_middle(path: Path, seed: tuple[int, int]) -> tuple[float, float]:
    return grey_eye(path, seed)[1]


class IrisScale(EyeScale):
    def find(self, part: np.ndarray, mask=None) -> tuple[int, int]:
        return matched(part, self.standing)


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


def matched(part: np.ndarray, whole: np.ndarray) -> tuple[int, int]:
    """Where a part sits in the whole (its top left, in the whole's pixels):
    the offset where most of its opaque pixels are the same colour as the
    whole's beneath them."""
    def same(a: np.ndarray) -> Callable[[np.ndarray], float]:
        solid = a > 0
        return lambda window: int((window[solid] == a[solid]).sum())
    return search(colours(part), colours(whole), same)


def table() -> None:
    art = keyed(HERE / 'fete-table.png')
    left, top = crop_origin(art)
    art = crop(art)
    k = TABLE[1] * TABLE[0] / art.shape[1]
    w, h = export(art, OUT, 'fete-table', k)
    print(f'fete-table: display {w / TABLE[1]:g}x{h / TABLE[1]:g}')
    for name, ((x, y), half) in {'cake': CAKE, 'jar': JAR}.items():
        fx, fy, fh = (x - left) / art.shape[1], (y - top) / art.shape[0], half / art.shape[1]
        print(f'{name}: fractions {fx:.4f}, {fy:.4f}, half {fh:.4f}; display {fx * w / TABLE[1]:.1f}, {fy * h / TABLE[1]:.1f}, half {fh * w / TABLE[1]:.1f}')


def wasp() -> None:
    scale = IrisScale(HERE, EYES, EYE, RES, measure=iris, middle=iris_middle)
    units = {'wasp-reference': scale.reference('wasp-standing.png', LAB, 'wasp-reference')}
    scale.key_poses('wasp-pose-', KEY_POSES, LAB)
    parts = cut(keyed(HERE / 'wasp-parts.png'), PARTS)
    units.update(scale.parts(parts, 'wasp-parts.png', OUT))
    wing = keyed(HERE / 'wasp-wing.png')
    left, top = crop_origin(wing)
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
