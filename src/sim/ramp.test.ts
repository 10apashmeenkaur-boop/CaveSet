import { describe, expect, it } from 'vitest';
import { checkPlace, costOf, EMPTY_DESIGN, eraseAt, place, type Design, type Draft } from './design';
import { makeWorld } from './pathfinding';
import { score } from './scoring';
import { runToEnd } from './simulate';
import { LEVELS } from '../levels';

const L4 = LEVELS[3];
const build = (items: Draft[]): Design => items.reduce((d, it) => place(L4, d, it), EMPTY_DESIGN);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
/** A ramp piece (2 tiles wide, 1 long) at (x, y), rising in direction dx (along x) or dy (along y). */
const ramp = (x: number, y: number, dx: 0 | 1 | -1, dy: 0 | 1 | -1, slope = 12): Draft =>
  dx ? { tool: 'ramp', x, y, orient: 'v', swing: dx as 1 | -1, slope } : { tool: 'ramp', x, y, orient: 'h', swing: dy as 1 | -1, slope };
const landing = (x: number, y: number): Draft => ({ tool: 'landing', x, y, orient: 'v', swing: 1 });

/** Switchback: up east along rows 7-8, two landings to turn on, then up west along rows 5-6 to the roof. ₹16,800. */
const SWITCHBACK = [...range(5, 16).map((x) => ramp(x, 7, 1, 0)), landing(18, 5), landing(18, 8), ...range(5, 16).map((x) => ramp(x, 5, -1, 0))];
const run = (items: Draft[]) => {
  const design = build(items);
  const sim = runToEnd(L4, design);
  return { design, sim, codes: sim.incidents.map((i) => i.code), result: score(L4, sim, costOf(design)) };
};
const stuck = (sim: ReturnType<typeof runToEnd>, type: string) => sim.agents.filter((a) => a.type === type).map((a) => a.stuckReason ?? a.state);

describe('Level 4: Ramp to the Roof', () => {
  it('is deterministic', () => {
    const a = run(SWITCHBACK).sim;
    const b = run(SWITCHBACK).sim;
    expect(a.tick).toBe(b.tick);
    expect(a.agents.map((x) => x.pos)).toEqual(b.agents.map((x) => x.pos));
  });

  it('a straight 1:12 ramp does not fit: 1.2 m needs 24 tiles, the longest run to the roof is 15', () => {
    const straight = range(5, 28).map((x) => ramp(x, 2, -1, 0));
    const design = build(straight);
    expect(design.items.length).toBeLessThan(24);
    expect(design.items.length).toBeLessThanOrEqual(15);
    // What does fit hangs from the roof with its foot 45 cm off the ground, so nobody gets on it.
    const t = makeWorld(L4, design).terrain!;
    expect(t.center[2 * t.w + 5] + t.rise[2 * t.w + 5] / 2).toBe(1200);
    expect(t.center[2 * t.w + 19] - t.rise[2 * t.w + 19] / 2).toBe(450);
    const { codes, result } = run(straight);
    expect(result.passed).toBe(false);
    expect(codes).toContain('NO_PATH');
  });

  it('a 1:8 switchback fits, and people on foot get up it, but the wheelchair can’t climb it and the trolley rolls back', () => {
    const { sim, codes, result } = run([
      ...range(5, 12).map((x) => ramp(x, 7, 1, 0, 8)),
      landing(14, 5),
      landing(14, 8),
      ...range(5, 12).map((x) => ramp(x, 5, -1, 0, 8)),
    ]);
    expect(codes).toContain('RAMP_TOO_STEEP');
    expect(codes).toContain('TROLLEY_ROLLBACK');
    expect(stuck(sim, 'wheelchair')).toEqual(['too-steep']);
    expect(sim.agents.filter((a) => a.type === 'sack').every((a) => a.state === 'done')).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('a 1:12 switchback with landings passes with three stars', () => {
    const { sim, result } = run(SWITCHBACK);
    expect(sim.delivered).toBe(sim.totalTasks);
    expect(sim.incidents).toEqual([]);
    expect(result.passed).toBe(true);
    expect(costOf(build(SWITCHBACK))).toBe(16800);
    expect(result.stars).toBe(3);
  });

  it('a second switchback (lower flight, different landings) also passes', () => {
    const { result } = run([
      ...range(5, 16).map((x) => ramp(x, 9, 1, 0)),
      landing(18, 6),
      landing(18, 9),
      ...range(5, 16).map((x) => ramp(x, 5, -1, 0)),
    ]);
    expect(result.passed).toBe(true);
  });

  it('handrails cost more: the same switchback with them passes on two stars', () => {
    const rails = range(5, 16).map((x): Draft => ({ tool: 'handrail', x, y: 8, orient: 'v', swing: 1 }));
    const { result } = run([...SWITCHBACK, ...rails]);
    expect(result.passed).toBe(true);
    expect(result.stars).toBe(2);
  });

  it('the landings sit halfway up and the ramp meets the roof exactly', () => {
    const t = makeWorld(L4, build(SWITCHBACK)).terrain!;
    expect(t.center[5 * t.w + 18]).toBe(600);
    expect(t.center[8 * t.w + 18]).toBe(600);
    expect(t.center[5 * t.w + 5] + t.rise[5 * t.w + 5] / 2).toBe(1200);
  });

  it('stairs only: people on foot get up, wheels have no way up', () => {
    const { sim, codes } = run([{ tool: 'stairs', x: 8, y: 3, orient: 'v', swing: -1 }]);
    expect(codes).toContain('NO_ACCESSIBLE_ROUTE');
    expect(stuck(sim, 'wheelchair')).toEqual(['no-access']);
    expect(sim.agents.filter((a) => a.type === 'sack' || a.type === 'elderly').every((a) => a.state === 'done')).toBe(true);
  });

  it('one landing is too small for a switchback: people on foot get round it, the wheelchair can’t turn', () => {
    const { sim, codes } = run([...range(5, 16).map((x) => ramp(x, 7, 1, 0)), landing(18, 7), ...range(5, 16).map((x) => ramp(x, 5, -1, 0))]);
    expect(codes).toContain('TIGHT_TURN');
    expect(stuck(sim, 'wheelchair')).toEqual(['tight-turn']);
    expect(sim.agents.filter((a) => a.type === 'sack').every((a) => a.state === 'done')).toBe(true);
  });

  it('a wheelchair gives out after 15 tiles of ramp with no landing', () => {
    const { sim, codes } = run(range(4, 19).map((x) => ramp(x, 9, 1, 0)));
    expect(codes).toContain('NO_REST_LANDING');
    expect(stuck(sim, 'wheelchair')).toEqual(['exhausted']);
  });

  it('build rules: not on the roof or in the yard; handrails go on ramps; erasing a ramp takes its handrail', () => {
    expect(checkPlace(L4, EMPTY_DESIGN, ramp(2, 2, -1, 0)).ok).toBe(false);
    expect(checkPlace(L4, EMPTY_DESIGN, ramp(1, 9, 1, 0)).ok).toBe(false);
    const rail: Draft = { tool: 'handrail', x: 8, y: 7, orient: 'v', swing: 1 };
    expect(checkPlace(L4, EMPTY_DESIGN, rail).ok).toBe(false);
    const d = build([ramp(8, 7, 1, 0), rail]);
    expect(d.items.map((i) => i.tool)).toEqual(['ramp', 'handrail']);
    expect(eraseAt(d, 8, 8).items).toEqual([]);
  });
});
