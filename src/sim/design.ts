import { DOUBLE_DOOR_TILES, LANDING_TILES, PERSON_TILES, RAMP_WIDTH_TILES, SINGLE_DOOR_TILES, STAIR_TILES } from './constants';
import { getCell, gridFromLevel, idx, inBounds, zoneAt, type Grid } from './grid';
import type { Level, StationKind, Tile, ToolId } from './types';

export type BuildTool = Exclude<ToolId, 'eraser'>;
/** Axis a door's width runs along: 'v' = along y (sits in a vertical wall, people pass in x). */
export type Orient = 'h' | 'v';
/**
 * Which side of the door a hinged leaf swings into: +1 = +x / +y. For a one-way sign: the direction people may pass.
 * For stairs and ramps: the uphill direction along the axis people walk ('v' = along x, like passing through a door).
 */
export type Side = 1 | -1;

/** slope: a ramp's steepness as 1:n. */
export type Placed = { id: number; tool: BuildTool; x: number; y: number; orient: Orient; swing: Side; slope?: number };
export type Design = { items: Placed[]; nextId: number };
export type Draft = Omit<Placed, 'id'>;

export const EMPTY_DESIGN: Design = { items: [], nextId: 1 };

/**
 * width runs along the orient axis; length (default 1) runs along the walking direction (stairs, ramps).
 * attach: hangs on another item (a sign on a door, a handrail on a ramp) and goes when that item is erased.
 */
export const TOOL_INFO: Record<
  BuildTool,
  {
    name: string;
    cost: number;
    width: number;
    length?: number;
    door: boolean;
    hinged: boolean;
    sign?: boolean;
    attach?: boolean;
    station?: StationKind;
    terrain?: 'ramp' | 'stairs' | 'landing';
  }
> = {
  wall: { name: 'Brick wall', cost: 500, width: PERSON_TILES, door: false, hinged: false },
  door1: { name: 'Hinged door', cost: 2000, width: SINGLE_DOOR_TILES, door: true, hinged: true },
  door2: { name: 'Double door', cost: 3500, width: DOUBLE_DOOR_TILES, door: true, hinged: true },
  slide1: { name: 'Sliding door', cost: 3000, width: SINGLE_DOOR_TILES, door: true, hinged: false },
  slide2: { name: 'Wide sliding door', cost: 5000, width: DOUBLE_DOOR_TILES, door: true, hinged: false },
  oneway: { name: 'One-way sign', cost: 200, width: PERSON_TILES, door: false, hinged: false, sign: true },
  shoe: { name: 'Shoe stand', cost: 2000, width: PERSON_TILES, door: false, hinged: false, station: 'shoe' },
  tap: { name: 'Hand-wash tap', cost: 1500, width: PERSON_TILES, door: false, hinged: false, station: 'tap' },
  rail: { name: 'Queue rail', cost: 300, width: PERSON_TILES, door: false, hinged: false },
  stairs: { name: 'Stairs', cost: 4000, width: RAMP_WIDTH_TILES, length: STAIR_TILES, door: false, hinged: false, terrain: 'stairs' },
  ramp: { name: 'Ramp', cost: 600, width: RAMP_WIDTH_TILES, door: false, hinged: false, terrain: 'ramp' },
  landing: { name: 'Landing 3×3', cost: 1200, width: LANDING_TILES, door: false, hinged: false, terrain: 'landing' },
  handrail: { name: 'Handrail', cost: 200, width: PERSON_TILES, door: false, hinged: false, attach: true },
};

/** Uphill direction of a stair or ramp. */
export function upDir(item: { orient: Orient; swing: Side }): Tile {
  return item.orient === 'v' ? [item.swing, 0] : [0, item.swing];
}

const STATION_NAME: Record<StationKind, string> = { shoe: 'Shoe stands', tap: 'Taps', basket: 'Baskets' };

/** Where someone stands to use a station: the tile it faces (same rule as a hinged door's swing). */
export function serveTile(st: { x: number; y: number; orient: Orient; swing: Side }): Tile {
  return st.orient === 'v' ? [st.x + st.swing, st.y] : [st.x, st.y + st.swing];
}

/** Every station in play: the level's fixed ones, then the player's, in that order. */
export function stationsOf(level: Level, design: Design): { kind: StationKind; tile: Tile; serve: Tile }[] {
  const fixed = (level.stations ?? []).map((st) => ({ kind: st.kind, tile: [st.x, st.y] as Tile, serve: serveTile(st) }));
  const built = design.items
    .filter((it) => TOOL_INFO[it.tool].station)
    .map((it) => ({ kind: TOOL_INFO[it.tool].station!, tile: [it.x, it.y] as Tile, serve: serveTile(it) }));
  return [...fixed, ...built];
}

