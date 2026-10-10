import type { Scene } from '../scenes';
import ChristmasLayer from './ChristmasLayer.svelte';
import ChristmasShelf from './ChristmasShelf.svelte';

export default { Shelf: ChristmasShelf, Layer: ChristmasLayer } satisfies Scene;
