import type { Level, Tile } from './types';

export type Cell = 'floor' | 'wall' | 'noWalk' | 'door';

export type Grid = {
  w: number;
  h: number;
  cells: Cell[];
};

export function idx(grid: Grid, x: number, y: number): number {
  return y * grid.w + x;
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.w && y < grid.h;
}

export function getCell(grid: Grid, x: number, y: number): Cell | null {
  return inBounds(grid, x, y) ? grid.cells[idx(grid, x, y)] : null;
}

export function gridFromLevel(level: Level): Grid {
  const { w, h } = level.grid;
  const grid: Grid = { w, h, cells: new Array<Cell>(w * h).fill('floor') };
  const mark = (tiles: Tile[], cell: Cell) => {
    for (const [x, y] of tiles) {
      if (inBounds(grid, x, y)) grid.cells[idx(grid, x, y)] = cell;
    }
  };
  mark(level.noWalk, 'noWalk');
  mark(level.fixedWalls, 'wall');
  return grid;
}

/** Name of the zone containing (x, y), or null. */
export function zoneAt(level: Level, x: number, y: number): string | null {
  for (const [name, z] of Object.entries(level.zones)) {
    if (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) return name;
  }
  return null;
}
