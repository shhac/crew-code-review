import { expect, test } from '@playwright/test';
import { big, decoded, legBones, seamOpening, wings } from './critter';

// The bird kit's birds in the critters lab, each held to the same things:
// every part decodes, it steps on two legs (if it walks at all), flaps with
// its wings turning over, holds still under reduced motion, names a bird's
// joints, and its key poses lie over it.

type Bird = {
  animal: string;
  // What its wing pictures are named after (see wings).
  wing: string;
  // The mode it walks in; the hawk only flies.
  walk?: string;
  flap: string;
  // A mode it holds still in under reduced motion.
  still: string;
  // A frame whose drawing is named in the address and the drawing it shows,
  // then each mode's button and that mode's drawing.
  drawings: { at: string; shows: string; modes: readonly (readonly [mode: string, drawing: string])[] };
};

const BIRDS: readonly Bird[] = [
  {
    animal: 'crow', wing: 'crow-wing', walk: 'walk', flap: 'flap', still: 'peck',
    drawings: {
      at: 'mode=walk&frame=10&ref=walk', shows: 'crow-pose-walk',
      modes: [['peck', 'crow-pose-peck'], ['alert', 'crow-pose-alert'], ['take-off', 'crow-pose-takeoff-2'], ['flap', 'crow-pose-flight-up-2'], ['flare', 'crow-pose-land-2'], ['stand', 'crow-reference']],
    },
  },
  {
    animal: 'gull', wing: 'gull', walk: 'strut', flap: 'flap', still: 'flap',
    drawings: {
      at: 'mode=strut&frame=10&ref=walk%20contact', shows: 'gull-pose-walk-contact',
      modes: [['take-off', 'gull-pose-takeoff'], ['flap', 'gull-pose-flap-up'], ['stoop', 'gull-pose-swoop'], ['flare', 'gull-pose-flare-2'], ['stand', 'gull-reference']],
    },
  },
  {
    animal: 'pigeon', wing: 'pigeon', walk: 'walk', flap: 'fly', still: 'walk',
    drawings: {
      at: 'mode=walk&frame=10&ref=walk%2C%20thrust', shows: 'pigeon-pose-walk-thrust',
      modes: [['peck', 'pigeon-pose-peck'], ['alert', 'pigeon-pose-alert'], ['take-off', 'pigeon-pose-takeoff'], ['fly', 'pigeon-pose-flight-down'], ['land', 'pigeon-pose-land'], ['stand', 'pigeon-reference']],
    },
  },
  {
    animal: 'hawk', wing: 'hawk', flap: 'flap', still: 'flap',
    drawings: { at: 'mode=glide&frame=10&ref=glide', shows: 'hawk-pose-glide', modes: [['flap', 'hawk-pose-flap-down']] },
  },
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
});

for (const bird of BIRDS) {
  test.describe(bird.animal, () => {
    const { animal, walk } = bird;
    if (walk) {
      test(`the ${animal} steps on two legs in its ${walk}, every part decoded`, async ({ page }) => {
        await page.goto(`/lab/critters.html#animal=${animal}&mode=${walk}`);
        await expect(big(page)).toBeVisible();
        const sizes = await decoded(page);
        expect(sizes.length).toBeGreaterThanOrEqual(10);
        expect(sizes.every((n) => n > 0)).toBe(true);
        const first = await legBones(page);
        await expect.poll(() => legBones(page)).not.toEqual(first);
      });

      test(`the ${animal} names a bird's joints`, async ({ page }) => {
        await page.goto(`/lab/critters.html#animal=${animal}&mode=stand&frame=0&guides=1`);
        for (const joint of ['hip', 'knee', 'intertarsal joint (ankle)', 'toes (metatarsophalangeal joint)']) {
          await expect(page.locator('[data-stage]').getByText(joint, { exact: true }).first()).toBeAttached();
        }
      });
    }

    test(`the ${animal} flaps, its wings turning over between strokes, every part decoded`, async ({ page }) => {
      await page.goto(`/lab/critters.html#animal=${animal}&mode=${bird.flap}`);
      await expect(big(page)).toBeVisible();
      const sizes = await decoded(page);
      expect(sizes.length).toBeGreaterThanOrEqual(10);
      expect(sizes.every((n) => n > 0)).toBe(true);
      // Both sides of both pieces of both wings are always drawn.
      await expect(big(page).locator(`image[href*="${bird.wing}-arm"], image[href*="${bird.wing}-hand"]`)).toHaveCount(8);
      const first = await wings(page, bird.wing);
      await expect.poll(() => wings(page, bird.wing)).not.toEqual(first);
    });

    test(`the ${animal} holds still under reduced motion, whatever it was doing`, async ({ page }) => {
      await page.goto(`/lab/critters.html#animal=${animal}&mode=${bird.still}&still=1`);
      await expect(big(page)).toBeVisible();
      const first = await big(page).innerHTML();
      await page.waitForTimeout(400);
      expect(await big(page).innerHTML()).toEqual(first);
      await expect(big(page).locator('[data-lid]')).toHaveCount(0);
    });

    test(`the ${animal} has its drawings to lay over it, each mode its own`, async ({ page }) => {
      const drawing = page.locator(`[data-stage] image[href*="${animal}-pose"], [data-stage] image[href*="${animal}-reference"]`);
      await page.goto(`/lab/critters.html#animal=${animal}&${bird.drawings.at}`);
      await expect(drawing).toHaveAttribute('href', new RegExp(bird.drawings.shows));
      for (const [mode, shows] of bird.drawings.modes) {
        await page.getByRole('button', { name: mode, exact: true }).click();
        await expect(drawing).toHaveAttribute('href', new RegExp(shows));
      }
    });
  });
}

// Where the crow's neck lay under its head and over its body as it was
// drawn, each one's edge stays near the other as it walks, skips and
// stands alert: before it had a neck of its own, its head bobbed along the
// body with nothing under it, its throat hackles and nape sliding nearly
// 2 units over the breast. Pecking, the neck swings down whole from its
// base with the head, as the head alone did, and comes out further from
// under the body's shoulders. Drawing units are page pixels (crow-rig.ts's
// SCALE is 1).
test('the crow\'s head stays on its neck, and its neck on its body', async ({ page }) => {
  test.setTimeout(240000);
  await page.goto('/lab/critters.html#animal=crow&mode=walk&frame=0');
  await expect(big(page)).toBeVisible();
  const frames = (modes: readonly string[]) => modes.flatMap((mode) => Array.from({ length: 30 }, (_, i) => `animal=crow&mode=${mode}&frame=${i * 2}`));
  const widest = (found: readonly { at: string; by: number }[]) => found.reduce((a, b) => (b.by > a.by ? b : a));
  const standing = frames(['walk', 'sidle', 'alert', 'stand']);
  const head = widest(await seamOpening(page, 'crow-head', 'crow-neck', [...standing, ...frames(['peck'])]));
  expect(head.by, head.at).toBeLessThan(0.3);
  const neck = widest(await seamOpening(page, 'crow-neck', 'crow-body', standing));
  expect(neck.by, neck.at).toBeLessThan(1.2);
  const pecking = widest(await seamOpening(page, 'crow-neck', 'crow-body', frames(['peck'])));
  expect(pecking.by, pecking.at).toBeLessThan(2);
});
