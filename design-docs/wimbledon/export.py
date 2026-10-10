# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Keys, crops and exports the summer tennis art. Run: uv run design-docs/wimbledon/export.py

The steps are shared with the other themes (../art.py). The shelf's kit is
exported at twice its display size.

Both birds are put on one scale in drawing units, the eye's (each bird's own
eye, so every pose of it is the same animal), at RES file pixels per unit,
and the rigs set one page size for a unit, so the hawk is the size it should
be beside the pigeons (1.6 times as long). The pigeon's parts are cut from
pigeon-standing-2.png (its anatomy reference) into pigeon-parts.png and
placed where they sat in it; its leg and neck pieces, cut from its own legs
and neck, are in pigeon-limbs.png; its flight wings and fanned tail in
pigeon-wings.png. The hawk only flies, so its parts are cut from its glide,
hawk-pose-glide-2.png, into hawk-parts.png and placed on the glide; its
wings are in hawk-wings.png, each wing piece stood span up as the bird kit
draws one. The sizes printed are what the rigs lay out.
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import EyeScale, by_colour, crop, cut, export, export_with_fur, feature, keyed  # noqa: E402
import numpy as np  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/wimbledon'
LAB = HERE.parents[1] / 'internal/dashboard/ui/src/lab'
RES = 12
# The pigeon's eye (its black pupil, the blob art.py's feature finds) is one
# drawing unit across, which makes the standing pigeon about 20 units long.
PIGEON_EYE = 1.0
# The hawk's pupil, in the same units: the glide drawing is then 1.6 times
# the standing pigeon's length (31.8 units against 19.9), as a Harris's hawk
# (46 to 59cm) is beside a feral pigeon (30 to 35cm). Its plumage is dark
# brown, so only what is darker still counts as the pupil.
HAWK_EYE = 1.8
HAWK_DARK = 90
# Where each sheet's eye is (source pixels), measured by eye.
PIGEON_EYES = {'pigeon-standing-2.png': (1082, 199), 'pigeon-parts.png': (1925, 298)}
PIGEON_POSES = {
    'alert': (1012, 131), 'peck': (1194, 727), 'walk-thrust': (1273, 238), 'walk-hold': (1086, 265),
    'takeoff': (1100, 374), 'flight-down': (1164, 298), 'flight-up': (1168, 455), 'land': (1006, 378),
}
HAWK_EYES = {'hawk-pose-glide-2.png': (995, 620), 'hawk-parts.png': (1140, 370)}
HAWK_POSES = {'flap-down': (986, 400), 'flap-up': (971, 764)}
PIGEON_PARTS = ['pigeon-body', 'pigeon-wing', 'pigeon-tail', 'pigeon-head']
HAWK_PARTS = ['hawk-body', 'hawk-head', 'hawk-tail']
# The leg and neck pieces, left to right in pigeon-limbs.png, and how thick
# each is drawn, outline included, in drawing units, measured from the
# reference: the neck, the feathered tibiotarsus where it leaves the belly,
# and the bare coral tarsometatarsus below the ankle.
LIMBS = ['pigeon-neck', 'pigeon-thigh', 'pigeon-shank', 'pigeon-foot', 'pigeon-foot-curled']
THICK = {'pigeon-neck': 3.6, 'pigeon-thigh': 1.7, 'pigeon-shank': 0.45}
# Feet: length in drawing units (the reference's near foot, hallux tip to
# middle claw), and where on them (fractions of their box) the shank comes
# down.
FEET = {'pigeon-foot': (4.7, (0.34, 0.3)), 'pigeon-foot-curled': (2.8, (0.4, 0.15))}
WINGS = ['arm', 'hand', 'arm-under', 'hand-under']
# A wing's hand (wrist to tip) is about half the bird's length: a pigeon's
# wing (31 to 34cm of its 62 to 68cm span) is as long as the bird, a Harris's
# hawk's a little shorter (103 to 120cm of span on a 46 to 59cm bird); the
# primaries are about half of it. The arm is drawn on the same scale.
PIGEON_HAND = 10.0
HAWK_HAND = 15.3


