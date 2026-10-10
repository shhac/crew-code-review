import type { Scene } from '../scenes';
import HalloweenLayer from './HalloweenLayer.svelte';
import HalloweenShelf from './HalloweenShelf.svelte';

export default { Shelf: HalloweenShelf, Layer: HalloweenLayer } satisfies Scene;
