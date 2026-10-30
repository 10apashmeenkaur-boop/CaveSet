import { buildGrid, doorAt, itemTiles, stationsOf, swingTiles, TOOL_INFO, type Design, type Orient } from './design';
import { DINING_COST, OCCUPIED_COST, RECENT_CAP, RECENT_WEIGHT, TURN_COST } from './constants';
import { getCell, type Grid } from './grid';
import { buildTerrain, isSlope, laneSide, terrainStep, tooSteep, type Terrain } from './terrain';
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
  /** Heights, ramps and stairs (ramp level only). */
  terrain?: Terrain;
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
    if (!TOOL_INFO[it.tool].door) continue;
    const tiles = itemTiles(it);
    const sweeps = swingTiles(it);
    tiles.forEach(([x, y], i) => {
      doors.set(key(x, y), it.orient);
      doorTiles.set(key(x, y), tiles);
      if (sweeps[i]) swing.set(key(x, y), sweeps[i]);
    });
  }
  const grid = buildGrid(level, design);
  return {
    grid,
    doors,
    swing,
    doorTiles,
    oneWay,
    units: stationsOf(level, design),
    seats: seatsOf(level, grid),
    terrain: buildTerrain(level, design, grid),
  };
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

/** On foot, or on wheels (wheelchair, trolley: no stairs, no lips). */
export type Mobility = 'walk' | 'wheel';

/**
 * Can an agent of this width step from a to b (4-neighbours)?
 * Width 2 needs the tiles beside both a and b, on the same side, to be open too:
 * a crate carrier needs a 2-wide lane. On a ramp, wheels keep to the ramp's own two tiles.
 */
