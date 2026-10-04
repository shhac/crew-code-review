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


def prepare(output, reference=REFERENCE):
    dimensions = subprocess.check_output(["magick", str(reference), "-format", "%w %h", "info:"]).strip()
    if dimensions != b"128 112":
        raise ValueError("Canonical dimensions changed")
    pixels = subprocess.check_output(["magick", str(reference), "-depth", "8", "rgba:-"])
    # Green is safe only if absent from visible canonical pixels.
    for offset in range(0, len(pixels), 4):
        r, g, b, a = pixels[offset:offset + 4]
        if a and max(r, 255 - g, b) < 80:
            raise ValueError("Green key conflicts with canonical palette")
    output.mkdir(parents=True, exist_ok=True)
    subprocess.run(["magick", "-size", "1024x112", "-depth", "8", "rgba:-", "-strip", str(output / "guide.png")],
                   input=guide_pixels(pixels), check=True)
    (output / "guide-contract.json").write_text(json.dumps({
        "reference": str(reference.relative_to(ROOT)) if reference.is_relative_to(ROOT) else str(reference),
        "reference_sha256": hashlib.sha256(reference.read_bytes()).hexdigest(),
        "guide_size": [WIDTH * COUNT, HEIGHT], "cell_size": [WIDTH, HEIGHT],
        "anchor": [64, 100], "clear_margin": 4,
        "extraction": "canonical-layout", "transform": canonical_transform(WIDTH * COUNT, HEIGHT),
        "purpose": "Registration only; idle wings and planted feet do not constrain flight articulation"
    }, indent=2) + '\n')


def canonical_transform(width, height):
    """Dimension-derived transform, independent of generated anatomical bounds."""
    if width <= 0 or height <= 0 or width * HEIGHT != height * WIDTH * COUNT:
        raise ValueError("Canonical layout requires uniform scaling of eight 128x112 slots")
    source_scale = height / HEIGHT
    slot = width / COUNT
    return {"source_size": [width, height], "slot_width": slot,
            "slot_boundaries": [i * slot for i in range(COUNT + 1)],
            "scale": 1 / source_scale, "source_anchor": [64 * source_scale, 100 * source_scale],
            "pixel_centres": "source=(native+0.5)/scale-0.5",
            "registration": "canonical-layout"}


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
        if colour is None and opaque[index]:
            colour = tuple(pixels[off:off + 3])
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


