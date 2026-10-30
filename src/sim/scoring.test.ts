import { describe, expect, it } from 'vitest';
import { costOf, EMPTY_DESIGN, place, type Design } from './design';
import { score } from './scoring';
import { runToEnd } from './simulate';
import { LEVELS } from '../levels';

const l1 = LEVELS[0];
const doors = (...ys: number[]): Design =>
  ys.reduce<Design>((d, y) => place(l1, d, { tool: 'door2', x: 8, y, orient: 'v', swing: 1 }), EMPTY_DESIGN);
const result = (d: Design, seed = 1) => score(l1, runToEnd(l1, d, seed), costOf(d));
const signed = place(l1, place(l1, doors(2, 6), { tool: 'oneway', x: 8, y: 2, orient: 'v', swing: 1 }), {
  tool: 'oneway', x: 8, y: 6, orient: 'v', swing: -1,
});

describe('score', () => {
  it('no stars for a failed run', () => {
    const r = result(doors(4));
    expect(r.passed).toBe(false);
    expect(r.stars).toBe(0);
    expect(r.checks[0].ok).toBe(false);
  });

  it('a passing run earns 1–3 stars, and the stars match the checks', () => {
    const r = result(signed);
    expect(r.passed).toBe(true);
    expect(r.stars).toBe(r.checks.filter((c) => c.ok).length);
    expect(r.stars).toBeGreaterThanOrEqual(1);
  });

  it('separate one-way flows earn all 3 stars', () => {
    expect(result(signed).stars).toBe(3);
  });

  it('two signed double doors are not thrifty in level 1 (₹7,400 of ₹7,500)', () => {
    expect(result(signed).thrifty).toBe(false);
  });
});
