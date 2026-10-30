/** mulberry32: returns [value in 0..1, next state]. Pure, so sim state stays serialisable and replays match. */
export function rand(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) | 0;
  let r = Math.imul(next ^ (next >>> 15), 1 | next);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, next];
}
