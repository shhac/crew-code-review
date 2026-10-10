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
from art import EyeScale, crop, cut, export, export_with_fur, keyed, rows  # noqa: E402

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


def main() -> None:
    kit = crop(keyed(HERE / 'winter-kit.png'))
    size = export(kit, OUT, 'winter-kit', 2 * 62 / kit.shape[0])
    print(f'winter-kit: display {size[0] / 2:g}x{size[1] / 2:g}')
    fox = EyeScale(HERE, EYES, EYE, RES)
    units = {}
    for name, art in cut(keyed(HERE / 'fox-sheet.png'), FOX).items():
        if name in SHIPPED:
            units[name] = export(art, OUT, name, fox.on_eye('fox-sheet.png'))
    units['fox-reference'] = fox.reference('fox-standing.png', LAB, 'fox-reference')
    fox.key_poses('fox-pose-', KEY_POSES, LAB)
    units.update(fox.parts(cut(keyed(HERE / 'fox-parts-2.png'), PARTS), 'fox-parts-2.png', OUT))
    # Each piece also as fur alone, its outline taken out.
    bone, _ = (crop(p) for p in rows(keyed(HERE / 'fox-legs.png'), 2))
    units['fox-leg'] = units['fox-leg-fur'] = export_with_fur(bone, OUT, 'fox-leg', LEG * RES / bone.shape[0])
    haunch = crop(keyed(HERE / 'fox-haunch.png'))
    units['fox-haunch'] = units['fox-haunch-fur'] = export_with_fur(haunch, OUT, 'fox-haunch', HAUNCH * RES / haunch.shape[0])
    fox.foot('fox-toes', crop(keyed(HERE / 'fox-toes.png')), OUT, TOES, HEEL)
    for name, (w, h) in units.items():
        print(f'{name}: {w}x{h}, drawing units {w / RES:.2f}x{h / RES:.2f}')


if __name__ == '__main__':
    main()
