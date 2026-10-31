import type { Design } from './design';
import type { IncidentCode } from './failures';
import type { Score } from './scoring';
import type { Level } from './types';

/** Saved between visits (localStorage). */
export type Progress = {
  stars: Record<string, number>;
  /** Incident codes whose principles the player has unlocked. */
  principles: string[];
  /** Failed runs in a row per level (reset by a pass). Mistri Ji's hint shows from HINT_AFTER_FAILS. */
  fails: Record<string, number>;
  /** What went wrong on the last failed run per level, to pick a fitting hint. */
  lastFail: Record<string, IncidentCode[]>;
  /** Levels failed at least once; passing one of these unlocks its diary page. */
  failed: string[];
  /** Diary pages unlocked (level ids). */
  insights: string[];
  /** Best passing run per level, replayed as the personal-best ghost (the sim is deterministic). */
  best: Record<string, { design: Design; stars: number; timeSec: number }>;
  /** Dev builds only: every level open. */
  devUnlock?: boolean;
};

export const EMPTY_PROGRESS: Progress = { stars: {}, principles: [], fails: {}, lastFail: {}, failed: [], insights: [], best: {} };

/** Mistri Ji speaks up with a hint after this many failed runs in a row. */
export const HINT_AFTER_FAILS = 2;

/** Codes in the order a hint should address them: what blocks the run outright first. */
const HINT_ORDER: IncidentCode[] = [
  'NO_ACCESSIBLE_ROUTE',
  'FELL_THROUGH',
  'FRAME_SAG',
  'WATER_POOLING',
  'COUNTER_WET',
  'STILL_WET',
  'RUSTED',
  'RAMP_TOO_STEEP',
  'TROLLEY_ROLLBACK',
  'TIGHT_TURN',
  'NO_HANDRAIL',
  'NO_PATH',
  'TOO_NARROW',
  'DINING_DISTURBED',
  'CROSS_FLOW',
  'QUEUE_OVERFLOW',
  'UNDERUSED_HALL',
  'HEAD_ON_JAM',
  'SWING_BLOCK',
  'TIME_LIMIT',
];

/** Fold one finished run into saved progress. Pure. */
export function recordRun(p: Progress, level: Level, r: Score, codes: IncidentCode[], design: Design): Progress {
  const id = level.id;
  const next: Progress = { ...p, stars: { ...p.stars }, fails: { ...p.fails }, lastFail: { ...p.lastFail }, best: { ...p.best } };
  if (!r.passed) {
    next.fails[id] = (p.fails[id] ?? 0) + 1;
    next.lastFail[id] = codes;
    if (!p.failed.includes(id)) next.failed = [...p.failed, id];
    return next;
  }
  next.fails[id] = 0;
  if (r.stars > (p.stars[id] ?? 0)) next.stars[id] = r.stars;
  if (p.failed.includes(id) && level.insight && !p.insights.includes(id)) next.insights = [...p.insights, id];
  const best = p.best[id];
  if (!best || r.stars > best.stars || (r.stars === best.stars && r.timeSec < best.timeSec)) {
    next.best[id] = { design, stars: r.stars, timeSec: r.timeSec };
  }
  return next;
}

/** What Mistri Ji says in the quote card: his brief, or a nudge after repeated failures. */
export function mistriLine(level: Level, p: Progress): { text: string; hint: boolean } | null {
  const m = level.mistri;
  if (!m) return null;
  if ((p.fails[level.id] ?? 0) < HINT_AFTER_FAILS) return { text: m.brief, hint: false };
  const codes = p.lastFail[level.id] ?? [];
  const code = HINT_ORDER.find((c) => codes.includes(c) && m.hints[c]);
  return { text: code ? m.hints[code] : (m.hints.default ?? m.brief), hint: true };
}

/** "🍽 {n}/{total} seated" → "🍽 27/50 seated". */
export function goalText(level: Level, n: number, total: number): string {
  return (level.goalLabel ?? '📦 {n}/{total} delivered').replace('{n}', String(n)).replace('{total}', String(total));
}
