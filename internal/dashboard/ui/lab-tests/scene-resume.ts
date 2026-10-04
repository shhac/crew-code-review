import type { Page } from '@playwright/test';

declare global {
  interface Window { atlasResume?: Promise<void> }
}

export function prepareSceneResume(reduced: boolean) {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  if (media.matches === reduced) throw new Error('Expected a motion preference change');
  window.atlasResume = new Promise(resolve => {
    media.addEventListener('change', () => {
      // The preference listener schedules the scene draw. The next frame
      // also lets its Svelte microtask flush finish regardless of listener order.
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }, { once: true });
  });
}

export async function setSceneReducedMotion(page: Pick<Page, 'evaluate' | 'emulateMedia'>, reduced: boolean) {
  await page.evaluate(prepareSceneResume, reduced);
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.evaluate(() => {
    if (!window.atlasResume) throw new Error('Resume barrier was not prepared');
    return window.atlasResume;
  });
}
