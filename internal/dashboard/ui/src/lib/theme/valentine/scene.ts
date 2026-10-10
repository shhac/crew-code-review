import type { Scene } from '../scenes';
import ValentineLayer from './ValentineLayer.svelte';
import ValentineShelf from './ValentineShelf.svelte';

export default { Shelf: ValentineShelf, Layer: ValentineLayer } satisfies Scene;
