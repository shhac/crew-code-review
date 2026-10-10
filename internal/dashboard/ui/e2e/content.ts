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
    const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right - slack && b.left < a.right - slack && a.top < b.bottom - slack && b.top < a.bottom - slack && b.width > 0 && b.height > 0;
    return els.flatMap((el) => {
      const drawn = el.matches(parts) ? [el] : Array.from(el.querySelectorAll(parts));
      const pictures = drawn.map((i) => i.getBoundingClientRect());
      return content.filter((c) => pictures.some((p) => overlap(p, c.r))).map((c) => `${el.getAttribute('data-id') ?? el.tagName.toLowerCase()} over ${c.name}`);
    });
  }, [parts, slack] as const);
}
