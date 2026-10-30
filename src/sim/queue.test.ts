import { describe, expect, it } from 'vitest';
import { checkPlace, costOf, EMPTY_DESIGN, place, type Design, type Draft } from './design';
import { findPath, makeWorld } from './pathfinding';
import { score } from './scoring';
import { initSim, runToEnd, step } from './simulate';
import { LEVELS } from '../levels';

const l3 = LEVELS[2];
const draft = (o: Partial<Draft>): Draft => ({ tool: 'tap', x: 0, y: 0, orient: 'h', swing: 1, ...o });
const build = (items: Partial<Draft>[]): Design =>
  items.reduce<Design>((d, o) => {
    const next = place(l3, d, draft(o));
    if (next === d) throw new Error(`could not place ${JSON.stringify(o)}`);
    return next;
  }, EMPTY_DESIGN);
const run = (d: Design) => {
  const sim = runToEnd(l3, d);
  return { sim, codes: sim.incidents.map((i) => i.code), score: score(l3, sim, costOf(d)) };
};

const shoe2: Partial<Draft> = { tool: 'shoe', x: 2, y: 4, orient: 'v', swing: 1 };
const shoe3: Partial<Draft> = { tool: 'shoe', x: 4, y: 4, swing: -1 };
const taps2: Partial<Draft>[] = [{ x: 5, y: 5, swing: -1 }, { x: 7, y: 5, swing: -1 }];
const tap4: Partial<Draft> = { x: 8, y: 4, swing: -1 };
/** A plain hinged door low in the hall wall, near the exit: the leavers' own way out. */
const exitDoor: Partial<Draft> = { tool: 'door1', x: 11, y: 9, orient: 'v', swing: -1 };

describe('level 3: langar queue', () => {
  it('is deterministic: same design, same result', () => {
    const d = build([shoe2, shoe3, ...taps2, exitDoor]);
    expect(runToEnd(l3, d)).toEqual(runToEnd(l3, d));
  });

  it('nothing built: the shoe line spills out the door and the hall stays half empty', () => {
    const { sim, codes, score: r } = run(EMPTY_DESIGN);
    expect(r.passed).toBe(false);
    expect(codes).toContain('QUEUE_OVERFLOW');
    expect(codes).toContain('UNDERUSED_HALL');
    expect(sim.peak.shoe).toBeGreaterThan(sim.peak.tap!);
  });

  it('twist: with one shoe stand, more taps don’t fix it; the shoe stand is the bottleneck', () => {
    const { sim, codes, score: r } = run(build([...taps2, tap4, exitDoor]));
    expect(r.passed).toBe(false);
    // ₹6,500 of taps and a door, and the hall is still less than half full.
    expect(codes).toContain('UNDERUSED_HALL');
    expect(sim.delivered).toBeLessThan(sim.seatTaken.length / 2);
    expect(sim.peak.shoe).toBeGreaterThanOrEqual(15);
    expect(sim.peak.tap).toBeLessThanOrEqual(2);
  });

  it('and the other way round: more shoe stands alone just move the line to the one tap', () => {
    const { sim, score: r } = run(build([shoe2, shoe3, exitDoor]));
    expect(r.passed).toBe(false);
    expect(sim.peak.tap).toBeGreaterThan(sim.peak.shoe!);
  });

  it('CROSS_FLOW: with only the top opening, diners walking out run into the line coming in', () => {
    const { codes, score: r } = run(build([shoe2, shoe3, ...taps2]));
    expect(r.passed).toBe(false);
    expect(codes).toContain('CROSS_FLOW');
  });

  it('pass A: 3 shoe stands, 3 taps and an exit door (₹9,000 ≤ starCost ₹9,500) earns 3 stars', () => {
    const d = build([shoe2, shoe3, ...taps2, exitDoor]);
    const { sim, codes, score: r } = run(d);
    expect(costOf(d)).toBe(9000);
    expect(sim.delivered).toBe(50);
    expect(codes).toEqual([]);
    expect(r.stars).toBe(3);
  });

  it('pass B: a different layout (4 taps, sliding exit door) also passes', () => {
    const d = build([shoe2, shoe3, ...taps2, tap4, { tool: 'slide1', x: 11, y: 8, orient: 'v', swing: -1 }]);
    const { codes, score: r } = run(d);
    expect(r.passed).toBe(true);
    expect(codes).toEqual([]);
    expect(costOf(d)).toBeGreaterThan(l3.starCost!);
    expect(r.stars).toBe(2);
  });

  it('seating fills from the back of the hall', () => {
    const d = build([shoe2, shoe3, ...taps2, exitDoor]);
    const world = makeWorld(l3, d);
    let s = initSim(l3, l3.seed, world);
    while (s.delivered === 0) s = step(l3, world, s);
    const first = s.agents.find((a) => a.todo && a.state === 'seated')!;
    const backX = Math.max(...world.seats.map(([x]) => x));
    expect(first.pos[0]).toBe(backX);
  });

  it('the previous pangat starts seated and walks out to the exit', () => {
    const world = makeWorld(l3, build([exitDoor]));
    const s0 = initSim(l3, l3.seed, world);
    expect(s0.agents.filter((a) => a.state === 'seated')).toHaveLength(l3.queue!.pangat.count);
    let s = s0;
    while (!s.agents.some((a) => a.leaving && a.state === 'done') && s.tick < 600) s = step(l3, world, s);
    const out = s.agents.find((a) => a.leaving && a.state === 'done')!;
    expect(out.pos[0]).toBe(l3.zones.exit.x);
  });
});

describe('level 3: building', () => {
  it('stations only go in their own area', () => {
    expect(checkPlace(l3, EMPTY_DESIGN, draft({ tool: 'shoe', x: 7, y: 5, swing: -1 })).ok).toBe(false);
    expect(checkPlace(l3, EMPTY_DESIGN, draft({ x: 7, y: 5, swing: -1 })).ok).toBe(true);
  });

  it('a station needs free floor in front, away from the next station', () => {
    // Facing the top wall: nowhere to stand.
    expect(checkPlace(l3, EMPTY_DESIGN, draft({ x: 7, y: 1, swing: -1 })).ok).toBe(false);
    // Right next to the fixed tap at (6,1): its standing spot (7,2) touches the tap's (6,2).
    expect(checkPlace(l3, EMPTY_DESIGN, draft({ x: 7, y: 1 })).ok).toBe(false);
  });

  it("nothing can be built on a station's standing spot", () => {
    expect(checkPlace(l3, EMPTY_DESIGN, draft({ tool: 'rail', x: 3, y: 2 })).ok).toBe(false);
  });

  it('queue rails block walking (₹300 each)', () => {
    const rails = build([3, 4, 5, 6, 7, 8, 9, 10].map((y) => ({ tool: 'rail', x: 1, y }) as Partial<Draft>));
    expect(costOf(rails)).toBe(2400);
    // The rails seal off the doorway column below the top row, so you have to go round by (1,1)... which is open.
    const world = makeWorld(l3, rails);
    const path = findPath(world, [0, 5], [2, 5], 1)!;
    expect(path.some(([x, y]) => x === 1 && y >= 3)).toBe(false);
  });
});
