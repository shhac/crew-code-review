// The fête table on the rail's shelf, in the stage's own pixels: the stage
// is 168 by 72, the table's art stands on a cloth along its foot. The two
// places the wasps use are measured from the art by design-docs/fete/
// export.py (as fractions of its box), so regenerated art means measuring
// them again.

export const STAGE = { width: 168, height: 72 } as const;
// The art's box on the stage: its display size, standing on the cloth.
export const ART = { left: 0, top: 6.5, width: 168, height: 59.5 } as const;
// The cloth's top edge, which the art stands on.
export const CLOTH = 63;

// The middle of the cake's sugared top, and how far either side of it a wasp
// may stand.
export const CAKE = { x: 76.1, y: 11.9, half: 23 } as const;
// The top of the blackcurrant jar's gingham lid, and its half-width.
export const JAR = { x: 155.2, y: 32.5, half: 6.9 } as const;
