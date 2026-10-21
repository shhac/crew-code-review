import { writable } from 'svelte/store';

// The scarecrow's one message to the page: it has started flapping. The
// shelf sends it as each flapping episode starts, and again with a later
// `until` while strokes keep adding flaps; the layer scatters the crows on
// a new `at` and keeps them away until well after `until`. The layer never
// reads the shelf's geometry, and the shelf never draws on the page.

// When the episode started and when its flapping now ends (performance.now()
// time, as every frame's), and the scarecrow's middle in the viewport. A
// test's cue (`early`) has no flapping to wait out: each crow it scatters
// stays away its wait less early, counted from when it leaves the page.
export type Alarm = { at: number; until: number; x: number; y: number; early?: number };

export const alarm = writable<Alarm | null>(null);
