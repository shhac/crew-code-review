"""Fixed-coordinate robin strip tooling, independently implemented (see strip-pipeline.md)."""
import argparse
from pathlib import Path
import subprocess
import json
import math
import statistics
import tempfile
from collections import deque
import hashlib
import os

ROOT = Path(__file__).resolve().parent
REFERENCE = ROOT.parents[2] / "internal/dashboard/ui/src/lib/theme/christmas/robin-perch.webp"
WIDTH, HEIGHT, COUNT = 128, 112, 8
DURATIONS = [1600, 450, 450, 650, 60, 80, 90, 1420]


def guide_pixels(reference):
    """Repeat reference ghosts in fixed cells, never fitting painted bounds."""
    if len(reference) != WIDTH * HEIGHT * 4:
        raise ValueError("Expected canonical 128x112 RGBA")
    stride = WIDTH * COUNT
    canvas = bytearray([245, 245, 245, 255] * stride * HEIGHT)

    def mark(x, y, colour):
        offset = (y * stride + x) * 4
        canvas[offset:offset + 4] = bytes([*colour, 255])

    for cell in range(COUNT):
        left = cell * WIDTH
        for y in range(HEIGHT):
            for x in range(WIDTH):
                offset = (y * WIDTH + x) * 4
                alpha = reference[offset + 3] / 255 * .28
                mark(left + x, y, [round(reference[offset + c] * alpha + 245 * (1 - alpha)) for c in range(3)])
        for x in range(WIDTH):
            mark(left + x, 0, (90, 90, 90))
            mark(left + x, HEIGHT - 1, (90, 90, 90))
        for y in range(HEIGHT):
            mark(left, y, (90, 90, 90))
            mark(left + WIDTH - 1, y, (90, 90, 90))
        for x in range(4, WIDTH - 4):
            mark(left + x, 4, (30, 110, 210))
            mark(left + x, HEIGHT - 5, (30, 110, 210))
        for y in range(4, HEIGHT - 4):
            mark(left + 4, y, (30, 110, 210))
            mark(left + WIDTH - 5, y, (30, 110, 210))
        for delta in range(-3, 4):
            mark(left + 64 + delta, 100, (210, 20, 150))
            mark(left + 64, 100 + delta, (210, 20, 150))
    return bytes(canvas)


def prepare(output):
    dimensions = subprocess.check_output(["magick", str(REFERENCE), "-format", "%w %h", "info:"]).strip()
    if dimensions != b"128 112":
        raise ValueError("Canonical dimensions changed")
    pixels = subprocess.check_output(["magick", str(REFERENCE), "-depth", "8", "rgba:-"])
    # Green is safe only if absent from visible canonical pixels.
    for offset in range(0, len(pixels), 4):
        r, g, b, a = pixels[offset:offset + 4]
        if a and max(r, 255 - g, b) < 80:
            raise ValueError("Green key conflicts with canonical palette")
    output.mkdir(parents=True, exist_ok=True)
    subprocess.run(["magick", "-size", "1024x112", "-depth", "8", "rgba:-", "-strip", str(output / "guide.png")],
                   input=guide_pixels(pixels), check=True)


def decode(path):
    width, height = map(int, subprocess.check_output(
        ["magick", str(path), "-format", "%w %h", "info:"]).split())
    pixels = subprocess.check_output(["magick", str(path), "-alpha", "on", "-depth", "8", "rgba:-"])
    return width, height, pixels


def clean_pixel(r, g, b, a, foreground=None):
    """Project onto the local foreground-to-green line, then unmatte RGB."""
    if not a:
        return (0, 0, 0, 0)
    if g >= 220 and max(r, b) <= 20:
        return (0, 0, 0, 0)
    if foreground is None:
        raise ValueError("Matte edge has no nearby foreground")
    direction = [foreground[0], foreground[1] - 255, foreground[2]]
    denominator = sum(v * v for v in direction)
    if not denominator:
        raise ValueError("Foreground conflicts with key")
    coverage = max(0, min(1, sum(v * c for v, c in zip(direction, [r, g - 255, b])) / denominator))
    if coverage < .02:
        return (0, 0, 0, 0)
    # The foreground colour is estimated from opaque material, not from green
    # excess. Using that estimate avoids amplifying matte noise into yellow or
    # magenta fringes on the dark outline. Interior seeds retain their own RGB.
    return (*foreground, round(a * coverage))


