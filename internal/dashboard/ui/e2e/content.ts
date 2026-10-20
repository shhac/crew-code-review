import type { Page } from '@playwright/test';

// What to check: the elements (a selector), and what in each is drawn (its
// pictures, say, or a bow's strokes too); an element that is itself one of
// them (an arrow, a heart) counts whole.
export type Drawn = readonly [elements: string, parts: string];

// Boxes a drawing must keep out of besides the content (the cards' own
// boxes, for a flier that keeps off them, or the whole rail, for one that
// never crosses it), each with its own slack: none unless given.
export type Region = { name: string; boxes: string; slack?: number };

// How long to watch for, and what may stop it sooner: selectors met in turn,
// each in the frame its predecessor was or a later one (a gull seen diving,
// then one calling).
export type Watch = { ms: number; slack?: number; until?: readonly string[]; keepOut?: readonly Region[] };

// What a watch saw: every drawing over the content or into a region, each
// watched element's kind and kind-and-mode (its `data-gull="dive"` reads as
// "gull" and "gull dive"), and whether `until` was met.
export type Watched = { covered: string[]; seen: string[]; done: boolean };

// Where the drawings overlap the page's content (rendered text, controls,
// charts, and the rail's links, brand and identity chip: the overlay sits
// above the rail, so a flier crossing it covers them, while the shelf's air
// between them is open sky) at every animation frame for `ms`. Cards' own
// boxes are not content; an animal may stand into their empty edges. slack
// is how far a drawing may reach into content and still not count. Walking
// every text range is most of the cost, so the content is measured again
// only when the page under the drawings changes.
export function watchFrames(page: Page, groups: readonly Drawn[], { ms, slack = 1, until = [], keepOut = [] }: Watch): Promise<Watched> {
  return page.evaluate(({ groups, ms, slack, until, keepOut }) => new Promise<Watched>((resolve) => {
    const main = document.querySelector('main');
    const measure = () => {
      const boxes: { name: string; r: DOMRect; slack: number }[] = [];
      if (main) {
        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent?.trim()) continue;
          range.selectNodeContents(node);
          for (const r of Array.from(range.getClientRects())) boxes.push({ name: `text "${node.textContent.trim().slice(0, 20)}"`, r, slack });
        }
        main.querySelectorAll('svg, canvas, button, input, textarea, select').forEach((el) => boxes.push({ name: el.tagName.toLowerCase(), r: el.getBoundingClientRect(), slack }));
      }
      document.querySelectorAll('.rail nav a, .rail .brand, .rail .viewer-chip').forEach((el) => boxes.push({ name: `rail ${el.matches('a') ? `link "${el.textContent?.trim()}"` : el.className.split(' ')[0]}`, r: el.getBoundingClientRect(), slack }));
      for (const region of keepOut) document.querySelectorAll(region.boxes).forEach((el) => boxes.push({ name: region.name, r: el.getBoundingClientRect(), slack: region.slack ?? 0 }));
      return boxes;
    };
    const content = { boxes: measure(), stale: false };
    const restale = () => { content.stale = true; };
    const changes = new MutationObserver(restale);
    const resizes = new ResizeObserver(restale);
    for (const el of [main, document.querySelector('.rail nav')]) if (el) changes.observe(el, { childList: true, subtree: true, characterData: true });
    for (const el of [main, document.querySelector('.rail')]) if (el) resizes.observe(el);
    window.addEventListener('resize', restale);

    type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };
    const overlap = (a: Box, b: Box, slack: number) => a.left < b.right - slack && b.left < a.right - slack && a.top < b.bottom - slack && b.top < a.bottom - slack && b.width > 0 && b.height > 0;
    // What of a picture shows: its box cut to every clip on it or around
    // it, a rect clip-path (an egg is drawn sunk below its ledge and clipped
    // at the line) or a CSS inset (July's fliers are clipped at the rail's
    // edge, so a bird past it is behind the rail). A box ignores clipping, so
    // without this a hidden egg on a ledge with a control right under its
    // line reads as covering the control.
    const lineage = (el: Element | null): Element[] => (el ? [el, ...lineage(el.parentElement)] : []);
    const rectClip = (at: Element): Box | null => {
      const id = at.getAttribute('clip-path')?.match(/^url\(#(.+)\)$/)?.[1];
      const shape = id ? document.getElementById(id)?.firstElementChild : null;
      const m = at instanceof SVGGraphicsElement && shape instanceof SVGRectElement ? at.getScreenCTM() : null;
      if (!m || !(shape instanceof SVGRectElement)) return null;
      const corner = (x: number, y: number) => new DOMPoint(x, y).matrixTransform(m);
      const a = corner(shape.x.baseVal.value, shape.y.baseVal.value);
      const b = corner(shape.x.baseVal.value + shape.width.baseVal.value, shape.y.baseVal.value + shape.height.baseVal.value);
      return { left: Math.min(a.x, b.x), right: Math.max(a.x, b.x), top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y), width: 0, height: 0 };
    };
    const insetClip = (at: Element): Box | null => {
      const inset = getComputedStyle(at).clipPath.match(/^inset\(([^)]*)\)$/)?.[1].split(/\s+/).map(parseFloat);
      if (!inset) return null;
      const [top, right = top, bottom = top, left = right] = inset;
      const b = at.getBoundingClientRect();
      return { left: b.left + left, right: b.right - right, top: b.top + top, bottom: b.bottom - bottom, width: 0, height: 0 };
    };
    const shown = (picture: Element): Box => {
      const box = picture.getBoundingClientRect();
      const cut = lineage(picture).flatMap((at) => [rectClip(at), insetClip(at)].flatMap((c) => c ?? [])).reduce((c, clip) => ({
        left: Math.max(c.left, clip.left), right: Math.min(c.right, clip.right), top: Math.max(c.top, clip.top), bottom: Math.min(c.bottom, clip.bottom),
      }), { left: box.left, right: box.right, top: box.top, bottom: box.bottom });
      return { ...cut, width: Math.max(0, cut.right - cut.left), height: Math.max(0, cut.bottom - cut.top) };
    };
    // An element's kind and mode: its own data attribute (`data-gull`),
    // leaving out the id and pose every rig carries.
    const kindOf = (el: Element) => Array.from(el.attributes).find((a) => a.name.startsWith('data-') && a.name !== 'data-id' && a.name !== 'data-pose');
    const labelOf = (el: Element) => {
      const kind = kindOf(el);
      return `${el.getAttribute('data-id') ?? kind?.name.slice(5) ?? el.tagName.toLowerCase()}${kind?.value ? ` (${kind.value})` : ''}`;
    };

    const covered = new Set<string>();
    const seen = new Set<string>();
    const met = { steps: 0 };
    const start = performance.now();
    const finish = (done: boolean) => {
      changes.disconnect();
      resizes.disconnect();
      window.removeEventListener('resize', restale);
      resolve({ covered: [...covered], seen: [...seen], done });
    };
    const look = () => {
      if (content.stale) Object.assign(content, { boxes: measure(), stale: false });
      for (const [elements, parts] of groups) {
        for (const el of Array.from(document.querySelectorAll(elements))) {
          const kind = kindOf(el);
          if (kind) seen.add(kind.name.slice(5));
          if (kind?.value) seen.add(`${kind.name.slice(5)} ${kind.value}`);
          const drawn = el.matches(parts) ? [el] : Array.from(el.querySelectorAll(parts));
          const pictures = drawn.filter((p) => getComputedStyle(p).visibility !== 'hidden').map(shown).filter((p) => p.width > 0 && p.height > 0);
          for (const c of content.boxes) if (pictures.some((p) => overlap(p, c.r, c.slack))) covered.add(`${labelOf(el)} over ${c.name}`);
        }
      }
      while (met.steps < until.length && document.querySelector(until[met.steps])) met.steps++;
      if (until.length && met.steps === until.length) return finish(true);
      if (performance.now() - start >= ms) return finish(false);
      requestAnimationFrame(look);
    };
    look();
  }), { groups, ms, slack, until, keepOut });
}

// What the drawings cover right now: one look.
export async function coveredContent(page: Page, groups: readonly Drawn[], slack = 0): Promise<string[]> {
  return (await watchFrames(page, groups, { ms: 0, slack })).covered;
}
