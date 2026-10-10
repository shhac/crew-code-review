import type { Locator } from '@playwright/test';

// Where an animal's drawing (the union of its pictures) overlaps the page's
// content: rendered text, controls, charts. Cards' own boxes are not content;
// an animal may stand into their empty edges. `parts` picks what in each
// element is drawn (its pictures, by default; a bow's strokes too, say); an
// element that is itself one of them (an arrow, a heart) counts whole.
// slack is how far a drawing may reach into content and still not count.
export function coveredContent(animals: Locator, parts = 'image', slack = 0): Promise<string[]> {
  return animals.evaluateAll((els, [parts, slack]) => {
    const main = document.querySelector('main');
    if (!main) return [];
    const content: { name: string; r: DOMRect }[] = [];
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) content.push({ name: `text "${node.textContent.trim().slice(0, 20)}"`, r });
    }
    main.querySelectorAll('svg, canvas, button, input, textarea, select').forEach((el) => content.push({ name: el.tagName.toLowerCase(), r: el.getBoundingClientRect() }));
    type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };
    const overlap = (a: Box, b: Box) => a.left < b.right - slack && b.left < a.right - slack && a.top < b.bottom - slack && b.top < a.bottom - slack && b.width > 0 && b.height > 0;
    // What of a picture shows: its box cut to every rect clip-path on it or
    // around it (an egg is drawn sunk below its ledge and clipped at the
    // line). A box ignores clipping, so without this a hidden egg on a ledge
    // with a control right under its line reads as covering the control.
    const lineage = (el: Element | null): Element[] => (el ? [el, ...lineage(el.parentElement)] : []);
    const clipBox = (at: Element): Box | null => {
      const id = at.getAttribute('clip-path')?.match(/^url\(#(.+)\)$/)?.[1];
      const shape = id ? document.getElementById(id)?.firstElementChild : null;
      const m = at instanceof SVGGraphicsElement && shape instanceof SVGRectElement ? at.getScreenCTM() : null;
      if (!m || !(shape instanceof SVGRectElement)) return null;
      const corner = (x: number, y: number) => new DOMPoint(x, y).matrixTransform(m);
      const a = corner(shape.x.baseVal.value, shape.y.baseVal.value);
      const b = corner(shape.x.baseVal.value + shape.width.baseVal.value, shape.y.baseVal.value + shape.height.baseVal.value);
      return { left: Math.min(a.x, b.x), right: Math.max(a.x, b.x), top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y), width: 0, height: 0 };
    };
    const shown = (picture: Element): Box => {
      const box = picture.getBoundingClientRect();
      const cut = lineage(picture).flatMap((at) => clipBox(at) ?? []).reduce((c, clip) => ({
        left: Math.max(c.left, clip.left), right: Math.min(c.right, clip.right), top: Math.max(c.top, clip.top), bottom: Math.min(c.bottom, clip.bottom),
      }), { left: box.left, right: box.right, top: box.top, bottom: box.bottom });
      return { ...cut, width: Math.max(0, cut.right - cut.left), height: Math.max(0, cut.bottom - cut.top) };
    };
    return els.flatMap((el) => {
      const drawn = el.matches(parts) ? [el] : Array.from(el.querySelectorAll(parts));
      const pictures = drawn.map(shown).filter((p) => p.width > 0 && p.height > 0);
      return content.filter((c) => pictures.some((p) => overlap(p, c.r))).map((c) => `${el.getAttribute('data-id') ?? el.tagName.toLowerCase()} over ${c.name}`);
    });
  }, [parts, slack] as const);
}