def clean_rgba(width, height, pixels):
    # Propagate nearby opaque colours only into matte edges, with a bounded
    # distance. It is colour estimation, never movement or geometry fitting.
    foreground = {}
    queue = deque()
    cleaned = bytearray(len(pixels))
    opaque = bytearray(width * height)
    for index in range(width * height):
        r, g, b, a = pixels[index * 4:index * 4 + 4]
        if a and g <= max(r, b) + 12:
            opaque[index] = 1
    for index in range(width * height):
        x, y = index % width, index // width
        if opaque[index] and all(0 <= x + dx < width and 0 <= y + dy < height
                                 and opaque[(y + dy) * width + x + dx]
                                 for dx, dy in [(-2, 0), (2, 0), (0, -2), (0, 2)]):
            r, g, b, _ = pixels[index * 4:index * 4 + 4]
            foreground[index] = (r, g, b)
            queue.append((index, 0))
    seeds = dict(foreground)
    while queue:
        index, distance = queue.popleft()
        if distance == 12:
            continue
        x, y = index % width, index // width
        for xx, yy in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]:
            if not (0 <= xx < width and 0 <= yy < height):
                continue
            other = yy * width + xx
            if other in foreground:
                continue
            r, g, b, a = pixels[other * 4:other * 4 + 4]
            if not a or g >= 220 and max(r, b) <= 20:
                continue
            foreground[other] = foreground[index]
            queue.append((other, distance + 1))
    for index in range(width * height):
        off = index * 4
        colour = foreground.get(index)
        if colour is not None and index not in seeds:
            # Choose a compatible local material rather than treating an
            # adjacent ivory belly as the foreground of a dark toe outline.
            x, y = index % width, index // width
            r, g, b, _ = pixels[off:off + 4]
            observed = [r, g - 255, b]
            candidates = [colour]
            for dy in [-12, -8, -4, 0, 4, 8, 12]:
                for dx in [-12, -8, -4, 0, 4, 8, 12]:
                    if 0 <= x + dx < width and 0 <= y + dy < height:
                        candidate = seeds.get((y + dy) * width + x + dx)
                        if candidate is not None:
                            candidates.append(candidate)
            def compatibility(candidate):
                direction = [candidate[0], candidate[1] - 255, candidate[2]]
                return sum(v * c for v, c in zip(direction, observed)) / math.sqrt(sum(v * v for v in direction))
            colour = max(candidates, key=compatibility)
        cleaned[off:off + 4] = bytes(clean_pixel(*pixels[off:off + 4], colour))
    return cleaned


