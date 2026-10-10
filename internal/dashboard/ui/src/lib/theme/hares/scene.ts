import type { Scene } from '../scenes';
import HaresLayer from './HaresLayer.svelte';
import HaresShelf from './HaresShelf.svelte';

export default { Shelf: HaresShelf, Layer: HaresLayer } satisfies Scene;
