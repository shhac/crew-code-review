# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Keys, crops and exports the seaside gull's art. Run: uv run design-docs/seaside/export.py

The steps are shared with the other themes (../art.py). The gull's pictures
are all put on one scale, the eye's, so every pose is the same bird; they
are written at RES pixels per drawing unit, and gull-rig.ts sets how big a
drawing unit is on the page. It is put together from parts cut from
gull-standing.png (the whole gull standing square, its anatomy reference):
the body and head in gull-parts.png, the body as it is in flight in
gull-flight-body.png (an edit of gull-parts.png's body, in place, so on its
scale), the tail closed and fanned in gull-flight-parts.png, the spread
wing's four pieces in gull-wings.png and the leg's pieces in
gull-limbs-3.png. Each part is printed with where it sat in the reference:
its place in the rig. The sizes printed are what the rig lays out.
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from art import EyeScale, crop, cut, export, export_with_fur, keyed  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'internal/dashboard/ui/src/lib/theme/seaside'
LAB = HERE.parents[1] / 'internal/dashboard/ui/src/lab'
# The eye's size in drawing units (its pupil, the dark blob art.py's
# feature finds), and file pixels per drawing unit: the reference standing
# is then about 17 units tall, and gull-rig.ts draws it 25.5px tall.
EYE = 0.3
RES = 12
# Where each sheet's eye is (source pixels), measured by eye.
EYES = {'gull-standing.png': (1178, 147), 'gull-parts.png': (1572, 210)}
# Key poses of the same gull, drawn from gull-standing.png, that the rig's
# poses are tuned toward; the lab lays each over its mode.
KEY_POSES = {
    'walk-contact': (1178, 147), 'walk-pass': (1178, 147), 'takeoff': (1166, 428), 'flap-up': (1168, 577),
    'flap-down-2': (1222, 218), 'swoop': (1265, 538), 'flare-2': (1130, 358),
}
# The wing's pieces, each drawn flat with its span up the picture, and how
# long each is in drawing units: shoulder to tip about the gull's length
# less its bill, as a gull's wing is (span 125 to 155cm on a 55 to 67cm
# bird), the hand (the primaries) a little the longer.
WINGS = ['gull-arm', 'gull-hand', 'gull-arm-under', 'gull-hand-under']
WING_LENGTH = {'gull-arm': 10.5, 'gull-hand': 11.5, 'gull-arm-under': 10.5, 'gull-hand-under': 11.5}
# The leg's pieces, left to right in gull-limbs-3.png: the drumstick (its
# feathered end at the knee), the tarsus, the foot standing flat and the
# foot with its toes drawn together. The bars by their thickness, measured
# on the reference's near leg (the drumstick where it leaves the belly
# about 50px, the tarsus 38px, at 51.7px to a unit); the feet by their
# length (the flat foot 4.1 units from the hallux to the claws' tips,
# the curled one on the same pixel scale) and where the leg comes down onto
# each, as fractions of its box.
LIMBS = ['gull-drumstick', 'gull-tarsus', 'gull-toes', 'gull-toes-curled']
DRUMSTICK = 0.95
TARSUS = 0.74
TOES = (4.1, (0.17, 0.17))
CURLED = (0.2, 0.1)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    gull = EyeScale(HERE, EYES, EYE, RES)
    for sheet in EYES:
        print(f'{sheet}: eye {gull.px(sheet):.1f}px')
    gull.reference('gull-standing.png', LAB, 'gull-reference')
    gull.key_poses('gull-pose-', KEY_POSES, LAB)
    gull.parts(cut(keyed(HERE / 'gull-parts.png'), ['gull-body', 'gull-head']), 'gull-parts.png', OUT)
    # Edited in place from gull-parts.png, so on its scale. Matched to the
    # standing body by shape: it lost the tail and folded wingtips behind.
    flight = crop(keyed(HERE / 'gull-flight-body.png'))
    gull.placed('gull-flight-body', flight, OUT, gull.on_eye('gull-parts.png'), 1)
    # The tails, drawn at the reference's size; laid at the rump by hand.
    tails = cut(keyed(HERE / 'gull-flight-parts.png'), [None, 'gull-tail', 'gull-tail-fanned'])
    for name in ['gull-tail', 'gull-tail-fanned']:
        gull.placed(name, tails[name], OUT, gull.on_eye('gull-standing.png'), 1, None)
    wings = cut(keyed(HERE / 'gull-wings.png'), WINGS)
    for name, art in wings.items():
        w, h = export(art, OUT, name, WING_LENGTH[name] * RES / art.shape[0])
        print(f'{name}: {gull.units((w, h))}')
    limbs = cut(keyed(HERE / 'gull-limbs-3.png'), LIMBS)
    for name, thick in [('gull-drumstick', DRUMSTICK), ('gull-tarsus', TARSUS)]:
        w, h = export_with_fur(limbs[name], OUT, name, thick * RES / limbs[name].shape[0])
        print(f'{name}: {gull.units((w, h))}')
    length, heel = TOES
    gull.foot('gull-toes', limbs['gull-toes'], OUT, length, heel)
    curled = limbs['gull-toes-curled']
    gull.foot('gull-toes-curled', curled, OUT, length * curled.shape[1] / limbs['gull-toes'].shape[1], CURLED)


if __name__ == '__main__':
    main()