def extract(width, height, pixels, count=COUNT):
    """One transform for all equal slots. Bounds measure, never fit individual cells."""
    if count != COUNT or width < COUNT * 8 or len(pixels) != width * height * 4:
        raise ValueError("Expected eight equal source slots and RGBA pixels")
    def source_ink(x, y):
        r, g, b, a = pixels[(y * width + x) * 4:(y * width + x) * 4 + 4]
        return a and not (g >= 220 and max(r, b) <= 20)
    if any(source_ink(x, y) for y in [0, height - 1] for x in range(width)):
        raise ValueError('Source vertical clipping')
    for cell in range(COUNT):
        if any(source_ink(x, y) for x in [math.ceil(cell * width / COUNT), math.ceil((cell + 1) * width / COUNT) - 1]
               for y in range(height)):
            raise ValueError(f'Source slot clipping {cell}')
    cleaned = clean_rgba(width, height, pixels)
    bounds = []
    slot = width / COUNT
    for cell in range(COUNT):
        points = [(x, y) for y in range(height)
                  for x in range(math.ceil(cell * slot), math.ceil((cell + 1) * slot))
                  if cleaned[(y * width + x) * 4 + 3]]
        if not points:
            raise ValueError(f"Empty source cell {cell}")
        xs, ys = zip(*points)
        bounds.append([min(xs) - cell * slot, min(ys), max(xs) - cell * slot, max(ys)])
        if min(xs) <= cell * slot or max(xs) >= (cell + 1) * slot - 1:
            raise ValueError(f"Source slot clipping {cell}")
        if min(ys) == 0 or max(ys) == height - 1:
            raise ValueError(f"Source vertical clipping {cell}")
    neutral = bounds[0]
    scale = 93 / (neutral[3] - neutral[1] + 1)
    anchor_x = (neutral[0] + neutral[2]) / 2
    baseline = statistics.median(b[3] for b in bounds)
    frames = []
    for cell in range(COUNT):
        frame = bytearray(WIDTH * HEIGHT * 4)
        for y in range(HEIGHT):
            sy = baseline + (y - 100) / scale
            for x in range(WIDTH):
                sx = cell * slot + anchor_x + (x - 64) / scale
                ix, iy = math.floor(sx), math.floor(sy)
                accum = [0., 0., 0., 0.]
                for dx, dy in [(0, 0), (1, 0), (0, 1), (1, 1)]:
                    xx, yy = ix + dx, iy + dy
                    if not (cell * slot <= xx < (cell + 1) * slot and 0 <= yy < height):
                        continue
                    weight = (1 - abs(sx - xx)) * (1 - abs(sy - yy))
                    off = (yy * width + xx) * 4
                    alpha = cleaned[off + 3] / 255
                    for channel in range(3):
                        accum[channel] += cleaned[off + channel] * alpha * weight
                    accum[3] += alpha * weight
                off = (y * WIDTH + x) * 4
                alpha = round(accum[3] * 255)
                if alpha:
                    frame[off:off + 4] = bytes([min(255, round(v / accum[3])) for v in accum[:3]] + [alpha])
        frames.append(bytes(frame))
    return frames, {"source_size": [width, height], "bird_band": [min(b[1] for b in bounds), max(b[3] for b in bounds)],
                    "slot_width": slot, "scale": scale, "source_anchor": [anchor_x, baseline], "bounds": bounds,
                    "source_clipping": "pass (horizontal and vertical)"}


def validate_frames(frames):
    if len(frames) != COUNT or any(len(f) != WIDTH * HEIGHT * 4 for f in frames):
        raise ValueError("Invalid fixed cell geometry")
    for cell, frame in enumerate(frames):
        visible = 0
        for off in range(0, len(frame), 4):
            r, g, b, a = frame[off:off + 4]
            x, y = off // 4 % WIDTH, off // 4 // WIDTH
            if not a and (r or g or b):
                raise ValueError("Invisible RGB")
            if a:
                visible += 1
                if x < 4 or x >= WIDTH - 4 or y < 4 or y >= HEIGHT - 4:
                    raise ValueError(f"Clipping cell {cell}")
                if g > max(r, b) + 40:
                    raise ValueError(f"Key residue cell {cell}")
                if a > 128 and (b > r + 70 and b > g + 40 or r > g + 100 and b > g + 80):
                    raise ValueError(f"Guide colour cell {cell}")
        if not visible:
            raise ValueError(f"Empty cell {cell}")
    if len(set(frames)) != COUNT:
        raise ValueError("Duplicate idle cells")
    return {"status": "pass", "cells": COUNT, "durations_ms": DURATIONS,
            "disabled_rows_transparent": True, "identity": "pending Juniper review"}


def compose(frames):
    validate_frames(frames)
    atlas = bytearray(WIDTH * COUNT * HEIGHT * 6 * 4)
    for cell, frame in enumerate(frames):
        for y in range(HEIGHT):
            start = (y * WIDTH * COUNT + cell * WIDTH) * 4
            atlas[start:start + WIDTH * 4] = frame[y * WIDTH * 4:(y + 1) * WIDTH * 4]
    return bytes(atlas)


def write_image(path, pixels, width, height):
    if path.suffix == '.webp':
        png = subprocess.run(['magick', '-size', f'{width}x{height}', '-depth', '8', 'rgba:-', 'png:-'],
                             input=pixels, stdout=subprocess.PIPE, check=True).stdout
        subprocess.run(['cwebp', '-lossless', '-exact', '-quiet', '-o', str(path), '--', '-'], input=png, check=True)
        return
    subprocess.run(["magick", "-size", f"{width}x{height}", "-depth", "8", "rgba:-",
                    "-define", "webp:lossless=true", str(path)], input=pixels, check=True)


