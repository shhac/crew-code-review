import type { Scene } from '../scenes';
import HarvestLayer from './HarvestLayer.svelte';
import HarvestShelf from './HarvestShelf.svelte';

export default { Shelf: HarvestShelf, Layer: HarvestLayer } satisfies Scene;