def bird_components(width, height, pixels, count, minimum_pixels=100):
    """Find whole birds in cleaned alpha, independent of spacing or guide slots."""
    if not isinstance(minimum_pixels, int) or minimum_pixels < 1:
        raise ValueError('Invalid component size threshold')
    seen = bytearray(width * height)
    components = []
    for index in range(width * height):
        if seen[index] or pixels[index * 4 + 3] <= 5:
            continue
        seen[index] = 1
        queue = [index]
        for current in queue:
            x, y = current % width, current // width
            for dy in [-1, 0, 1]:
                for dx in [-1, 0, 1]:
                    xx, yy = x + dx, y + dy
                    other = yy * width + xx
                    if 0 <= xx < width and 0 <= yy < height and not seen[other] and pixels[other * 4 + 3] > 5:
                        seen[other] = 1
                        queue.append(other)
        if len(queue) >= minimum_pixels:
            xs, ys = [i % width for i in queue], [i // width for i in queue]
            components.append(([min(xs), min(ys), max(xs), max(ys)], queue))
    components.sort(key=lambda component: component[0][0])
    if len(components) != count:
        raise ValueError(f'Expected exactly {count} bird components; found {len(components)}')
    for i, (bounds, _) in enumerate(components):
        left, top, right, bottom = bounds
        if left == 0 or right == width - 1 or top == 0 or bottom == height - 1:
            raise ValueError(f'Source clipping bird {i}')
        if i and components[i - 1][0][2] >= left:
            raise ValueError('Overlapping bird bounds')
    retained = bytearray(len(pixels))
    for _, indices in components:
        for index in indices:
            retained[index * 4:index * 4 + 4] = pixels[index * 4:index * 4 + 4]
    return retained, [bounds for bounds, _ in components]


def landmark_geometry(bounds, shared):
    """Whole-frame union registered by eye, independent of silhouette edges."""
    scale = shared.get('scale')
    landmarks = shared.get('landmarks')
    canonical = shared.get('canonical_eye')
    def point(p):
        return isinstance(p, list) and len(p) == 2 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in p)
    if not isinstance(scale, (int, float)) or not math.isfinite(scale) or scale <= 0 or not point(canonical) or not isinstance(landmarks, list) or len(landmarks) != len(bounds):
        raise ValueError('Invalid body landmark geometry')
    for i, (l, b) in enumerate(zip(landmarks, bounds)):
        for name in ['eye', 'beak_base', 'breast_centre']:
            p = l.get(name) if isinstance(l, dict) else None
            if not point(p) or not (b[0] <= p[0] <= b[2] and b[1] <= p[1] <= b[3]):
                raise ValueError(f'Invalid {name} landmark {i}')
    eyes = [l['eye'] for l in landmarks]
    left = math.floor(min((b[0]-e[0]-1)*scale for b,e in zip(bounds,eyes)))-4
    top = math.floor(min((b[1]-e[1]-1)*scale for b,e in zip(bounds,eyes)))-4
    right = math.ceil(max((b[2]-e[0]+1)*scale for b,e in zip(bounds,eyes)))+4
    bottom = math.ceil(max((b[3]-e[1]+1)*scale for b,e in zip(bounds,eyes)))+4
    return {'cell_size': [math.ceil((right-left+1)/2)*2, math.ceil((bottom-top+1)/2)*2],
            'anchor': [-left,-top], 'canonical_anchor': canonical, 'landmarks': landmarks}


