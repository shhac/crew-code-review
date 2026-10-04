"""Publish the owner-approved idle/blink scope from reference pixels.

No generated redraw is accepted here. All six cells are recomputed from the
pinned reference, checked, and exported losslessly. Immutable assets precede
manifest publication. Tilt and new articulation belong to the follow-up.
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
import rig

ROOT = Path(__file__).resolve().parent
IDS = ["I0", "I1", "I2", "I3", "B1", "B2"]
RUNTIME = ROOT.parents[2] / "internal/dashboard/ui/src/lib/theme/christmas/robin-frames"
SCALES = {"I0": [1, 1], "I1": [1.004, 1.006], "I2": [1.010, 1.012], "I3": [1.005, 1.007], "B1": [1, 1], "B2": [1, 1]}


def measurements(reference, pixels, masks, identifier):
    result = rig.report(reference, pixels, identifier)
    if result["numerical_status"] != "pass":
        raise ValueError(f"Failed rig invariants: {identifier}")
    violations = pack.artwork.validate("robin-perch", 128, 112, pixels[3::4])
    if violations:
        raise ValueError(f"Filtered collision envelope failed: {identifier}")
    layers = rig.segmentation(masks)
    for i, layer in enumerate(layers):
        before, after = reference[i * 4:i * 4 + 4], pixels[i * 4:i * 4 + 4]
        if identifier.startswith("I") and layer in ("head", "wing", "tail", "feet") and before[3] and before != after:
            raise ValueError(f"Fixed identity changed: {identifier}/{layer}")
        if identifier.startswith("B") and before != after:
            if not (82 <= i % 128 < 88 and 29 <= i // 128 < 36) or before[3] != after[3]:
                raise ValueError(f"Blink left eye support or changed alpha: {identifier}")
    palettes = {layer: set() for layer in set(layers)}
    for i, layer in enumerate(layers):
        if reference[i * 4 + 3]:
            palettes[layer].add(tuple(reference[i * 4:i * 4 + 3]))
    distances = []
    for i, layer in enumerate(layers):
        if not pixels[i * 4 + 3]:
            continue
        rgb = tuple(pixels[i * 4:i * 4 + 3])
        if rgb == tuple(reference[i * 4:i * 4 + 3]):
            distances.append(0.)
            continue
        distances.append(math.sqrt(min(sum((a - b) ** 2 for a, b in zip(rgb, colour)) for colour in palettes[layer])))
    distances.sort()
    palette = {"median": distances[len(distances) // 2], "p95": distances[math.ceil(.95 * len(distances)) - 1], "max": distances[-1]}
    if palette["median"] > 1 or palette["p95"] > 3 or palette["max"] > 24:
        raise ValueError(f"Reference-rig palette drift: {identifier}")
    original_body = [(i % 128, i // 128) for i, layer in enumerate(layers) if layer == "torso" and reference[i * 4 + 3] >= 128]
    body = [(i % 128, i // 128) for i, layer in enumerate(layers) if layer == "torso" and pixels[i * 4 + 3] >= 128]
    original_bounds, body_bounds = guide.bounds(original_body), guide.bounds(body)
    dimension_drift = [(body_bounds[j + 2] - body_bounds[j]) / (original_bounds[j + 2] - original_bounds[j]) - 1 for j in (0, 1)]
    centre_offset = [a - b for a, b in zip(guide.centroid(body), guide.centroid(original_body))]
    if any(abs(value) > .03 for value in dimension_drift) or math.hypot(*centre_offset) > 1.5:
        raise ValueError(f"Reference-rig body drift: {identifier}")
    result.update({
        "identity_status": "reference-preserved", "source": "owner-authorized reference rig, not new image generation",
        "owner_visual_review": "pending", "status": "pass", "filtered_envelope": "pass-both-facings",
        "body_scale": SCALES[identifier], "body_scale_drift_percent": [(s - 1) * 100 for s in SCALES[identifier]],
        "torso_mask_bounds": body_bounds, "reference_torso_mask_bounds": original_bounds,
        "torso_dimensions_drift_percent": [value * 100 for value in dimension_drift], "torso_centre_offset": centre_offset,
        "palette_distance_rgb": {"metric": "nearest source material colour, Euclidean sRGB diagnostic (not CIEDE2000)",
                                 **palette},
        "engineering_gates": {"anchor_pixels": 0, "torso_dimensions_percent": 3, "torso_centre_pixels": 1.5,
                              "palette_euclidean_rgb": {"median": 1, "p95": 3, "max": 24}},
        "palette_status": "source pixels and premultiplied interpolation; no chroma key or palette remapping required",
        "reason": "Fixed anatomy, bounded eye overlay, source-derived body scale, exact feet and collision envelope validated",
    })
    return result


def publish(path, payload):
    digest = pack.digest(payload)
    target = path.parent / f"{digest}-{path.name}"
    # A failed write must leave only disposable private staging, never a
    # truncated content-addressed final file that poisons every restart.
    with tempfile.TemporaryDirectory(prefix=".publish-", dir=path.parent) as temporary:
        pack.publish_immutable(Path(temporary), path.parent, target.name, payload)
    return target.name


def generate(runtime=RUNTIME, evidence=ROOT / "accepted", checkpoint=lambda stage: None):
    pack.versions()
    runtime.mkdir(parents=True, exist_ok=True)
    evidence.mkdir(parents=True, exist_ok=True)
    lock = runtime / ".publish.lock"
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise ValueError("Idle publisher active; verify recorded PID before removing stale lock")
    try:
        with os.fdopen(descriptor, "w") as handle:
            handle.write(str(os.getpid()))
        return _generate(runtime, evidence, checkpoint)
    finally:
        lock.unlink()


def _generate(runtime, evidence, checkpoint):
    source = pack.read_regular(guide.REFERENCE)
    if pack.digest(source) != guide.IDENTITY_HASH:
        raise ValueError("Shipped reference changed")
    spec_bytes = pack.read_regular(ROOT / "rig-masks.json")
    masks = json.loads(spec_bytes)
    pair = guide.read_published(ROOT / "reference-guide")
    reference = subprocess.check_output(["magick", "webp:-", "-depth", "8", "rgba:-"], input=source)
    frames = {identifier: rig.bake(reference, masks, identifier) for identifier in IDS}
    reports = {identifier: measurements(reference, frames[identifier], masks, identifier) for identifier in IDS}
    if frames["I0"] != reference:
        raise ValueError("I0 must reconstruct the independent reference")
    with tempfile.TemporaryDirectory(prefix=".idle-", dir=runtime) as temporary:
        staged = Path(temporary)
        records = {"version": 1, "scope": "idle-blink", "reference_sha256": pack.digest(source),
                   "guide_sha256": pack.digest(pair["guide.png"]), "masks_sha256": pack.digest(spec_bytes),
                   "rig_script_sha256": pack.digest((ROOT / "rig.py").read_bytes()),
                   "publisher_sha256": pack.digest(Path(__file__).read_bytes()),
                   "tools": {"magick": "7.1.2-32 Q16-HDRI", "cwebp": "1.6.0", "export": "-lossless -q 100 -m 6 -exact -metadata none"},
                   "frames": {}, "previews": {}}
        atlas = bytearray(780 * 114 * 4)
        for index, identifier in enumerate(IDS):
            pixels = frames[identifier]
            path = staged / f"{identifier}.png"
            rig.png(pixels, path)
            webp = staged / f"{identifier}.webp"
            subprocess.run(["cwebp", "-quiet", "-lossless", "-q", "100", "-m", "6", "-exact", "-metadata", "none", str(path), "-o", str(webp)], check=True)
            if pack.rgba(webp) != pixels:
                raise ValueError(f"Lossless decode failed: {identifier}")
            report = reports[identifier]
            report["frame_sha256"] = pack.digest(webp.read_bytes())
            filename = publish(evidence / f"{identifier}.webp", webp.read_bytes())
            report_name = publish(evidence / f"{identifier}.json", pack.encode_json(report))
            records["frames"][identifier] = {"file": filename, "sha256": report["frame_sha256"], "report": report_name, "report_sha256": pack.digest(pack.encode_json(report))}
            for y in range(112):
                start = ((y + 1) * 780 + index * 130 + 1) * 4
                atlas[start:start + 512] = pixels[y * 512:(y + 1) * 512]
            checkpoint(identifier)
        sheet = staged / "idle-sheet.png"
        rig.png(bytes(atlas), sheet, 780, 114)
        sheet_webp = staged / "idle-sheet.webp"
        subprocess.run(["cwebp", "-quiet", "-lossless", "-q", "100", "-m", "6", "-exact", "-metadata", "none", str(sheet), "-o", str(sheet_webp)], check=True)
        if pack.rgba(sheet_webp) != bytes(atlas):
            raise ValueError("Lossless atlas mismatch")
        sheet_name = publish(runtime / "idle-sheet.webp", sheet_webp.read_bytes())
        clips = {name: rig.CLIPS[name] for name in ("breathing", "blink")}
        # Preview inputs are complete accepted cells; terminal/rest metadata also
        # labels every contact-sheet column without relying on font installation.
        for name, clip in clips.items():
            contact = staged / f"{name}-contact.png"
            width = len(clip["frames"]) * 136
            pixels = bytearray(width * 128 * 4)
            glyphs = {"I": [7, 2, 2, 2, 7], "B": [6, 5, 6, 5, 6], "0": [7, 5, 5, 5, 7], "1": [2, 6, 2, 2, 7], "2": [7, 1, 7, 4, 7], "3": [7, 1, 7, 1, 7]}
            for i, identifier in enumerate(clip["frames"]):
                for y in range(112):
                    start = ((y + 12) * width + i * 136 + 4) * 4
                    pixels[start:start + 512] = frames[identifier][y * 512:(y + 1) * 512]
                for c, letter in enumerate(identifier):
                    for y, bits in enumerate(glyphs[letter]):
                        for x in range(3):
                            if bits & (1 << (2 - x)):
                                start = ((y + 3) * width + i * 136 + 4 + c * 4 + x) * 4
                                pixels[start:start + 4] = bytes([240, 240, 240, 255])
            rig.png(bytes(pixels), contact, width, 128)
            gif = staged / f"{name}.gif"
            rig.preview_gif([staged / f"{identifier}.png" for identifier in clip["frames"]], clip, gif)
            records["previews"][name] = {"contact": publish(evidence / contact.name, contact.read_bytes()), "gif": publish(evidence / gif.name, gif.read_bytes()), "clip": clip}
        manifest = {"version": 1, "profile": "idle-blink", "anchor": [64, 100], "scale": .35,
                    "fallback": {"file": "robin-perch.webp", "width": 128, "height": 112, "sha256": pack.digest(source)},
                    "sheets": {sheet_name: {"width": 780, "height": 114, "sha256": pack.digest(sheet_webp.read_bytes())}},
                    "frames": {identifier: {"sheet": sheet_name, "x": i * 130 + 1, "y": 1, "width": 128, "height": 112} for i, identifier in enumerate(IDS)},
                    "clips": clips}
        # Hash-link evidence before swapping the runtime manifest. No decoder or
        # exporter is called after this point; interruption keeps the old runtime.
        records["manifest_sha256"] = pack.digest(pack.encode_json(manifest))
        evidence_name = publish(evidence / "inventory.json", pack.encode_json(records))
        checkpoint("before-manifest")
        pack.synced_write(staged / "manifest.json", pack.encode_json(manifest))
        (staged / "manifest.json").replace(runtime / "manifest.json")
        pack.synced_write(staged / "complete.json", pack.encode_json({"file": evidence_name, "sha256": pack.digest(pack.encode_json(records))}))
        (staged / "complete.json").replace(evidence / "complete.json")
        return manifest, records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime", type=Path, default=RUNTIME)
    parser.add_argument("--evidence", type=Path, default=ROOT / "accepted")
    args = parser.parse_args()
    generate(args.runtime, args.evidence)
