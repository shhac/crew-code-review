"""Verified, staged shelf export. EWA filtering weights color by alpha."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
SOURCE_HASH = 'f7303d27bca1cae483f35e978aa101ae5996e40625bdecec36c8ba4b150f4dc7'
LAYERS = {'tree': (60, 60, 784, 784, 166 / 784, 5, 176, 166),
          'presents': (900, 364, 832, 456, 132 / 456, (248 - 832 * 132 / 456) / 2, 248, 132)}
BULBS = [(54.85, 71.21), (79.47, 66.83), (102.54, 55.92), (68.32, 94.95),
         (101.25, 102.75), (127.55, 103.67), (79.79, 127.36)]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def decode(path):
    size = tuple(map(int, subprocess.check_output(['magick', str(path), '-format', '%w %h', 'info:']).split()))
    rgba = subprocess.check_output(['magick', str(path), '-colorspace', 'sRGB', '-depth', '8', 'rgba:-'])
    return size, rgba

def validate(name, path):
    size, rgba = decode(path)
    w, h = LAYERS[name][-2:]
    if size != (w, h):
        raise ValueError('wrong dimensions')
    alpha = rgba[3::4]
    if not any(alpha) or not any(0 < a < 255 for a in alpha):
        raise ValueError('empty or opaque artwork')
    if any(alpha[x] or alpha[(h-1)*w+x] for x in range(w)) or any(alpha[y*w] or alpha[y*w+w-1] for y in range(h)):
        raise ValueError('clipped artwork or missing margins')
    return rgba

def verify(name, path, manifest):
    validate(name, path)
    if sha(path) != manifest['outputs'][path.name]:
        raise ValueError('asset hash changed: shifted or altered artwork')

def promote(source, destination):
    temporary = destination.with_suffix(destination.suffix + '.temporary')
    shutil.copyfile(source, temporary)
    temporary.replace(destination)

def export(root=ROOT, runtime=None, run=subprocess.run):
    source = root / 'originals/christmas-shelf-generated-original.png'
    if sha(source) != SOURCE_HASH:
        raise ValueError('source hash changed')
    if subprocess.check_output(['cwebp', '-version'], text=True).splitlines()[0] != '1.6.0':
        raise RuntimeError('requires cwebp 1.6.0')
    if not subprocess.check_output(['magick', '-version'], text=True).startswith('Version: ImageMagick 7.1.2-32 Q16-HDRI'):
        raise RuntimeError('requires ImageMagick 7.1.2-32 Q16-HDRI')
    size, rgba = decode(source)
    if size != (1774, 887) or not any(0 < a < 255 for a in rgba[3::4]):
        raise ValueError('invalid source alpha')
    commands = []
    with tempfile.TemporaryDirectory(prefix='.shelf-', dir=root) as temporary:
        stage = Path(temporary)
        for name, (x, y, cw, ch, scale, dx, w, h) in LAYERS.items():
            for i, a in enumerate(rgba[3::4]):
                px, py = i % 1774, i // 1774
                if a and ((px < 887) == (name == 'tree')) and not (x <= px < x+cw and y <= py < y+ch):
                    raise ValueError(f'{name}: source crop clips alpha')
            png, webp = stage / f'{name}.png', stage / f'{name}.webp'
            command = ['magick', str(source), '-crop', f'{cw}x{ch}+{x}+{y}', '+repage', '-colorspace', 'sRGB', '-virtual-pixel', 'transparent', '-filter', 'Triangle', '-define', f'distort:viewport={w}x{h}+0+0', '+distort', 'AffineProjection', f'{scale},0,0,{scale},{dx},0', '-depth', '8', '-strip', '-define', 'png:color-type=6', str(png)]
            run(command, check=True)
            commands.append(command)
            command = ['cwebp', '-lossless', '-q', '100', '-m', '6', '-exact', '-metadata', 'none', str(png), '-o', str(webp)]
            run(command, check=True)
            commands.append(command)
            if validate(name, png) != validate(name, webp):
                raise ValueError('lossless RGBA mismatch')
        if sha(source) != SOURCE_HASH:
            raise ValueError('source changed during export')
        manifest = {'source_sha256': SOURCE_HASH, 'commands': commands, 'bulbs_native': BULBS, 'anchors': {'tree': [88,166], 'presents': [124,132]}, 'outputs': {p.name: sha(p) for p in stage.iterdir()}}
        (root / 'aligned').mkdir(exist_ok=True)
        for path in stage.iterdir():
            promote(path, root / 'aligned' / path.name)
        if runtime:
            for name in LAYERS:
                promote(stage / f'{name}.webp', runtime / f'{name}.webp')
        for path in stage.iterdir():
            if sha(root / 'aligned' / path.name) != manifest['outputs'][path.name]:
                raise ValueError('concurrent modification invalidated aligned output')
        if runtime:
            for name in LAYERS:
                if sha(runtime / f'{name}.webp') != manifest['outputs'][f'{name}.webp']:
                    raise ValueError('concurrent modification invalidated runtime output')
        manifest_path = root / '2026-10-03-shelf-manifest.json'
        temporary_manifest = manifest_path.with_suffix('.temporary')
        temporary_manifest.write_text(json.dumps(manifest, indent=2) + '\n')
        temporary_manifest.replace(manifest_path)

if __name__ == '__main__':
    export(runtime=ROOT.parents[1] / 'internal/dashboard/ui/src/lib/theme/christmas')