def extract(width, height, pixels, count=COUNT, registration="idle-bounds", shared=None):
    """Whole connected birds, one scale and virtual root; never fit individual cells."""
    if count not in [4, 5, 6, 8] or width < count * 8 or height <= 0 or len(pixels) != width * height * 4:
        raise ValueError("Expected four to six or eight birds and RGBA pixels")
    if registration not in ["idle-bounds", "canonical-layout", "shared-transform"]:
        raise ValueError("Unknown registration mode")
    transform = canonical_transform(width, height) if registration == "canonical-layout" else None
    origin, slot = 0, width / count
    if registration == 'shared-transform':
        if not isinstance(shared, dict):
            raise ValueError('Flying requires a recorded shared canonical transform')
        scale, anchor = shared['scale'], shared.get('source_anchor', [0, 0])
        if not all(math.isfinite(v) for v in [scale, *anchor]) or len(anchor) != 2 or scale <= 0:
            raise ValueError('Invalid shared transform')
        transform = {"source_anchor": anchor, **shared, 'registration': registration}
    elif count != COUNT:
        raise ValueError('Idle and canonical layout require eight cells')
    # Genuine alpha is straight RGBA on every row; only chroma-backed strips
    # need unmatting. Remove empty-padding dust before component detection.
    pixels = bytearray(pixels)
    transparent = any(pixels[off + 3] == 0 for off in range(0, len(pixels), 4))
    for off in range(0, len(pixels), 4):
        r, g, b, a = pixels[off:off + 4]
        if a <= 5 or a <= 10 and g > max(r, b) + 40:
            pixels[off:off + 4] = bytes(4)
    def source_ink(x, y):
        r, g, b, a = pixels[(y * width + x) * 4:(y * width + x) * 4 + 4]
        return a and not (g >= 220 and max(r, b) <= 20)
    if registration == 'canonical-layout' and any(source_ink(x, y) for y in [0, height - 1] for x in range(width)):
        raise ValueError('Source vertical clipping')
    for cell in range(count) if registration == 'canonical-layout' else []:
        if any(source_ink(x, y) for x in [math.ceil(origin + cell * slot), math.ceil(origin + (cell + 1) * slot) - 1]
               for y in range(height)):
            raise ValueError(f'Source slot clipping {cell}')
    # Alpha-backed artwork is already straight RGBA, not composited on green.
    # Applying chroma recovery to it would recolour genuine translucent edges.
    cleaned = pixels if transparent else clean_rgba(width, height, pixels)
    cleaned, component_bounds = bird_components(width, height, cleaned, count,
                                               shared.get('minimum_component_pixels', 100) if shared else 100)
    # The guide layout mode remains a diagnostic for exact canonical grids.
    # Generated production strips use actual component boxes, never grid cuts.
    origins = [origin + cell * slot for cell in range(count)] if registration == 'canonical-layout' else [b[0] for b in component_bounds]
    geometry = landmark_geometry(component_bounds, shared) if shared and "landmarks" in shared else None
    cw, ch = geometry["cell_size"] if geometry else (WIDTH, HEIGHT)
    tx, ty = geometry["anchor"] if geometry else (64, 100)
    bounds = []
    for cell in range(count):
        left, top, right, bottom = component_bounds[cell]
        bounds.append([left - origins[cell], top, right - origins[cell], bottom])
        if registration == 'canonical-layout' and (left <= origins[cell] or right >= origins[cell] + slot - 1):
            raise ValueError(f"Source slot clipping {cell}")
    neutral = bounds[0]
    scale = transform['scale'] if transform else 93 / (neutral[3] - neutral[1] + 1)
    anchor_x = transform['source_anchor'][0] if transform else (neutral[0] + neutral[2]) / 2
    baseline = transform['source_anchor'][1] if transform else statistics.median(b[3] for b in bounds)
    if registration != 'canonical-layout' and geometry is None:
        for cell, (left, top, right, bottom) in enumerate(bounds):
            # Reject loss before sampling: an off-canvas bird must never look
            # like passing evidence merely because its extremities disappeared.
            if (64 + (left - anchor_x) * scale < 4 or
                    64 + (right - anchor_x) * scale >= WIDTH - 4 or
                    100 + (top - baseline) * scale < 4 or
                    100 + (bottom - baseline) * scale >= HEIGHT - 4):
                raise ValueError(f'Clipping cell {cell} under shared transform')
    frames = []
    for cell in range(count):
        frame = bytearray(cw * ch * 4)
        eye = geometry["landmarks"][cell]["eye"] if geometry else None
        for y in range(ch):
            sy = (y + .5) / scale - .5 if registration == 'canonical-layout' else baseline + (y - 100) / scale
            if eye is not None:
                sy = eye[1] + (y - ty) / scale
            for x in range(cw):
                sx = origins[cell] + ((x + .5) / scale - .5 if registration == 'canonical-layout' else anchor_x + (x - 64) / scale)
                if eye is not None:
                    sx = eye[0] + (x - tx) / scale
                ix, iy = math.floor(sx), math.floor(sy)
                accum = [0., 0., 0., 0.]
                for dx, dy in [(0, 0), (1, 0), (0, 1), (1, 1)]:
                    xx, yy = ix + dx, iy + dy
                    left, top, right, bottom = component_bounds[cell]
                    if not (left <= xx <= right and top <= yy <= bottom):
                        continue
                    weight = (1 - abs(sx - xx)) * (1 - abs(sy - yy))
                    off = (yy * width + xx) * 4
                    alpha = cleaned[off + 3] / 255
                    for channel in range(3):
                        accum[channel] += cleaned[off + channel] * alpha * weight
                    accum[3] += alpha * weight
                off = (y * cw + x) * 4
                alpha = round(accum[3] * 255)
                if alpha:
                    frame[off:off + 4] = bytes([min(255, round(v / accum[3])) for v in accum[:3]] + [alpha])
        frames.append(bytes(frame))
    return frames, {**(transform or {}), **(geometry or {}), "source_size": [width, height], "bird_band": [min(b[1] for b in bounds), max(b[3] for b in bounds)],
                    "scale": scale, "source_anchor": [anchor_x, baseline], "bounds": bounds,
                    "component_bounds": component_bounds, "component_origins": origins,
                    "minimum_component_pixels": shared.get('minimum_component_pixels', 100) if shared else 100,
                    "source_clipping": "pass (horizontal and vertical)"}


