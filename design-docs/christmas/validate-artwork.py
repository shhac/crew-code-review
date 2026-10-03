"""Decode actual candidate WebPs and reject alpha outside the accepted geometry.

Includes half a native texel of bilinear filter support beyond each texel edge.
Wing bounds use analytic extrema across the entire rotation interval, not samples.
No threshold removes faint alpha. Exit 1 means candidates cannot be shipped.
"""
from pathlib import Path
import json
import math
import subprocess

ROOT = Path(__file__).resolve().parent
NAMES = ("robin-perch", "robin-alert", "robin-flight", "robin-flight-wing", "holly")


def decode(path):
    w, h = map(int, subprocess.check_output(
        ["magick", str(path), "-format", "%w %h", "info:"]).split())
    alpha = subprocess.check_output([
        "magick", str(path), "-alpha", "extract", "-depth", "8", "gray:-"])
    if len(alpha) != w * h:
        raise ValueError("unexpected decoded alpha length")
    return w, h, alpha


def extrema(a, b, low, high):
    angles = [low, high]
    stationary = math.atan2(b, a)
    for k in range(-2, 3):
        angle = stationary + k * math.pi
        if low <= angle <= high:
            angles.append(angle)
    values = [a * math.cos(t) + b * math.sin(t) for t in angles]
    return min(values), max(values)


def support(x, y, wing=False):
    points = [(xx, yy) for xx in (x - .5, x + 1.5) for yy in (y - .5, y + 1.5)]
    if not wing:
        return x - .5, x + 1.5, y - .5, y + 1.5
    low, high = -math.radians(5), math.radians(5)
    xs, ys = [], []
    for xx, yy in points:
        dx, dy = xx - 64, yy - 57
        xs.extend(v + 64 for v in extrema(dx, -dy, low, high))
        ys.extend(v + 57 for v in extrema(dy, dx, low, high))
    return min(xs), max(xs), min(ys), max(ys)


def validate(name, w, h, alpha):
    expected = (96, 64) if name == "holly" else (128, 112)
    if (w, h) != expected:
        raise ValueError(f"wrong dimensions: {(w, h)}, expected {expected}")
    if not any(alpha) or not any(0 < a < 255 for a in alpha):
        raise ValueError("empty artwork or missing partial alpha")
    if any(alpha[x] or alpha[(h - 1) * w + x] for x in range(w)) or any(
            alpha[y * w] or alpha[y * w + w - 1] for y in range(h)):
        raise ValueError("missing transparent margins")
    violations = []
    for i, a in enumerate(alpha):
        if not a:
            continue
        x, y = i % w, i // w
        left, right, top, bottom = support(x, y, name == "robin-flight-wing")
        if name == "holly":
            outside = left < 0 or right > 96 or top < 0 or bottom > 55
        else:
            # Mirror the whole assembly around the common foot anchor.
            outside = top * .35 - 35 < -37 or bottom * .35 - 35 > 0
            for direction in (-1, 1):
                xs = [(v - 64) * .35 * direction for v in (left, right)]
                outside |= min(xs) < -24 or max(xs) > 24
        if outside:
            violations.append({"pixel": [x, y], "alpha": a,
                               "support": [left, right, top, bottom]})
    return violations


def report():
    result = {}
    for name in NAMES:
        try:
            w, h, alpha = decode(ROOT / "aligned" / f"{name}.webp")
            violations = validate(name, w, h, alpha)
            result[name] = {"dimensions": [w, h], "violating_pixels": len(violations),
                            "examples": violations[:8], "accepted": not violations}
        except (ValueError, subprocess.CalledProcessError) as error:
            result[name] = {"accepted": False, "error": str(error)}
    return result


if __name__ == "__main__":
    results = report()
    print(json.dumps(results, indent=2))
    raise SystemExit(0 if all(r["accepted"] for r in results.values()) else 1)
