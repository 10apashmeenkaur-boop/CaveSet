import { describe, expect, it } from 'vitest';
import { checkPlace, EMPTY_DESIGN, eraseAt, place, type Design, type Draft } from './design';
import { findPath, makeWorld } from './pathfinding';
import { initSim, runToEnd, step } from './simulate';
import type { Agent } from './agents';
import type { Level } from './types';
import { LEVELS } from '../levels';

const [l1, l2] = LEVELS;
const codes = (lvl: Level, d: Design) => runToEnd(lvl, d).incidents.map((i) => i.code);
const onWall = (lvl: Level, x: number, ...drafts: Partial<Draft>[]): Design =>
  drafts.reduce<Design>((d, o) => place(lvl, d, { tool: 'door1', x, y: 4, orient: 'v', swing: 1, ...o }), EMPTY_DESIGN);

/** Level 1, but with tray carriers (1 tile wide) going both ways, so a 1-wide door is passable. */
const trays: Level = {
  ...l1,
  spawns: [
    { type: 'tray', from: 'kitchen', to: 'washing', count: 6, every: 15 },
    { type: 'tray', from: 'washing', to: 'kitchen', count: 6, every: 15, delay: 7 },
  ],
};

describe('failure detectors', () => {
  it('NO_PATH when the wall is solid', () => {
    expect(codes(l1, EMPTY_DESIGN)).toContain('NO_PATH');
  });

  it('TOO_NARROW when crates meet a 1-wide door, pointing at the door', () => {
    const s = runToEnd(l1, onWall(l1, 8, {}));
    const inc = s.incidents.find((i) => i.code === 'TOO_NARROW');
    expect(inc).toBeDefined();
    expect(inc!.tiles).toContainEqual([8, 4]);
    expect(inc!.evidence).toMatch(/crate carrier/);
  });

  it('HEAD_ON_JAM on a 1-wide two-way door', () => {
    expect(codes(trays, onWall(trays, 8, { tool: 'slide1' }))).toContain('HEAD_ON_JAM');
  });

  it("SWING_BLOCK when someone stands in a hinged door's swing", () => {
    // A door at (8,4) swinging into (9,4). Someone parks on (9,4); someone else wants to come through from the kitchen.
    const quiet: Level = { ...trays, spawns: [] };
    const world = makeWorld(quiet, onWall(quiet, 8, {}));
    const person = (id: string, pos: [number, number], goal: [number, number], extra: Partial<Agent> = {}): Agent => ({
      id, type: 'empty', carrying: false, pos, next: null, progress: 0, path: [], home: pos, goal,
      phase: 'deliver', state: 'walking', waitTicks: 0, dir: [1, 0], ...extra,
    });
    let s = initSim(quiet);
    s = {
      ...s,
      agents: [
        person('p1', [9, 4], [15, 4], { holdUntil: 10_000, state: 'waiting' }),
        { ...person('p2', [7, 4], [15, 4]), path: findPath(world, [7, 4], [15, 4], 1)! },
      ],
    };
    for (let t = 0; t < 30; t++) s = step(quiet, world, s);
    expect(s.agents[1].waitReason).toBe('swing');
    expect(s.incidents.map((i) => i.code)).toContain('SWING_BLOCK');
  });

  it('DINING_DISTURBED when doors line up with the hall, not when the hall is sealed off', () => {
    const doors = (y: number) => onWall(l2, 5, { tool: 'slide2', y }).items.reduce(
      (d, it) => place(l2, d, { ...it, x: 18 }),
      onWall(l2, 5, { tool: 'slide2', y }),
    );
    expect(codes(l2, doors(6))).toContain('DINING_DISTURBED');
    // Doors at the top and the hall's side entrances bricked up: nobody can shortcut through.
    const sealed = [[8, 6], [8, 7], [15, 6], [15, 7]].reduce(
      (d, [x, y]) => place(l2, d, { tool: 'wall', x, y, orient: 'v', swing: 1 }),
      doors(0),
    );
    expect(codes(l2, sealed)).not.toContain('DINING_DISTURBED');
  });

  it('a clean design in level 1 has no blocking incidents', () => {
    const d = [
      { y: 1, swing: 1 as const },
      { y: 7, swing: -1 as const },
    ].reduce((acc, o) => place(l1, acc, { tool: 'oneway', x: 8, orient: 'v', ...o }), onWall(l1, 8, { tool: 'slide2', y: 1 }, { tool: 'slide2', y: 7 }));
    const found = codes(l1, d);
    for (const c of ['NO_PATH', 'TOO_NARROW', 'TIME_LIMIT', 'SWING_BLOCK'] as const) expect(found).not.toContain(c);
  });
});

