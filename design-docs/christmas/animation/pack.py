"""Pack a complete *accepted* inventory; never cleans or accepts generation.

python3 pack.py accepted/index.json output-directory
Requires ImageMagick 7.1.2-32 Q16-HDRI and cwebp 1.6.0, as CCR-4.
Index: {"frames": {ID: {"file": "ID.webp", "sha256": "...",
"numerical_status": "pass", "identity_status": "accepted",
"report": "ID.report.json", "report_sha256": "..."}}}.
Reports must have matching frame_sha256 and status="pass". This is an input
contract for a future cleanup stage, not evidence that such reports exist yet.
"""
import hashlib
import argparse
import importlib.util
import json
import os
import stat
from pathlib import Path
import subprocess
import sys
import tempfile

IDS = ([f"I{i}" for i in range(4)] + ["B1", "B2", "T1", "T2"]
       + [f"H{i}" for i in range(1, 6)] + ["F1", "F2"]
       + [f"W{i}" for i in range(8)] + ["L1", "L2", "L3", "A1", "A2", "A3"])
WIDTH, HEIGHT = 130 * len(IDS), 114
spec = importlib.util.spec_from_file_location("artwork", Path(__file__).resolve().parents[1] / "validate-artwork.py")
artwork = importlib.util.module_from_spec(spec)
spec.loader.exec_module(artwork)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encode_json(value):
    return (json.dumps(value, sort_keys=True, indent=2, allow_nan=False) + "\n").encode()


def versions():
    if subprocess.check_output(["cwebp", "-version"], text=True).splitlines()[0] != "1.6.0":
        raise ValueError("Expected cwebp 1.6.0")
    if not subprocess.check_output(["magick", "-version"], text=True).startswith("Version: ImageMagick 7.1.2-32 Q16-HDRI"):
        raise ValueError("Expected ImageMagick 7.1.2-32 Q16-HDRI")


def rgba(path):
    return subprocess.check_output(["magick", str(path), "-depth", "8", "rgba:-"])


def read_regular(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, "rb") as handle:
        if not stat.S_ISREG(os.fstat(handle.fileno()).st_mode):
            raise ValueError(f"Not a regular evidence file: {path.name}")
        return handle.read()


def checked_file(root, filename, expected, staged):
    # Inventory may never read outside its own evidence directory.
    if not isinstance(filename, str) or Path(filename).name != filename or filename in ("", ".", ".."):
        raise ValueError("Inventory files must be simple filenames")
    path = root / filename
    if not isinstance(expected, str) or len(expected) != 64 or any(c not in "0123456789abcdef" for c in expected):
        raise ValueError(f"Invalid evidence hash: {filename}")
    source_key = digest(str(path.absolute()).encode())
    snapshot = staged / f"input-{source_key}-{expected}{path.suffix}"
    if snapshot.exists():
        return snapshot
    # Read ONCE from an open regular inode. Replacement of the input pathname
    # cannot change the verified bytes. Only the private snapshot is decoded.
    payload = read_regular(path)
    if digest(payload) != expected:
        raise ValueError(f"Missing or mismatched evidence: {filename}")
    synced_write(snapshot, payload)
    return snapshot


def accepted_pixels(index, staged):
    document = json.loads(read_regular(index))
    frames = document["frames"]
    if set(frames) != set(IDS):
        raise ValueError("Require exactly the 29 designed frame IDs")
    result = {}
    decoded = {}
    snapshots = {}
    # Snapshot the COMPLETE inventory before invoking an image decoder. Reports
    # and pixels come from the same immutable evidence even if callers replace
    # all source files during decoding. Partial/mismatched inventories reject.
    for identifier in IDS:
        entry = frames[identifier]
        if entry["numerical_status"] != "pass" or entry["identity_status"] != "accepted":
            raise ValueError(f"Unaccepted frame: {identifier}")
        path = checked_file(index.parent, entry["file"], entry["sha256"], staged)
        report_path = checked_file(index.parent, entry["report"], entry["report_sha256"], staged)
        report = json.loads(report_path.read_bytes())
        if report.get("status") != "pass" or report.get("frame_sha256") != entry["sha256"]:
            raise ValueError(f"Incomplete or mismatched report: {identifier}")
        snapshots[identifier] = path
    for identifier in IDS:
        entry = frames[identifier]
        path = snapshots[identifier]
        if entry["sha256"] not in decoded:
            if artwork.validate("robin-perch", *artwork.decode(path)):
                raise ValueError(f"Alpha envelope failed: {identifier}")
            decoded[entry["sha256"]] = rgba(path)
        pixels = decoded[entry["sha256"]]
        if len(pixels) != 128 * 112 * 4:
            raise ValueError(f"Decoded pixel length: {identifier}")
        result[identifier] = pixels
    return result


def clip(frames, durations, loop=False):
    return {"frames": frames, "durations": durations, "loop": loop,
            "terminalFrame": frames[-1], "restFrame": "I0"}


