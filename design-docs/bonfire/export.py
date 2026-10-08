# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Keys, crops and exports the Bonfire Night art. Run: uv run design-docs/bonfire/export.py

Same recipe as design-docs/halloween: alpha from min(R,B) - G ramping between
60 and 140, a half-strength despill, crop to the art, then WebP. Everything is
exported at twice its display size for high-density screens; the display sizes
below are what the components lay out.
"""
from pathlib import Path
import subprocess
import tempfile

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/bonfire'
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


def halves(rgba: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Split a two-pose sheet at the middle of its widest run of empty columns."""
    empty = (rgba[..., 3] <= 8).all(axis=0)
    runs, start = [], None
    for x, e in enumerate(empty):
        if e and start is None:
            start = x
        if not e and start is not None:
            runs.append((start, x))
            start = None
    inner = [r for r in runs if r[0] > 0 and r[1] < len(empty)]
    a, b = max(inner, key=lambda r: r[1] - r[0])
    cut = (a + b) // 2
    return rgba[:, :cut], rgba[:, cut:]


def export(rgba: np.ndarray, name: str, scale: float) -> tuple[int, int]:
    img = Image.fromarray(rgba, 'RGBA')
    size = (round(img.width * scale), round(img.height * scale))
    img = img.resize(size, Image.LANCZOS)
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / f'{name}.png'
        img.save(png)
        subprocess.run(['cwebp', '-quiet', '-q', '90', '-alpha_q', '100', '-exact', str(png), '-o', str(OUT / f'{name}.webp')], check=True)
    return size


def main() -> None:
    sizes = {}
    # Display heights in page pixels; exported at twice that.
    for name, height in [('bonfire', 92), ('toffee-apples', 34)]:
        art = crop(keyed(HERE / f'{name}.png'))
        sizes[name] = export(art, name, 2 * height / art.shape[0])
    pile = crop(keyed(HERE / 'woodpile.png'))
    sizes['woodpile'] = export(pile, 'woodpile', 2 * 20 / pile.shape[0])
    walk, ball = (crop(h) for h in halves(keyed(HERE / 'hedgehog-sheet.png')))
    # Both poses share the walking hedgehog's scale, so the ball is its size.
    scale = 2 * 26 / walk.shape[1]
    sizes['hedgehog-walk'] = export(walk, 'hedgehog-walk', scale)
    sizes['hedgehog-ball'] = export(ball, 'hedgehog-ball', scale)
    for name, (w, h) in sizes.items():
        print(f'{name}: {w}x{h} (display {w / 2:g}x{h / 2:g})')


if __name__ == '__main__':
    main()
