import { expect, type Locator, type Page } from '@playwright/test';
import { coveredContent } from './content';

// The contract every seasonal set with animals keeps, whatever it draws:
// its palette, an overlay nobody can click or hear, enough animals for the
// page, nothing over the content as the page moves under it, and a still
// scene under reduced motion. Each set's own spec keeps only what is its own.

// The fixture pins dashboard.theme to none; this pretends the daemon
// resolved a set, as it would by the calendar or by config.
export async function serveTheme(page: Page, active: string) {
  await page.route('**/api/config', async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.theme = active;
    await route.fulfill({ response, json: config });
  });
}

export const accentOf = (page: Page) => page.locator('.brand em').evaluate((el) => getComputedStyle(el).color);

export type Width = 1440 | 1024 | 390;
export const WIDTHS: readonly Width[] = [1440, 1024, 390];

export type SeasonalSet = {
  theme: string;
  // The overlay's own attribute, as a selector.
  overlay: string;
  shelf: string;
  accent: string;
  // Each animal's rig carries `data-<animal>="<mode>"`.
  animal: string;
  // What an animal's drawing is made of, for coveredContent.
  drawn: string;
  // Ledge decorations that are always there once the page is placed.
  decoration: string;
  // Everything else the set draws on the page that must keep off the
  // content too (plants, petals, eggs, arrows), as [elements, their drawing].
  parts: readonly (readonly [string, string])[];
  // The fewest animals the overview, history and metrics pages get.
  min: Record<Width, number>;
  // The mode every animal shows under reduced motion.
  still: string;
  // How long the page must stay still before its animals are all out.
  settle: number;
};

export const SETS: readonly SeasonalSet[] = [
  {
    theme: 'aurora', overlay: '[data-aurora]', shelf: '.aurora-shelf', accent: 'rgb(114, 224, 207)',
    animal: 'fox', drawn: 'image', decoration: '.rime', parts: [], min: { 1440: 2, 1024: 2, 390: 2 }, still: 'asleep', settle: 400,
  },
  {
    // The hedgehogs come out of the woodpile one by one once the page is still.
    // Where the home has no room to walk (metrics at 1024 and narrower) they
    // only peek from the pile, one at a time.
    theme: 'bonfire', overlay: '[data-bonfire]', shelf: '.bonfire-shelf', accent: 'rgb(244, 194, 91)',
    animal: 'hedgehog', drawn: 'image', decoration: '[data-woodpile]', parts: [], min: { 1440: 2, 1024: 1, 390: 1 }, still: 'sniff', settle: 5000,
  },
  {
    // On a phone the cards fill the width, so the cupids' only open air is
    // the heading band beside the page's title, and how many fit there is up
    // to how wide the font sets the title: beside "Review history" Linux's
    // DejaVu Sans leaves room for one, macOS's system font usually for two.
    theme: 'valentine', overlay: '[data-valentine]', shelf: '.valentine-shelf', accent: 'rgb(244, 143, 184)',
    animal: 'cupid', drawn: 'image, path', decoration: '.petal',
    parts: [['.petal', 'path'], ['[data-arrow] path', 'path'], ['[data-heart]', 'path']],
    min: { 1440: 2, 1024: 2, 390: 1 }, still: 'hover', settle: 400,
  },
  {
    theme: 'hares', overlay: '[data-hares]', shelf: '.hares-shelf', accent: 'rgb(223, 160, 106)',
    animal: 'hare', drawn: 'image', decoration: '[data-plant]', parts: [['[data-plant]', 'path, ellipse']],
    min: { 1440: 2, 1024: 2, 390: 2 }, still: 'sit', settle: 400,
  },
  {
    theme: 'easter', overlay: '[data-easter]', shelf: '.easter-shelf', accent: 'rgb(196, 168, 242)',
    animal: 'rabbit', drawn: 'image', decoration: 'g[data-egg]', parts: [['g[data-egg]', 'image']],
    min: { 1440: 2, 1024: 2, 390: 2 }, still: 'sit', settle: 400,
  },
];

export const ROUTES = ['/', '/history', '/metrics', '/leaderboard', '/config', '/prompt', '/logs'];

