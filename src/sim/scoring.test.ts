import { describe, expect, it } from 'vitest';
import { costOf, EMPTY_DESIGN, place, type Design, type Draft } from './design';
import { score } from './scoring';
import { runToEnd } from './simulate';
import type { Level } from './types';
import { LEVELS } from '../levels';

const [l1, l2] = LEVELS;
const build = (lvl: Level, items: Partial<Draft>[]): Design =>
  items.reduce<Design>((d, o) => place(lvl, d, { tool: 'door2', x: 8, y: 0, orient: 'v', swing: 1, ...o } as Draft), EMPTY_DESIGN);
const result = (lvl: Level, d: Design) => score(lvl, runToEnd(lvl, d), costOf(d));

const shared = build(l1, [{ y: 4 }]);
/** Two double doors with opposite one-way signs: ₹7,400. */
const signed = build(l1, [{ y: 2 }, { y: 6 }, { tool: 'oneway', y: 2, swing: 1 }, { tool: 'oneway', y: 6, swing: -1 }]);
/** Level 2: crate doors at the top, sangat entrances bricked up. */
const seal: Partial<Draft>[] = [
  { tool: 'wall', x: 8, y: 6 },
  { tool: 'wall', x: 8, y: 7 },
  { tool: 'wall', x: 15, y: 6 },
  { tool: 'wall', x: 15, y: 7 },
];
const l2Cheap = build(l2, [{ x: 5, y: 0 }, { x: 18, y: 0, swing: -1 }, ...seal]);
const l2Pricey = build(l2, [{ tool: 'slide2', x: 5, y: 0 }, { tool: 'slide2', x: 18, y: 0 }, ...seal]);

describe('score', () => {
  it('no stars for a failed run', () => {
    const r = result(l1, shared);
    expect(r.passed).toBe(false);
    expect(r.stars).toBe(0);
    expect(r.checks[0].ok).toBe(false);
  });

  it('stars match the checks (each star needs the ones before it)', () => {
    const r = result(l1, signed);
    expect(r.stars).toBe(r.checks.filter((c) => c.ok).length);
  });

  it('level 1: two signed double doors (₹7,400 ≤ starCost ₹7,500) earn 3 stars', () => {
    expect(costOf(signed)).toBe(7400);
    expect(result(l1, signed).stars).toBe(3);
  });

  it('level 2: the cheapest clean design (₹9,000 ≤ starCost ₹9,500) earns 3 stars', () => {
    expect(costOf(l2Cheap)).toBe(9000);
    expect(result(l2, l2Cheap).stars).toBe(3);
  });

  it('level 2: a clean but pricier design (₹12,000) stops at 2 stars', () => {
    const r = result(l2, l2Pricey);
    expect(r.passed).toBe(true);
    expect(r.stars).toBe(2);
  });

  it('each level plays on its own fixed seed: same design, same result', () => {
    expect(runToEnd(l1, signed)).toEqual(runToEnd(l1, signed));
    expect(runToEnd(l1, signed)).toEqual(runToEnd(l1, signed, l1.seed));
  });
});
