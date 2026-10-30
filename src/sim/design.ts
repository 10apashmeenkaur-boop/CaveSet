import { getCell, gridFromLevel, idx, inBounds, type Grid } from './grid';
import type { Level, Tile, ToolId } from './types';

export type BuildTool = Exclude<ToolId, 'eraser'>;
/** Axis a door's width runs along: 'v' = along y (sits in a vertical wall, people pass in x). */
export type Orient = 'h' | 'v';
/** Which side of the door a hinged leaf swings into: +1 = +x / +y. */
export type Side = 1 | -1;

export type Placed = { id: number; tool: BuildTool; x: number; y: number; orient: Orient; swing: Side };
export type Design = { items: Placed[]; nextId: number };
export type Draft = Omit<Placed, 'id'>;

export const EMPTY_DESIGN: Design = { items: [], nextId: 1 };

export const TOOL_INFO: Record<BuildTool, { name: string; cost: number; width: 1 | 2; door: boolean; hinged: boolean }> = {
  wall: { name: 'Brick wall', cost: 500, width: 1, door: false, hinged: false },
  door1: { name: 'Hinged door', cost: 2000, width: 1, door: true, hinged: true },
  door2: { name: 'Double door', cost: 3500, width: 2, door: true, hinged: true },
  slide1: { name: 'Sliding door', cost: 3000, width: 1, door: true, hinged: false },
  slide2: { name: 'Wide sliding door', cost: 5000, width: 2, door: true, hinged: false },
};

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

export function itemAt(design: Design, x: number, y: number): Placed | undefined {
  return design.items.find((it) => itemTiles(it).some(([tx, ty]) => tx === x && ty === y));
}

export type PlaceCheck = { ok: true } | { ok: false; reason: string };

export function checkPlace(level: Level, design: Design, draft: Draft): PlaceCheck {
  const info = TOOL_INFO[draft.tool];
  if (!level.allowedTools.includes(draft.tool)) return { ok: false, reason: `${info.name}s aren't allowed in this level.` };

  const base = gridFromLevel(level);
  const taken = new Set(design.items.flatMap((it) => itemTiles(it).map(([x, y]) => key(x, y))));

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

export function place(level: Level, design: Design, draft: Draft): Design {
  if (!checkPlace(level, design, draft).ok) return design;
  return { items: [...design.items, { ...draft, id: design.nextId }], nextId: design.nextId + 1 };
}

/** Remove whatever covers (x, y). Design mode refunds 100%, so cost just drops. */
export function eraseAt(design: Design, x: number, y: number): Design {
  const hit = itemAt(design, x, y);
  return hit ? { ...design, items: design.items.filter((it) => it !== hit) } : design;
}

/** Level grid with the player's design applied. Doors cut through fixed walls. */
export function buildGrid(level: Level, design: Design): Grid {
  const grid = gridFromLevel(level);
  for (const it of design.items) {
    const cell = it.tool === 'wall' ? 'wall' : 'door';
    for (const [x, y] of itemTiles(it)) grid.cells[idx(grid, x, y)] = cell;
  }
  return grid;
}
