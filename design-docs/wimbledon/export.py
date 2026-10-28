# /// script
# dependencies = ["pillow==12.3.0", "numpy==2.5.4"]
# ///
"""Keys, crops and exports the summer tennis art. Run: uv run design-docs/wimbledon/export.py

The steps are shared with the other themes (../art.py). The shelf's kit is
exported at twice its display size.

Both birds are put on one scale in drawing units, the eye's (each bird's own
eye, so every pose of it is the same animal), at RES file pixels per unit,
and the rigs set one page size for a unit, so the hawk is the size it should
be beside the pigeons (1.6 times as long). The pigeon's parts are cut from
pigeon-standing-2.png (its anatomy reference) into pigeon-parts.png and
placed where they sat in it, the body from its redraw with the rump and
undertail coverts kept (pigeon-body-3.png); its neck piece is cut from
between the body and the head laid together, each then cut short of it;
its leg pieces, cut from its own legs, are in pigeon-limbs.png; its flight
wings and fanned tail in pigeon-wings.png. The hawk only flies, so its parts are cut from its glide,
hawk-pose-glide-2.png, into hawk-parts.png and placed on the glide; its
wings are in hawk-wings.png, each wing piece stood span up as the bird kit
draws one. The sizes printed are what the rigs lay out.
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import EyeScale, Neck, by_colour, crop, cut, export, feature, keyed, knobbed, rescaled, span_up, wristed  # noqa: E402
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
PIGEON_EYES = {'pigeon-standing-2.png': (1082, 199), 'pigeon-parts.png': (1925, 298), 'pigeon-body-3.png': (1302, 432)}
PIGEON_POSES = {
    'alert': (1012, 131), 'peck': (1194, 727), 'walk-thrust': (1273, 238), 'walk-hold': (1086, 265),
    'takeoff': (1100, 374), 'flight-down': (1164, 298), 'flight-up': (1168, 455), 'land': (1006, 378),
}
HAWK_EYES = {'hawk-pose-glide-2.png': (995, 620), 'hawk-parts.png': (1140, 370)}
HAWK_POSES = {'flap-down': (986, 400), 'flap-up': (971, 764)}
PIGEON_PARTS = ['pigeon-body', 'pigeon-wing', 'pigeon-tail', 'pigeon-head']
# pigeon-parts.png's body stopped short behind, where the reference's folded
# wing hid the rump, so a notch showed between the tail's root and the
# belly; the body is cut from pigeon-body-3.png instead, redrawn with its
# rear running back over the tail's root, beside the same head.
BODY_SHEET = ['pigeon-body', 'pigeon-head']
HAWK_PARTS = ['hawk-body', 'hawk-head', 'hawk-tail']
# The pieces left to right in pigeon-limbs.png (its first, a neck piece, no
# longer used: see NECK), and how thick each bar is drawn, outline
# included, in drawing units, measured from the reference: the feathered
# tibiotarsus where it leaves the belly, and the bare coral tarsometatarsus
# below the ankle.
LIMBS = ['pigeon-neck', 'pigeon-thigh', 'pigeon-shank', 'pigeon-foot', 'pigeon-foot-curled']
THICK = {'pigeon-thigh': 1.7, 'pigeon-shank': 0.45}
# Where the neck is parted from the body and from the head (art.py's Neck),
# in the drawings' ink; the two are laid together 23 by 19 units.
NECK = Neck(body=((13.9, 6.3), (19.9, 8.4)), head=((14.8, 4.4), (19.3, 5.0)), sides=(13.5, 20.5), ink=(22, 24, 30), size=(23, 19))
# Feet: length in drawing units (the reference's near foot, hallux tip to
# middle claw), and where on them (fractions of their box) the shank comes
# down, where the toes part. Each keeps of the shank drawn above that only a
# knob round it (art.py's knobbed), KNOB across in drawing units, outlined
# KNOB_LINE thick: the shank's own bar draws the rest.
FEET = {'pigeon-foot': (4.7, (0.34, 0.3)), 'pigeon-foot-curled': (2.8, (0.45, 0.26))}
KNOB = 0.3
KNOB_LINE = 0.06
WINGS = ['arm', 'hand', 'arm-under', 'hand-under']
# A wing's hand (wrist to tip) is about half the bird's length: a pigeon's
# wing (31 to 34cm of its 62 to 68cm span) is as long as the bird, a Harris's
# hawk's a little shorter (103 to 120cm of span on a 46 to 59cm bird); the
# primaries are about half of it. The arm is drawn on the same scale.
PIGEON_HAND = 10.0
HAWK_HAND = 15.3
# How far each arm runs on past its wrist, from its top (the rigs' WING), to
# be faded out there (art.py's wristed).
PIGEON_PAST = 1.2
HAWK_PAST = 1.6


def wings(sheet: str, prefix: str, hand: float, past: float, names: list[str]) -> dict[str, np.ndarray]:
    """The wing pieces of sheet, stood span up, all on the scale that makes
    the hand hand units long, the arm's faded out past units beyond its
    wrist. The rig shades the far wing itself."""
    pieces = cut(keyed(HERE / sheet), names)
    scale = hand * RES / pieces['hand'].shape[1]
    for name in WINGS:
        piece = span_up(pieces[name])
        if name.startswith('arm'):
            piece = wristed(piece, past, RES / scale)
        w, h = export(piece, OUT, f'{prefix}-{name}', scale)
        print(f'{prefix}-{name}: {w / RES:.2f}x{h / RES:.2f}')
    return pieces


def where(pigeon: EyeScale, art: np.ndarray, sheet: str) -> tuple[float, float]:
    """Where a part sat in the reference, its top left in drawing units."""
    y, x = pigeon.find(rescaled(art, pigeon.px(pigeon.standing_sheet) / pigeon.px(sheet)), by_colour)
    return x / pigeon.per_unit() + pigeon.margin, y / pigeon.per_unit() + pigeon.margin


def parted(pigeon: EyeScale, body: np.ndarray, head: np.ndarray) -> np.ndarray:
    """Writes the body and the head with the neck taken off each, printing
    where each sat, and gives back the two laid together where they sat,
    whole, at the neck's working pixels a unit."""
    sheets = {'pigeon-body': (body, 'pigeon-body-3.png'), 'pigeon-head': (head, 'pigeon-parts.png')}
    parts = []
    for name, (art, sheet) in sheets.items():
        at = where(pigeon, art, sheet)
        per_unit = pigeon.px(sheet) / PIGEON_EYE
        kept = NECK.body_cut(art, at, per_unit) if name == 'pigeon-body' else NECK.head_kept(art, at, per_unit)
        w, h = export(kept, OUT, name, pigeon.on_eye(sheet))
        print(f'{name}: {pigeon.units((w, h))} at {at[0]:.2f}, {at[1]:.2f}')
        parts.append((art, at, per_unit))
    return NECK.laid(parts)


