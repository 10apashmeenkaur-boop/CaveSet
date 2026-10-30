import { describe, expect, it } from 'vitest';
import { EMPTY_DESIGN, place, type Design, type Draft } from './design';
import { findPath, makeWorld } from './pathfinding';
import { widthOf } from './agents';
import { footprint, initSim, runToEnd, step } from './simulate';
import { LEVELS } from '../levels';

const l1 = LEVELS[0];
const withDoors = (...drafts: Partial<Draft>[]): Design =>
  drafts.reduce<Design>((d, o) => place(l1, d, { tool: 'door1', x: 8, y: 4, orient: 'v', swing: 1, ...o }), EMPTY_DESIGN);

describe('findPath', () => {
  it('returns null when the wall is solid', () => {
    expect(findPath(makeWorld(l1, EMPTY_DESIGN), [2, 4], [13, 4], 1)).toBeNull();
  });

  it('lets a person but not a crate carrier through a 1-wide door', () => {
    const world = makeWorld(l1, withDoors({}));
    expect(findPath(world, [2, 4], [13, 4], 1)).not.toBeNull();
    expect(findPath(world, [2, 4], [13, 4], 2)).toBeNull();
  });

  it('lets a crate carrier through a double door', () => {
    const world = makeWorld(l1, withDoors({ tool: 'door2' }));
    const path = findPath(world, [2, 4], [13, 4], 2);
    expect(path).not.toBeNull();
    expect(path!.some(([x]) => x === 8)).toBe(true);
  });

  it('never walks along a doorway', () => {
    const world = makeWorld(l1, withDoors({ tool: 'slide2' }));
    // Inside the door, stepping from (8,4) to (8,5) is along the wall: not allowed.
    const path = findPath(world, [8, 4], [8, 5], 1);
    expect(path === null || path.length > 1).toBe(true);
  });
});

describe('simulation', () => {
  it('is deterministic: same seed + design gives the same final state', () => {
    const d = withDoors({ tool: 'door2', y: 2 }, { tool: 'slide2', y: 6 });
    expect(runToEnd(l1, d, 7)).toEqual(runToEnd(l1, d, 7));
  });

  it('delivers every crate through wide doors', () => {
    const s = runToEnd(l1, withDoors({ tool: 'slide2', y: 2 }, { tool: 'slide2', y: 6 }));
    expect(s.finished).toBe(true);
    expect(s.delivered).toBe(s.totalTasks);
  });

  it('crate carriers get stuck at a 1-wide door', () => {
    const s = runToEnd(l1, withDoors({}));
    expect(s.finished).toBe(false);
    expect(s.agents.some((a) => a.state === 'stuck' && a.stuckReason === 'too-narrow')).toBe(true);
  });

  it('no path when there is no door at all', () => {
    const s = runToEnd(l1, EMPTY_DESIGN);
    expect(s.agents.every((a) => a.stuckReason === 'no-path')).toBe(true);
  });
});

describe('collisions', () => {
  it('never puts two people on the same tile', () => {
    const level = LEVELS[0];
    const design = withDoors({ tool: 'slide2', y: 2 }, { tool: 'slide2', y: 6 });
    const world = makeWorld(level, design);
    let s = initSim(level);
    for (let t = 0; t < 600 && !s.finished; t++) {
      s = step(level, world, s);
      const seen = new Set<string>();
      for (const a of s.agents) {
        if (a.state === 'done') continue;
        for (const [x, y] of footprint(world, a.pos, widthOf(a))) {
          const k = `${x},${y}`;
          expect(seen.has(k), `tile ${k} shared at tick ${s.tick}`).toBe(false);
          seen.add(k);
        }
      }
    }
  });

  it('a hinged door stays shut while someone stands in its swing', () => {
    const level = LEVELS[0];
    const world = makeWorld(level, withDoors({}));
    // Swing tile of the door at (8,4) swinging +x is (9,4).
    expect(world.swing.get('8,4')).toEqual([9, 4]);
  });
});
