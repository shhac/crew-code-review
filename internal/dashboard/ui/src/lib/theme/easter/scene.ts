import type { Scene } from '../scenes';
import EasterLayer from './EasterLayer.svelte';
import EasterShelf from './EasterShelf.svelte';

export default { Shelf: EasterShelf, Layer: EasterLayer } satisfies Scene;
