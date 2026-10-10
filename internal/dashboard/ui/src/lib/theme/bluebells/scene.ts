import type { Scene } from '../scenes';
import BluebellsLayer from './BluebellsLayer.svelte';
import BluebellsShelf from './BluebellsShelf.svelte';

export default { Shelf: BluebellsShelf, Layer: BluebellsLayer } satisfies Scene;