def validate_frames(frames, durations=None, cell_size=(WIDTH, HEIGHT)):
    cw, ch = cell_size
    if any(not isinstance(v, int) or v < 16 or v % 2 for v in cell_size):
        raise ValueError("Invalid cell dimensions")
    count = len(frames)
    if count not in [4, 5, 6, 8] or any(len(f) != cw * ch * 4 for f in frames):
        raise ValueError("Invalid fixed cell geometry")
    durations = durations if durations is not None else DURATIONS if count == COUNT else [200 / count] * count
    if len(durations) != count or any(not math.isfinite(ms) or ms <= 0 for ms in durations):
        raise ValueError('Invalid cell timing')
    for cell, frame in enumerate(frames):
        visible = 0
        for off in range(0, len(frame), 4):
            r, g, b, a = frame[off:off + 4]
            x, y = off // 4 % cw, off // 4 // cw
            if not a and (r or g or b):
                raise ValueError("Invisible RGB")
            if a:
                visible += 1
                if x < 4 or x >= cw - 4 or y < 4 or y >= ch - 4:
                    raise ValueError(f"Clipping cell {cell}")
                if g > max(r, b) + 40:
                    raise ValueError(f"Key residue cell {cell}")
                if a > 128 and (b > r + 70 and b > g + 40 or r > g + 100 and b > g + 80):
                    raise ValueError(f"Guide colour cell {cell}")
        if not visible:
            raise ValueError(f"Empty cell {cell}")
    if len(set(frames)) != count:
        raise ValueError("Duplicate cells")
    return {"status": "pass", "cells": count, "durations_ms": durations,
            "disabled_rows_transparent": True, "identity": "pending Juniper review"}


def compose(frames, row=0, base=None):
    validate_frames(frames)
    if row not in [0, 1]:
        raise ValueError('Only idle and flying rows are supported')
    atlas = bytearray(base if base is not None else bytes(WIDTH * COUNT * HEIGHT * 6 * 4))
    if len(atlas) != WIDTH * COUNT * HEIGHT * 6 * 4:
        raise ValueError('Invalid base atlas')
    start = row * WIDTH * COUNT * HEIGHT * 4
    atlas[start:start + WIDTH * COUNT * HEIGHT * 4] = bytes(WIDTH * COUNT * HEIGHT * 4)
    for cell, frame in enumerate(frames):
        for y in range(HEIGHT):
            start = ((y + row * HEIGHT) * WIDTH * COUNT + cell * WIDTH) * 4
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


def preview_views(stage, durations=DURATIONS):
    """Same extracted pixels on contrasting mattes, in both runtime facings."""
    count = len(durations)
    cw, ch, _ = decode(stage / "0.png")
    small_height = math.ceil(ch * .35)
    for cell in range(count):
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
                        '-background', '#888888', '-gravity', 'west', '-extent', f'{cw*4}x{small_height}',
                        str(stage / f'{cell}-small.png')], check=True)
        subprocess.run(['magick', str(stage / f'{cell}-native.png'), str(stage / f'{cell}-small.png'),
                        '-append', str(stage / f'{cell}-preview.png')], check=True)
    rows = []
    for name in ['light', 'dark', 'light-left', 'dark-left']:
        row = stage / f'row-{name}.png'
        subprocess.run(['magick', *[str(stage / f'{i}-{name}.png') for i in range(count)],
                        '+append', str(row)], check=True)
        rows.append(str(row))
        small = stage / f'row-{name}-small.png'
        subprocess.run(['magick', str(row), '-resize', '35%', '-background', '#888888',
                        '-gravity', 'west', '-extent', f'{cw*count}x{small_height}', str(small)], check=True)
        rows.append(str(small))
    subprocess.run(['magick', *rows, '-append', str(stage / 'contact.png')], check=True)
    command = ['magick']
    for i, duration in enumerate(durations):
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
        if report.get('atlas_sha256') is not None and report['atlas_sha256'] != hashlib.sha256(artwork).hexdigest():
            raise ValueError('Stale processing report')
        canonical = (evidence / 'canonical.png').read_bytes()
        with tempfile.TemporaryDirectory(dir=evidence) as directory:
            stage = Path(directory)
            (stage / 'atlas.webp').write_bytes(artwork)
            (stage / 'canonical.png').write_bytes(canonical)
            return artwork, decode(stage / 'atlas.webp'), decode(stage / 'canonical.png'), report
    finally:
        lock.unlink()