def spanUp(piece: np.ndarray) -> np.ndarray:
    """A wing piece drawn lying down, root left and leading edge on top,
    stood up as the bird kit draws one: span up the picture, root at the
    bottom, leading edge on the right."""
    return np.ascontiguousarray(np.rot90(piece, 1)[:, ::-1])


def wings(sheet: str, prefix: str, hand: float, names: list[str]) -> dict[str, np.ndarray]:
    """The wing pieces of sheet, stood span up, all on the scale that makes
    the hand hand units long. The rig shades the far wing itself."""
    pieces = cut(keyed(HERE / sheet), names)
    scale = hand * RES / pieces['hand'].shape[1]
    for name in WINGS:
        w, h = export(spanUp(pieces[name]), OUT, f'{prefix}-{name}', scale)
        print(f'{prefix}-{name}: {w / RES:.2f}x{h / RES:.2f}')
    return pieces


def main() -> None:
    OUT.mkdir(exist_ok=True)
    # Display heights in page pixels, and how many file pixels to each.
    for name, source, height, density in [('summer-kit', 'summer-kit-2.png', 55, 2)]:
        art = crop(keyed(HERE / source))
        w, h = export(art, OUT, name, density * height / art.shape[0])
        print(f'{name}: display {w / density:g}x{h / density:g}')

    pigeon = EyeScale(HERE, PIGEON_EYES, PIGEON_EYE, RES)
    for sheet in PIGEON_EYES:
        print(f'{sheet}: eye {pigeon.px(sheet):.1f}px')
    pigeon.reference('pigeon-standing-2.png', LAB, 'pigeon-reference')
    pigeon.key_poses('pigeon-pose-', PIGEON_POSES, LAB)
    pigeon.parts(cut(keyed(HERE / 'pigeon-parts.png'), PIGEON_PARTS), 'pigeon-parts.png', OUT, mask=by_colour)
    limbs = cut(keyed(HERE / 'pigeon-limbs.png'), LIMBS)
    for name, thick in THICK.items():
        w, h = export_with_fur(limbs[name], OUT, name, thick * RES / limbs[name].shape[0])
        print(f'{name}: {w / RES:.2f}x{h / RES:.2f}')
    for name, (length, heel) in FEET.items():
        pigeon.foot(name, limbs[name], OUT, length, heel)
    flight = wings('pigeon-wings.png', 'pigeon', PIGEON_HAND, [*WINGS, 'tail-fan'])
    # The fanned tail as long as the closed one.
    closed = cut(keyed(HERE / 'pigeon-parts.png'), PIGEON_PARTS)['pigeon-tail']
    length = closed.shape[1] * pigeon.on_eye('pigeon-parts.png')
    w, h = export(flight['tail-fan'], OUT, 'pigeon-tail-fan', length / flight['tail-fan'].shape[1])
    print(f'pigeon-tail-fan: {w / RES:.2f}x{h / RES:.2f}')

    hawk = EyeScale(HERE, HAWK_EYES, HAWK_EYE, RES, measure=lambda path, seed: feature(path, seed, HAWK_DARK))
    for sheet in HAWK_EYES:
        print(f'{sheet}: eye {hawk.px(sheet):.1f}px')
    hawk.reference('hawk-pose-glide-2.png', LAB, 'hawk-pose-glide')
    hawk.key_poses('hawk-pose-', HAWK_POSES, LAB)
    hawk.parts(cut(keyed(HERE / 'hawk-parts.png'), HAWK_PARTS), 'hawk-parts.png', OUT, mask=by_colour)
    wings('hawk-wings.png', 'hawk', HAWK_HAND, WINGS)


if __name__ == '__main__':
    main()
