"""Reproduce alignment and export. --ship promotes only after all five pass.

Requires ImageMagick 7.1.2-32 and cwebp 1.6.0. Run from any directory.
Candidates must pass validate-artwork.py before promotion to runtime assets.
"""
from pathlib import Path
import subprocess
import importlib.util
import shutil
import sys

ROOT = Path(__file__).resolve().parent
# Explicit registration, not autocropping. ImageMagick's EWA distortion filters
# color weighted by alpha (premultiplied filtering), then returns straight RGBA.
LAYERS = {
    "robin-perch": (.09, -7.37, 1.59, 128, 112),
    "robin-alert": (.09, -7.37, 1.59, 128, 112),
    "robin-flight": (.09, -7.37, 1.59, 128, 112),
    "robin-flight-wing": (.085, 3, -4, 128, 112),
    "holly": (.0625, 0, -.5, 96, 64),
}


def export(ship=False):
    spec = importlib.util.spec_from_file_location("artwork", ROOT / "validate-artwork.py")
    artwork = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(artwork)
    version = subprocess.check_output(["cwebp", "-version"], text=True)
    if version.splitlines()[0] != "1.6.0":
        raise RuntimeError(f"Expected cwebp 1.6.0, got {version}")
    magick_version = subprocess.check_output(["magick", "-version"], text=True)
    if not magick_version.startswith("Version: ImageMagick 7.1.2-32 Q16-HDRI"):
        raise RuntimeError(f"Unexpected ImageMagick: {magick_version}")
    staged = []
    for name, (scale, x, y, cw, ch) in LAYERS.items():
        png = ROOT / "aligned" / f"{name}.temporary.png"
        # First render on a roomy canvas. Reject any nonzero alpha that would
        # be discarded when padding to the logical cell; never clip to fit.
        command = [
            "magick", str(ROOT / "originals" / f"{name}.png"),
            "-colorspace", "sRGB", "-virtual-pixel", "transparent", "-filter", "Triangle",
            "-define", "distort:viewport=384x336+0+0", "+distort", "AffineProjection",
            f"{scale},0,0,{scale},{128+x},{112+y}", "-depth", "8",
        ]
        alpha = subprocess.check_output(command + ["-alpha", "extract", "gray:-"])
        if any(a and not (128 <= i % 384 < 128 + cw and 112 <= i // 384 < 112 + ch)
               for i, a in enumerate(alpha)):
            raise ValueError(f"{name}: padding would clip artwork")
        subprocess.run(command + ["-crop", f"{cw}x{ch}+128+112", "+repage",
                                   "-strip", "-define", "png:color-type=6", str(png)], check=True)
        temporary = ROOT / "aligned" / f"{name}.temporary.webp"
        subprocess.run(["cwebp", "-lossless", "-q", "100", "-m", "6", "-exact",
                        "-metadata", "none", str(png), "-o", str(temporary)], check=True)
        decoded = artwork.decode(temporary)
        if artwork.validate(name, *decoded):
            raise ValueError(f"{name}: exported alpha exceeds the envelope")
        staged.append((name, png, temporary))
    for name, png, webp in staged:
        png.replace(ROOT / "aligned" / f"{name}.png")
        webp.replace(ROOT / "aligned" / f"{name}.webp")
    if ship:
        runtime = ROOT.parents[1] / "internal/dashboard/ui/src/lib/theme/christmas"
        for name, _, _ in staged:
            temporary = runtime / f"{name}.temporary.webp"
            shutil.copyfile(ROOT / "aligned" / f"{name}.webp", temporary)
            temporary.replace(runtime / f"{name}.webp")


if __name__ == "__main__":
    export(ship="--ship" in sys.argv)