def neck(pigeon: EyeScale, whole: np.ndarray) -> None:
    """Writes the neck piece between the body and the head, outlined and as
    fur alone, cut from the two laid together, and prints where it sat."""
    outlined, fur, top = NECK.pieces(whole)
    for name, piece in {'pigeon-neck': outlined, 'pigeon-neck-fur': fur}.items():
        w, h = export(piece, OUT, name, RES / NECK.work)
    print(f'pigeon-neck: {pigeon.units((w, h))} at {NECK.sides[0]:.2f}, {top:.2f}')


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
    parts = cut(keyed(HERE / 'pigeon-parts.png'), PIGEON_PARTS)
    body = cut(keyed(HERE / 'pigeon-body-3.png'), BODY_SHEET)['pigeon-body']
    pigeon.parts({name: parts[name] for name in ['pigeon-wing', 'pigeon-tail']}, 'pigeon-parts.png', OUT, mask=by_colour)
    neck(pigeon, parted(pigeon, body, parts['pigeon-head']))
    limbs = cut(keyed(HERE / 'pigeon-limbs.png'), LIMBS)
    for name, thick in THICK.items():
        pigeon.bar(name, limbs[name], OUT, thick)
    for name, (length, heel) in FEET.items():
        per_unit = limbs[name].shape[1] / length
        pigeon.foot(name, knobbed(limbs[name], heel, KNOB * per_unit, KNOB_LINE * per_unit), OUT, length, heel)
    flight = wings('pigeon-wings.png', 'pigeon', PIGEON_HAND, PIGEON_PAST, [*WINGS, 'tail-fan'])
    # The fanned tail as long as the closed one.
    closed = parts['pigeon-tail']
    length = closed.shape[1] * pigeon.on_eye('pigeon-parts.png')
    w, h = export(flight['tail-fan'], OUT, 'pigeon-tail-fan', length / flight['tail-fan'].shape[1])
    print(f'pigeon-tail-fan: {w / RES:.2f}x{h / RES:.2f}')

    hawk = EyeScale(HERE, HAWK_EYES, HAWK_EYE, RES, measure=lambda path, seed: feature(path, seed, HAWK_DARK))
    for sheet in HAWK_EYES:
        print(f'{sheet}: eye {hawk.px(sheet):.1f}px')
    hawk.reference('hawk-pose-glide-2.png', LAB, 'hawk-pose-glide')
    hawk.key_poses('hawk-pose-', HAWK_POSES, LAB)
    hawk.parts(cut(keyed(HERE / 'hawk-parts.png'), HAWK_PARTS), 'hawk-parts.png', OUT, mask=by_colour)
    wings('hawk-wings.png', 'hawk', HAWK_HAND, HAWK_PAST, WINGS)


if __name__ == '__main__':
    main()
