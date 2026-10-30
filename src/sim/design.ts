import { getCell, gridFromLevel, idx, inBounds, type Grid } from './grid';
import type { Level, Tile, ToolId } from './types';

export type BuildTool = Exclude<ToolId, 'eraser'>;
/** Axis a door's width runs along: 'v' = along y (sits in a vertical wall, people pass in x). */
export type Orient = 'h' | 'v';
/** Which side of the door a hinged leaf swings into: +1 = +x / +y. For a one-way sign: the direction people may pass. */
export type Side = 1 | -1;

export type Placed = { id: number; tool: BuildTool; x: number; y: number; orient: Orient; swing: Side };
export type Design = { items: Placed[]; nextId: number };
export type Draft = Omit<Placed, 'id'>;

export const EMPTY_DESIGN: Design = { items: [], nextId: 1 };

export const TOOL_INFO: Record<BuildTool, { name: string; cost: number; width: 1 | 2; door: boolean; hinged: boolean; sign?: boolean }> = {
  wall: { name: 'Brick wall', cost: 500, width: 1, door: false, hinged: false },
  door1: { name: 'Hinged door', cost: 2000, width: 1, door: true, hinged: true },
  door2: { name: 'Double door', cost: 3500, width: 2, door: true, hinged: true },
  slide1: { name: 'Sliding door', cost: 3000, width: 1, door: true, hinged: false },
  slide2: { name: 'Wide sliding door', cost: 5000, width: 2, door: true, hinged: false },
  oneway: { name: 'One-way sign', cost: 200, width: 1, door: false, hinged: false, sign: true },
};

const isSign = (it: Draft) => !!TOOL_INFO[it.tool].sign;

const key = (x: number, y: number) => `${x},${y}`;

/** Tiles the item itself occupies. 2-wide doors extend along their orient axis. */
export function itemTiles(item: Draft): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 0; i < TOOL_INFO[item.tool].width; i++) {
    tiles.push(item.orient === 'v' ? [item.x, item.y + i] : [item.x + i, item.y]);
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
  return design.items.find((it) => !isSign(it) && covers(it, x, y));
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

  const base = gridFromLevel(level);
  const taken = new Set(design.items.filter((it) => !isSign(it)).flatMap((it) => itemTiles(it).map(([x, y]) => key(x, y))));

  for (const [x, y] of itemTiles(draft)) {
    if (!inBounds(base, x, y)) return { ok: false, reason: 'That runs off the edge of the site.' };
    if (!isEditable(level, x, y)) return { ok: false, reason: 'You can only build on the marked wall here.' };
    if (taken.has(key(x, y))) return { ok: false, reason: 'Something is already built there.' };
    const cell = getCell(base, x, y);
    if (cell === 'noWalk') return { ok: false, reason: 'People are eating there. No construction in the dining hall!' };
    if (!info.door && cell === 'wall') return { ok: false, reason: 'There is already a wall there.' };
  }

  for (const [x, y] of swingTiles(draft)) {
    const cell = getCell(base, x, y);
    if (cell === null) return { ok: false, reason: 'The door would swing off the edge of the site.' };
    if (cell === 'wall' || cell === 'noWalk') return { ok: false, reason: 'The door has no room to swing. Press R to flip or rotate it.' };
    const blocker = itemAt(design, x, y);
    if (blocker && blocker.tool === 'wall') return { ok: false, reason: 'The door would swing into a wall. Press R to flip it.' };
  }
  return { ok: true };
}

export function place(level: Level, design: Design, raw: Draft): Design {
  const draft = snapSign(design, raw);
  if (!checkPlace(level, design, draft).ok) return design;
  return { items: [...design.items, { ...draft, id: design.nextId }], nextId: design.nextId + 1 };
}

/** Remove whatever covers (x, y); a removed door takes its sign with it. Design mode refunds 100%. */
export function eraseAt(design: Design, x: number, y: number): Design {
  const hit = itemAt(design, x, y);
  if (!hit) return design;
  const sign = TOOL_INFO[hit.tool].door ? signOn(design, hit) : undefined;
  return { ...design, items: design.items.filter((it) => it !== hit && it !== sign) };
}

/** Level grid with the player's design applied. Doors cut through fixed walls. */
export function buildGrid(level: Level, design: Design): Grid {
  const grid = gridFromLevel(level);
  for (const it of design.items) {
    if (isSign(it)) continue;
    const cell = it.tool === 'wall' ? 'wall' : 'door';
    for (const [x, y] of itemTiles(it)) grid.cells[idx(grid, x, y)] = cell;
  }
  return grid;
}
