"""Measure the shipped identity and rasterize its fixed production guide.

No generated artwork, anatomy edits, resizing or acceptance occurs here. Feature
search regions were selected against the reference; output gives the mask rules
alongside measured pixels so semantic landmarks are reproducible and auditable.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
REFERENCE = ROOT.parents[2] / "internal/dashboard/ui/src/lib/theme/christmas/robin-perch.webp"
IDENTITY_HASH = "e9d871e3f720fe55bf70fc40991e8dcc82a67514889038785d67e53e9a79237a"
WIDTH, HEIGHT = 128, 112
# Half-open search regions, measured in the unchanged native cell. These bound
# feature searches, NOT permissible clipping or generation acceptance regions.
REGIONS = {
    "eye": [78, 24, 92, 40], "beak": [93, 25, 108, 39],
    "breast": [68, 43, 99, 78], "torso": [24, 38, 99, 86],
    "head": [53, 12, 99, 44], "left_foot": [43, 88, 64, 100],
    "right_foot": [64, 88, 84, 100],
}


def bounds(points):
    if not points:
        raise ValueError("Empty measurement region")
    xs, ys = zip(*points)
    return [min(xs), min(ys), max(xs) + 1, max(ys) + 1]


def centroid(points):
    if not points:
        raise ValueError("Empty landmark mask")
    return [round(sum(x + .5 for x, _ in points) / len(points), 4),
            round(sum(y + .5 for _, y in points) / len(points), 4)]


def largest_component(points):
    remaining = set(points)
    components = []
    while remaining:
        seed = min(remaining, key=lambda p: (p[1], p[0]))
        remaining.remove(seed)
        pending, component = [seed], [seed]
        while pending:
            x, y = pending.pop()
            for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]:
                neighbor = (x + dx, y + dy)
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    pending.append(neighbor)
                    component.append(neighbor)
        components.append(component)
    if not components:
        raise ValueError("No connected landmark pixels")
    return max(components, key=lambda c: (len(c), -min(y for _, y in c), -min(x for x, _ in c)))


def measure(pixels):
    if len(pixels) != WIDTH * HEIGHT * 4:
        raise ValueError("Expected native 128x112 RGBA bytes")
    samples = {(i % WIDTH, i // WIDTH): tuple(pixels[4 * i:4 * i + 4]) for i in range(WIDTH * HEIGHT)}
    support = [point for point, (_, _, _, a) in samples.items() if a > 0]
    alpha_bounds = bounds(support)
    masks = {}
    for name, (left, top, right, bottom) in REGIONS.items():
        points = []
        for (x, y), (r, g, b, a) in samples.items():
            if not (left <= x < right and top <= y < bottom):
                continue
            accepted = a >= 128
            if name == "eye":
                accepted &= r <= 60 and g <= 50 and b <= 40
            elif name == "beak":
                accepted = a >= 16 and r <= 130 and g <= 95 and b <= 80
            elif name == "breast":
                accepted &= r >= 170 and 45 <= g <= 180 and g < .8 * r and b <= 100
            elif name.endswith("foot"):
                accepted = a >= 32 and r <= 170 and g <= 120 and b <= 100
            if accepted:
                points.append((x, y))
        masks[name] = largest_component(points)
    landmarks = {name: {"centre": centroid(points), "bounds": bounds(points), "pixels": len(points)}
                 for name, points in masks.items()}
    beak = masks["beak"]
    edge_x = max(x for x, _ in beak)
    landmarks["beak"]["tip"] = centroid([(x, y) for x, y in beak if x == edge_x])
    for name in ("left_foot", "right_foot"):
        points = masks[name]
        left, top, right, bottom = bounds(points)
        landmarks[name]["toe_extrema"] = {
            "left": centroid([(x, y) for x, y in points if x == left]),
            "right": centroid([(x, y) for x, y in points if x == right - 1]),
            "lowest": centroid([(x, y) for x, y in points if y == bottom - 1]),
        }
    return {
        "cell": [WIDTH, HEIGHT], "virtual_foot_anchor": [64, 100], "ground_y": 100,
        "scale": .35, "alpha_bounds": alpha_bounds,
        "collision_envelope_display": {"x": [-24, 24], "y": [-37, 0]},
        "collision_envelope_native": {"x": [64 - 24 / .35, 64 + 24 / .35], "y": [100 - 37 / .35, 100]},
        "landmarks": landmarks, "search_regions": REGIONS,
        "measurement_rules": {
            "bounds": "half-open integer support bounds; centres are pixel centres",
            "alpha_bounds": "all nonzero alpha, including faint antialiasing",
            "torso_head": "largest 8-connected alpha>=128 component in named anatomical search region",
            "eye": "largest alpha>=128 component with RGB<=60,50,40 in eye region",
            "beak": "largest alpha>=16 component with RGB<=130,95,80 in beak region; tip is rightmost support centre",
            "breast": "alpha>=128; R>=170,45<=G<=180,G<0.8R,B<=100; largest component",
            "feet": "alpha>=32,RGB<=170,120,100; largest component in each foot region",
            "toe_extrema": "support extrema of foot-pad component, not an inferred number of anatomical toes",
        },
        "registration_note": "The virtual anchor is a layout contract, not the centroid or lowest painted toe. Preserve its reference-relative offset for every pose.",
        "calibration_status": "measured reference features; generated pose tolerance calibration remains pending",
    }


def rasterize(pixels, measurements):
    canvas = bytearray(WIDTH * HEIGHT * 4)
    # Reference composited on white for visibility. Overlay only guide marks;
    # never changes or writes the identity reference itself.
    for i in range(WIDTH * HEIGHT):
        alpha = pixels[4 * i + 3] / 255
        canvas[4 * i:4 * i + 4] = bytes([round(pixels[4 * i + c] * alpha + 255 * (1 - alpha)) for c in range(3)] + [255])

    def dot(x, y, colour):
        x, y = round(x), round(y)
        if 0 <= x < WIDTH and 0 <= y < HEIGHT:
            canvas[(y * WIDTH + x) * 4:(y * WIDTH + x) * 4 + 4] = bytes([*colour, 255])

    def line(x1, y1, x2, y2, colour):
        steps = math.ceil(max(abs(x2 - x1), abs(y2 - y1)))
        for i in range(steps + 1):
            t = i / max(1, steps)
            dot(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, colour)

    def box(rect, colour):
        left, top, right, bottom = rect
        for x1, y1, x2, y2 in [(left, top, right - 1, top), (left, bottom - 1, right - 1, bottom - 1),
                                (left, top, left, bottom - 1), (right - 1, top, right - 1, bottom - 1)]:
            line(x1, y1, x2, y2, colour)

    box([0, 0, WIDTH, HEIGHT], (160, 160, 160))
    box(measurements["alpha_bounds"], (80, 80, 80))
    for name, colour in [("torso", (0, 170, 200)), ("head", (170, 0, 210))]:
        box(measurements["landmarks"][name]["bounds"], colour)
    # The hard envelope extends outside the cell horizontally/upward; y100 is
    # its only visible edge. Keep the exact unclipped limits in the JSON.
    line(0, 100, 127, 100, (0, 150, 0))
    line(60, 100, 68, 100, (240, 0, 0))
    line(64, 96, 64, 104, (240, 0, 0))
    for name, colour in [("eye", (20, 80, 230)), ("breast", (230, 100, 0)),
                         ("left_foot", (20, 80, 230)), ("right_foot", (20, 80, 230))]:
        x, y = measurements["landmarks"][name]["centre"]
        dot(x, y, colour)
    dot(*measurements["landmarks"]["beak"]["tip"], (230, 0, 0))
    return bytes(canvas)


def read_published(output):
    """Resolve one completed pair, never the convenience browsing copies."""
    pointer = json.loads((output / "complete.json").read_bytes())
    result = {}
    for name in ("guide.png", "landmarks.json"):
        entry = pointer[name]
        if Path(entry["file"]).name != entry["file"]:
            raise ValueError("Invalid completion path")
        payload = (output / entry["file"]).read_bytes()
        if hashlib.sha256(payload).hexdigest() != entry["sha256"]:
            raise ValueError("Mismatched guide evidence")
        result[name] = payload
    if json.loads(result["landmarks.json"])["guide_sha256"] != hashlib.sha256(result["guide.png"]).hexdigest():
        raise ValueError("Mismatched guide pair")
    return result


def generate(output, checkpoint=lambda stage: None):
    output.mkdir(parents=True, exist_ok=True)
    lock = output / ".publish.lock"
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise ValueError("Guide publisher active; verify recorded PID before removing stale lock")
    try:
        with os.fdopen(descriptor, "w") as handle:
            handle.write(str(os.getpid()))
        return _generate(output, checkpoint)
    finally:
        lock.unlink()


def _generate(output, checkpoint):
    version = subprocess.check_output(["magick", "-version"], text=True).splitlines()[0]
    if not version.startswith("Version: ImageMagick 7.1.2-32 Q16-HDRI"):
        raise ValueError(f"Unsupported rasterizer: {version}")
    source = REFERENCE.read_bytes()
    reference_hash = hashlib.sha256(source).hexdigest()
    if reference_hash != IDENTITY_HASH:
        raise ValueError("Identity reference changed; review feature-search regions before repinning")
    # Decode the byte snapshot, not a mutable source path.
    dimensions = subprocess.check_output(["magick", "webp:-", "-format", "%w %h", "info:"], input=source)
    if dimensions.strip() != b"128 112":
        raise ValueError("Identity reference must retain native 128x112 cell")
    pixels = subprocess.check_output(["magick", "webp:-", "-depth", "8", "rgba:-"], input=source)
    measurements = measure(pixels)
    measurements["reference"] = {"file": str(REFERENCE.relative_to(ROOT.parents[2])), "sha256": reference_hash}
    measurements["finish_references"] = [
        {"file": f"design-docs/halloween/{name}.png",
         "sha256": hashlib.sha256((ROOT.parents[2] / f"design-docs/halloween/{name}.png").read_bytes()).hexdigest()}
        for name in ["pumpkins", "candles", "spider-body-side"]
    ]
    measurements["rasterizer"] = version
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".guide-", dir=output) as temporary:
        staged = Path(temporary)
        guide = staged / "guide.png"
        subprocess.run(["magick", "-size", "128x112", "-depth", "8", "rgba:-", "-strip", "-define", "png:color-type=6", str(guide)],
                       input=rasterize(pixels, measurements), check=True)
        measurements["guide_sha256"] = hashlib.sha256(guide.read_bytes()).hexdigest()
        metadata = staged / "landmarks.json"
        metadata.write_text(json.dumps(measurements, indent=2, sort_keys=True, allow_nan=False) + "\n")
        completion = {}
        for name, path in [("guide.png", guide), ("landmarks.json", metadata)]:
            payload = path.read_bytes()
            digest = hashlib.sha256(payload).hexdigest()
            filename = f"{digest}-{name}"
            target = output / filename
            if target.exists() and target.read_bytes() != payload:
                raise ValueError("Immutable guide evidence changed")
            if not target.exists():
                path.replace(target)
            completion[name] = {"file": filename, "sha256": digest}
            checkpoint(name)
        pointer = staged / "complete.json"
        pointer.write_text(json.dumps(completion, sort_keys=True, indent=2) + "\n")
        checkpoint("before-completion")
        pointer.replace(output / "complete.json")
        published = read_published(output)
        # These paths are for browsing only. Completion is authoritative.
        for name, payload in published.items():
            copy = staged / name
            copy.write_bytes(payload)
            copy.replace(output / name)
    return measurements


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "reference-guide")
    args = parser.parse_args()
    generate(args.output)
