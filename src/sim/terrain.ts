import { SLOPE_SPEED, STAIR_MAX_RISER_M, STAIR_STEPS, STAIR_TILES, STEP_UP_MAX_M, TILE_M } from './constants';
import { itemTiles, TOOL_INFO, upDir, type Design } from './design';
import { getCell, type Grid } from './grid';
import type { AgentType, Level, Tile } from './types';

/**
 * Heights for the ramp level: the ground, the raised roof, and whatever the player built to get between them.
 * Heights are in millimetres. Each tile has the height of its centre; a stair or ramp tile also rises along its
 * uphill direction, so its downhill and uphill edges sit half a tile's rise below and above its centre.
 */

export const GROUND = 0;
export const RAISED = 1;
export const LANDING = 2;
export const RAMP = 3;
export const STAIRS = 4;

export type Terrain = {
  w: number;
  /** GROUND, RAISED, LANDING, RAMP or STAIRS per tile (row-major). */
  kind: Uint8Array;
  /** Height of the tile's centre, mm. */
  center: Float64Array;
  /** Rise per tile along the uphill direction, mm (0 on the flat). */
  rise: Float64Array;
  /** Uphill direction of a ramp or stairs tile. */
  dx: Int8Array;
  dy: Int8Array;
  /** A ramp's steepness as 1:n (0 elsewhere). */
  slope: Uint8Array;
  /** Ramp or stairs tile → the tile beside it in the same piece (the other half of its 2-tile width). */
  sibling: Int32Array;
  /** Tiles with a handrail. */
  rail: Uint8Array;
  /** Flat tiles inside a clear, level 3×3 area: a wheelchair can turn here. */
  turnable: Uint8Array;
};

