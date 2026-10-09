import type { Locator } from '@playwright/test';

// Where an animal's drawing (the union of its pictures) overlaps the page's
// content: rendered text, controls, charts. Cards' own boxes are not content;
// an animal may stand into their empty edges.
export function coveredContent(animals: Locator): Promise<string[]> {
  return animals.evaluateAll((els) => {
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
    const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom && b.width > 0 && b.height > 0;
    return els.flatMap((el) => {
      const pictures = Array.from(el.querySelectorAll('image')).map((i) => i.getBoundingClientRect());
      return content.filter((c) => pictures.some((p) => overlap(p, c.r))).map((c) => `${el.getAttribute('data-id')} over ${c.name}`);
    });
  });
}
