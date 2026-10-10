# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Keys, crops and exports the Easter art. Run: uv run design-docs/easter/export.py

The steps are shared with the other themes (../art.py). The basket is
exported at twice its display size; the eggs, which are tiny on the page, at
four times. Every egg is cut from one sheet at its empty column runs, so they
share one size.

The rabbit's pictures (the parts it is put together from, its leg pieces,
the standing reference and the key poses the lab lays over it) are all put
on one scale, the eye's, so every pose is the same animal; they are written
at RES pixels per drawing unit, and rabbit-rig.ts sets how big a drawing
unit is on the page. The parts are cut from rabbit-standing.png (the whole
rabbit standing on all four feet, its anatomy reference) into
rabbit-parts.png, each printed with where it sat in the reference: its place
in the rig. The leg pieces (rabbit-limbs.png) are cut from its near legs and
sized to them.
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import EyeScale, crop, cut, export, export_with_fur, keyed, lum, opaque, poses  # noqa: E402
import numpy as np  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/easter'
LAB = HERE.parents[1] / 'internal/dashboard/ui/src/lab'
# Display heights in page pixels, and file pixels to each.
BASKET = (64, 2)
EGG = (14, 4)
EGGS = 6
PARTS = ['rabbit-tail', 'rabbit-body', 'rabbit-head', 'rabbit-ears']
# The eye's size in drawing units, and file pixels per drawing unit.
EYE = 1.5
RES = 12
# Where each sheet's eye is (source pixels), measured by eye.
EYES = {'rabbit-standing.png': (1135, 370), 'rabbit-parts.png': (1080, 480)}
# Key poses of the same rabbit, drawn from rabbit-standing.png, that the
# rig's poses are tuned toward; the lab lays each over its mode. Where each
# one's eye is (source pixels), measured by eye.
KEY_POSES = {
    'sit': (1029, 369), 'alert': (900, 282), 'gather': (1080, 420), 'extend': (1197, 393),
    'groom': (957, 390), 'nudge': (1083, 621), 'thump': (1128, 435),
}
# Measured from the reference's near legs, in drawing units, outline
# included: the haunch's thickness at the hip, the hind leg's and the
# foreleg's; the hind foot's and the forepaw's length. Each foot's heel
# (where the leg comes down onto it) as fractions of its box.
HAUNCH = 3.2
HIND_LEG = 1.9
FORELEG = 1.45
FEET = {'rabbit-foot': (4.4, (0.14, 0.32)), 'rabbit-paw': (1.9, (0.24, 0.3))}


def inked(rgba: np.ndarray) -> np.ndarray:
    """The black outlines, thickened a little: what to match a part by, since
    a small part's shape alone fits anywhere inside the whole rabbit."""
    ink = opaque(rgba) & (lum(rgba) < 70)
    thick = ink.copy()
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            thick |= np.roll(np.roll(ink, dy, axis=0), dx, axis=1)
    return thick


def rabbit() -> dict:
    scale = EyeScale(HERE, EYES, EYE, RES)
    units = {'rabbit-reference': scale.reference('rabbit-standing.png', LAB, 'rabbit-reference')}
    scale.key_poses('rabbit-pose-', KEY_POSES, LAB)
    units.update(scale.parts(cut(keyed(HERE / 'rabbit-parts.png'), PARTS), 'rabbit-parts.png', OUT, mask=inked))
    # Each piece also as fur alone, its outline taken out.
    haunch, leg, foot, foreleg, paw = (crop(p) for p in poses(keyed(HERE / 'rabbit-limbs.png'), 5))
    units['rabbit-haunch'] = export_with_fur(haunch, OUT, 'rabbit-haunch', HAUNCH * RES / haunch.shape[0])
    units['rabbit-leg'] = export_with_fur(leg, OUT, 'rabbit-leg', HIND_LEG * RES / leg.shape[0])
    units['rabbit-foreleg'] = export_with_fur(foreleg, OUT, 'rabbit-foreleg', FORELEG * RES / foreleg.shape[0])
    for (name, (length, heel)), art in zip(FEET.items(), (foot, paw)):
        scale.foot(name, art, OUT, length, heel)
    return units


def main() -> None:
    OUT.mkdir(exist_ok=True)
    basket = crop(keyed(HERE / 'basket-chicks.png'))
    w, h = export(basket, OUT, 'basket', BASKET[1] * BASKET[0] / basket.shape[0])
    print(f'basket: display {w / BASKET[1]:g}x{h / BASKET[1]:g}')
    eggs = [crop(p) for p in poses(keyed(HERE / 'eggs.png'), EGGS)]
    tallest = max(e.shape[0] for e in eggs)
    for i, egg in enumerate(eggs):
        w, h = export(egg, OUT, f'egg-{i}', EGG[1] * EGG[0] / tallest)
        print(f'egg-{i}: display {w / EGG[1]:g}x{h / EGG[1]:g}')
    for name, (w, h) in rabbit().items():
        print(f'{name}: {w}x{h}, drawing units {w / RES:.2f}x{h / RES:.2f}')


if __name__ == '__main__':
    main()