export function canStep(world: World, a: Tile, b: Tile, width: 1 | 2, mob: Mobility = 'walk'): boolean {
  const dx = b[0] - a[0];
  if (!walkable(world, b[0], b[1])) return false;
  if (!doorAllows(world, a[0], a[1], dx) || !doorAllows(world, b[0], b[1], dx)) return false;
  // One-way doors: entering or leaving must follow the arrow.
  const dy = b[1] - a[1];
  for (const t of [a, b]) {
    const d = world.oneWay.get(key(t[0], t[1]));
    if (d && (d[0] !== dx || d[1] !== dy)) return false;
  }
  const t = world.terrain;
  if (t && !terrainStep(t, a, b, mob === 'wheel')) return false;
  if (width === 1) return true;
  const [px, py] = dx !== 0 ? [0, 1] : [1, 0];
  let sides: (1 | -1)[] = [1, -1];
  if (t && mob === 'wheel') {
    const sa = laneSide(t, a, px, py);
    const sb = laneSide(t, b, px, py);
    if (sa && sb && sa !== sb) return false;
    if (sa || sb) sides = [sa || sb] as (1 | -1)[];
  }
  return sides.some((s) => {
    const a2: Tile = [a[0] + s * px, a[1] + s * py];
    const b2: Tile = [b[0] + s * px, b[1] + s * py];
    return walkable(world, ...a2) && walkable(world, ...b2) && (!t || terrainStep(t, a2, b2, mob === 'wheel'));
  });
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


/** Cost of walking onto (x, y) before crowding: 1 a step, more for slow ground. */
export type TileCost = (x: number, y: number) => number;

/**
 * 4-direction A*. Returns the tiles after `from` up to and including `to`, or null. Deterministic tie-breaks.
 * With `crowd`, occupied and recently jammed tiles cost extra, so people spread over the doors.
 */
export function findPath(world: World, from: Tile, to: Tile, width: 1 | 2, crowd?: Crowd, tileCost?: TileCost): Tile[] | null {
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
      let cost = g[i] + (isDining(world, nx, ny) ? DINING_COST : (tileCost?.(nx, ny) ?? 1));
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

/**
 * What a route on wheels must respect. lane: how wide a lane it needs (2 = the real chair or trolley; 1 to find where
 * a user would try to go). maxRise: steepest ramp (mm per tile). turns: where it may turn (a level 3×3 spot, any flat
 * tile, or anywhere). rest: most ramp tiles in a row before a flat rest spot.
 */
export type WheelRules = { lane: 1 | 2; maxRise: number; turns: 'turnable' | 'flat' | 'any'; rest: number };

/** Small binary heap on (f, order), for routes on wheels (their search space is bigger: tile × direction × ramp run). */
class Heap {
  private items: { s: number; f: number; o: number }[] = [];
  get size() {
    return this.items.length;
  }
  private less(a: number, b: number) {
    const x = this.items[a];
    const y = this.items[b];
    return x.f < y.f || (x.f === y.f && x.o < y.o);
  }
  push(item: { s: number; f: number; o: number }) {
    const h = this.items;
    h.push(item);
    for (let i = h.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      [h[i], h[p]] = [h[p], h[i]];
      i = p;
    }
  }
  pop() {
    const h = this.items;
    const top = h[0];
    const last = h.pop()!;
    if (h.length) {
      h[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && this.less(l, m)) m = l;
        if (r < h.length && this.less(r, m)) m = r;
        if (m === i) break;
        [h[i], h[m]] = [h[m], h[i]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * A* for a wheelchair or trolley, tracking which way it faces and how many ramp tiles it has rolled in a row.
 * Starts facing `dir` with `run` ramp tiles behind it. Returns the tiles after `from` up to `to`, or null.
 */
export function findWheelPath(
  world: World,
  from: Tile,
  dir: Tile,
  run: number,
  to: Tile,
  rules: WheelRules,
  crowd?: Crowd,
  tileCost?: TileCost,
): Tile[] | null {
  const t = world.terrain;
  const { w, h } = world.grid;
  const runs = Number.isFinite(rules.rest) ? rules.rest + 1 : 1;
  const sid = (i: number, d: number, r: number) => (i * 4 + d) * runs + r;
  const total = w * h * 4 * runs;
  const g = new Float64Array(total).fill(Infinity);
  const came = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const heap = new Heap();
  let order = 0;
  const d0 = Math.max(0, DIRS.findIndex(([x, y]) => x === dir[0] && y === dir[1]));
  const start = sid(from[1] * w + from[0], d0, Math.min(run, runs - 1));
  g[start] = 0;
  heap.push({ s: start, f: Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]), o: order++ });

  while (heap.size) {
    const { s } = heap.pop();
    if (closed[s]) continue;
    closed[s] = 1;
    const r = s % runs;
    const d = Math.floor(s / runs) % 4;
    const i = Math.floor(s / runs / 4);
    const cx = i % w;
    const cy = Math.floor(i / w);
    if (cx === to[0] && cy === to[1]) {
      const path: Tile[] = [];
      for (let c = s; c !== start; c = came[c]) {
        const ti = Math.floor(c / runs / 4);
        path.push([ti % w, Math.floor(ti / w)]);
      }
      return path.reverse();
    }
    for (let nd = 0; nd < 4; nd++) {
      const nx = cx + DIRS[nd][0];
      const ny = cy + DIRS[nd][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      const turning = nd !== d;
      if (turning && t && rules.turns !== 'any' && (rules.turns === 'flat' ? isSlope(t, i) : !t.turnable[i])) continue;
      if (!canStep(world, [cx, cy], [nx, ny], rules.lane, 'wheel')) continue;
      if (t && tooSteep(t, n, rules.maxRise)) continue;
      const nr = t && isSlope(t, n) ? r + 1 : 0;
      if (nr > rules.rest) continue;
      if (crowd?.blocked?.has(key(nx, ny)) && (nx !== to[0] || ny !== to[1])) continue;
      const ns = sid(n, nd, Math.min(nr, runs - 1));
      if (closed[ns]) continue;
      let cost = g[s] + (tileCost?.(nx, ny) ?? 1) + (turning ? TURN_COST : 0);
      if (crowd) {
        if (crowd.occupied.has(key(nx, ny))) cost += OCCUPIED_COST;
        cost += Math.min(RECENT_CAP, crowd.recent[n] * RECENT_WEIGHT);
      }
      if (cost < g[ns]) {
        g[ns] = cost;
        came[ns] = s;
        heap.push({ s: ns, f: cost + Math.abs(to[0] - nx) + Math.abs(to[1] - ny), o: order++ });
      }
    }
  }
  return null;
}

/** Every tile a wheelchair or trolley could roll to from `from`, ignoring how steep or tight it gets. */
export function wheelReach(world: World, from: Tile): Tile[] {
  const { w } = world.grid;
  const seen = new Set<number>([from[1] * w + from[0]]);
  const out: Tile[] = [from];
  for (let q = 0; q < out.length; q++) {
    const [x, y] = out[q];
    for (const [dx, dy] of DIRS) {
      const n: Tile = [x + dx, y + dy];
      const ni = n[1] * w + n[0];
      if (n[0] < 0 || n[1] < 0 || n[0] >= w || n[1] >= world.grid.h || seen.has(ni)) continue;
      if (!canStep(world, [x, y], n, 1, 'wheel')) continue;
      seen.add(ni);
      out.push(n);
    }
  }
  return out;
}
