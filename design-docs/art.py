"""Shared steps for exporting seasonal theme art (see halloween/README.md).

Each theme's export.py imports this: key the flat magenta background out with
alpha from min(R,B) - G ramping between 60 and 140 and a half-strength
despill, crop to the art plus a margin, split pose sheets at their empty
column (or row) runs, measure a feature (an eye) to put sheets drawn at
different sizes on one scale, and write WebP.
"""
from collections import deque
from pathlib import Path
import subprocess
import tempfile

import numpy as np
from PIL import Image

MARGIN = 6


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
    rgb = rgba[..., :3].astype(np.float32)
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    keep = np.clip((lum - 70) / 60, 0, 1)
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


def export(rgba: np.ndarray, out: Path, name: str, scale: float) -> tuple[int, int]:
    img = Image.fromarray(rgba, 'RGBA')
    size = (round(img.width * scale), round(img.height * scale))
    img = img.resize(size, Image.LANCZOS)
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / f'{name}.png'
        img.save(png)
        subprocess.run(['cwebp', '-quiet', '-q', '90', '-alpha_q', '100', '-exact', str(png), '-o', str(out / f'{name}.webp')], check=True)
    return size
