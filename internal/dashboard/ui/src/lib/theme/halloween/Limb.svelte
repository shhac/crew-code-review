<script lang="ts">
  // One leg, drawn with generated art: a thigh from hip to knee and a shin
  // from knee to foot, each a straight textured piece stretched and turned
  // to lie along its bone. The rounded ends overlap at the joints, so the
  // knee reads as a joint rather than a seam. Must sit inside an <svg>.
  import type { Leg, Point } from '../spidergait';
  import shinArt from './leg-shin.webp';
  import thighArt from './leg-thigh.webp';

  export let leg: Leg;
  // The same leg at rest, which settles which way its art faces.
  export let rest: Leg;

  const THIGH = 3.7;
  const SHIN = 3.4;

  // The art's gloss runs along its top edge. Turned to lie along a bone that
  // points leftward, that edge would face the floor and the leg would look
  // lit from below, so such a bone uses the art mirrored across its own
  // length, putting the gloss on the side facing the light (up and to the
  // left, as on the body). The choice is made once, from the resting pose:
  // a bone that swings through the turning point mid-stride would otherwise
  // flick between the two every few frames.
  const LIGHT = { x: -0.6, y: -0.8 };

  const facesLight = (from: Point, to: Point) => (to.y - from.y) * LIGHT.x - (to.x - from.x) * LIGHT.y >= 0;
  $: mirrorThigh = !facesLight(rest.hip, rest.knee);
  $: mirrorShin = !facesLight(rest.knee, rest.foot);

  // The piece is centred on the bone and runs half its thickness past each
  // end, so its rounded caps land on the joints.
  function bone(from: Point, to: Point, thick: number, mirrored: boolean) {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
    const mirror = mirrored ? ' scale(1 -1)' : '';
    return { width: length + thick, height: thick, offset: -thick / 2, transform: `translate(${from.x} ${from.y}) rotate(${angle})${mirror}` };
  }

  $: shin = bone(leg.knee, leg.foot, SHIN, mirrorShin);
  $: thigh = bone(leg.hip, leg.knee, THIGH, mirrorThigh);
</script>

<image href={shinArt} x={shin.offset} y={shin.offset} width={shin.width} height={shin.height} transform={shin.transform} preserveAspectRatio="none" />
<image href={thighArt} x={thigh.offset} y={thigh.offset} width={thigh.width} height={thigh.height} transform={thigh.transform} preserveAspectRatio="none" />
