import { LINE_SLOTS } from './constants';
import { getCell, type Grid } from './grid';
import type { Level, Tile, Zone } from './types';

const key = (x: number, y: number) => `${x},${y}`;
const inZone = (z: Zone, x: number, y: number) => x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h;
const N4: Tile[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Where people are drawn while they wait for each station unit (display only; the sim doesn't use it):
 * a single-file line of tiles starting just
 * behind the unit's standing spot, one tile apart. It runs straight back, follows queue rails when there
 * are some, and bends along walls when it meets one. Lines never use standing spots, doorways, the hall,
 * the entrance or exit, or the tiles right next to those (so they don't block a way in or out).
 * Two lines never share a tile, and no line may split the floor in two: everywhere reachable before stays
 * reachable around the lines.
 * A line can be short (or empty) where there's no room.
 */
export function queueLines(level: Level, grid: Grid, units: { tile: Tile; serve: Tile }[]): Tile[][] {
  const q = level.queue;
  if (!q) return units.map(() => []);
  const keep = [q.hall, q.entrance, q.exit].map((n) => level.zones[n]).filter(Boolean);
  const serves = new Set(units.map((u) => key(...u.serve)));
  const cell = (x: number, y: number) => getCell(grid, x, y);
  const busy = (x: number, y: number) => cell(x, y) === 'door' || keep.some((z) => inZone(z, x, y));
  const used = new Set<string>();
  const free = (x: number, y: number) =>
    cell(x, y) === 'floor' &&
    !serves.has(key(x, y)) &&
    !used.has(key(x, y)) &&
    !busy(x, y) &&
    !N4.some(([dx, dy]) => busy(x + dx, y + dy));
  const touches = (x: number, y: number, what: 'rail' | 'wall') => N4.some(([dx, dy]) => cell(x + dx, y + dy) === what);
  const walk = (x: number, y: number) => {
    const c = cell(x, y);
    return c === 'floor' || c === 'door' || c === 'noWalk';
  };
  const ent = level.zones[q.entrance];
  const start: Tile = [ent.x, ent.y];
  /** Walkable tiles reachable from the entrance without stepping on a line. */
  const reach = (extra?: string): Set<string> => {
    const seen = new Set([key(...start)]);
    const todo: Tile[] = [start];
    while (todo.length) {
      const [x, y] = todo.pop()!;
      for (const [dx, dy] of N4) {
        const k = key(x + dx, y + dy);
        if (seen.has(k) || used.has(k) || k === extra || !walk(x + dx, y + dy)) continue;
        seen.add(k);
        todo.push([x + dx, y + dy]);
      }
    }
    return seen;
  };
  const everywhere = reach();
  /** Taking this tile for a line still leaves every other reachable tile reachable. */
  const splits = (x: number, y: number) => {
    const k = key(x, y);
    const after = reach(k);
    for (const t of everywhere) if (t !== k && !used.has(t) && !after.has(t)) return true;
    return false;
  };

  return units.map((u) => {
    const line: Tile[] = [];
    let h: Tile = [u.serve[0] - u.tile[0], u.serve[1] - u.tile[1]];
    let cur = u.serve;
    while (line.length < LINE_SLOTS) {
      const straight = h;
      const turns: Tile[] = [[h[1], -h[0]], [-h[1], h[0]]];
      const ok = [straight, ...turns].filter(([dx, dy]) => {
        const [x, y] = [cur[0] + dx, cur[1] + dy];
        return free(x, y) && !splits(x, y);
      });
      if (!ok.length) break;
      const at = ([dx, dy]: Tile): Tile => [cur[0] + dx, cur[1] + dy];
      // Follow a rail if there is one; otherwise keep straight; at a wall, turn along it.
      const railed = ok.filter((d) => touches(...at(d), 'rail'));
      const walled = ok.filter((d) => touches(...at(d), 'wall'));
      const pick = railed.length
        ? railed.includes(straight) ? straight : railed[0]
        : ok.includes(straight) ? straight : walled[0] ?? ok[0];
      cur = at(pick);
      h = pick;
      line.push(cur);
      used.add(key(...cur));
    }
    return line;
  });
}