const MM = 1000;
/** Each stair tile climbs two 15 cm steps: 1.2 m over 4 tiles. */
const STAIR_RISE = (STAIR_MAX_RISER_M * MM * STAIR_STEPS) / STAIR_TILES;
const DIRS: Tile[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export const isSlope = (t: Terrain, i: number) => t.kind[i] === RAMP || t.kind[i] === STAIRS;

/** Height (mm) of tile i's edge on the side facing (ex, ey). */
export function edgeHeight(t: Terrain, i: number, ex: number, ey: number): number {
  const half = t.rise[i] / 2;
  if (!half) return t.center[i];
  if (ex === t.dx[i] && ey === t.dy[i]) return t.center[i] + half;
  if (ex === -t.dx[i] && ey === -t.dy[i]) return t.center[i] - half;
  return t.center[i];
}

type Piece = { tiles: number[]; landing: boolean; rise: number; dir: Tile; slope: number };

/** The level's heights with the design built. Undefined for levels without a raised zone. */
export function buildTerrain(level: Level, design: Design, grid: Grid): Terrain | undefined {
  const rise = level.rise;
  if (!rise) return undefined;
  const { w, h } = grid;
  const n = w * h;
  const t: Terrain = {
    w,
    kind: new Uint8Array(n),
    center: new Float64Array(n),
    rise: new Float64Array(n),
    dx: new Int8Array(n),
    dy: new Int8Array(n),
    slope: new Uint8Array(n),
    sibling: new Int32Array(n).fill(-1),
    rail: new Uint8Array(n),
    turnable: new Uint8Array(n),
  };
  const z = level.zones[rise.zone];
  for (let y = z.y; y < z.y + z.h; y++) {
    for (let x = z.x; x < z.x + z.w; x++) {
      t.kind[y * w + x] = RAISED;
      t.center[y * w + x] = rise.heightM * MM;
    }
  }

  // Each stair, ramp or landing is a piece; it gets its height from whatever it joins (see `fit`).
  const pieces: Piece[] = [];
  const pieceOf = new Int32Array(n).fill(-1);
  const row = new Int32Array(n); // how many tiles up the piece this tile is
  const items = [...design.items].sort((a, b) => a.id - b.id);
  for (const it of items) {
    const info = TOOL_INFO[it.tool];
    if (info.attach) {
      if (it.x >= 0 && it.y >= 0 && it.x < w && it.y < h) t.rail[it.y * w + it.x] = 1;
      continue;
    }
    if (!info.terrain) continue;
    const tiles = itemTiles(it).map(([x, y]) => y * w + x);
    const landing = info.terrain === 'landing';
    const slope = info.terrain === 'ramp' ? (it.slope ?? 12) : 0;
    const piece: Piece = {
      tiles,
      landing,
      rise: landing ? 0 : info.terrain === 'stairs' ? STAIR_RISE : (TILE_M * MM) / slope,
      dir: upDir(it),
      slope,
    };
    const p = pieces.push(piece) - 1;
    tiles.forEach((i, k) => {
      pieceOf[i] = p;
      t.kind[i] = landing ? LANDING : info.terrain === 'stairs' ? STAIRS : RAMP;
      t.rise[i] = piece.rise;
      [t.dx[i], t.dy[i]] = landing ? [0, 0] : piece.dir;
      t.slope[i] = slope;
      // itemTiles lists a ramp/stairs piece row by row, two tiles per row.
      if (!landing) {
        row[i] = Math.floor(k / info.width);
        const mate = tiles[k % 2 === 0 ? k + 1 : k - 1];
        if (mate !== undefined) t.sibling[i] = mate;
      }
    });
  }

  const assigned = new Uint8Array(pieces.length);
  const setPiece = (p: number, base: number) => {
    assigned[p] = 1;
    for (const i of pieces[p].tiles) t.center[i] = pieces[p].landing ? base : base + pieces[p].rise * (row[i] + 0.5);
  };

  const fixed = (i: number) => t.kind[i] === GROUND || t.kind[i] === RAISED;
  /** Does the whole end row of a stair or ramp piece (bottom or top) open on to this kind of fixed ground? */
  const endOn = (piece: Piece, top: boolean, kind: number) => {
    const last = Math.max(...piece.tiles.map((i) => row[i]));
    const [ux, uy] = top ? piece.dir : [-piece.dir[0], -piece.dir[1]];
    return piece.tiles
      .filter((i) => row[i] === (top ? last : 0))
      .every((i) => {
        const x = (i % w) + ux;
        const y = Math.floor(i / w) + uy;
        return x >= 0 && y >= 0 && x < w && y < h && t.kind[y * w + x] === kind && pieceOf[y * w + x] < 0;
      });
  };

  /**
   * Fit piece p to a neighbour: tile `from` (known height) next to tile `to` of the piece, stepping (ex, ey).
   * A landing takes the height of a stair, ramp or landing it touches; a stair or ramp joins only at its bottom or
   * top edge, and joins the ground or roof only if its whole width meets it. Returns the piece's base height, or null.
   */
  const fit = (from: number, to: number, ex: number, ey: number): number | null => {
    const piece = pieces[pieceOf[to]];
    const e = edgeHeight(t, from, ex, ey);
    if (piece.landing) return fixed(from) ? null : e;
    const atBottom = ex === piece.dir[0] && ey === piece.dir[1];
    if (fixed(from) && !endOn(piece, !atBottom, t.kind[from])) return null;
    const r = row[to];
    let base: number;
    if (ex === piece.dir[0] && ey === piece.dir[1]) base = e - piece.rise * r; // walking in at its bottom edge
    else if (ex === -piece.dir[0] && ey === -piece.dir[1]) base = e - piece.rise * (r + 1); // at its top edge
    else return null;
    return base < 0 ? null : base;
  };

  const spread = (queue: number[]) => {
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      const x = i % w;
      const y = Math.floor(i / w);
      for (const [ex, ey] of DIRS) {
        const nx = x + ex;
        const ny = y + ey;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        const p = pieceOf[j];
        if (p < 0 || assigned[p] || (pieceOf[i] < 0 && t.kind[i] !== GROUND && t.kind[i] !== RAISED)) continue;
        const base = fit(i, j, ex, ey);
        if (base === null) continue;
        setPiece(p, base);
        queue.push(...pieces[p].tiles);
      }
    }
  };
  const open = (i: number) => getCell(grid, i % w, Math.floor(i / w)) === 'floor';
  const all = Array.from({ length: n }, (_, i) => i);
  // Up from the ground first, then down from the roof, then anything left over just sits on the ground.
  spread(all.filter((i) => t.kind[i] === GROUND && open(i)));
  spread(all.filter((i) => t.kind[i] === RAISED || (pieceOf[i] >= 0 && assigned[pieceOf[i]])));
  pieces.forEach((piece, p) => {
    if (assigned[p]) return;
    setPiece(p, 0);
    spread([...piece.tiles]);
  });

  // Turning spots: every tile of some level, open 3×3 square.
  const flatAt = (x: number, y: number, height: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const i = y * w + x;
    return !isSlope(t, i) && open(i) && t.center[i] === height;
  };
  for (let i = 0; i < n; i++) {
    if (isSlope(t, i) || !open(i)) continue;
    const x = i % w;
    const y = Math.floor(i / w);
    let ok = false;
    for (let oy = -2; oy <= 0 && !ok; oy++) {
      for (let ox = -2; ox <= 0 && !ok; ox++) {
        ok = true;
        for (let k = 0; k < 9 && ok; k++) ok = flatAt(x + ox + (k % 3), y + oy + Math.floor(k / 3), t.center[i]);
      }
    }
    t.turnable[i] = ok ? 1 : 0;
  }
  return t;
}

