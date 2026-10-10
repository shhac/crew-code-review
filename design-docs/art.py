"""Shared steps for exporting seasonal theme art (see halloween/README.md).

Each theme's export.py imports this: key the flat magenta background out with
alpha from min(R,B) - G ramping between 60 and 140 and a half-strength
despill, crop to the art plus a margin, split pose sheets at their empty
column (or row) runs, measure a feature (an eye) to put sheets drawn at
different sizes on one scale, and write WebP. EyeScale holds one animal's
pictures on that scale and prints where each part sat in its reference.
"""
from collections import deque
from collections.abc import Callable
from pathlib import Path
import subprocess
import tempfile

import numpy as np
from PIL import Image

MARGIN = 6

Mask = Callable[[np.ndarray], np.ndarray]
Size = tuple[int, int]


def keyed(path: Path) -> np.ndarray:
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    spill = np.minimum(r, b) - g
    alpha = 1 - np.clip((spill - 60) / 80, 0, 1)
    excess = np.maximum(spill, 0) * 0.5
    out = np.dstack([r - excess, g, b - excess, alpha * 255])
    return np.clip(out, 0, 255).astype(np.uint8)


def crop(rgba: np.ndarray) -> np.ndarray:
    ys, xs = np.nonzero(rgba[..., 3] > 8)
    return rgba[max(0, ys.min() - MARGIN):ys.max() + MARGIN + 1, max(0, xs.min() - MARGIN):xs.max() + MARGIN + 1]


