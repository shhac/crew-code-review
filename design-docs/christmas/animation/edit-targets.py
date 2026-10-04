"""Registered F1/F2 local-edit targets, not artwork or accepted frames.

Silhouette landmarks come from Juniper's design-10 exact prompts. Reference
wing patches inside the target silhouette are merely an edit scaffold. Codex
image generation must supply the articulation; extraction cannot use this scaffold.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile

import guide
import pack
import rig

ROOT = Path(__file__).resolve().parent
POSES = {
    "F1": [[57, 48], [63, 43], [39, 25], [25, 26], [23, 33], [39, 48]],
    "F2": [[57, 48], [63, 43], [42, 12], [29, 8], [26, 17], [43, 35]],
}


def target(reference, spec, polygon):
    layers = rig.segmentation(spec)
    wing = [(i % 128, i // 128) for i, layer in enumerate(layers) if layer == "wing" and reference[i * 4 + 3] >= 128]
    left, top, right, bottom = guide.bounds(wing)
    px, py = zip(*polygon)
    result = bytearray()
    mask = bytearray()
    for y in range(112):
        for x in range(128):
            inside = rig.inside(x + .5, y + .5, polygon)
            i = (y * 128 + x) * 4
            r, g, b, a = reference[i:i + 4]
            if inside:
                # Nearest genuine wing patch preserves the exact reference
                # palette. This is explicitly a scaffold, never accepted art.
                tx = left + (x - min(px)) / (max(px) - min(px)) * (right - left - 1)
                ty = top + (y - min(py)) / (max(py) - min(py)) * (bottom - top - 1)
                sx, sy = min(wing, key=lambda p: ((p[0] - tx) ** 2 + (p[1] - ty) ** 2, p[1], p[0]))
                r, g, b = reference[(sy * 128 + sx) * 4:(sy * 128 + sx) * 4 + 3]
                a = 255
            # Flat cyan matte; original fractional-alpha edges composite onto it.
            result.extend([round(r * a / 255), round(g * a / 255 + 255 * (1 - a / 255)), round(b * a / 255 + 255 * (1 - a / 255)), 255])
            editable = inside or layers[y * 128 + x] == "wing"
            mask.extend([255 if editable else 0] * 3 + [255])
    return bytes(result), bytes(mask)


def generate(output, checkpoint=lambda stage: None):
    output.mkdir(parents=True, exist_ok=True)
    lock = output / ".publish.lock"
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise ValueError("Edit-target publisher active; verify PID before removing stale lock")
    try:
        with os.fdopen(descriptor, "w") as handle:
            handle.write(str(os.getpid()))
        return _generate(output, checkpoint)
    finally:
        lock.unlink()


def _generate(output, checkpoint):
    pack.versions()
    source = guide.REFERENCE.read_bytes()
    if pack.digest(source) != guide.IDENTITY_HASH:
        raise ValueError("Edit-target identity changed")
    pair = guide.read_published(ROOT / "reference-guide")
    mask_bytes = (ROOT / "rig-masks.json").read_bytes()
    spec = json.loads(mask_bytes)
    pixels = subprocess.check_output(["magick", "webp:-", "-depth", "8", "rgba:-"], input=source)
    output.mkdir(parents=True, exist_ok=True)
    metadata = {"status": "edit-scaffolds-not-artwork", "reference_sha256": pack.digest(source),
                "mask_sha256": pack.digest(mask_bytes), "script_sha256": pack.digest(Path(__file__).read_bytes()),
                "rasterizer": "ImageMagick 7.1.2-32 Q16-HDRI",
                "guide_sha256": pack.digest(pair["guide.png"]), "anchor": [64, 100], "ground_y": 100,
                "shoulder_root": [57, 48], "cell": [128, 112], "background": "#00FFFF", "poses": {}}
    # Immutable inputs publish before the completion pointer. Read targets.json
    # once and verify all named file hashes, never consume browsing filenames.
    with tempfile.TemporaryDirectory(prefix=".targets-", dir=output) as temporary:
        staged = Path(temporary)
        for identifier, polygon in POSES.items():
            rgba, mask = target(pixels, spec, polygon)
            entry = {"silhouette": polygon, "source": "Juniper design 10 exact prompt landmarks; polygon connects the stated landmarks", "files": {}}
            for suffix, data in [("target", rgba), ("edit-region", mask)]:
                name = f"{identifier}-{suffix}.png"
                path = staged / name
                rig.png(data, path)
                digest = pack.digest(path.read_bytes())
                filename = f"{digest}-{name}"
                destination = output / filename
                if destination.exists() and destination.read_bytes() != path.read_bytes():
                    raise ValueError("Immutable edit target changed")
                if not destination.exists():
                    path.replace(destination)
                entry["files"][filename] = digest
                checkpoint(name)
            metadata["poses"][identifier] = entry
        pointer = staged / "targets.json"
        pointer.write_bytes(pack.encode_json(metadata))
        checkpoint("before-completion")
        pointer.replace(output / "targets.json")
    return metadata


if __name__ == "__main__":
    generate(ROOT / "edit-targets")