/** Wheels need the edges to meet exactly and never take stairs; on foot a small lip (one stair riser) is fine. */
export function terrainStep(t: Terrain, a: Tile, b: Tile, wheels: boolean): boolean {
  const ia = a[1] * t.w + a[0];
  const ib = b[1] * t.w + b[0];
  if (wheels && (t.kind[ia] === STAIRS || t.kind[ib] === STAIRS)) return false;
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const gap = Math.abs(edgeHeight(t, ia, ex, ey) - edgeHeight(t, ib, -ex, -ey));
  return gap <= (wheels ? 0.5 : STEP_UP_MAX_M * MM + 0.5);
}

/** On a stair or ramp tile with a sibling to the +1 or -1 side along (px, py): which side. 0 if none. */
export function laneSide(t: Terrain, at: Tile, px: number, py: number): 0 | 1 | -1 {
  const i = at[1] * t.w + at[0];
  const s = t.sibling[i];
  if (s < 0) return 0;
  const sx = (s % t.w) - at[0];
  const sy = Math.floor(s / t.w) - at[1];
  if (sx === px && sy === py) return 1;
  if (sx === -px && sy === -py) return -1;
  return 0;
}

/** A ramp tile steeper than the given rise per tile (mm). */
export const tooSteep = (t: Terrain, i: number, maxRise: number) => t.kind[i] === RAMP && t.rise[i] > maxRise + 0.01;

/** Share of flat-ground speed on tile i for this kind of agent. */
export function slopeFactor(t: Terrain, i: number, type: AgentType): number {
  if (!isSlope(t, i)) return 1;
  if (type === 'elderly' && !railed(t, i)) return SLOPE_SPEED.elderlyNoRail;
  if (t.kind[i] === RAMP) {
    if (type === 'wheelchair' || type === 'trolley') return SLOPE_SPEED.ramp.wheel;
    return type === 'elderly' ? SLOPE_SPEED.ramp.elderlyRail : SLOPE_SPEED.ramp.walk;
  }
  return type === 'elderly' ? SLOPE_SPEED.stairs.elderlyRail : SLOPE_SPEED.stairs.walk;
}

/** A handrail on this tile, or on the other half of its ramp or stairs (one rail serves the full width). */
export const railed = (t: Terrain, i: number) => t.rail[i] === 1 || (t.sibling[i] >= 0 && t.rail[t.sibling[i]] === 1);

/** Height (mm) on the way from tile a to tile b, fraction f of the way: up to a's edge, then on from b's edge. */
export function heightBetween(t: Terrain, a: Tile, b: Tile | null, f: number): number {
  const ia = a[1] * t.w + a[0];
  if (!b) return t.center[ia];
  const ib = b[1] * t.w + b[0];
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  if (f < 0.5) return t.center[ia] + (edgeHeight(t, ia, ex, ey) - t.center[ia]) * f * 2;
  const e = edgeHeight(t, ib, -ex, -ey);
  return e + (t.center[ib] - e) * (f - 0.5) * 2;
}
