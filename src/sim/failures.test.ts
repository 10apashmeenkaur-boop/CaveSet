import { describe, expect, it } from 'vitest';
import { EMPTY_DESIGN, place, type Design, type Draft } from './design';
import { runToEnd } from './simulate';
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

  it('SWING_BLOCK on a hinged door with two-way traffic', () => {
    expect(codes(trays, onWall(trays, 8, {}))).toContain('SWING_BLOCK');
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
    const d = onWall(l1, 8, { tool: 'slide2', y: 1 }, { tool: 'slide2', y: 7 });
    const found = codes(l1, d);
    for (const c of ['NO_PATH', 'TOO_NARROW', 'TIME_LIMIT', 'SWING_BLOCK'] as const) expect(found).not.toContain(c);
  });
});

describe('level 1 lesson: separate the flows', () => {
  const doors = (...ys: number[]) => onWall(l1, 8, ...ys.map((y) => ({ tool: 'door2' as const, y })));

  it.each([1, 2, 3])('one shared double door fails on time (seed %i)', (seed) => {
    const s = runToEnd(l1, doors(4), seed);
    expect(s.timeUp).toBe(true);
    expect(s.incidents.map((i) => i.code)).toEqual(expect.arrayContaining(['HEAD_ON_JAM', 'TIME_LIMIT']));
  });

  it.each([1, 2, 3])('two double doors pass (seed %i)', (seed) => {
    expect(runToEnd(l1, doors(2, 6), seed).finished).toBe(true);
  });
});
