import type { IncidentCode } from './failures';
import { TICKS_PER_SEC } from './constants';
import type { SimState } from './simulate';
import type { Level } from './types';

/** Incidents that mean the job wasn't done properly, even if everything arrived. */
const FAILS: IncidentCode[] = ['NO_PATH', 'TOO_NARROW', 'TIME_LIMIT', 'DINING_DISTURBED'];
/** Incidents people grumble about: shown as complaints, they don't cost the pass. */
const COMPLAINTS: IncidentCode[] = ['HEAD_ON_JAM', 'SWING_BLOCK'];

export type Check = { label: string; ok: boolean; detail: string };

export type Score = {
  passed: boolean;
  /** 0 if failed, else 1-3: one for passing, two if also under target time, three if also at or under the level's starCost. */
  stars: number;
  checks: Check[];
  timeSec: number;
  complaints: number;
};

export function targetSec(level: Level): number {
  return level.targetSec ?? Math.round(level.timeLimitSec * 0.8);
}

/** Spend at most this for the third star. Defaults to the full budget. */
export function starCost(level: Level): number {
  return level.starCost ?? level.budget;
}

export function score(level: Level, sim: SimState, cost: number): Score {
  const timeSec = sim.tick / TICKS_PER_SEC;
  const codes = sim.incidents.map((i) => i.code);
  const failCodes = FAILS.filter((c) => codes.includes(c));
  const underBudget = cost <= level.budget;
  const passed = sim.finished && sim.delivered === sim.totalTasks && !failCodes.length && underBudget;

  const complaints = sim.incidents.filter((i) => COMPLAINTS.includes(i.code)).reduce((n, i) => n + i.count, 0);
  const timed = level.timeLimitSec > 0;
  const quick = passed && (!timed || timeSec <= targetSec(level));
  const cheap = cost <= starCost(level);
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const checks: Check[] = [
    {
      label: 'Function',
      ok: passed,
      detail: passed
        ? `All ${sim.totalTasks} loads delivered, nobody disturbed.`
        : `${sim.delivered} of ${sim.totalTasks} delivered${failCodes.includes('DINING_DISTURBED') ? ', and people walked through the langar' : ''}.`,
    },
    {
      label: 'Time',
      ok: quick,
      detail: timed ? `${timeSec.toFixed(1)}s (target ${targetSec(level)}s, limit ${level.timeLimitSec}s)` : `${timeSec.toFixed(1)}s`,
    },
    {
      label: 'Cost',
      ok: quick && cheap,
      detail: `${inr(cost)} (${inr(starCost(level))} or less for the third star)`,
    },
  ];

  return {
    passed,
    stars: !passed ? 0 : !quick ? 1 : !cheap ? 2 : 3,
    checks,
    timeSec,
    complaints,
  };
}