def publish_landmark_flying(evidence, output, artwork, decoded, canonical, geometry, count, verdict):
    """Separate flying sheet preserves accepted idle bytes and metadata."""
    width, height, pixels = decoded
    expected = landmark_geometry(geometry['component_bounds'], geometry)
    if any(geometry.get(k) != expected[k] for k in ['cell_size', 'anchor', 'canonical_anchor']):
        raise ValueError('Stale flying geometry')
    cw, ch = geometry['cell_size']
    if (width, height) != (cw * count, ch):
        raise ValueError('Flying sheet geometry mismatch')
    frames = [b''.join(pixels[(y*width+i*cw)*4:(y*width+(i+1)*cw)*4] for y in range(ch)) for i in range(count)]
    validate_frames(frames, [200/count]*count, [cw,ch])
    digest = hashlib.sha256(artwork).hexdigest()
    identity = json.loads(verdict.read_text()) if verdict else {}
    accepted = identity.get('status') == 'accepted' and identity.get('designer') == 'Juniper' and identity.get('atlas_sha256') == digest and identity.get('geometry') == geometry
    if verdict and not accepted:
        raise ValueError('Requires acceptance of corrected flying pixels and geometry')
    joins = accepted and identity.get('joins') == 'accepted'
    lock = output / '.publication.lock'
    with lock.open('x') as handle:
        handle.write(str(os.getpid()))
    try:
        manifest = json.loads((output / 'manifest.json').read_text())
        if canonical != decode(output / manifest['fallback']['file']):
            raise ValueError('Flying reference differs from accepted canonical')
        idle_names = {f['sheet'] for k,f in manifest['frames'].items() if k.startswith('I')}
        manifest['sheets'] = {k:v for k,v in manifest['sheets'].items() if k in idle_names}
        for name in idle_names:
            if hashlib.sha256((output/name).read_bytes()).hexdigest() != manifest['sheets'][name]['sha256']:
                raise ValueError('Current idle atlas hash mismatch')
        name = digest + '-flying.webp'
        manifest['sheets'][name] = {'width': width, 'height': height, 'sha256': digest}
        manifest['frames'] = {k:v for k,v in manifest['frames'].items() if k.startswith('I')}
        manifest['frames'].update({f'W{i}': {'sheet':name,'x':i*cw,'y':0,'width':cw,'height':ch,
            'anchor':geometry['anchor'],'canonical_anchor':geometry['canonical_anchor']} for i in range(count)})
        manifest['rows']['flying'] = {'row':1,'count':count,'available':bool(joins),
            'acceptance':'accepted' if accepted else 'pending','joins':'accepted' if joins else 'pending',
            'cell_size':[cw,ch],'anchor':geometry['anchor'],'canonical_anchor':geometry['canonical_anchor']}
        manifest['clips']['flap'] = {'frames':[f'W{i}' for i in range(count)],'durations':[200/count]*count,
            'loop':True,'restFrame':'I0','terminalFrame':f'W{count-1}'}
        with tempfile.TemporaryDirectory(dir=output) as directory:
            stage = Path(directory)
            target = output/name
            if target.exists() and target.read_bytes() != artwork:
                raise ValueError('Immutable artwork name collision')
            if not target.exists():
                (stage/name).write_bytes(artwork)
                (stage/name).replace(target)
            (stage/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
            (stage/'manifest.json').replace(output/'manifest.json')
    finally:
        lock.unlink()


def publish_flying(evidence, output, verdict=None):
    """Merge row one against the current idle under the publication lock."""
    # Snapshot includes the report under the same processing lock as its pixels.
    artwork, (width, height, atlas), canonical, report = snapshot_evidence(evidence)
    geometry = report.get('transform', {})
    if 'cell_size' in geometry:
        return publish_landmark_flying(evidence, output, artwork, (width, height, atlas), canonical, geometry, report['cells'], verdict)
    if (width, height) != (1024, 672) or any(atlas[:1024 * 112 * 4]) or any(atlas[1024 * 224 * 4:]):
        raise ValueError('Invalid flying evidence atlas')
    candidates = [b''.join(atlas[((y + 112) * 1024 + i * 128) * 4:((y + 112) * 1024 + i * 128 + 128) * 4]
                           for y in range(112)) for i in range(8)]
    count = next((i for i, frame in enumerate(candidates) if not any(frame)), 8)
    frames = candidates[:count]
    if any(any(frame) for frame in candidates[count:]):
        raise ValueError('Noncontiguous flying cells')
    validate_frames(frames)
    validate_frames(frames, [200 / count] * count)
    identity = json.loads(verdict.read_text()) if verdict else {}
    digest = hashlib.sha256(artwork).hexdigest()
    accepted = identity.get('status') == 'accepted' and identity.get('designer') == 'Juniper' and identity.get('atlas_sha256') == digest
    if verdict and not accepted:
        raise ValueError('Requires Juniper loop acceptance of these pixels')
    joins = accepted and identity.get('joins') == 'accepted'
    lock = output / '.publication.lock'
    with lock.open('x') as handle:
        handle.write(str(os.getpid()))
    try:
        manifest = json.loads((output / 'manifest.json').read_text())
        if canonical != decode(output / manifest['fallback']['file']):
            raise ValueError('Flying reference differs from current accepted canonical')
        idle_sheet = manifest['frames']['I0']['sheet']
        old_bytes = (output / idle_sheet).read_bytes()
        if hashlib.sha256(old_bytes).hexdigest() != manifest['sheets'][idle_sheet]['sha256']:
            raise ValueError('Current idle atlas hash mismatch')
        bw, bh, base = decode(output / idle_sheet)
        if (bw, bh) != (1024, 672) or any(base[1024 * 224 * 4:]):
            raise ValueError('Invalid current atlas')
        with tempfile.TemporaryDirectory(dir=output) as directory:
            stage = Path(directory)
            write_image(stage / 'atlas.webp', compose(frames, row=1, base=base), 1024, 672)
            combined = (stage / 'atlas.webp').read_bytes()
            combined_hash = hashlib.sha256(combined).hexdigest()
            name = combined_hash + '-idle.webp'
            manifest['sheets'] = {name: {'width': 1024, 'height': 672, 'sha256': combined_hash}}
            manifest['frames'] = {key: {**frame, 'sheet': name} for key, frame in manifest['frames'].items() if key.startswith('I')}
            manifest['frames'].update({f'W{i}': {'sheet': name, 'x': i * 128, 'y': 112, 'width': 128, 'height': 112} for i in range(count)})
            manifest['clips']['flap'] = {'frames': [f'W{i}' for i in range(count)], 'durations': [200 / count] * count,
                                        'loop': True, 'restFrame': 'I0', 'terminalFrame': f'W{count - 1}'}
            manifest['rows']['flying'] = {'row': 1, 'count': count, 'available': bool(joins),
                                         'acceptance': 'accepted' if accepted else 'pending',
                                         'joins': 'accepted' if joins else 'pending'}
            (stage / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
            target = output / name
            if target.exists():
                if target.read_bytes() != combined:
                    raise ValueError('Immutable artwork name collision')
            else:
                (stage / 'atlas.webp').replace(target)
            (stage / 'manifest.json').replace(output / 'manifest.json')
    finally:
        lock.unlink()


def publish_runtime(evidence, output, verdict=None, row='idle'):
    """Immutable artwork first, atomic manifest last; pending art stays disabled."""
    if row == 'flying':
        return publish_flying(evidence, output, verdict)
    artwork, (width, height, atlas), canonical, report = snapshot_evidence(evidence)
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
        current = output / 'manifest.json'
        if current.exists() and json.loads(current.read_text()).get('rows', {}).get('flying', {}).get('count', 0):
            raise ValueError('Idle-only publication would discard flying; use row-aware composition')
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


def process(source, output, row='idle', count=COUNT, shared=None, reference=None):
    """Build review evidence privately; never installs or enables a runtime row."""
    output.mkdir(parents=True, exist_ok=True)
    lock = output / ".processing.lock"
    # Exclusive writers. On interruption the lock remains as a diagnostic;
    # remove it only after confirming its writer is gone.
    with lock.open("x") as handle:
        handle.write(str(os.getpid()))
    try:
        if row == 'flying' and (reference is None or shared is None):
            raise ValueError('Flying requires canonical reference and shared transform')
        if row == 'flying' and shared.get('reference_sha256') != hashlib.sha256(reference.read_bytes()).hexdigest():
            raise ValueError('Shared transform canonical reference mismatch')
        frames, transform = extract(*decode(source), count=count,
                                    registration='shared-transform' if row == 'flying' else 'idle-bounds', shared=shared)
        durations = [200 / count] * count if row == 'flying' else DURATIONS
        cell_size = transform.get("cell_size", [WIDTH, HEIGHT])
        report = validate_frames(frames, durations, cell_size)
        with tempfile.TemporaryDirectory(dir=output) as staging:
            stage = Path(staging)
            if row == 'flying' and 'cell_size' in transform:
                cw, ch = cell_size
                packed = b''.join(b''.join(f[y*cw*4:(y+1)*cw*4] for f in frames) for y in range(ch))
                write_image(stage / 'atlas.webp', packed, cw * count, ch)
            else:
                write_image(stage / "atlas.webp", compose(frames, row=1 if row == 'flying' else 0), 1024, 672)
            for index, frame in enumerate(frames):
                write_image(stage / f"{index}.png", frame, *cell_size)
            canonical = decode(reference) if row == 'flying' else (128, 112, frames[0])
            if canonical[:2] != (128, 112):
                raise ValueError('Invalid canonical')
            write_image(stage / 'canonical.png', canonical[2], 128, 112)
            # Comparison GIF is deliberately slower. Exact 200ms diagnostic is
            # browser-only, avoiding GIF's centisecond quantisation.
            preview_views(stage, [140] * count if row == 'flying' else durations)
            (stage / "validation.json").write_text(json.dumps({**report, "row": row, "transform": transform,
                "comparison_durations_ms": [140] * count if row == 'flying' else durations,
                "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                "atlas_sha256": hashlib.sha256((stage / 'atlas.webp').read_bytes()).hexdigest()}, indent=2) + "\n")
            publish_evidence(stage, output)
    finally:
        lock.unlink()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["prepare", "process", "publish"])
    parser.add_argument("--source", type=Path)
    parser.add_argument("--verdict", type=Path)
    parser.add_argument("--reference", type=Path, default=REFERENCE)
    parser.add_argument('--row', choices=['idle', 'flying'], default='idle')
    parser.add_argument('--count', type=int, default=COUNT)
    parser.add_argument('--transform', type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "idle-strip")
    args = parser.parse_args()
    if args.command == "prepare":
        prepare(args.output, args.reference)
    elif args.command == 'process':
        if not args.source:
            parser.error("process requires --source")
        process(args.source, args.output, args.row, args.count,
                json.loads(args.transform.read_text()) if args.transform else None, args.reference)
    else:
        if not args.source:
            parser.error('publish requires --source evidence directory')
        publish_runtime(args.source, args.output, args.verdict, args.row)
