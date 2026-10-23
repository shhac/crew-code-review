import type { Locator, Page } from '@playwright/test';

// The critters lab's big animal, and what its specs read off it.

export const big = (page: Page) => page.locator('[data-stage] [data-critter]');

// Each leg bone's transform: they change as the legs step. An animal built
// on a skeleton marks each of its legs' pieces itself.
export const legBones = (page: Page) => big(page).locator('[data-legs] image, image[data-leg]').evaluateAll((els) => els.map((el) => el.getAttribute('transform')));

// Each picture's decoded size in pixels (the animal's parts unless other
// pictures are given): nought for one that drew nothing.
export const decoded = (page: Page, images: Locator = big(page).locator('image')) => images.evaluateAll((els) => Promise.all(els.map(async (el) => {
  const image = new Image();
  image.src = el.getAttribute('href')!;
  await image.decode();
  return image.naturalWidth * image.naturalHeight;
})));

// Each wing picture's group transform and whether it is seen: its arm and
// hand, each with an underside, named `<wing>-arm` and `<wing>-hand`.
export const wings = (page: Page, wing: string) => big(page).locator(`image[href*="${wing}-arm"], image[href*="${wing}-hand"]`).evaluateAll((els) =>
  els.map((el) => `${el.closest('g')?.parentElement?.parentElement?.getAttribute('transform')} ${el.getAttribute('visibility') ?? 'visible'}`));