const isSign = (it: Draft) => !!TOOL_INFO[it.tool].sign;
/** Signs and handrails: they hang on something else. */
const isAttached = (it: Draft) => !!TOOL_INFO[it.tool].sign || !!TOOL_INFO[it.tool].attach;

const key = (x: number, y: number) => `${x},${y}`;

/**
 * Tiles the item itself occupies. 2-wide doors, stairs and ramps extend along their orient axis (+x / +y);
 * stairs also run `length` tiles uphill. A landing is centred on its tile.
 */
export function itemTiles(item: Draft): Tile[] {
  const info = TOOL_INFO[item.tool];
  if (info.terrain === 'landing') {
    const r = Math.floor(info.width / 2);
    const tiles: Tile[] = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) tiles.push([item.x + dx, item.y + dy]);
    return tiles;
  }
  const [ux, uy] = upDir(item);
  const tiles: Tile[] = [];
  for (let j = 0; j < (info.length ?? 1); j++) {
    for (let i = 0; i < info.width; i++) {
      tiles.push(item.orient === 'v' ? [item.x + j * ux, item.y + i] : [item.x + i, item.y + j * uy]);
    }
  }
  return tiles;
}

/** Floor tiles a hinged door sweeps when it opens. Empty for walls and sliding doors. */
export function swingTiles(item: Draft): Tile[] {
  if (!TOOL_INFO[item.tool].hinged) return [];
  return itemTiles(item).map(([x, y]) => (item.orient === 'v' ? [x + item.swing, y] : [x, y + item.swing]));
}

export function costOf(design: Design): number {
  return design.items.reduce((sum, it) => sum + TOOL_INFO[it.tool].cost, 0);
}

/** Level's `editableTiles` rule: "all" or "wall-x-N-only". */
export function isEditable(level: Level, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= level.grid.w || y >= level.grid.h) return false;
  const m = /^wall-x-(\d+)-only$/.exec(level.editableTiles);
  if (m) return x === Number(m[1]);
  return level.editableTiles === 'all';
}

const covers = (it: Draft, x: number, y: number) => itemTiles(it).some(([tx, ty]) => tx === x && ty === y);

/** The door (not wall, not sign) covering (x, y). */
export function doorAt(design: Design, x: number, y: number): Placed | undefined {
  return design.items.find((it) => TOOL_INFO[it.tool].door && covers(it, x, y));
}

/** The one-way sign hung on this door, if any. Signs sit on their door's first tile. */
export function signOn(design: Design, door: Draft): Placed | undefined {
  return design.items.find((it) => isSign(it) && it.x === door.x && it.y === door.y);
}

/** What the eraser would hit at (x, y): a sign before the door it hangs on. */
export function itemAt(design: Design, x: number, y: number): Placed | undefined {
  const door = doorAt(design, x, y);
  if (door) return signOn(design, door) ?? door;
  return design.items.find((it) => !isAttached(it) && covers(it, x, y));
}

/** A sign draft snaps to the door under it: same anchor tile and axis, keeping its arrow direction. */
export function snapSign(design: Design, draft: Draft): Draft {
  if (!isSign(draft)) return draft;
  const door = doorAt(design, draft.x, draft.y);
  return door ? { ...draft, x: door.x, y: door.y, orient: door.orient } : draft;
}

export type PlaceCheck = { ok: true } | { ok: false; reason: string };

