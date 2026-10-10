import type { Scene } from '../scenes';
import FeteLayer from './FeteLayer.svelte';
import FeteShelf from './FeteShelf.svelte';

export default { Shelf: FeteShelf, Layer: FeteLayer } satisfies Scene;
