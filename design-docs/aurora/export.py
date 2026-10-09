# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Keys, crops and exports the northern lights art. Run: uv run design-docs/aurora/export.py

The steps are shared with the other themes (../art.py). The winter kit is
exported at twice its display size. The fox's pictures (curled up, looking
up, and the parts it is put together from) are all put on one scale, the
eye's, so every pose is the same animal; they are written at RES pixels per
drawing unit, and fox-rig.ts sets how big a drawing unit is on the page.
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import crop, export, feature, fill_only, keyed, place, poses, rows  # noqa: E402
from PIL import Image  # noqa: E402
import numpy as np  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/aurora'
LAB = HERE.parents[1] / 'internal/dashboard/ui/src/lab'
FOX = ['fox-curled', 'fox-alert', 'fox-trot', 'fox-bow', 'fox-pounce']
# The poses still shipped: curled up, asleep or looking up. Standing and
# moving, the fox is put together from PARTS, cut from fox-standing.png (the
# whole fox standing square, its anatomy reference) into fox-parts-2.png, on
# legs: fox-haunch.png from hip to knee (shoulder to elbow), the upper piece
# of fox-legs.png for the bones below, standing on fox-toes.png, all sized to
# the reference's legs.
SHIPPED = ['fox-curled', 'fox-alert']
PARTS = ['fox-tail', 'fox-torso', 'fox-head']
# Drawing units are the reference's, moved by this, so a frame round it has
# a margin.
MARGIN = 1
# The eye's size in drawing units, and file pixels per drawing unit.
EYE = 1.544
RES = 12
# Where each sheet's eye is (source pixels), measured by eye: the sheet's
# trotting fox stands for its scale.
EYES = {'fox-sheet.png': (1187, 416), 'fox-standing.png': (1290, 330), 'fox-parts-2.png': (1800, 335)}
# Key poses of the same fox, drawn from fox-standing.png, that the rig's
# poses are tuned toward; the lab lays each over its mode. Where each one's
# eye is (source pixels), measured by eye.
KEY_POSES = {
    'trot-reach': (1280, 322), 'trot-pass': (1274, 322), 'crouch': (1320, 534),
    'bow': (1235, 566), 'pounce': (1294, 496), 'dig': (1242, 704),
}
# In drawing units: the legs' thickness below the haunch, outline included;
# the haunch's at its thick end (the hind legs'; the forelegs draw it
# thinner); and the toes' length. A fox stands on its toes; the leg comes
# down onto their back (HEEL, as fractions of their box).
LEG = 2.1
HAUNCH = 3.3
TOES = 3.3
HEEL = (0.3, 0.3)


def on_eye(sheet: str) -> float:
    return EYE / feature(HERE / sheet, EYES[sheet]) * RES


def main() -> None:
    kit = crop(keyed(HERE / 'winter-kit.png'))
    size = export(kit, OUT, 'winter-kit', 2 * 62 / kit.shape[0])
    print(f'winter-kit: display {size[0] / 2:g}x{size[1] / 2:g}')
    units = {}
    for name, art in zip(FOX, (crop(p) for p in poses(keyed(HERE / 'fox-sheet.png'), len(FOX)))):
        if name in SHIPPED:
            units[name] = export(art, OUT, name, on_eye('fox-sheet.png'))
    # The reference, for the lab to lay over the rig, and where each part sat
    # in it: their places in the rig.
    reference = crop(keyed(HERE / 'fox-standing.png'))
    per_unit = feature(HERE / 'fox-standing.png', EYES['fox-standing.png']) / EYE
    units['fox-reference'] = export(reference, LAB, 'fox-reference', on_eye('fox-standing.png'))
    ground = np.nonzero((reference[..., 3] > 128).any(axis=1))[0].max()
    print(f'fox-reference: at {MARGIN}, {MARGIN}; ground {ground / per_unit + MARGIN:.2f}')
    for name, seed in KEY_POSES.items():
        path = HERE / f'fox-pose-{name}.png'
        art = crop(keyed(path))
        w, h = export(art, LAB, f'fox-pose-{name}', EYE / feature(path, seed) * RES)
        print(f'fox-pose-{name}: drawing units {w / RES:.2f}x{h / RES:.2f}')
    for name, art in zip(PARTS, (crop(p) for p in poses(keyed(HERE / 'fox-parts-2.png'), len(PARTS)))):
        units[name] = export(art, OUT, name, on_eye('fox-parts-2.png'))
        k = feature(HERE / 'fox-standing.png', EYES['fox-standing.png']) / feature(HERE / 'fox-parts-2.png', EYES['fox-parts-2.png'])
        img = Image.fromarray(art, 'RGBA')
        y, x = place(np.asarray(img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)), reference)
        print(f'{name}: at {x / per_unit + MARGIN:.2f}, {y / per_unit + MARGIN:.2f}')
    # Each piece also as fur alone, its outline taken out.
    bone, _ = (crop(p) for p in rows(keyed(HERE / 'fox-legs.png'), 2))
    units['fox-leg'] = export(bone, OUT, 'fox-leg', LEG * RES / bone.shape[0])
    units['fox-leg-fur'] = export(fill_only(bone), OUT, 'fox-leg-fur', LEG * RES / bone.shape[0])
    haunch = crop(keyed(HERE / 'fox-haunch.png'))
    units['fox-haunch'] = export(haunch, OUT, 'fox-haunch', HAUNCH * RES / haunch.shape[0])
    units['fox-haunch-fur'] = export(fill_only(haunch), OUT, 'fox-haunch-fur', HAUNCH * RES / haunch.shape[0])
    toes = crop(keyed(HERE / 'fox-toes.png'))
    w, h = export(toes, OUT, 'fox-toes', TOES * RES / toes.shape[1])
    export(fill_only(toes), OUT, 'fox-toes-fur', TOES * RES / toes.shape[1])
    print(f'fox-toes: {w / RES:.2f}x{h / RES:.2f}, heel {w * HEEL[0] / RES:.2f}, {h * HEEL[1] / RES:.2f}')
    for name, (w, h) in units.items():
        print(f'{name}: {w}x{h}, drawing units {w / RES:.2f}x{h / RES:.2f}')


if __name__ == '__main__':
    main()
