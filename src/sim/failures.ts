import { AGENT_INFO, goingIn, type Agent, type StuckReason } from './agents';
import { CONGESTION_TICKS, CROSS_FLOW_TICKS, HEAD_ON_TICKS, QUEUE_SPILL_TICKS, SWING_TICKS, UNDERUSED_SHARE } from './constants';
import type { StationKind, Tile, Zone } from './types';

export type IncidentCode =
  | 'NO_PATH'
  | 'TOO_NARROW'
  | 'HEAD_ON_JAM'
  | 'SWING_BLOCK'
  | 'DINING_DISTURBED'
  | 'CONGESTION'
  | 'TIME_LIMIT'
  | 'OVER_BUDGET'
  | 'QUEUE_OVERFLOW'
  | 'CROSS_FLOW'
  | 'UNDERUSED_HALL'
  | 'RAMP_TOO_STEEP'
  | 'TROLLEY_ROLLBACK'
  | 'NO_HANDRAIL'
  | 'TIGHT_TURN'
  | 'NO_ACCESSIBLE_ROUTE';

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
    title: 'Keep service away from diners',
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
  QUEUE_OVERFLOW: {
    title: 'Fix the slowest station first',
    principle: 'A line grows at the slowest step. If people arrive faster than it can serve, the line spills out the door.',
    hint: 'Find the busiest station (the marker shows it) and add another unit there.',
  },
  CROSS_FLOW: {
    title: 'Separate in and out',
    principle: 'People arriving and people leaving should not share one path.',
    hint: 'Give the hall a second door with a one-way sign, so leavers have their own way out.',
  },
  UNDERUSED_HALL: {
    title: 'The bottleneck sets the speed',
    principle: 'The slowest step limits the whole line. Speeding up any other step changes nothing.',
    hint: 'Watch the busiest-station marker. More taps won’t help if the shoe stand is the slow one.',
  },
  RAMP_TOO_STEEP: {
    title: 'Gentle slopes only',
    principle: 'A wheelchair user can push up a 1:12 slope at most: 1 m of height needs 12 m of ramp.',
    hint: 'Press R for a gentler slope. A gentler ramp is longer, so plan where it goes.',
  },
  TROLLEY_ROLLBACK: {
    title: 'Loads roll downhill',
    principle: 'A heavy trolley on a steep ramp pulls back harder than anyone can push. Keep it to 1:12.',
    hint: 'Use 1:12 for the whole ramp the trolley takes.',
  },
  NO_HANDRAIL: {
    title: 'Something to hold on to',
    principle: 'Older people need a handrail on every ramp and stair, all the way up.',
    hint: 'Put a handrail along the ramp or stairs the elderly visitor uses.',
  },
  TIGHT_TURN: {
    title: 'Room to turn',
    principle: 'A wheelchair needs about 1.5 m of flat floor to turn. Every turn on a ramp needs a full landing.',
    hint: 'Turn on landings, and make sure the whole width of each ramp meets one.',
  },
  NO_ACCESSIBLE_ROUTE: {
    title: 'Stairs aren’t for everyone',
    principle: 'Stairs leave out wheelchairs and trolleys. There must be a step-free way up.',
    hint: 'Build a ramp all the way up, from the ground to the roof.',
  },
};

/** Ramp-level stuck reasons and the failure each one is. */
const RAMP_FAILS: Partial<Record<StuckReason, IncidentCode>> = {
  'too-steep': 'RAMP_TOO_STEEP',
  rollback: 'TROLLEY_ROLLBACK',
  'tight-turn': 'TIGHT_TURN',
  'no-access': 'NO_ACCESSIBLE_ROUTE',
};

const RAMP_TITLES: Partial<Record<IncidentCode, (who: string) => [string, string]>> = {
  RAMP_TOO_STEEP: (who) => ['The ramp was too steep', `${who} couldn’t push up the ramp. Steeper than 1:12 is too much.`],
  TROLLEY_ROLLBACK: (who) => ['A trolley rolled back down', `${who} got partway up the steep ramp and slid back to the bottom.`],
  TIGHT_TURN: (who) => ['No room to turn', `${who} couldn’t turn here: a turn needs a 3×3 landing that the whole ramp meets.`],
  NO_ACCESSIBLE_ROUTE: (who) => ['No step-free way up', `${who} had no way up without steps.`],
};


