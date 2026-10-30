import { buildGrid, doorAt, itemTiles, stationsOf, swingTiles, TOOL_INFO, type Design, type Orient } from './design';
import { DINING_COST, OCCUPIED_COST, RECENT_CAP, RECENT_WEIGHT } from './constants';
import { getCell, type Grid } from './grid';
import type { Level, StationKind, Tile } from './types';

/** Level + design baked into what movement needs to know. */
export type World = {
  grid: Grid;
  /** Door orientation per door tile, keyed "x,y". */
  doors: Map<string, Orient>;
  /** Hinged door tile → the floor tile its leaf sweeps. The door only opens while that tile is empty. */
  swing: Map<string, Tile>;
  /** Door tile → every tile of that door. A crate carrier fills the whole doorway while passing. */
  doorTiles: Map<string, Tile[]>;
  /** Door tile → the only direction people may pass, when the door has a one-way sign. */
  oneWay: Map<string, Tile>;
  /** Station units (fixed first, then built), each serving one person at a time on its `serve` tile. */
  units: { kind: StationKind; tile: Tile; serve: Tile }[];
  /** Hall seats in the order they fill: from the back, and in each row of seats from the far end inwards. */
  seats: Tile[];
};

/** Hall tiles that aren't aisles and weren't built over, back first. */
function seatsOf(level: Level, grid: Grid): Tile[] {
  const q = level.queue;
  if (!q) return [];
  const z = level.zones[q.hall];
  const fromAisle = (y: number) => Math.min(...q.aisleRows.map((r) => Math.abs(r - y)));
  const seats: Tile[] = [];
  for (let x = z.x; x < z.x + z.w; x++) {
    for (let y = z.y; y < z.y + z.h; y++) {
      if (!q.aisleRows.includes(y) && !q.aisleCols.includes(x) && getCell(grid, x, y) === 'floor') seats.push([x, y]);
    }
  }
  // Back = far from the hall's door wall (highest x). Far end of each column first so nobody climbs over a diner.
  return seats.sort((a, b) => b[0] - a[0] || fromAisle(b[1]) - fromAisle(a[1]) || a[1] - b[1]);
}


export const key = (x: number, y: number) => `${x},${y}`;

export function makeWorld(level: Level, design: Design): World {
  const doors = new Map<string, Orient>();
  const swing = new Map<string, Tile>();
  const doorTiles = new Map<string, Tile[]>();
  const oneWay = new Map<string, Tile>();
  for (const it of design.items) {
    if (TOOL_INFO[it.tool].sign) {
      const door = doorAt(design, it.x, it.y);
      if (!door) continue;
      const dir: Tile = door.orient === 'v' ? [it.swing, 0] : [0, it.swing];
      for (const [x, y] of itemTiles(door)) oneWay.set(key(x, y), dir);
      continue;
    }
    if (it.tool === 'wall') continue;
    const tiles = itemTiles(it);
    const sweeps = swingTiles(it);
    tiles.forEach(([x, y], i) => {
      doors.set(key(x, y), it.orient);
      doorTiles.set(key(x, y), tiles);
      if (sweeps[i]) swing.set(key(x, y), sweeps[i]);
    });
  }
  const grid = buildGrid(level, design);
  return { grid, doors, swing, doorTiles, oneWay, units: stationsOf(level, design), seats: seatsOf(level, grid) };
}

export function walkable(world: World, x: number, y: number): boolean {
  const c = getCell(world.grid, x, y);
  return c === 'floor' || c === 'door' || c === 'noWalk';
}

export function isDining(world: World, x: number, y: number): boolean {
  return getCell(world.grid, x, y) === 'noWalk';
}

/** Doors are passed straight through, never walked along. */
function doorAllows(world: World, x: number, y: number, dx: number): boolean {
  const o = world.doors.get(key(x, y));
  if (!o) return true;
  return o === 'v' ? dx !== 0 : dx === 0;
}

/**
 * Can an agent of this width step from a to b (4-neighbours)?
 * Width 2 needs the tiles beside both a and b, on the same side, to be open too:
 * a crate carrier needs a 2-wide lane.
 */
export function canStep(world: World, a: Tile, b: Tile, width: 1 | 2): boolean {
  const dx = b[0] - a[0];
  if (!walkable(world, b[0], b[1])) return false;
  if (!doorAllows(world, a[0], a[1], dx) || !doorAllows(world, b[0], b[1], dx)) return false;
  // One-way doors: entering or leaving must follow the arrow.
  const dy = b[1] - a[1];
  for (const t of [a, b]) {
    const d = world.oneWay.get(key(t[0], t[1]));
    if (d && (d[0] !== dx || d[1] !== dy)) return false;
  }
  if (width === 1) return true;
  const [px, py] = dx !== 0 ? [0, 1] : [1, 0];
  return [1, -1].some(
    (s) => walkable(world, a[0] + s * px, a[1] + s * py) && walkable(world, b[0] + s * px, b[1] + s * py),
  );
}

export const DIRS: Tile[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** What people can see of the crowd when choosing a route. */
export type Crowd = {
  /** Tiles someone else is standing on or walking into. */
  occupied: Set<string>;
  /** Recent waiting per tile (row-major, decays over time). */
  recent: number[];
  /** Tiles nobody can get through right now (people sitting down to eat). */
  blocked?: Set<string>;
};


/**
 * 4-direction A*. Returns the tiles after `from` up to and including `to`, or null. Deterministic tie-breaks.
 * With `crowd`, occupied and recently jammed tiles cost extra, so people spread over the doors.
 */
export function findPath(world: World, from: Tile, to: Tile, width: 1 | 2, crowd?: Crowd): Tile[] | null {
  const { w, h } = world.grid;
  const id = (x: number, y: number) => y * w + x;
  const goal = id(to[0], to[1]);
  const g = new Float64Array(w * h).fill(Infinity);
  const came = new Int32Array(w * h).fill(-1);
  const closed = new Uint8Array(w * h);
  const open: { i: number; f: number; order: number }[] = [];
  let order = 0;

  const start = id(from[0], from[1]);
  g[start] = 0;
  open.push({ i: start, f: Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]), order: order++ });

  while (open.length) {
    let best = 0;
    for (let k = 1; k < open.length; k++) {
      const o = open[k];
      if (o.f < open[best].f || (o.f === open[best].f && o.order < open[best].order)) best = k;
    }
    const { i } = open.splice(best, 1)[0];
    if (closed[i]) continue;
    if (i === goal) {
      const path: Tile[] = [];
      for (let c = i; c !== start; c = came[c]) path.push([c % w, Math.floor(c / w)]);
      return path.reverse();
    }
    closed[i] = 1;
    const cx = i % w;
    const cy = Math.floor(i / w);
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = id(nx, ny);
      if (closed[n] || !canStep(world, [cx, cy], [nx, ny], width)) continue;
      if (n !== goal && crowd?.blocked?.has(key(nx, ny))) continue;
      let cost = g[i] + (isDining(world, nx, ny) ? DINING_COST : 1);
      if (crowd) {
        if (crowd.occupied.has(key(nx, ny))) cost += OCCUPIED_COST;
        cost += Math.min(RECENT_CAP, crowd.recent[n] * RECENT_WEIGHT);
      }
      if (cost < g[n]) {
        g[n] = cost;
        came[n] = i;
        open.push({ i: n, f: cost + Math.abs(to[0] - nx) + Math.abs(to[1] - ny), order: order++ });
      }
    }
  }
  return null;
}
