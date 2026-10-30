import { describe, expect, it } from 'vitest';
import { EMPTY_DESIGN } from './design';
import type { IncidentCode } from './failures';
import { EMPTY_PROGRESS, goalText, mistriLine, recordRun, type Progress } from './progress';
import type { Score } from './scoring';
import { LEVELS } from '../levels';

const [l1, , l3] = LEVELS;
const fail: Score = { passed: false, stars: 0, checks: [], timeSec: 60, complaints: 0 };
const pass = (stars: number, timeSec: number): Score => ({ passed: true, stars, checks: [], timeSec, complaints: 0 });
const failRun = (p: Progress, codes: IncidentCode[] = ['TIME_LIMIT']) => recordRun(p, l1, fail, [...codes], EMPTY_DESIGN);

describe('Mistri Ji', () => {
  it('gives his brief until two failed runs in a row, then a hint', () => {
    expect(mistriLine(l1, EMPTY_PROGRESS)).toEqual({ text: l1.mistri!.brief, hint: false });
    const once = failRun(EMPTY_PROGRESS);
    expect(mistriLine(l1, once)!.hint).toBe(false);
    const twice = failRun(once);
    expect(mistriLine(l1, twice)!.hint).toBe(true);
  });

  it('picks the hint for what went wrong, and a pass resets the streak', () => {
    const p = failRun(failRun(EMPTY_PROGRESS), ['TOO_NARROW', 'TIME_LIMIT']);
    expect(mistriLine(l1, p)!.text).toBe(l1.mistri!.hints.TOO_NARROW);
    const passed = recordRun(p, l1, pass(1, 58), [], EMPTY_DESIGN);
    expect(mistriLine(l1, passed)!.hint).toBe(false);
  });

  it('every level has a brief, a default hint and a diary page', () => {
    for (const l of LEVELS) {
      expect(l.mistri?.brief).toBeTruthy();
      expect(l.mistri?.hints.default).toBeTruthy();
      expect(l.insight?.quote).toBeTruthy();
    }
  });
});

describe('diary and best run', () => {
  it('a diary page unlocks only by failing the level and then passing it', () => {
    const straightPass = recordRun(EMPTY_PROGRESS, l1, pass(3, 40), [], EMPTY_DESIGN);
    expect(straightPass.insights).toEqual([]);
    const learned = recordRun(failRun(EMPTY_PROGRESS), l1, pass(1, 58), [], EMPTY_DESIGN);
    expect(learned.insights).toEqual([l1.id]);
  });

  it('keeps the best run: more stars, then faster', () => {
    let p = recordRun(EMPTY_PROGRESS, l1, pass(2, 45), [], EMPTY_DESIGN);
    p = recordRun(p, l1, pass(2, 50), [], EMPTY_DESIGN);
    expect(p.best[l1.id].timeSec).toBe(45);
    p = recordRun(p, l1, pass(3, 55), [], EMPTY_DESIGN);
    expect(p.best[l1.id]).toMatchObject({ stars: 3, timeSec: 55 });
    expect(p.stars[l1.id]).toBe(3);
  });
});

describe('goal label', () => {
  it('comes from the level JSON', () => {
    expect(goalText(l3, 27, 50)).toBe('🍽 27/50 seated');
    expect(goalText(l1, 3, 12)).toBe('📦 3/12 delivered');
  });
});