export function checkPlace(level: Level, design: Design, draft: Draft): PlaceCheck {
  const info = TOOL_INFO[draft.tool];
  if (!level.allowedTools.includes(draft.tool)) return { ok: false, reason: `${info.name}s aren't allowed in this level.` };

  if (info.sign) {
    const door = doorAt(design, draft.x, draft.y);
    if (!door) return { ok: false, reason: 'Hang the sign on a door.' };
    if (signOn(design, door)) return { ok: false, reason: 'This door already has a sign. Erase it to change it.' };
    return { ok: true };
  }

  if (info.attach) {
    const under = itemAt(design, draft.x, draft.y);
    if (!under || !(TOOL_INFO[under.tool].terrain === 'ramp' || TOOL_INFO[under.tool].terrain === 'stairs')) {
      return { ok: false, reason: 'Put the handrail on a ramp or stairs.' };
    }
    if (design.items.some((it) => it.tool === draft.tool && it.x === draft.x && it.y === draft.y)) {
      return { ok: false, reason: 'There is already a handrail here.' };
    }
    return { ok: true };
  }

  const base = gridFromLevel(level);
  const taken = new Set(design.items.filter((it) => !isAttached(it)).flatMap((it) => itemTiles(it).map(([x, y]) => key(x, y))));
  const rise = level.rise;
  // Nobody may build where people stand to use a station.
  const serving = new Set(stationsOf(level, design).map(({ serve: [x, y] }) => key(x, y)));

  for (const [x, y] of itemTiles(draft)) {
    if (!inBounds(base, x, y)) return { ok: false, reason: 'That runs off the edge of the site.' };
    if (!isEditable(level, x, y)) return { ok: false, reason: 'You can only build on the marked wall here.' };
    if (taken.has(key(x, y))) return { ok: false, reason: 'Something is already built there.' };
    if (serving.has(key(x, y))) return { ok: false, reason: 'People stand there to use the station.' };
    const cell = getCell(base, x, y);
    if (cell === 'noWalk') return { ok: false, reason: 'People are eating there. No construction in the dining hall!' };
    if (cell === 'station') return { ok: false, reason: 'A station is already there.' };
    if (!info.door && cell === 'wall') return { ok: false, reason: 'There is already a wall there.' };
    if (rise && zoneAt(level, x, y) === rise.zone) return { ok: false, reason: 'That is the roof. Build on the ground, up to it.' };
    if (rise && zoneAt(level, x, y) === rise.yard) return { ok: false, reason: 'Keep the yard clear: people arrive here.' };
  }

  if (info.station) {
    const zone = level.queue?.stationZones[info.station];
    if (!zone || zoneAt(level, draft.x, draft.y) !== zone) {
      return { ok: false, reason: `${STATION_NAME[info.station]} go in the ${zone ?? 'right'} area.` };
    }
    const [sx, sy] = serveTile(draft);
    const cell = getCell(base, sx, sy);
    if (cell !== 'floor' || taken.has(key(sx, sy)) || serving.has(key(sx, sy))) {
      return { ok: false, reason: 'People need free floor in front of it. Press R to turn it.' };
    }
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => serving.has(key(sx + dx, sy + dy)))) {
      return { ok: false, reason: 'Too close to the next station: leave a gap so people can step out.' };
    }
  }

  for (const [x, y] of swingTiles(draft)) {
    const cell = getCell(base, x, y);
    if (cell === null) return { ok: false, reason: 'The door would swing off the edge of the site.' };
    if (cell === 'wall' || cell === 'noWalk' || cell === 'station') return { ok: false, reason: 'The door has no room to swing. Press R to flip or rotate it.' };
    const blocker = itemAt(design, x, y);
    if (blocker && (blocker.tool === 'wall' || blocker.tool === 'rail' || TOOL_INFO[blocker.tool].station)) return { ok: false, reason: 'The door would swing into something. Press R to flip it.' };
  }
  return { ok: true };
}

export function place(level: Level, design: Design, raw: Draft): Design {
  const draft = snapSign(design, raw);
  if (!checkPlace(level, design, draft).ok) return design;
  return { items: [...design.items, { ...draft, id: design.nextId }], nextId: design.nextId + 1 };
}

/** Every tile that belongs to an object, for the eraser: its own tiles, a door's swing area, a station's standing spot. */
export function objectTiles(item: Draft): Tile[] {
  return [...itemTiles(item), ...swingTiles(item), ...(TOOL_INFO[item.tool].station ? [serveTile(item)] : [])];
}

/**
 * The whole object the eraser takes at (x, y): whatever is built on the tile, else a door whose swing
 * or a station whose standing spot is there. (A door's sign goes with the door.)
 */
export function eraseTarget(design: Design, x: number, y: number): Placed | undefined {
  const objects = design.items.filter((it) => !isAttached(it));
  return objects.find((it) => covers(it, x, y)) ?? objects.find((it) => objectTiles(it).some(([tx, ty]) => tx === x && ty === y));
}

/** Remove the whole object at (x, y); a removed door takes its sign with it, a ramp or stairs its handrails. Design mode refunds 100%. */
export function eraseAt(design: Design, x: number, y: number): Design {
  const hit = eraseTarget(design, x, y);
  if (!hit) return design;
  const sign = TOOL_INFO[hit.tool].door ? signOn(design, hit) : undefined;
  const rails = new Set(handrailsOn(design, hit));
  return { ...design, items: design.items.filter((it) => it !== hit && it !== sign && !rails.has(it)) };
}

/** Handrails hung on this ramp or stairs. */
export function handrailsOn(design: Design, item: Draft): Placed[] {
  if (!TOOL_INFO[item.tool].terrain) return [];
  return design.items.filter((it) => TOOL_INFO[it.tool].attach && covers(item, it.x, it.y));
}

/** Level grid with the player's design applied. Doors cut through fixed walls. */
export function buildGrid(level: Level, design: Design): Grid {
  const grid = gridFromLevel(level);
  for (const it of design.items) {
    // Stairs, ramps and landings are still floor; their heights live in the terrain (terrain.ts).
    if (isAttached(it) || TOOL_INFO[it.tool].terrain) continue;
    const cell = it.tool === 'wall' ? 'wall' : it.tool === 'rail' ? 'rail' : TOOL_INFO[it.tool].station ? 'station' : 'door';
    for (const [x, y] of itemTiles(it)) grid.cells[idx(grid, x, y)] = cell;
  }
  return grid;
}