def preview_views(stage):
    """Same extracted pixels on contrasting mattes, in both runtime facings."""
    for cell in range(COUNT):
        for name, background, mirrored in [('light', '#eeeeee', False), ('dark', '#20252b', False),
                                           ('light-left', '#eeeeee', True), ('dark-left', '#20252b', True)]:
            command = ['magick', str(stage / f'{cell}.png')]
            if mirrored:
                command += ['-flop']
            subprocess.run(command + ['-background', background, '-alpha', 'remove', '-alpha', 'off',
                                      str(stage / f'{cell}-{name}.png')], check=True)
        subprocess.run(['magick', *[str(stage / f'{cell}-{name}.png') for name in
                                    ['light', 'dark', 'light-left', 'dark-left']], '+append',
                        str(stage / f'{cell}-native.png')], check=True)
        subprocess.run(['magick', str(stage / f'{cell}-native.png'), '-resize', '35%',
                        '-background', '#888888', '-gravity', 'west', '-extent', '512x40',
                        str(stage / f'{cell}-small.png')], check=True)
        subprocess.run(['magick', str(stage / f'{cell}-native.png'), str(stage / f'{cell}-small.png'),
                        '-append', str(stage / f'{cell}-preview.png')], check=True)
    rows = []
    for name in ['light', 'dark', 'light-left', 'dark-left']:
        row = stage / f'row-{name}.png'
        subprocess.run(['magick', *[str(stage / f'{i}-{name}.png') for i in range(COUNT)],
                        '+append', str(row)], check=True)
        rows.append(str(row))
        small = stage / f'row-{name}-small.png'
        subprocess.run(['magick', str(row), '-resize', '35%', '-background', '#888888',
                        '-gravity', 'west', '-extent', '1024x40', str(small)], check=True)
        rows.append(str(small))
    subprocess.run(['magick', *rows, '-append', str(stage / 'contact.png')], check=True)
    command = ['magick']
    for i, duration in enumerate(DURATIONS):
        command += ['-delay', str(duration // 10), str(stage / f'{i}-preview.png')]
    subprocess.run(command + ['-loop', '0', str(stage / 'preview.gif')], check=True)


def publish_evidence(stage, output):
    # A passing report is the completion marker. Remove it before any evidence
    # replacement, so interruption cannot pair new pixels with an old pass.
    (output / 'validation.json').unlink(missing_ok=True)
    for name in ['atlas.webp', 'canonical.png', 'contact.png', 'preview.gif', 'validation.json']:
        (stage / name).replace(output / name)


def snapshot_evidence(evidence):
    """Decode one immutable snapshot, excluding the processing writer."""
    lock = evidence / '.processing.lock'
    with lock.open('x') as handle:
        handle.write(str(os.getpid()))
    try:
        report = json.loads((evidence / 'validation.json').read_text())
        if report.get('status') != 'pass':
            raise ValueError('Missing passing processing report')
        artwork = (evidence / 'atlas.webp').read_bytes()
        canonical = (evidence / 'canonical.png').read_bytes()
        with tempfile.TemporaryDirectory(dir=evidence) as directory:
            stage = Path(directory)
            (stage / 'atlas.webp').write_bytes(artwork)
            (stage / 'canonical.png').write_bytes(canonical)
            return artwork, decode(stage / 'atlas.webp'), decode(stage / 'canonical.png')
    finally:
        lock.unlink()


def publish_runtime(evidence, output, verdict=None):
    """Immutable artwork first, atomic manifest last; pending art stays disabled."""
    artwork, (width, height, atlas), canonical = snapshot_evidence(evidence)
    if (width, height) != (1024, 672) or any(atlas[1024 * 112 * 4:]):
        raise ValueError('Invalid atlas or disabled rows')
    frames = [b''.join(atlas[(y * 1024 + cell * 128) * 4:(y * 1024 + cell * 128 + 128) * 4]
                       for y in range(112)) for cell in range(COUNT)]
    validate_frames(frames)
    if canonical != (128, 112, frames[0]):
        raise ValueError('Stale canonical')
    digest = hashlib.sha256(artwork).hexdigest()
    accepted = False
    if verdict is not None:
        identity = json.loads(verdict.read_text())
        designer_accepted = identity.get('designer') == 'Juniper'
        owner = identity.get('owner_acceptance', {})
        static = identity.get('designer_review', {})
        owner_accepted = (owner.get('reviewer') == 'owner' and
                          owner.get('status') == 'accepted' and
                          owner.get('atlas_sha256') == digest and
                          static.get('designer') == 'Juniper' and
                          static.get('status') == 'static-identity-supported' and
                          static.get('atlas_sha256') == digest)
        if identity.get('status') != 'accepted' or identity.get('atlas_sha256') != digest or not (designer_accepted or owner_accepted):
            raise ValueError('Requires Juniper acceptance or owner acceptance with Juniper static identity review of this atlas')
        accepted = True
    output.mkdir(parents=True, exist_ok=True)
    lock = output / '.publication.lock'
    with lock.open('x') as handle:
        handle.write(str(os.getpid()))
    try:
        with tempfile.TemporaryDirectory(dir=output) as directory:
            stage = Path(directory)
            atlas_name = digest + '-idle.webp'
            (stage / atlas_name).write_bytes(artwork)
            write_image(stage / 'neutral.webp', frames[0], 128, 112)
            neutral = (stage / 'neutral.webp').read_bytes()
            neutral_hash = hashlib.sha256(neutral).hexdigest()
            neutral_name = neutral_hash + '-neutral.webp'
            (stage / 'neutral.webp').rename(stage / neutral_name)
            manifest = {
                'version': 1, 'profile': 'atlas-idle', 'anchor': [64, 100], 'scale': .35,
                'sheets': {atlas_name: {'width': 1024, 'height': 672, 'sha256': digest}},
                'fallback': {'file': neutral_name, 'width': 128, 'height': 112, 'sha256': neutral_hash},
                'frames': {f'I{i}': {'sheet': atlas_name, 'x': i * 128, 'y': 0, 'width': 128, 'height': 112} for i in range(8)},
                'clips': {'idle': {'frames': [f'I{i}' for i in range(8)], 'durations': DURATIONS,
                                   'loop': True, 'restFrame': 'I0', 'terminalFrame': 'I7'}},
                'rows': {name: {'row': i, 'count': 8 if i == 0 else 0,
                                'available': accepted if i == 0 else False,
                                'acceptance': 'accepted' if i == 0 and accepted else 'pending'}
                         for i, name in enumerate(['idle', 'flying', 'takeoff', 'landing', 'hop', 'alert'])}}
            (stage / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
            for name in [atlas_name, neutral_name]:
                target = output / name
                if target.exists():
                    if target.read_bytes() != (stage / name).read_bytes():
                        raise ValueError('Immutable artwork name collision')
                else:
                    (stage / name).replace(target)
            (stage / 'manifest.json').replace(output / 'manifest.json')
    finally:
        lock.unlink()


def process(source, output):
    """Build review evidence privately; never installs or enables a runtime row."""
    output.mkdir(parents=True, exist_ok=True)
    lock = output / ".processing.lock"
    # Exclusive writers. On interruption the lock remains as a diagnostic;
    # remove it only after confirming its writer is gone.
    with lock.open("x") as handle:
        handle.write(str(os.getpid()))
    try:
        frames, transform = extract(*decode(source))
        report = validate_frames(frames)
        with tempfile.TemporaryDirectory(dir=output) as staging:
            stage = Path(staging)
            write_image(stage / "atlas.webp", compose(frames), 1024, 672)
            for index, frame in enumerate(frames):
                write_image(stage / f"{index}.png", frame, 128, 112)
            write_image(stage / 'canonical.png', frames[0], 128, 112)
            preview_views(stage)
            (stage / "validation.json").write_text(json.dumps({**report, "transform": transform}, indent=2) + "\n")
            publish_evidence(stage, output)
    finally:
        lock.unlink()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["prepare", "process", "publish"])
    parser.add_argument("--source", type=Path)
    parser.add_argument("--verdict", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "idle-strip")
    args = parser.parse_args()
    if args.command == "prepare":
        prepare(args.output)
    elif args.command == 'process':
        if not args.source:
            parser.error("process requires --source")
        process(args.source, args.output)
    else:
        if not args.source:
            parser.error('publish requires --source evidence directory')
        publish_runtime(args.source, args.output, args.verdict)
