export type Affine = [number, number, number, number, number, number];
const identity: Affine = [1, 0, 0, 1, 0, 0];

export const multiply = (a: Affine, b: Affine): Affine => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];

// SVG applies a list of transforms from right to left. Raster exports and
// geometric attachment checks use this same interpretation.
export function svgMatrix(transform: string) {
  let result = identity;
  for (const [, operation, values] of transform.matchAll(/(translate|rotate|scale)\(([^)]+)\)/g)) {
    const [x, y = operation === 'scale' ? x : 0, z = 0] = values.trim().split(/[ ,]+/).map(Number);
    let next: Affine;
    if (operation === 'translate') next = [1, 0, 0, 1, x, y];
    else if (operation === 'scale') next = [x, 0, 0, y, 0, 0];
    else {
      const c = Math.cos(x * Math.PI / 180), s = Math.sin(x * Math.PI / 180);
      next = [c, s, -s, c, y * (1 - c) + z * s, z * (1 - c) - y * s];
    }
    result = multiply(result, next);
  }
  return result;
}

export function transformPoint(transform: string, x: number, y: number) {
  const m = svgMatrix(transform);
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
