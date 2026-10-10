import type { Scene } from '../scenes';
import SeasideLayer from './SeasideLayer.svelte';
import SeasideShelf from './SeasideShelf.svelte';

export default { Shelf: SeasideShelf, Layer: SeasideLayer } satisfies Scene;