def poses(rgba: np.ndarray, count: int) -> list[np.ndarray]:
    """Split a sheet of count poses, left to right, at the middles of its
    count - 1 widest runs of empty columns."""
    empty = (rgba[..., 3] <= 8).all(axis=0)
    runs, start = [], None
    for x, e in enumerate(empty):
        if e and start is None:
            start = x
        if not e and start is not None:
            runs.append((start, x))
            start = None
    inner = [r for r in runs if r[0] > 0 and r[1] < len(empty)]
    gaps = sorted(sorted(inner, key=lambda r: r[1] - r[0])[-(count - 1):])
    cuts = [0, *((a + b) // 2 for a, b in gaps), rgba.shape[1]]
    return [rgba[:, a:b] for a, b in zip(cuts, cuts[1:])]


def fill_only(rgba: np.ndarray) -> np.ndarray:
    """The same piece with its black outline taken out, the fur alone: drawn
    over the outlined pieces of a leg, it hides the outlines where they
    cross inside the leg, so only the leg's silhouette is outlined."""
    keep = np.clip((lum(rgba) - 70) / 60, 0, 1)
    out = rgba.copy()
    out[..., 3] = (rgba[..., 3] * keep).astype(np.uint8)
    return out


def rows(rgba: np.ndarray, count: int) -> list[np.ndarray]:
    """Split a sheet of count pieces, top to bottom, the same way."""
    return [p.transpose(1, 0, 2) for p in poses(rgba.transpose(1, 0, 2), count)]


def feature(path: Path, seed: tuple[int, int]) -> float:
    """The size (mean of width and height) of the dark blob nearest seed in a
    source image: an eye, the one feature every pose of an animal shares."""
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(int)
    dark = rgb.sum(axis=-1) < 200
    ys, xs = np.nonzero(dark)
    start = min(zip(ys, xs), key=lambda p: (p[0] - seed[1]) ** 2 + (p[1] - seed[0]) ** 2)
    seen, todo, blob = {start}, deque([start]), []
    while todo:
        y, x = todo.popleft()
        blob.append((y, x))
        for n in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= n[0] < dark.shape[0] and 0 <= n[1] < dark.shape[1] and dark[n] and n not in seen:
                seen.add(n)
                todo.append(n)
    by, bx = zip(*blob)
    return ((max(bx) - min(bx) + 1) + (max(by) - min(by) + 1)) / 2


def lum(rgba: np.ndarray) -> np.ndarray:
    return rgba[..., :3].astype(np.float32) @ np.array([0.299, 0.587, 0.114], dtype=np.float32)


def opaque(rgba: np.ndarray) -> np.ndarray:
    return rgba[..., 3] > 128


def ground(rgba: np.ndarray) -> int:
    """The lowest row anything stands on: the last with an opaque pixel."""
    return int(np.nonzero(opaque(rgba).any(axis=1))[0].max())


def pale(rgba: np.ndarray) -> np.ndarray:
    """The light fur of a picture: what to match a part by when its shape
    alone fits anywhere inside the whole (a head against a spiny body)."""
    return opaque(rgba) & (lum(rgba) > 170)


def rescaled(rgba: np.ndarray, k: float) -> np.ndarray:
    img = Image.fromarray(rgba, 'RGBA')
    return np.asarray(img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS))


def place(part: np.ndarray, whole: np.ndarray, step: int = 4, mask=opaque) -> tuple[int, int]:
    """Where a part cut from a whole picture sits in it (its top left, in the
    whole's pixels): the offset at which their shapes (or what mask picks
    out of them) overlap best, found on copies shrunk step times, then
    refined at full size."""
    a = mask(part).astype(np.float32)
    b = mask(whole).astype(np.float32)

    def best(a: np.ndarray, b: np.ndarray, ys, xs) -> tuple[int, int]:
        h, w = a.shape
        def score(y: int, x: int) -> float:
            window = b[y:y + h, x:x + w]
            return float((window * a).sum() - 0.5 * ((1 - window) * a).sum())
        return max(((y, x) for y in ys for x in xs), key=lambda p: score(*p))

    small_a, small_b = a[::step, ::step], b[::step, ::step]
    cy, cx = best(small_a, small_b, range(small_b.shape[0] - small_a.shape[0] + 1), range(small_b.shape[1] - small_a.shape[1] + 1))
    h, w = a.shape
    ys = range(max(0, cy * step - step), min(b.shape[0] - h, cy * step + step) + 1)
    xs = range(max(0, cx * step - step), min(b.shape[1] - w, cx * step + step) + 1)
    return best(a, b, ys, xs)


def export(rgba: np.ndarray, out: Path, name: str, scale: float) -> tuple[int, int]:
    img = Image.fromarray(rgba, 'RGBA')
    size = (round(img.width * scale), round(img.height * scale))
    img = img.resize(size, Image.LANCZOS)
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / f'{name}.png'
        img.save(png)
        subprocess.run(['cwebp', '-quiet', '-q', '90', '-alpha_q', '100', '-exact', str(png), '-o', str(out / f'{name}.webp')], check=True)
    return size


def export_with_fur(rgba: np.ndarray, out: Path, name: str, scale: float) -> tuple[int, int]:
    """A piece and, under {name}-fur, its fur alone at the same scale, to
    draw over the outlined pieces it joins."""
    size = export(rgba, out, name, scale)
    export(fill_only(rgba), out, f'{name}-fur', scale)
    return size


def cut(rgba: np.ndarray, names: list) -> dict:
    """A sheet split into its named pieces, left to right, each cropped."""
    return dict(zip(names, (crop(p) for p in poses(rgba, len(names)))))


class EyeScale:
    """One animal's pictures put on one scale, the eye's (the one feature
    every pose shares), so every pose is the same animal: its eye is eye
    drawing units across, written at res file pixels per unit, and the
    theme's rig sets how big a unit is on the page. eyes says where each
    sheet's eye is (source pixels, measured by eye). Drawing units are the
    reference's, moved by margin so a frame round it has a margin. measure
    says how big the feature is in a sheet, given where it is: feature (a
    dark blob) by default, or another where an eye cannot be told from the
    fur round it (a bumblebee's, in its black head)."""

    def __init__(self, here: Path, eyes: dict[str, tuple[int, int]], eye: float, res: int, margin: int = 1,
                 measure: Callable[[Path, tuple[int, int]], float] = feature):
        self.here, self.eyes, self.eye, self.res, self.margin, self.measure = here, eyes, eye, res, margin, measure
        self.standing = np.zeros((0, 0, 4), np.uint8)
        self.standing_sheet = ''

    def px(self, sheet: str, seed: tuple[int, int] | None = None) -> float:
        """The eye's size in a sheet's own pixels."""
        return self.measure(self.here / sheet, seed or self.eyes[sheet])

    def on_eye(self, sheet: str) -> float:
        """File pixels to each of a sheet's pixels."""
        return self.eye / self.px(sheet) * self.res

    def per_unit(self) -> float:
        """The reference's pixels to each drawing unit."""
        return self.px(self.standing_sheet) / self.eye

    def units(self, size: Size) -> str:
        return f'{size[0] / self.res:.2f}x{size[1] / self.res:.2f}'

    def reference(self, sheet: str, out: Path, name: str, key: Callable[[Path], np.ndarray] = keyed) -> Size:
        """The whole animal standing square, its anatomy reference: written
        for the lab to lay over the rig, and kept to place the parts by."""
        self.standing = crop(key(self.here / sheet))
        self.standing_sheet = sheet
        size = export(self.standing, out, name, self.on_eye(sheet))
        print(f'{name}: {self.units(size)} at {self.margin}, {self.margin}; ground {ground(self.standing) / self.per_unit() + self.margin:.2f}')
        return size

    def key_poses(self, prefix: str, seeds: dict[str, tuple[int, int]], out: Path, key: Callable[[Path], np.ndarray] = keyed) -> None:
        """Key poses of the same animal, drawn from the reference, that the
        rig's poses are tuned toward; the lab lays each over its mode. seeds
        says where each one's eye is."""
        for pose, seed in seeds.items():
            name = f'{prefix}{pose}'
            path = self.here / f'{name}.png'
            eye = self.measure(path, seed)
            size = export(crop(key(path)), out, name, self.eye / eye * self.res)
            print(f'{name}: eye {eye:.1f}px; drawing units {self.units(size)}')

    def placed(self, name: str, art: np.ndarray, out: Path, scale: float, k: float, mask: Mask | None = opaque) -> Size:
        """Writes a part at scale and prints where it sat in the reference,
        its place in the rig, matched by what mask picks out with the part
        grown k times onto the reference's pixels. A part with no mask is
        placed by hand."""
        size = export(art, out, name, scale)
        if mask is None:
            print(f'{name}: {self.units(size)}')
            return size
        per_unit = self.per_unit()
        y, x = place(rescaled(art, k), self.standing, mask=mask)
        print(f'{name}: {self.units(size)} at {x / per_unit + self.margin:.2f}, {y / per_unit + self.margin:.2f}')
        return size

    def parts(self, arts: dict[str, np.ndarray], sheet: str, out: Path, mask: Mask = opaque, masks: dict[str, Mask | None] | None = None) -> dict[str, Size]:
        """The parts cut from the reference into sheet, each placed; masks
        sets a part's own mask in place of mask."""
        k = self.px(self.standing_sheet) / self.px(sheet)
        scale = self.on_eye(sheet)
        return {name: self.placed(name, art, out, scale, k, (masks or {}).get(name, mask)) for name, art in arts.items()}

    def foot(self, name: str, art: np.ndarray, out: Path, length: float, heel: tuple[float, float]) -> Size:
        """A foot length drawing units long, and its fur alone; prints where
        the leg comes down onto it, its heel (fractions of its box)."""
        w, h = export_with_fur(art, out, name, length * self.res / art.shape[1])
        print(f'{name}: {self.units((w, h))}, heel {w * heel[0] / self.res:.2f}, {h * heel[1] / self.res:.2f}')
        return w, h