def clips():
    return {
        "breathing": clip(["I0", "I1", "I2", "I3", "I2", "I1"], [200] * 6, True),
        "blink": clip(["I0", "B1", "B2", "B1", "I0"], [60, 40, 70, 40, 90]),
        "tilt": clip(["I0", "T1", "T2", "T1", "I0"], [100, 120, 180, 120, 100]),
        "hop": clip(["I0", "H1", "H2", "H3", "H4", "H5", "I0"], [28, 42, 28, 56, 56, 42, 28]),
        "takeoff": clip(["I0", "F1", "F2", "W0"], [30] * 4),
        "flap": clip([f"W{i}" for i in range(8)], [25] * 8, True),
        "landing": clip(["W0", "L1", "L2", "L3", "I0"], [24] * 5),
        "alertEntry": clip(["I0", "A1", "A2", "A3"], [40, 60, 80, 100]),
        "alertReturn": clip(["A3", "A2", "A1", "I0"], [60] * 4),
    }


def synced_write(path, data):
    with path.open("xb") as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())


def export_webp(staged, name, pixels, width, height):
    source = staged / f"{name}.rgba"
    synced_write(source, pixels)
    png = staged / f"{name}.png"
    subprocess.run(["magick", "-size", f"{width}x{height}", "-depth", "8", f"rgba:{source}", "-strip", str(png)], check=True)
    webp = staged / f"{name}.webp"
    subprocess.run(["cwebp", "-lossless", "-q", "100", "-m", "6", "-exact", "-metadata", "none", str(png), "-o", str(webp)], check=True, capture_output=True)
    if rgba(webp) != pixels:
        raise ValueError(f"Lossless {name} fidelity failed")
    return webp.read_bytes()


def publish_immutable(staged, output, name, payload):
    destination = output / name
    if destination.exists():
        if destination.is_symlink() or destination.read_bytes() != payload:
            raise ValueError(f"Conflicting existing artifact: {name}")
    else:
        synced_write(staged / name, payload)
        if read_regular(staged / name) != payload:
            raise ValueError(f"Incomplete staged artifact: {name}")
        os.replace(staged / name, destination)


def verify_previous(output, staged):
    manifest_path = output / "manifest.json"
    if not manifest_path.exists():
        return
    manifest = json.loads(read_regular(manifest_path))
    inventory = dict(manifest["sheets"])
    fallback = manifest["fallback"]
    inventory[fallback["file"]] = fallback
    for name, entry in inventory.items():
        path = checked_file(output, name, entry["sha256"], staged)
        dimensions = artwork.decode(path)[:2]
        if dimensions != (entry["width"], entry["height"]):
            raise ValueError(f"Previous manifest dimension mismatch: {name}")


def pack(index, output, checkpoint=lambda stage: None):
    versions()
    output.mkdir(parents=True, exist_ok=True)
    lock = output / ".publish.lock"
    # Exclusive lock; stale locks require human verification of the recorded pid.
    descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        with os.fdopen(descriptor, "w") as handle:
            handle.write(str(os.getpid()))
        with tempfile.TemporaryDirectory(prefix=".pack-", dir=output) as temporary:
            staged = Path(temporary)
            verify_previous(output, staged)
            pixels = accepted_pixels(index, staged)
            checkpoint("validated")
            canvas = bytearray(WIDTH * HEIGHT * 4)
            frames = {}
            for i, identifier in enumerate(IDS):
                x = 130 * i + 1
                frames[identifier] = {"sheet": "", "x": x, "y": 1, "width": 128, "height": 112}
                for y in range(112):
                    start = ((y + 1) * WIDTH + x) * 4
                    canvas[start:start + 128 * 4] = pixels[identifier][y * 128 * 4:(y + 1) * 128 * 4]
            payload = export_webp(staged, "sheet", canvas, WIDTH, HEIGHT)
            name = f"robin-{digest(payload)}.webp"
            fallback = export_webp(staged, "fallback", pixels["I0"], 128, 112)
            fallback_name = f"i0-{digest(fallback)}.webp"
            for frame in frames.values():
                frame["sheet"] = name
            manifest = {"version": 1, "anchor": [64, 100], "scale": .35,
                        "sheets": {name: {"width": WIDTH, "height": HEIGHT, "sha256": digest(payload)}},
                        "fallback": {"file": fallback_name, "width": 128, "height": 112, "sha256": digest(fallback)},
                        "frames": frames, "clips": clips()}
            checkpoint("encoded")
            # Immutable content-addressed sheet first. Never replace conflicting bytes.
            publish_immutable(staged, output, name, payload)
            publish_immutable(staged, output, fallback_name, fallback)
            checkpoint("sheet-published")
            # The only mutable pointer is published last. Any earlier failure leaves
            # the previous manifest and its sheets intact; restart verifies inputs.
            synced_write(staged / "manifest.json", encode_json(manifest))
            checkpoint("manifest-staged")
            os.replace(staged / "manifest.json", output / "manifest.json")
            return manifest
    finally:
        lock.unlink()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("index", type=Path)
    parser.add_argument("output", type=Path)
    arguments = parser.parse_args()
    try:
        pack(arguments.index, arguments.output)
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError) as error:
        print(f"Packing rejected: {error}", file=sys.stderr)
        raise SystemExit(1)
