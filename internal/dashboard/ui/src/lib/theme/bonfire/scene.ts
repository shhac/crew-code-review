import type { Scene } from '../scenes';
import BonfireLayer from './BonfireLayer.svelte';
import BonfireShelf from './BonfireShelf.svelte';

export default { Shelf: BonfireShelf, Layer: BonfireLayer } satisfies Scene;