// Where a set is known to cover content today, by its animals or by its
// other parts. Each is a bug to fix: its check runs as an expected failure,
// so it says when the bug is gone, and the contract holds everywhere else.
export type Known = { theme: string; width: Width; route: string; what: 'animals' | 'parts'; bug: string };
export const KNOWN: readonly Known[] = [
  {
    theme: 'bonfire', width: 390, route: '/config', what: 'animals',
    bug: "a sniffing hedgehog's lowered head reaches 4px below its ledge, into the config tabs under it",
  },
];
export const knownAt = (theme: string, width: Width, what: Known['what']) => KNOWN.filter((k) => k.theme === theme && k.width === width && k.what === what);

// A repeatable Math.random, so where the animals are placed, and so any
// failure, is the same every run.
export async function seedRandom(page: Page) {
  await page.addInitScript(() => {
    const state = { n: 7 };
    Math.random = () => {
      state.n = (state.n * 1664525 + 1013904223) % 4294967296;
      return state.n / 4294967296;
    };
  });
}
// The pages every width keeps room on for the set's fewest animals.
export const ROOMY = ['/', '/history', '/metrics'];

export const animals = (page: Page, set: SeasonalSet) => page.locator(`${set.overlay} [data-${set.animal}]`);

// Waits for the page's nav to finish arriving (the config adds a link, which
// moves the rail and so the ledges), then for the animals to be placed.
export async function settled(page: Page, set: SeasonalSet) {
  await expect(page.locator('.rail nav a')).toHaveCount(7);
  await page.waitForTimeout(set.settle);
}

// A drawing resting on a ledge that is also the top edge of a control (the
// config page's tabs) touches it by less than a pixel where it anti-aliases;
// that is not covering it.
const SLACK = 1;

// What the set's animals cover right now.
export const coveredByAnimals = (page: Page, set: SeasonalSet) => coveredContent(animals(page, set), set.drawn, SLACK);

// What its other parts (plants, petals, eggs, arrows) cover right now.
export async function coveredByParts(page: Page, set: SeasonalSet) {
  const parts = await Promise.all(set.parts.map(([els, of]) => coveredContent(page.locator(`${set.overlay} ${els}`), of, SLACK)));
  return parts.flat();
}

// How long the ledges take to catch up with the page once it has settled:
// on a phone the rail stacks above main and grows as the config and the feed
// arrive, which only the once-a-second remeasure notices (b-groups' R3b fix
// makes the layout watch the rail too, with its own test). The contract is
// about the page at rest, so it looks after that.
export const CATCH_UP = 1500;

// Looks at a page a few times over a couple of seconds, so moves in
// progress are caught too, returning everything ever covered.
export async function watchCovered(page: Page, look: () => Promise<string[]>, times = 3) {
  const seen = new Set<string>();
  for (let i = 0; i < times; i++) {
    if (i) await page.waitForTimeout(700);
    for (const c of await look()) seen.add(c);
  }
  return [...seen];
}

// Elements in the overlay or shelf that would catch a pointer. evaluateAll
// finds the elements and then runs on them, so one drawn only for a moment
// (a blink's lid) can be gone by then, and a removed element has no
// computed style at all; it catches nothing.
export function catching(page: Page, set: SeasonalSet) {
  const scope = `${set.overlay}, ${set.overlay} *, ${set.shelf}, ${set.shelf} *`;
  return page.locator(scope).evaluateAll((els) =>
    els.filter((el) => el.isConnected && getComputedStyle(el).pointerEvents !== 'none').map((el) => el.tagName + '.' + el.getAttribute('class')),
  );
}

// Whether a click at the element's centre lands on the decoration rather
// than the page beneath it.
export function landsOnDecoration(target: Locator, set: SeasonalSet) {
  return target.evaluate((el, within) => {
    const r = el.getBoundingClientRect();
    return !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(within);
  }, `${set.overlay}, ${set.shelf}`);
}

// What an unmoving scene looks like: each animal's mode, pose, box and
// drawing, and the drawing of its always-there decoration.
export async function sceneOf(page: Page, set: SeasonalSet) {
  return {
    animals: await animals(page, set).evaluateAll((els, animal) =>
      els.map((el) => [el.getAttribute(`data-${animal}`), el.getAttribute('data-pose'), el.getBoundingClientRect().toJSON(), el.innerHTML]), set.animal),
    decoration: await page.locator(`${set.overlay} ${set.decoration}`).evaluateAll((els) => els.slice(0, 20).map((el) => el.outerHTML)),
  };
}

export const modesOf = (page: Page, set: SeasonalSet) =>
  animals(page, set).evaluateAll((els, animal) => [...new Set(els.map((el) => el.getAttribute(`data-${animal}`)))], set.animal);
