import type { Level } from '../sim/types';

/** Grid tile (x, y) → world position at the tile centre. Grid y maps to world z. */
export function tileToWorld(level: Level, x: number, y: number): [number, number, number] {
  return [x - level.grid.w / 2 + 0.5, 0, y - level.grid.h / 2 + 0.5];
}