const where = ([x, y]: Tile) => `(${x},${y})`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const near = (a: Tile, b: Tile) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) <= 2;

const inZone = ([x, y]: Tile, z: Zone) => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h;

/** One going in, the other going out. */
function crossing(a: Agent, b: Agent | undefined): boolean {
  return !!b && ((goingIn(a) && !!b.leaving) || (!!a.leaving && goingIn(b)));
}

/** Waiting at the door because the line hasn't moved. */
function spilled(a: Agent, entrance: Zone | undefined): boolean {
  return !!entrance && goingIn(a) && a.state === 'waiting' && a.waitReason !== 'service' && inZone(a.pos, entrance);
}

/** What an agent is complaining about right now, if anything. Drives speech bubbles. */
export function complaintOf(a: Agent, others: Map<string, Agent>, timeUp: boolean, entrance?: Zone): IncidentCode | undefined {
  if (a.state === 'done' || a.state === 'seated') return undefined;
  if (a.stuckReason === 'no-path') return 'NO_PATH';
  if (a.stuckReason === 'too-narrow') return 'TOO_NARROW';
  const ramp = a.stuckReason && RAMP_FAILS[a.stuckReason];
  if (ramp) return ramp;
  if (a.unrailed) return 'NO_HANDRAIL';
  if (a.waitReason === 'swing' && a.waitTicks >= SWING_TICKS) return 'SWING_BLOCK';
  const b = a.blocker ? others.get(a.blocker) : undefined;
  if (a.waitReason === 'occupied' && a.waitTicks >= CROSS_FLOW_TICKS && crossing(a, b)) return 'CROSS_FLOW';
  if (a.waitReason === 'occupied' && a.waitTicks >= HEAD_ON_TICKS) {
    if (b?.blocker === a.id && b.waitTicks >= HEAD_ON_TICKS) return 'HEAD_ON_JAM';
  }
  if (spilled(a, entrance) && a.waitTicks >= QUEUE_SPILL_TICKS) return 'QUEUE_OVERFLOW';
  // Out of time, the sangat still in line grumble about the food, not about routes.
  if (timeUp) return goingIn(a) ? 'UNDERUSED_HALL' : 'TIME_LIMIT';
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
  /** Langar line levels: the entrance zone, number of hall seats, and the longest line each station kind had. */
  queue?: { entrance: Zone; seats: number; peak: Partial<Record<StationKind, number>> };
  /** Ramp level: everyone is going up to the roof. */
  rise?: boolean;
};

const STATION_LABEL: Record<StationKind, string> = { shoe: 'shoe stand', tap: 'hand-wash tap', basket: 'head-cover basket' };

