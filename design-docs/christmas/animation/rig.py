"""Bake owner-authorized reference cut-outs, never accept generated anatomy.

Outputs are a draft evidence unit, NOT pack.py acceptance records. Numerical
checks and pending visual review are separate. No original reference is edited.
"""
import argparse
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile

import guide
import pack

ROOT = Path(__file__).resolve().parent
IDS = ["I0", "I1", "I2", "I3", "B1", "B2", "T1", "T2"]
CLIPS = {
    "breathing": {"frames": ["I0", "I1", "I2", "I3", "I2", "I1"], "durations": [200] * 6, "loop": True},
    "blink": {"frames": ["I0", "B1", "B2", "B1", "I0"], "durations": [60, 40, 70, 40, 90], "loop": False},
    "tilt": {"frames": ["I0", "T1", "T2", "T1", "I0"], "durations": [100, 120, 180, 120, 100], "loop": False},
}
for clip in CLIPS.values():
    clip["terminalFrame"] = clip["frames"][-1]
    clip["restFrame"] = "I0"


def preview_gif(paths, clip, destination):
    # Clear the preceding silhouette before every discrete frame, including wrap.
    arguments = ["magick", "-background", "none", "-dispose", "Background"]
    for path, duration in zip(paths, clip["durations"]):
        arguments += ["-delay", str(duration // 10), str(path)]
    subprocess.run(arguments + ["-loop", "0" if clip["loop"] else "1", str(destination)], check=True)


def inside(x, y, polygon):
    result = False
    for (ax, ay), (bx, by) in zip(polygon, polygon[1:] + polygon[:1]):
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            result = not result
    return result


def segmentation(spec):
    """Disjoint ownership, including transparent pixels. No eroded toe mask."""
    result = []
    (ax, ay), (bx, by) = spec["head_seam"]
    for y in range(112):
        for x in range(128):
            seam = ay + (by - ay) * (x + .5 - ax) / (bx - ax)
            if y >= spec["feet_start_y"]:
                layer = "feet"
            elif x < spec["tail_end_x"]:
                layer = "tail"
            elif y + .5 < seam:
                layer = "head"
            elif inside(x + .5, y + .5, spec["wing"]):
                layer = "wing"
            else:
                layer = "torso"
            result.append(layer)
    return result


def sample(pixels, layers, layer, x, y):
    """Bilinear filtering in premultiplied RGBA; straight output at export."""
    left, top = math.floor(x), math.floor(y)
    accum = [0.] * 4
    for dx, dy in [(0, 0), (1, 0), (0, 1), (1, 1)]:
        sx, sy = left + dx, top + dy
        if not (0 <= sx < 128 and 0 <= sy < 112):
            continue
        i = sy * 128 + sx
        if layers[i] != layer:
            continue
        weight = (1 - abs(x - sx)) * (1 - abs(y - sy))
        r, g, b, a = pixels[i * 4:i * 4 + 4]
        for c, value in enumerate((r * a / 255, g * a / 255, b * a / 255, a)):
            accum[c] += value * weight
    return accum


def bake(pixels, spec, identifier):
    if len(pixels) != 128 * 112 * 4 or identifier not in IDS:
        raise ValueError("Invalid rig cell or frame")
    if identifier == "I0":
        return pixels  # Includes invisible RGB and every fractional alpha value.
    if identifier in ("B1", "B2"):
        result = bytearray(pixels)
        # Overlay only the measured eye support, preserving orbital contour.
        # Adjacent russet is sampled per row, never a new generated colour.
        for y in range(29, 36):
            for x in range(82, 88):
                i = (y * 128 + x) * 4
                if identifier == "B1" and y >= 32:
                    continue
                source = (y * 128 + 80) * 4
                result[i:i + 3] = pixels[source:source + 3]
                if identifier == "B2" and y == 33 and 83 <= x <= 86:
                    source = (34 * 128 + 84) * 4
                    result[i:i + 3] = pixels[source:source + 3]
        return bytes(result)
    layer = "head" if identifier.startswith("T") else "torso"
    pivot = spec["head_pivot"] if layer == "head" else spec["torso_pivot"]
    scales = {"I1": (1.004, 1.006), "I2": (1.010, 1.012), "I3": (1.005, 1.007)}
    sx, sy = scales.get(identifier, (1, 1))
    angle = math.radians({"T1": -3, "T2": -6}.get(identifier, 0))
    layers = segmentation(spec)
    result = bytearray(pixels)
    for y in range(112):
        for x in range(128):
            i = y * 128 + x
            # Fixed cut-outs composite over the moved layer. Their reference
            # bytes remain untouched; holes are reported, never underpainted.
            if y >= spec["feet_start_y"] or layers[i] != layer and pixels[i * 4 + 3]:
                continue
            px, py = x + .5 - pivot[0], y + .5 - pivot[1]
            tx = (math.cos(angle) * px + math.sin(angle) * py) / sx + pivot[0] - .5
            ty = (-math.sin(angle) * px + math.cos(angle) * py) / sy + pivot[1] - .5
            r, g, b, a = sample(pixels, layers, layer, tx, ty)
            # The reference torso supplies its own interior overlap at the
            # fixed wing seam. Preserve only opaque interior pixels, never
            # extend the outline or synthesize missing head/neck underpaint.
            if layer == "torso" and pixels[i * 4 + 3] >= 250 and a < 128:
                result[i * 4:i * 4 + 4] = pixels[i * 4:i * 4 + 4]
                continue
            result[i * 4:i * 4 + 4] = bytes([round(c * 255 / a) if a else 0 for c in (r, g, b)] + [round(a)])
    return bytes(result)


def report(reference, pixels, identifier):
    original = guide.measure(reference)
    support = [(i % 128, i // 128) for i in range(128 * 112) if pixels[i * 4 + 3]]
    holes = sum(reference[i + 3] >= 250 and pixels[i + 3] < 128 for i in range(0, len(pixels), 4))
    fixed_feet = pixels[84 * 128 * 4:] == reference[84 * 128 * 4:]
    return {
        "frame": identifier, "identity_status": "visual-pending",
        "gate_scope": "reference-rig invariants only, not generated-frame cleanup acceptance",
        "numerical_status": "pass" if fixed_feet and not holes else "reject",
        "uncovered_opaque_pixels": holes, "fixed_feet_exact": fixed_feet,
        "anchor_offset": [0, 0], "virtual_foot_anchor": [64, 100],
        "alpha_bounds": guide.bounds(support), "reference_alpha_bounds": original["alpha_bounds"],
        "bounds_drift": [a - b for a, b in zip(guide.bounds(support), original["alpha_bounds"])],
        "palette_status": "reference pixels with premultiplied interpolation; CIEDE2000 calibration pending",
        "reason": "Neck/torso seam needs review; no invented underpaint" if holes else "Mask tracing and identity review pending",
    }


def png(pixels, path, width=128, height=112):
    subprocess.run(["magick", "-size", f"{width}x{height}", "-depth", "8", "rgba:-", "-strip", "-define", "png:color-type=6", str(path)], input=pixels, check=True)


def generate(output, checkpoint=lambda stage: None):
    pack.versions()
    source = guide.REFERENCE.read_bytes()
    if pack.digest(source) != guide.IDENTITY_HASH:
        raise ValueError("Rig identity changed")
    guide_pair = guide.read_published(ROOT / "reference-guide")
    spec_bytes = (ROOT / "rig-masks.json").read_bytes()
    spec = json.loads(spec_bytes)
    pixels = subprocess.check_output(["magick", "webp:-", "-depth", "8", "rgba:-"], input=source)
    output.mkdir(parents=True, exist_ok=True)
    lock = output / ".publish.lock"
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise ValueError("Rig publisher active; verify recorded PID before removing stale lock")
    try:
        with os.fdopen(descriptor, "w") as handle:
            handle.write(str(os.getpid()))
        with tempfile.TemporaryDirectory(prefix=".rig-", dir=output) as temporary:
            staged = Path(temporary)
            completion = {"version": 1, "status": "draft-not-accepted", "reference_sha256": pack.digest(source),
                          "mask_sha256": pack.digest(spec_bytes), "guide_sha256": pack.digest(guide_pair["guide.png"]),
                          "script_sha256": pack.digest(Path(__file__).read_bytes()),
                          "tools": {"magick": "7.1.2-32 Q16-HDRI", "cwebp": "1.6.0", "export": "-lossless -q 100 -m 6 -exact -metadata none"},
                          "frames": {}, "clips": CLIPS, "files": {}}
            frames = {}
            for identifier in IDS:
                frames[identifier] = bake(pixels, spec, identifier)
                evidence = report(pixels, frames[identifier], identifier)
                completion["frames"][identifier] = evidence
                if evidence["numerical_status"] != "pass":
                    evidence["raw_rgba_sha256"] = pack.digest(frames[identifier])
                    continue  # No rejected bitmap leaves isolated staging.
                path = staged / f"{identifier}.png"
                png(frames[identifier], path)
                target = staged / f"{identifier}.webp"
                subprocess.run(["cwebp", "-quiet", "-lossless", "-q", "100", "-m", "6", "-exact", "-metadata", "none", str(path), "-o", str(target)], check=True)
                if pack.rgba(target) != frames[identifier]:
                    raise ValueError(f"Lossless rig mismatch: {identifier}")
                evidence["frame_sha256"] = pack.digest(target.read_bytes())
            # Publish the segmentation itself and an RGB seam overlay for review.
            colors = {"head": (190, 80, 190), "torso": (0, 180, 180), "wing": (240, 170, 40), "feet": (40, 190, 60), "tail": (90, 120, 220)}
            mask = bytes(c for i, layer in enumerate(segmentation(spec)) for c in (*colors[layer], pixels[i * 4 + 3]))
            png(mask, staged / "masks.png")
            atlas = bytearray(1040 * 114 * 4)
            for index, identifier in enumerate(IDS):
                if completion["frames"][identifier]["numerical_status"] != "pass":
                    continue
                for y in range(112):
                    start = ((y + 1) * 1040 + index * 130 + 1) * 4
                    atlas[start:start + 128 * 4] = frames[identifier][y * 128 * 4:(y + 1) * 128 * 4]
                completion["frames"][identifier]["rectangle"] = [index * 130 + 1, 1, 128, 112]
            png(bytes(atlas), staged / "sheet.png", 1040, 114)
            subprocess.run(["cwebp", "-quiet", "-lossless", "-q", "100", "-m", "6", "-exact", "-metadata", "none", str(staged / "sheet.png"), "-o", str(staged / "sheet.webp")], check=True)
            for name, clip in CLIPS.items():
                if any(completion["frames"][identifier]["numerical_status"] != "pass" for identifier in clip["frames"]):
                    continue
                paths = [str(staged / f"{identifier}.png") for identifier in clip["frames"]]
                contact_width = 136 * len(paths)
                contact = bytearray(contact_width * 120 * 4)
                for index, identifier in enumerate(clip["frames"]):
                    for y in range(112):
                        start = ((y + 4) * contact_width + index * 136 + 4) * 4
                        contact[start:start + 512] = frames[identifier][y * 512:(y + 1) * 512]
                png(bytes(contact), staged / f"{name}-contact.png", contact_width, 120)
                preview_gif(paths, clip, staged / f"{name}.gif")
            for path in sorted(staged.iterdir()):
                if path.name == "sheet.png" or path.stem in IDS and path.suffix == ".png":
                    continue
                data = path.read_bytes()
                filename = f"{pack.digest(data)}-{path.name}"
                target = output / filename
                if target.exists() and target.read_bytes() != data:
                    raise ValueError("Immutable rig evidence changed")
                if not target.exists():
                    path.replace(target)
                completion["files"][path.name] = {"file": filename, "sha256": pack.digest(data)}
                checkpoint(path.name)
            pointer = staged / "complete.json"
            pointer.write_bytes(pack.encode_json(completion))
            checkpoint("before-completion")
            pointer.replace(output / "complete.json")
            return completion
    finally:
        lock.unlink()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "rig-draft")
    generate(parser.parse_args().output)
