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
from art import crop, export, feature, fill_only, keyed, poses, rows  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/aurora'
FOX = ['fox-curled', 'fox-alert', 'fox-trot', 'fox-bow', 'fox-pounce']
# The poses still shipped: curled up, asleep or looking up. Standing and
# moving, the fox is put together from PARTS, on legs: fox-haunch.png from
# hip to knee (shoulder to elbow), the upper piece of fox-legs.png for the
# bones below, standing on fox-toes.png.
SHIPPED = ['fox-curled', 'fox-alert']
PARTS = ['fox-tail', 'fox-torso', 'fox-head']
# The eye's size in drawing units, and file pixels per drawing unit.
EYE = 1.544
RES = 12
# Where each sheet's eye is (source pixels), measured by eye: the sheet's
# trotting fox stands for its scale.
EYES = {'fox-sheet.png': (1187, 416), 'fox-parts.png': (1895, 386)}
# In drawing units: the legs' thickness below the haunch, outline included;
# the haunch's at its thick end (the hind legs'; the forelegs draw it
# thinner); and the toes' length. A fox stands on its toes; the leg comes
# down onto their back (HEEL, as fractions of their box).
LEG = 1.9
HAUNCH = 3.2
TOES = 3.0
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
    for name, art in zip(PARTS, (crop(p) for p in poses(keyed(HERE / 'fox-parts.png'), len(PARTS)))):
        units[name] = export(art, OUT, name, on_eye('fox-parts.png'))
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