/** The station kind that had the longest line, e.g. "the shoe stand (9 people in line)". */
function busiest(peak: Partial<Record<StationKind, number>>): string {
  const [kind, n] = (Object.entries(peak) as [StationKind, number][]).reduce((a, b) => (b[1] > a[1] ? b : a), ['shoe', 0]);
  return `the ${STATION_LABEL[kind]} (${plural(n, 'person', 'people')} in line at once)`;
}

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

    const ramp = a.stuckReason && RAMP_FAILS[a.stuckReason];
    if (ramp && a.state === 'stuck') {
      const inc = record(list, ramp, d.tick, [a.pos], [a.id], 'global');
      if (inc.count !== inc.agents.length) {
        inc.count = inc.agents.length;
        const who = inc.agents.length === 1 ? `The ${AGENT_INFO[a.type].label.toLowerCase()}` : `${inc.count} people`;
        [inc.title, inc.evidence] = RAMP_TITLES[ramp]!(who);
        inc.evidence += ` (at ${where(inc.tiles[0])})`;
      }
    }

    if (a.unrailed) {
      const inc = record(list, 'NO_HANDRAIL', d.tick, [a.pos], [a.id], 'global');
      inc.count = inc.agents.length;
      inc.title = 'Nothing to hold on to';
      inc.evidence = `The elderly visitor had to climb ${plural(inc.tiles.length, 'tile')} of ramp or stairs without a handrail, at a quarter of their speed.`;
    }

    if (a.waitReason === 'swing' && a.waitTicks === SWING_TICKS) {
      const inc = record(list, 'SWING_BLOCK', d.tick, [facing], [a.id, ...(a.blocker ? [a.blocker] : [])], 'near');
      inc.count++;
      inc.title = 'A door couldn’t open';
      inc.evidence = `The door at ${where(inc.tiles[0])} was blocked ${plural(inc.count, 'time')}: someone stood in its swing for 2+ seconds.`;
    }

    // In meets out: once per wait. (Counted here instead of as a head-on jam.)
    const b = a.blocker ? byId.get(a.blocker) : undefined;
    if (a.waitReason === 'occupied' && a.waitTicks === CROSS_FLOW_TICKS && crossing(a, b)) {
      const inc = record(list, 'CROSS_FLOW', d.tick, [a.pos, b!.pos], [a.id, b!.id], 'global');
      inc.count++;
      inc.title = 'People going in ran into people leaving';
      inc.evidence = `Visitors coming in and diners walking out blocked each other ${plural(inc.count, 'time')} (first near ${where(inc.tiles[0])}).`;
    }

    if (d.queue && spilled(a, d.queue.entrance) && a.waitTicks === QUEUE_SPILL_TICKS) {
      const inc = record(list, 'QUEUE_OVERFLOW', d.tick, [a.pos], [a.id], 'global');
      inc.count = inc.agents.length;
      inc.title = 'The line spilled out the door';
      inc.evidence = `${plural(inc.count, 'person', 'people')} stood stuck in the entrance for ${QUEUE_SPILL_TICKS / 10}+ seconds. Longest line: ${busiest(d.queue.peak)}.`;
    }

    // Fire once per stand-off, from the lower id's side.
    if (a.waitReason === 'occupied' && a.waitTicks === HEAD_ON_TICKS && !crossing(a, b)) {
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
    inc.title = 'Volunteers walked through the dining hall';
    inc.evidence = `${plural(people, 'person', 'people')} cut through where people were eating (${plural(inc.count, 'step')} among the diners).`;
  }

  if (d.timeUp && !list.some((i) => i.code === 'TIME_LIMIT')) {
    const late = d.agents.filter((a) => a.state !== 'done');
    const inc = record(list, 'TIME_LIMIT', d.tick, late.map((a) => a.pos), late.map((a) => a.id), 'global');
    inc.count = 1;
    inc.title = 'Ran out of time';
    inc.evidence = d.queue
      ? `Only ${d.delivered} of ${d.totalTasks} visitors were seated in ${d.timeLimitSec}s.`
      : d.rise
        ? `Only ${d.delivered} of ${d.totalTasks} got up to the roof in ${d.timeLimitSec}s.`
        : `Only ${d.delivered} of ${d.totalTasks} loads were delivered in ${d.timeLimitSec}s.`;
  }

  if (d.queue && d.timeUp && d.delivered < d.queue.seats * UNDERUSED_SHARE && !list.some((i) => i.code === 'UNDERUSED_HALL')) {
    const waiting = d.agents.filter((a) => a.station !== undefined && a.state !== 'done' && a.state !== 'seated');
    const inc = record(list, 'UNDERUSED_HALL', d.tick, waiting.map((a) => a.pos), waiting.map((a) => a.id), 'global');
    inc.count = 1;
    inc.title = 'Half the hall sat empty';
    inc.evidence = `Only ${d.delivered} of ${d.queue.seats} seats were filled. The longest line was at ${busiest(d.queue.peak)}.`;
  }

  // Langar lines are meant to queue; their crowding shows up as QUEUE_OVERFLOW / UNDERUSED_HALL instead.
  if (d.ended && !d.queue && !d.rise && !list.some((i) => i.code === 'CONGESTION')) {
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

