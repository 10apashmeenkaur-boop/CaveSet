import { describe, expect, it } from 'vitest';
import { getCell, gridFromLevel, zoneAt } from './grid';
import { LEVELS } from '../levels';

const l1 = LEVELS[0];

describe('gridFromLevel', () => {
  it('builds a w×h grid with fixed walls', () => {
    const g = gridFromLevel(l1);
    expect(g.cells).toHaveLength(16 * 10);
    expect(getCell(g, 8, 0)).toBe('wall');
    expect(getCell(g, 8, 9)).toBe('wall');
    expect(getCell(g, 0, 0)).toBe('floor');
  });

  it('returns null outside the grid', () => {
    expect(getCell(gridFromLevel(l1), -1, 0)).toBeNull();
    expect(getCell(gridFromLevel(l1), 16, 0)).toBeNull();
  });
});

describe('zoneAt', () => {
  it('finds kitchen and washing', () => {
    expect(zoneAt(l1, 0, 0)).toBe('kitchen');
    expect(zoneAt(l1, 15, 9)).toBe('washing');
    expect(zoneAt(l1, 8, 5)).toBeNull();
  });
});
