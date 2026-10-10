import type { Scene } from '../scenes';
import AuroraLayer from './AuroraLayer.svelte';
import AuroraShelf from './AuroraShelf.svelte';

export default { Shelf: AuroraShelf, Layer: AuroraLayer } satisfies Scene;
