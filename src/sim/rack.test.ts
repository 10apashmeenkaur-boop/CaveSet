import { describe, expect, it } from 'vitest';
import { costOf, EMPTY_DESIGN } from './design';
import { DEFAULT_RACK, type RackDesign } from './rack';
import { score } from './scoring';
import { runToEnd } from './simulate';
import { LEVELS } from '../levels';

const RACK = LEVELS.find((l) => l.id === 'o1-rack')!;
/** Wire mesh, plate dividers, drip tray, stainless steel: the parts every good rack here needs. */
const GOOD: Partial<RackDesign> = { base: 'mesh', dividers: true, dripTray: true, material: 'stainless' };
const run = (r: Partial<RackDesign>) => {
  const design = { ...EMPTY_DESIGN, rack: { ...DEFAULT_RACK, ...r } };
  const sim = runToEnd(RACK, design);
  return { sim, codes: sim.incidents.map((i) => i.code), result: score(RACK, sim, costOf(design)), cost: costOf(design) };
};

describe('Object 1: The Utensil Rack', () => {
  it('is deterministic', () => {
    const a = run({ ...GOOD, gap: 20, cup: 'perforated' }).sim;
    const b = run({ ...GOOD, gap: 20, cup: 'perforated' }).sim;
    expect(a.tick).toBe(b.tick);
    expect(a.rack).toEqual(b.rack);
  });

  it('a solid tray pools water and nothing sitting in it dries', () => {
    const { codes, result } = run({});
    expect(codes).toEqual(expect.arrayContaining(['WATER_POOLING', 'STILL_WET']));
    expect(result.passed).toBe(false);
  });

  it('twist 1: a big-gap mesh drains and dries fastest, but the spoons fall through', () => {
    const big = run({ ...GOOD, gap: 35 });
    const small = run({ ...GOOD, gap: 10 });
    expect(big.codes).toEqual(['FELL_THROUGH']);
    expect(big.sim.rack!.items.filter((u) => u.fallen).map((u) => u.kind)).toEqual(Array(10).fill('spoon'));
    // At 10 mm the spoons stay put, but plates that close together don't dry in time.
    expect(small.codes).toEqual(['STILL_WET']);
    expect(small.sim.rack!.items.filter((u) => u.kind === 'plate').every((u) => u.water > 0.3)).toBe(true);
  });

  it('twist 2: a solid cutlery cup keeps the spoons wet; a perforated one fixes it', () => {
    const solid = run({ ...GOOD, gap: 35, cup: 'solid' });
    expect(solid.codes).toEqual(expect.arrayContaining(['WATER_POOLING', 'STILL_WET']));
    expect(solid.sim.rack!.items.filter((u) => u.water > 0.3).every((u) => u.kind === 'spoon')).toBe(true);
    const perforated = run({ ...GOOD, gap: 35, cup: 'perforated' });
    expect(perforated.result.passed).toBe(true);
  });

  it('pass A: wire mesh, 20 mm, dividers, drip tray, perforated cup is the cheapest clean design, for 3 stars', () => {
    const { sim, result, cost } = run({ ...GOOD, gap: 20, cup: 'perforated' });
    expect(cost).toBe(1050);
    expect(sim.delivered).toBe(40);
    expect(sim.incidents).toEqual([]);
    expect(result.stars).toBe(3);
  });

  it('pass B: a perforated sheet with 35 mm holes passes too, slower and dearer', () => {
    const { result, cost } = run({ ...GOOD, base: 'perforated', gap: 35, cup: 'perforated' });
    expect(cost).toBe(1150);
    expect(result.passed).toBe(true);
    expect(result.stars).toBe(2);
  });

  it('plastic works as well as stainless steel', () => {
    expect(run({ ...GOOD, gap: 20, cup: 'perforated', material: 'plastic' }).result.stars).toBe(3);
  });

  it('without plate dividers the plates lie stacked and stay wet', () => {
    const { codes } = run({ ...GOOD, gap: 20, cup: 'perforated', dividers: false });
    expect(codes).toEqual(['STILL_WET']);
  });

  it('without a drip tray the water ends up on the counter', () => {
    const { sim, codes } = run({ ...GOOD, gap: 20, cup: 'perforated', dripTray: false });
    expect(codes).toEqual(['COUNTER_WET']);
    expect(sim.rack!.counter).toBeGreaterThan(300);
  });

  it('mild steel rusts in the one-month check; thin aluminium bends under the wet load', () => {
    expect(run({ ...GOOD, gap: 20, cup: 'perforated', material: 'mildSteel' }).codes).toEqual(['RUSTED']);
    expect(run({ ...GOOD, gap: 20, cup: 'perforated', material: 'aluminium' }).codes).toEqual(['FRAME_SAG']);
  });

  it('even the dearest rack is within budget', () => {
    expect(run({ ...GOOD, base: 'perforated', cup: 'perforated' }).cost).toBeLessThanOrEqual(RACK.budget);
  });
});
