import type { Agent } from './agents';
import { CONGESTION_TICKS, HEAD_ON_TICKS, SWING_TICKS } from './constants';
import type { Tile } from './types';

export type IncidentCode =
  | 'NO_PATH'
  | 'TOO_NARROW'
  | 'HEAD_ON_JAM'
  | 'SWING_BLOCK'
  | 'DINING_DISTURBED'
  | 'CONGESTION'
  | 'TIME_LIMIT'
  | 'OVER_BUDGET';

/** The "why it went wrong" card. */
export type Incident = {
  code: IncidentCode;
  /** When it first happened (for replay jumps). */
  tick: number;
  /** Where: highlighted red. */
  tiles: Tile[];
  agents: string[];
  /** How many times it happened. */
  count: number;
  title: string;
  evidence: string;
  principle: string;
  hint: string;
};

export const PRINCIPLES: Record<IncidentCode, { title: string; principle: string; hint: string }> = {
  TOO_NARROW: {
    title: 'Fit the load',
    principle: 'Openings must fit the largest thing passing through, not just the person.',
    hint: 'Try a double door or a wide sliding door.',
  },
  HEAD_ON_JAM: {
    title: 'Separate the flows',
    principle: 'When traffic goes both ways, give each direction its own path.',
    hint: 'Add a second door so each direction has its own way through.',
  },
  SWING_BLOCK: {
    title: 'Mind the swing',
    principle: 'A hinged door needs empty floor where it swings. Keep paths and queues out of the arc.',
    hint: 'Flip the swing side with R, or use a sliding door.',
  },
  NO_PATH: {
    title: 'Leave a way through',
    principle: 'Every task needs a route. Check for dead ends before you build.',
    hint: 'Add a door where people need to cross.',
  },
  DINING_DISTURBED: {
    title: 'Keep service out of the sangat',
    principle: 'Service routes should never cut through where people sit and eat.',
    hint: 'Put the doors where the route around is short, or wall off the hall’s side entrances.',
  },
  CONGESTION: {
    title: 'Widen the busy spots',
    principle: 'Where people wait most, space is worth the most.',
    hint: 'Look at the heatmap: widen or duplicate the red spots.',
  },
  TIME_LIMIT: {
    title: 'Short routes win',
    principle: 'Every extra step is paid for on every trip, by every person.',
    hint: 'Shorten the route or remove the bottleneck that slows everyone down.',
  },
  OVER_BUDGET: {
    title: 'Spend where it matters',
    principle: 'Put money into the parts that carry the load.',
    hint: 'Remove something, or swap a pricey part for a cheaper one that still fits.',
  },
};


const where = ([x, y]: Tile) => `(${x},${y})`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const near = (a: Tile, b: Tile) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) <= 2;

/** What an agent is complaining about right now, if anything. Drives speech bubbles. */
export function complaintOf(a: Agent, others: Map<string, Agent>, timeUp: boolean): IncidentCode | undefined {
  if (a.state === 'done') return undefined;
  if (a.stuckReason === 'no-path') return 'NO_PATH';
  if (a.stuckReason === 'too-narrow') return 'TOO_NARROW';
  if (a.waitReason === 'swing' && a.waitTicks >= SWING_TICKS) return 'SWING_BLOCK';
  if (a.waitReason === 'occupied' && a.waitTicks >= HEAD_ON_TICKS) {
    const b = a.blocker ? others.get(a.blocker) : undefined;
    if (b?.blocker === a.id && b.waitTicks >= HEAD_ON_TICKS) return 'HEAD_ON_JAM';
  }
  if (timeUp) return 'TIME_LIMIT';
  return undefined;
}

/** Add an occurrence to the matching incident (same code, close by), or start a new one. Mutates `list`. */
function record(list: Incident[], code: IncidentCode, tick: number, tiles: Tile[], agents: string[], merge: 'near' | 'global') {
  const hit = list.find((i) => i.code === code && (merge === 'global' || i.tiles.some((t) => tiles.some((u) => near(t, u)))));
  if (hit) {
    const fresh = agents.filter((id) => !hit.agents.includes(id));
    hit.agents.push(...fresh);
    for (const t of tiles) if (!hit.tiles.some((u) => u[0] === t[0] && u[1] === t[1])) hit.tiles.push(t);
    return hit;
  }
  const inc: Incident = { code, tick, tiles: [...tiles], agents: [...agents], count: 0, title: '', evidence: '', ...pick(code) };
  list.push(inc);
  return inc;
}

