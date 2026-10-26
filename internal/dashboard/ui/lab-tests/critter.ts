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
// hand, each with an underside, named `<wing>-arm` and `<wing>-hand`. A
// wing on a skeleton places each picture by its own matrix.
export const wings = (page: Page, wing: string) => big(page).locator(`image[href*="${wing}-arm"], image[href*="${wing}-hand"]`).evaluateAll((els) =>
  els.map((el) => `${el.getAttribute('transform') ?? el.closest('g')?.parentElement?.parentElement?.getAttribute('transform')} ${el.getAttribute('visibility') ?? 'visible'}`));

// Where one picture lay over another as the animal was drawn (a head over
// its body at the neck), how far the edge of either there has come out from
// under the other, in drawing units, at each of the lab's addresses `at`:
// past a little, the join opens into a notch. Read off the pictures' own
// pixels, which only a browser decodes.
export const seamOpening = (page: Page, over: string, under: string, at: readonly string[]) => page.evaluate(async ({ over, under, at }) => {
  const picture = (name: string) => {
    const el = document.querySelector<SVGImageElement>(`[data-stage] [data-critter] image[href*="${name}"]`);
    if (!el) throw new Error(`no ${name} drawn at ${location.hash}`);
    return el;
  };
  // A picture's opaque pixels, and its box in drawing units.
  const maskOf = async (el: SVGImageElement) => {
    const image = new Image();
    image.src = el.getAttribute('href') ?? '';
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const g = canvas.getContext('2d');
    if (!g) throw new Error('no canvas');
    g.drawImage(image, 0, 0);
    const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
    const n = (k: string) => Number(el.getAttribute(k) ?? 0);
    return { w: canvas.width, h: canvas.height, solid: Array.from({ length: canvas.width * canvas.height }, (_, i) => data[i * 4 + 3] >= 128), box: { x: n('x'), y: n('y'), width: n('width'), height: n('height') } };
  };
  type Mask = Awaited<ReturnType<typeof maskOf>>;
  type Point = { x: number; y: number };
  const solidAt = (m: Mask, p: Point) => {
    const i = Math.floor(((p.x - m.box.x) / m.box.width) * m.w), j = Math.floor(((p.y - m.box.y) / m.box.height) * m.h);
    return i >= 0 && j >= 0 && i < m.w && j < m.h && m.solid[j * m.w + i];
  };
  const centre = (m: Mask, k: number): Point => ({ x: m.box.x + (((k % m.w) + 0.5) / m.w) * m.box.width, y: m.box.y + ((Math.floor(k / m.w) + 0.5) / m.h) * m.box.height });
  const edge = (m: Mask) => m.solid.flatMap((solid, k) => {
    const [i, j] = [k % m.w, Math.floor(k / m.w)];
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => !m.solid[(j + dj) * m.w + i + di] || i + di < 0 || i + di >= m.w || j + dj < 0 || j + dj >= m.h);
    return solid && open ? [centre(m, k)] : [];
  });
  const [top, bottom] = [await maskOf(picture(over)), await maskOf(picture(under))];
  // Each one's edge where the other covered it as drawn, and the other's
  // whole edge, the nearest of it how far that has come out.
  const pairs = [
    { edge: edge(top).filter((p) => solidAt(bottom, p)), from: over, to: under, mask: bottom, rim: edge(bottom) },
    { edge: edge(bottom).filter((p) => solidAt(top, p)), from: under, to: over, mask: top, rim: edge(top) },
  ];
  const opened = (pair: (typeof pairs)[number]) => {
    // From one picture's drawing units into the other's, as posed now.
    const onScreen = (name: string) => {
      const m = picture(name).getScreenCTM();
      if (!m) throw new Error(`${name} not placed`);
      return DOMMatrix.fromMatrix(m);
    };
    const into = onScreen(pair.to).inverse().multiply(onScreen(pair.from));
    const placed = (p: Point) => {
      const q = into.transformPoint(new DOMPoint(p.x, p.y));
      return { x: q.x, y: q.y };
    };
    return Math.max(0, ...pair.edge.map(placed).filter((p) => !solidAt(pair.mask, p)).map((p) => Math.min(...pair.rim.map((c) => Math.hypot(c.x - p.x, c.y - p.y)))));
  };
  const next = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const found: { at: string; by: number }[] = [];
  for (const address of at) {
    location.hash = address;
    await next();
    found.push({ at: address, by: Math.max(...pairs.map(opened)) });
  }
  return found;
}, { over, under, at });