describe('level 1 lesson: separate the flows', () => {
  const doors = (...ys: number[]) => onWall(l1, 8, ...ys.map((y) => ({ tool: 'door2' as const, y })));
  /** Two double doors with opposite one-way arrows. */
  const signed = (a: number, b: number) =>
    [
      { y: a, swing: 1 as const },
      { y: b, swing: -1 as const },
    ].reduce((d, o) => place(l1, d, { tool: 'oneway', x: 8, orient: 'v', ...o }), doors(a, b));

  it.each([1, 2, 3])('one shared double door fails on time (seed %i)', (seed) => {
    const s = runToEnd(l1, doors(4), seed);
    expect(s.timeUp).toBe(true);
    expect(s.incidents.map((i) => i.code)).toEqual(expect.arrayContaining(['HEAD_ON_JAM', 'TIME_LIMIT']));
  });

  it.each([1, 2, 3, 4, 5])('two double doors with opposite one-way signs pass with no jams (seed %i)', (seed) => {
    const s = runToEnd(l1, signed(2, 6), seed);
    expect(s.finished).toBe(true);
    expect(s.incidents.map((i) => i.code)).not.toContain('HEAD_ON_JAM');
  });

  it('crowd-aware routing uses both doors even without signs', () => {
    const d = doors(0, 8);
    const world = makeWorld(l1, d);
    let s = initSim(l1);
    const used = new Map<number, Set<string>>();
    while (!s.finished && !s.timeUp) {
      s = step(l1, world, s);
      for (const a of s.agents) {
        if (a.pos[0] !== 8) continue;
        const door = a.pos[1] < 5 ? 0 : 8;
        if (!used.has(door)) used.set(door, new Set());
        used.get(door)!.add(`${a.id}:${a.phase}`);
      }
    }
    const [top, bottom] = [used.get(0)?.size ?? 0, used.get(8)?.size ?? 0];
    expect(Math.min(top, bottom) / (top + bottom)).toBeGreaterThan(0.3);
  });
});

describe('one-way signs', () => {
  const door = onWall(l1, 8, { tool: 'slide2', y: 4 });
  const withSign = (swing: 1 | -1) => place(l1, door, { tool: 'oneway', x: 8, y: 5, orient: 'v', swing });

  it('snaps to its door and only allows passing with the arrow', () => {
    const d = withSign(1);
    const sign = d.items.find((i) => i.tool === 'oneway')!;
    expect([sign.x, sign.y]).toEqual([8, 4]);
    const world = makeWorld(l1, d);
    expect(findPath(world, [2, 4], [13, 4], 2)).not.toBeNull();
    expect(findPath(world, [13, 4], [2, 4], 1)).toBeNull();
  });

  it('needs a door, and one sign per door', () => {
    expect(checkPlace(l1, EMPTY_DESIGN, { tool: 'oneway', x: 8, y: 4, orient: 'v', swing: 1 }).ok).toBe(false);
    expect(checkPlace(l1, withSign(1), { tool: 'oneway', x: 8, y: 5, orient: 'v', swing: -1 }).ok).toBe(false);
  });

  it('erasing the door takes its sign; erasing the sign keeps the door', () => {
    expect(eraseAt(withSign(1), 8, 4).items).toHaveLength(1); // sign goes first
    expect(eraseAt(eraseAt(withSign(1), 8, 4), 8, 4).items).toHaveLength(0);
  });

  it('two doors signed the same way leave the return trip with no path', () => {
    const d = [2, 6].reduce(
      (acc, y) => place(l1, place(l1, acc, { tool: 'door2', x: 8, y, orient: 'v', swing: 1 }), { tool: 'oneway', x: 8, y, orient: 'v', swing: 1 }),
      EMPTY_DESIGN,
    );
    expect(codes(l1, d)).toContain('NO_PATH');
  });
});