function pick(code: IncidentCode) {
  const { principle, hint } = PRINCIPLES[code];
  return { principle, hint };
}

export type DetectInput = {
  tick: number;
  agents: Agent[];
  /** Dining tiles stepped on this tick. */
  diningSteps: { tile: Tile; agent: string }[];
  timeUp: boolean;
  ended: boolean;
  delivered: number;
  totalTasks: number;
  timeLimitSec: number;
  heat: number[];
  gridW: number;
};

/** Run every detector for this tick. Returns the updated incident list (new array; incidents copied before change). */
export function detect(prev: Incident[], d: DetectInput): Incident[] {
  const list = prev.map((i) => ({ ...i, tiles: [...i.tiles], agents: [...i.agents] }));
  const byId = new Map(d.agents.map((a) => [a.id, a]));

  for (const a of d.agents) {
    if (a.state === 'done') continue;
    const facing: Tile = [a.pos[0] + a.dir[0], a.pos[1] + a.dir[1]];

    if (a.stuckReason === 'no-path') {
      const inc = record(list, 'NO_PATH', d.tick, [a.pos], [a.id], 'global');
      inc.count = inc.agents.length;
      inc.title = 'People had no way through';
      inc.evidence = `${plural(inc.count, 'person', 'people')} couldn’t find any route to where they had to go.`;
    }

    if (a.stuckReason === 'too-narrow') {
      const inc = record(list, 'TOO_NARROW', d.tick, [facing], [a.id], 'near');
      inc.count = inc.agents.length;
      inc.title = 'Crate carriers got stuck at a narrow door';
      inc.evidence = `${plural(inc.count, 'crate carrier')} couldn’t fit through the 1-tile opening at ${where(inc.tiles[0])}.`;
    }

    if (a.waitReason === 'swing' && a.waitTicks === SWING_TICKS) {
      const inc = record(list, 'SWING_BLOCK', d.tick, [facing], [a.id, ...(a.blocker ? [a.blocker] : [])], 'near');
      inc.count++;
      inc.title = 'A door couldn’t open';
      inc.evidence = `The door at ${where(inc.tiles[0])} was blocked ${plural(inc.count, 'time')}: someone stood in its swing for 2+ seconds.`;
    }

    // Fire once per stand-off, from the lower id's side.
    if (a.waitReason === 'occupied' && a.waitTicks === HEAD_ON_TICKS) {
      const b = a.blocker ? byId.get(a.blocker) : undefined;
      if (b && b.blocker === a.id && b.waitTicks >= HEAD_ON_TICKS) {
        const inc = record(list, 'HEAD_ON_JAM', d.tick, [a.pos, b.pos], [a.id, b.id], 'global');
        inc.count++;
        inc.title = 'Head-on jam';
        inc.evidence = `People walking opposite ways blocked each other ${plural(inc.count, 'time')}, for 3+ seconds each (first near ${where(inc.tiles[0])}).`;
      }
    }
  }

  for (const step of d.diningSteps) {
    const inc = record(list, 'DINING_DISTURBED', d.tick, [step.tile], [step.agent], 'global');
    inc.count++;
    const people = inc.agents.length;
    inc.title = 'Sevadars walked through the dining hall';
    inc.evidence = `${plural(people, 'person', 'people')} cut through where the sangat was eating (${plural(inc.count, 'step')} among the diners).`;
  }

  if (d.timeUp && !list.some((i) => i.code === 'TIME_LIMIT')) {
    const late = d.agents.filter((a) => a.state !== 'done');
    const inc = record(list, 'TIME_LIMIT', d.tick, late.map((a) => a.pos), late.map((a) => a.id), 'global');
    inc.count = 1;
    inc.title = 'Ran out of time';
    inc.evidence = `Only ${d.delivered} of ${d.totalTasks} loads were delivered in ${d.timeLimitSec}s.`;
  }

  if (d.ended && !list.some((i) => i.code === 'CONGESTION')) {
    const hot: Tile[] = [];
    let worst = 0;
    d.heat.forEach((v, i) => {
      if (v >= CONGESTION_TICKS) hot.push([i % d.gridW, Math.floor(i / d.gridW)]);
      worst = Math.max(worst, v);
    });
    if (hot.length) {
      const inc = record(list, 'CONGESTION', d.tick, hot, [], 'global');
      inc.count = hot.length;
      inc.title = 'Crowding at busy spots';
      inc.evidence = `People spent up to ${Math.round(worst / 10)}s in total waiting on a single tile (${plural(hot.length, 'hot spot')}).`;
    }
  }

  return list;
}

