import type { IncidentCode } from './failures';
import { RACK_SEC_PER_TICK, TICKS_PER_SEC } from './constants';
import type { SimState } from './simulate';
import type { Level } from './types';

/** Incidents that mean the job wasn't done properly, even if everything arrived. */
const FAILS: IncidentCode[] = [
  'NO_PATH',
  'TOO_NARROW',
  'TIME_LIMIT',
  'DINING_DISTURBED',
  'QUEUE_OVERFLOW',
  'CROSS_FLOW',
  'UNDERUSED_HALL',
  'RAMP_TOO_STEEP',
  'TROLLEY_ROLLBACK',
  'NO_HANDRAIL',
  'TIGHT_TURN',
  'NO_ACCESSIBLE_ROUTE',
  'WATER_POOLING',
  'STILL_WET',
  'COUNTER_WET',
  'FELL_THROUGH',
  'RUSTED',
  'FRAME_SAG',
];
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

/** Seconds of game time after `tick` ticks. On the rack level one tick is several game seconds. */
export function gameSeconds(level: Level, tick: number): number {
  return level.rack ? tick * RACK_SEC_PER_TICK : tick / TICKS_PER_SEC;
}

export function score(level: Level, sim: SimState, cost: number): Score {
  const timeSec = gameSeconds(level, sim.tick);
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
      detail: level.rack
        ? passed
          ? `All ${sim.totalTasks} utensils dry, nothing lost, nothing spilled.`
          : `${sim.delivered} of ${sim.totalTasks} utensils dry.`
        : level.rise
        ? passed
          ? `All ${sim.totalTasks} up on the roof, wheels and all.`
          : `${sim.delivered} of ${sim.totalTasks} got up to the roof.`
        : level.queue
        ? passed
          ? `All ${sim.totalTasks} visitors seated, no spills, no crossing.`
          : `${sim.delivered} of ${sim.totalTasks} visitors seated.`
        : passed
          ? `All ${sim.totalTasks} loads delivered, nobody disturbed.`
          : `${sim.delivered} of ${sim.totalTasks} delivered${failCodes.includes('DINING_DISTURBED') ? ', and people walked through the dining hall' : ''}.`,
    },
    {
      label: 'Time',
      ok: quick,
      detail: level.rack
        ? `Dry in ${Math.ceil(timeSec / 60)} min (target ${targetSec(level) / 60} min, limit ${level.timeLimitSec / 60} min)`
        : timed
          ? `${timeSec.toFixed(1)}s (target ${targetSec(level)}s, limit ${level.timeLimitSec}s)`
          : `${timeSec.toFixed(1)}s`,
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
