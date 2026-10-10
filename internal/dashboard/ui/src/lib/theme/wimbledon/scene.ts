import type { Scene } from '../scenes';
import WimbledonLayer from './WimbledonLayer.svelte';
import WimbledonShelf from './WimbledonShelf.svelte';

export default { Shelf: WimbledonShelf, Layer: WimbledonLayer } satisfies Scene;
