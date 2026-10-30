import { describe, expect, it } from 'vitest';
import { getCell } from './grid';
import { buildGrid, checkPlace, costOf, EMPTY_DESIGN, eraseAt, eraseTarget, place, swingTiles, type Draft } from './design';
import { LEVELS } from '../levels';

const [l1, l2] = LEVELS;
const door = (over: Partial<Draft> = {}): Draft => ({ tool: 'door1', x: 8, y: 4, orient: 'v', swing: 1, ...over });

describe('cost', () => {
  it('matches placed items and refunds on erase', () => {
    let d = place(l1, EMPTY_DESIGN, door());
    d = place(l1, d, door({ tool: 'door2', y: 0 }));
    expect(costOf(d)).toBe(2000 + 3500);
    d = eraseAt(d, 8, 1); // second tile of the double door
    expect(costOf(d)).toBe(2000);
  });
});

describe('checkPlace (level 1)', () => {
  it('allows a door in the fixed wall', () => {
    expect(checkPlace(l1, EMPTY_DESIGN, door()).ok).toBe(true);
  });

  it('rejects building off the editable wall', () => {
    expect(checkPlace(l1, EMPTY_DESIGN, door({ x: 3 })).ok).toBe(false);
  });

  it('rejects walls when the level only allows doors', () => {
    expect(checkPlace(l1, EMPTY_DESIGN, door({ tool: 'wall' })).ok).toBe(false);
  });

  it('rejects overlapping items', () => {
    const d = place(l1, EMPTY_DESIGN, door({ tool: 'slide2', y: 4 }));
    expect(checkPlace(l1, d, door({ y: 5 })).ok).toBe(false);
  });

  it('rejects a hinged door whose swing hits a wall', () => {
    // Rotated to span x: it would swing up/down into the fixed wall column.
    expect(checkPlace(l1, EMPTY_DESIGN, door({ orient: 'h' })).ok).toBe(false);
  });

  it('rejects a double door hanging off the end of the wall', () => {
    expect(checkPlace(l1, EMPTY_DESIGN, door({ tool: 'door2', y: 9 })).ok).toBe(false);
  });
});

describe('checkPlace (level 2)', () => {
  it('rejects walls in the dining hall', () => {
    expect(checkPlace(l2, EMPTY_DESIGN, { tool: 'wall', x: 9, y: 5, orient: 'v', swing: 1 }).ok).toBe(false);
  });
  it('allows walls on open floor', () => {
    expect(checkPlace(l2, EMPTY_DESIGN, { tool: 'wall', x: 6, y: 5, orient: 'v', swing: 1 }).ok).toBe(true);
  });
});

describe('swing + grid', () => {
  it('swing tiles sit on the swing side', () => {
    expect(swingTiles(door({ tool: 'door2', swing: -1 }))).toEqual([[7, 4], [7, 5]]);
    expect(swingTiles(door({ tool: 'slide1' }))).toEqual([]);
  });

  it('doors cut through fixed walls', () => {
    const g = buildGrid(l1, place(l1, EMPTY_DESIGN, door()));
    expect(getCell(g, 8, 4)).toBe('door');
    expect(getCell(g, 8, 3)).toBe('wall');
  });
});

describe('eraser takes the whole object', () => {
  const l3 = LEVELS[2];
  it("clicking a door's swing area removes the door", () => {
    const d = place(l1, EMPTY_DESIGN, door()); // swings into (9,4)
    expect(eraseAt(d, 9, 4).items).toHaveLength(0);
  });

  it("clicking a station's standing spot removes the station", () => {
    const d = place(l3, EMPTY_DESIGN, { tool: 'tap', x: 7, y: 5, orient: 'h', swing: -1 }); // stands at (7,4)
    expect(eraseTarget(d, 7, 4)?.tool).toBe('tap');
    expect(eraseAt(d, 7, 4).items).toHaveLength(0);
  });

  it('empty floor erases nothing', () => {
    const d = place(l1, EMPTY_DESIGN, door());
    expect(eraseAt(d, 2, 2)).toBe(d);
  });
});
