import { AGENT_INFO, effectiveType, goingIn, onWheels, speedOf, widthOf, type Agent, type StuckReason, type WaitReason } from './agents';
import {
  BACKOFF_CLEAR_STEPS,
  BACKOFF_SEARCH_STEPS,
  DISTURBANCE_TICKS,
  ELDERLY_STAIRS_COST,
  LINE_SQUEEZE_TICKS,
  RAMP_MAX_SLOPE,
  ROLLBACK_AFTER_TILES,
  ROLLBACK_SPEED,
  RECENT_DECAY,
  REPATH_TICKS,
  SEAT_RETRY_TICKS,
  SERVICE_SEC,
  SIDESTEP_EVERY,
  SIDESTEP_TICKS,
  SQUEEZE_TICKS,
  STUCK_TICKS,
  TICKS_PER_SEC,
  TILE_M,
  YIELD_FALLBACK_TICKS,
  YIELD_HOLD_TICKS,
} from './constants';
import type { Design } from './design';
import { getCell } from './grid';
import { complaintOf, detect, type Incident } from './failures';
import {
  canStep,
  DIRS,
  findPath,
  findWheelPath,
  isDining,
  key,
  makeWorld,
  wheelReach,
  type Crowd,
  type TileCost,
  type WheelRules,
  type World,
} from './pathfinding';
import { rand } from './rng';
import { isSlope, railed, slopeFactor, STAIRS, tooSteep } from './terrain';
import type { AgentType, Level, StationKind, Tile, Zone } from './types';

type PendingSpawn = { tick: number; type: AgentType; from: string; to: string };

export type SimState = {
  tick: number;
  rng: number;
  agents: Agent[];
  pending: PendingSpawn[];
  nextId: number;
  /** Loads dropped at their goal, out of `totalTasks`. */
  delivered: number;
  totalTasks: number;
  /** Total ticks people spent waiting on each tile (row-major), for the congestion heatmap. */
  heat: number[];
  /** Recent waiting per tile, decaying each tick. Routes avoid where people are queueing right now. */
  recent: number[];
  incidents: Incident[];
  /** Recent steps onto dining tiles, newest last (diners complain about these). */
  disturbances: { tile: Tile; tick: number; agent: string }[];
  finished: boolean;
  timeUp: boolean;
  /** Langar line: who sits in each seat (world.seats order), people heading for or at each station unit, and the most any unit of a kind ever had. */
  seatTaken: (string | null)[];
  loads: number[];
  peak: Partial<Record<StationKind, number>>;
};

/** Tile key → id of the agent standing on or walking into it. */
type Occupancy = Map<string, string>;

/** The previous pangat, sitting in the seats nearest the exit. They get up nearest-the-aisle first, a group at a time. */
function seatPangat(level: Level, world: World, seatTaken: (string | null)[]): Agent[] {
  const q = level.queue;
  if (!q) return [];
  const { count, group, every, delay } = q.pangat;
  const exit = level.zones[q.exit];
  const toExit = ([x, y]: Tile) => Math.abs(x - exit.x) + Math.abs(y - (exit.y + exit.h - 1));
  const fromAisle = (y: number) => Math.min(...q.aisleRows.map((r) => Math.abs(r - y)));
  const front = world.seats
    .map((tile, seat) => ({ tile, seat }))
    .sort((a, b) => toExit(a.tile) - toExit(b.tile) || a.tile[0] - b.tile[0] || b.tile[1] - a.tile[1])
    .slice(0, count)
    .sort((a, b) => fromAisle(a.tile[1]) - fromAisle(b.tile[1]) || toExit(a.tile) - toExit(b.tile));
  return front.map(({ tile, seat }, i) => {
    const id = `p${i + 1}`;
    seatTaken[seat] = id;
    return {
      id,
      type: 'sangat',
      carrying: false,
      pos: tile,
      next: null,
      progress: 0,
      path: [],
      home: tile,
      goal: tile,
      phase: 'deliver',
      state: 'seated',
      waitTicks: 0,
      dir: [-1, 0],
      seat,
      leaveAt: delay + Math.floor(i / group) * every,
    };
  });
}

export function initSim(level: Level, seed = level.seed ?? 1, world?: World): SimState {
  const pending: PendingSpawn[] = [];
  for (const rule of level.spawns) {
    for (let i = 0; i < rule.count; i++) {
      const wave = Math.floor(i / (rule.group ?? 1));
      pending.push({ tick: (rule.delay ?? 0) + wave * rule.every, type: rule.type, from: rule.from, to: rule.to });
    }
  }
  // Stable sort keeps rule order for equal ticks, so spawning is deterministic.
  pending.sort((a, b) => a.tick - b.tick);
  // On the ramp level everyone has to get up, the elderly visitor too.
  const totalTasks = level.spawns.filter((r) => r.type !== 'elderly' || level.rise).reduce((n, r) => n + r.count, 0);
  const seatTaken: (string | null)[] = world ? world.seats.map(() => null) : [];
  const agents = world ? seatPangat(level, world, seatTaken) : [];
  return {
    tick: 0,
    rng: seed,
    agents,
    pending,
    nextId: agents.length + 1,
    delivered: 0,
    totalTasks,
    heat: new Array(level.grid.w * level.grid.h).fill(0),
    recent: new Array(level.grid.w * level.grid.h).fill(0),
    incidents: [],
    disturbances: [],
    finished: false,
    timeUp: false,
    seatTaken,
    loads: world ? world.units.map(() => 0) : [],
    peak: {},
  };
}

/** Column on the zone's outer edge (where counters and sinks are), or its middle if it touches neither side. */
function serviceColumn(level: Level, z: Zone): number {
  if (z.x === 0) return 0;
  if (z.x + z.w === level.grid.w) return level.grid.w - 1;
  return z.x + Math.floor(z.w / 2);
}

function pickServiceTile(level: Level, world: World, zoneName: string, rng: number): [Tile, number] {
  const z = level.zones[zoneName];
  const x = serviceColumn(level, z);
  // Keep away from the zone's top/bottom edge so wide carriers have room.
  const [r, next] = rand(rng);
  const y0 = z.y + 1 + Math.floor(r * Math.max(1, z.h - 2));
  for (let d = 0; d < z.h; d++) {
    for (const y of [y0 + d, y0 - d]) {
      if (y >= z.y && y < z.y + z.h && getCell(world.grid, x, y) === 'floor') return [[x, y], next];
    }
  }
  return [[x, y0], next];
}

/**
 * Tiles an agent blocks at t. Everyone takes one tile, except a crate carrier in a doorway fills the whole door.
 * (Width still decides where a carrier can fit at all; see canStep.)
 */
export function footprint(world: World, t: Tile, width: 1 | 2): Tile[] {
  if (width === 2) return world.doorTiles.get(key(t[0], t[1])) ?? [t];
  return [t];
}

/** The second tile a moving wheelchair or trolley covers: the other half of the ramp, else the free side beside it. */
export function laneTile(world: World, a: Agent): Tile | null {
  const t = world.terrain;
  if (!t || widthOf(a) !== 2 || a.state === 'stuck') return null;
  const i = a.pos[1] * t.w + a.pos[0];
  if (t.sibling[i] >= 0) return [t.sibling[i] % t.w, Math.floor(t.sibling[i] / t.w)];
  const [px, py] = a.dir[0] !== 0 ? [0, 1] : [1, 0];
  for (const s of [1, -1]) {
    const side: Tile = [a.pos[0] + s * px, a.pos[1] + s * py];
    if (canStep(world, a.pos, side, 1, 'wheel')) return side;
  }
  return null;
}

/** Someone on foot who gave up for good on the ramp level: others step around them. (A stuck chair or trolley still takes its space.) */
const outOfPlay = (world: World, a: Agent) => !!world.terrain && a.state === 'stuck' && a.stuckReason !== 'jam' && !onWheels(a.type);

function occupancy(world: World, agents: Agent[]): Occupancy {
  const occ: Occupancy = new Map();
  for (const a of agents) {
    if (a.state === 'done' || outOfPlay(world, a)) continue;
    for (const [x, y] of footprint(world, a.pos, widthOf(a))) occ.set(key(x, y), a.id);
    if (a.next) for (const [x, y] of footprint(world, a.next, widthOf(a))) occ.set(key(x, y), a.id);
    const lane = laneTile(world, a);
    if (lane && !occ.has(key(...lane))) occ.set(key(...lane), a.id);
  }
  return occ;
}

/** The crowd as seen by one person (everyone but themselves). */
function crowdFor(s: SimState, occ: Occupancy, self: string): Crowd {
  const occupied = new Set<string>();
  for (const [k, id] of occ) if (id !== self) occupied.add(k);
  const blocked = new Set(s.agents.filter((a) => a.state === 'seated').map((a) => key(a.pos[0], a.pos[1])));
  return { occupied, recent: s.recent, blocked };
}

/** People heading for or using each station unit. */
function loadsOf(world: World, agents: Agent[]): number[] {
  const loads = world.units.map(() => 0);
  for (const a of agents) if (a.station !== undefined && a.state !== 'done' && a.state !== 'seated') loads[a.station]++;
  return loads;
}

/** Join the shortest line for this kind of station (ties: the nearest, then the first built). -1 if there is none. */
function chooseUnit(world: World, s: SimState, kind: StationKind, from: Tile): number {
  const dist = (t: Tile) => Math.abs(t[0] - from[0]) + Math.abs(t[1] - from[1]);
  let best = -1;
  world.units.forEach((u, i) => {
    if (u.kind !== kind) return;
    if (best < 0 || s.loads[i] < s.loads[best] || (s.loads[i] === s.loads[best] && dist(u.serve) < dist(world.units[best].serve))) best = i;
  });
  return best;
}

/** Head for the next station on the list, or a seat once the list is done. */
function nextStop(world: World, a: Agent, s: SimState, occ: Occupancy, todo: StationKind[]): Agent {
  if (a.station !== undefined) s.loads[a.station]--;
  if (todo.length) {
    const unit = chooseUnit(world, s, todo[0], a.pos);
    if (unit < 0) return { ...a, todo, station: undefined, path: [], state: 'stuck', stuckReason: 'no-path' };
    s.loads[unit]++;
    return plan(world, { ...a, todo, station: unit, goal: world.units[unit].serve, waitReason: undefined }, crowdFor(s, occ, a.id));
  }
  const seat = s.seatTaken.indexOf(null);
  // Hall full: stay put and look again in a moment.
  if (seat < 0) return { ...a, serveUntil: s.tick + SEAT_RETRY_TICKS };
  s.seatTaken[seat] = a.id;
  return plan(world, { ...a, todo, station: undefined, seat, goal: world.seats[seat], waitReason: undefined }, crowdFor(s, occ, a.id));
}

const idNum = (a: Agent) => Number(a.id.slice(1));
const same = (a: Tile, b: Tile) => a[0] === b[0] && a[1] === b[1];
/**
 * Goals are on a counter/sink column: reaching the column anywhere counts, so people don't queue for one exact tile.
 * The sangat goes to exact spots (a station, a seat, the exit); so does everyone on the ramp level (the roof).
 */
const reached = (world: World, a: Agent) => (a.type === 'sangat' || world.terrain ? same(a.pos, a.goal) : a.pos[0] === a.goal[0]);

/** Steepest ramp a wheelchair or trolley can go up: 1:12, as mm of rise per tile. */
const WHEEL_MAX_RISE = RAMP_MAX_SLOPE * TILE_M * 1000;

/** Route cost of a tile for this kind of agent: slow ground costs more, and the elderly steer clear of stairs. */
function costFor(world: World, type: Agent['type']): TileCost | undefined {
  const t = world.terrain;
  if (!t) return undefined;
  return (x, y) => {
    const i = y * t.w + x;
    if (type === 'elderly' && t.kind[i] === STAIRS) return ELDERLY_STAIRS_COST;
    return 1 / slopeFactor(t, i, type);
  };
}

/** Speed right now, in tiles per second: slower on slopes; a trolley rolling back goes faster. */
export function speedAt(world: World | null, a: Agent): number {
  if (a.rolling) return ROLLBACK_SPEED;
  const t = world?.terrain;
  const base = speedOf(a);
  if (!t) return base;
  const [x, y] = a.next ?? a.pos;
  return base * slopeFactor(t, y * t.w + x, effectiveType(a));
}

/** Plan a route. If the agent is too wide for every route, it heads for the narrow one and gets stuck there. */
function plan(world: World, a: Agent, crowd?: Crowd): Agent {
  if (world.terrain && onWheels(a.type)) return planWheels(world, a, crowd);
  const cost = costFor(world, a.type);
  const route =
    findPath(world, a.pos, a.goal, widthOf(a), crowd, cost) ??
    (widthOf(a) === 2 ? findPath(world, a.pos, a.goal, 1, crowd, cost) : null);
  if (!route) return { ...a, path: [], state: 'stuck', stuckReason: 'no-path' };
  return { ...a, path: route, state: 'walking', stuckReason: undefined };
}

/**
 * A wheelchair or trolley takes a proper accessible route if there is one. If not, it tries the way a user would
 * (any ramp, any corner) and stops where the design lets it down. With no step-free way up at all it goes as high
 * as any ramp takes it, else to the foot of the stairs people on foot use, and stops there.
 */
function planWheels(world: World, a: Agent, crowd?: Crowd): Agent {
  const cost = costFor(world, a.type);
  const chair = a.type === 'wheelchair';
  const go = (path: Tile[], deadEnd?: StuckReason): Agent => ({ ...a, path, state: 'walking', stuckReason: undefined, deadEnd });
  const proper: WheelRules = { lane: 2, maxRise: WHEEL_MAX_RISE, turns: chair ? 'turnable' : 'any' };
  const ok = findWheelPath(world, a.pos, a.dir, a.goal, proper, crowd, cost);
  if (ok) return go(ok);
  // (Turning only on flat ground, so it doesn't swerve between the ramp's two halves.)
  const attempt: WheelRules = { lane: 1, maxRise: Infinity, turns: 'flat' };
  const tried = findWheelPath(world, a.pos, a.dir, a.goal, attempt, crowd, cost);
  if (tried) return go(tried);
  const t = world.terrain!;
  const dist = (p: Tile) => Math.abs(p[0] - a.goal[0]) + Math.abs(p[1] - a.goal[1]);
  const height = (p: Tile) => t.center[p[1] * t.w + p[0]];
  const best = wheelReach(world, a.pos).reduce((b, p) => (height(p) > height(b) || (height(p) === height(b) && dist(p) < dist(b)) ? p : b));
  const onFoot = height(best) > height(a.pos) ? null : findPath(world, a.pos, a.goal, 1, undefined, costFor(world, 'sack'));
  if (onFoot) {
    const cut = onFoot.findIndex((tile, k) => !canStep(world, k ? onFoot[k - 1] : a.pos, tile, 1, 'wheel'));
    return go(cut < 0 ? onFoot : onFoot.slice(0, cut), 'no-access');
  }
  return go(findWheelPath(world, a.pos, a.dir, best, attempt, undefined, cost) ?? [], 'no-access');
}

/**
 * Before a wheelchair or trolley rolls on to `nxt`: is there a reason it can't? (Following a proper route, never.)
 * A trolley does start up a too-steep ramp: it rolls back once it's on it (see `rolled`).
 */
function wheelTrouble(world: World, a: Agent, nxt: Tile): StuckReason | null {
  const t = world.terrain!;
  const i = a.pos[1] * t.w + a.pos[0];
  const n = nxt[1] * t.w + nxt[0];
  const dir: Tile = [nxt[0] - a.pos[0], nxt[1] - a.pos[1]];
  const chair = a.type === 'wheelchair';
  if (chair && a.trail && !same(dir, a.dir) && !t.turnable[i]) return 'tight-turn';
  if (!canStep(world, a.pos, nxt, 2, 'wheel')) return 'tight-turn';
  const uphill = dir[0] === t.dx[n] && dir[1] === t.dy[n];
  if (chair && uphill && tooSteep(t, n, WHEEL_MAX_RISE)) return 'too-steep';
  return null;
}

/** After rolling on to a tile: track the ramp tiles since the last flat one; a trolley too far up a too-steep ramp starts rolling back. */
function rolled(world: World, a: Agent): Agent {
  const t = world.terrain!;
  if (a.rolling) return a;
  const i = a.pos[1] * t.w + a.pos[0];
  if (!isSlope(t, i)) return { ...a, trail: [a.pos], steep: 0 };
  const uphill = a.dir[0] === t.dx[i] && a.dir[1] === t.dy[i];
  const steep = (a.steep ?? 0) + (uphill && tooSteep(t, i, WHEEL_MAX_RISE) ? 1 : 0);
  const trail = [...(a.trail ?? []), a.pos];
  if (a.type === 'trolley' && steep >= ROLLBACK_AFTER_TILES) {
    // Back down the way it came, still facing uphill, to the last flat tile.
    return { ...a, trail, steep, rolling: true, path: trail.slice(0, -1).reverse() };
  }
  return { ...a, trail, steep };
}

/** A trolley rolling back: nothing stops it; at the bottom it stays put. */
function rollBack(a: Agent): Agent {
  const r = { ...a };
  if (!r.next) {
    if (!r.path.length) return { ...r, rolling: false, state: 'stuck', stuckReason: 'rollback', progress: 0 };
    r.next = r.path[0];
    r.path = r.path.slice(1);
  }
  r.state = 'walking';
  r.progress += ROLLBACK_SPEED / TICKS_PER_SEC;
  while (r.progress >= 1 && r.next) {
    r.progress -= 1;
    r.pos = r.next;
    r.next = r.path.length ? r.path[0] : null;
    r.path = r.path.slice(1);
  }
  if (!r.next) r.progress = 0;
  return r;
}

/** At the end of a route that stops short: stuck there, for the planned reason. */
const stopShort = (a: Agent): Agent => ({ ...a, state: 'stuck', stuckReason: a.deadEnd, deadEnd: undefined, progress: 0 });

function arrive(world: World, a: Agent, s: SimState, occ: Occupancy): Agent {
  if (a.leaving) return { ...a, state: 'done' };
  if (a.todo) {
    if (a.seat !== undefined) {
      s.delivered++;
      return { ...a, state: 'seated', path: [], waitTicks: 0, waitReason: undefined, blocker: undefined };
    }
    const unit = world.units[a.station!];
    const dir: Tile = [unit.tile[0] - a.pos[0], unit.tile[1] - a.pos[1]];
    const serveUntil = s.tick + SERVICE_SEC[unit.kind] * TICKS_PER_SEC;
    return { ...a, state: 'waiting', waitReason: 'service', waitTicks: 0, blocker: undefined, dir, serveUntil };
  }
  if (a.phase === 'deliver') {
    // Up on the roof: that's the job done, for people and sacks alike.
    if (world.terrain) {
      s.delivered++;
      return { ...a, state: 'done' };
    }
    if (a.type === 'elderly') return { ...a, state: 'done' };
    s.delivered++;
    return plan(world, { ...a, carrying: false, phase: 'return', goal: a.home }, crowdFor(s, occ, a.id));
  }
  return { ...a, state: 'done' };
}

function othersAt(occ: Occupancy, tiles: Tile[], self: string, ignore?: string): string | undefined {
  for (const [x, y] of tiles) {
    const who = occ.get(key(x, y));
    if (who && who !== self && who !== ignore) return who;
  }
  return undefined;
}

function wait(
  world: World,
  a: Agent,
  s: SimState,
  occ: Occupancy,
  before: Map<string, Agent>,
  reason: WaitReason,
  blocker: string | undefined,
  target: Tile,
) {
  a.state = 'waiting';
  a.waitTicks++;
  a.waitReason = reason;
  a.blocker = blocker;
  s.heat[a.pos[1] * world.grid.w + a.pos[0]]++;
  s.recent[a.pos[1] * world.grid.w + a.pos[0]]++;

  // Standing in line for the same station: just wait your turn, however long it takes.
  const other = blocker ? before.get(blocker) : undefined;
  if (a.station !== undefined && other?.station === a.station) {
    a.waitReason = 'queue';
    return;
  }

  if (a.waitTicks >= STUCK_TICKS) {
    a.state = 'stuck';
    a.stuckReason = 'jam';
  }

  // When two people block each other, only one of them detours; if both did, they'd mirror each other forever.
  const holdsGround = other?.blocker === a.id && idNum(a) < idNum(other);

  // Someone sat down in the way: no point waiting for them to move.
  const seatedInWay = other?.state === 'seated' && a.waitTicks === 1;
  // A wheelchair or trolley on the ramp level can't just step aside, but it can look for another way.
  const wheels = !!world.terrain && onWheels(a.type);
  if ((a.waitTicks % REPATH_TICKS === 0 || seatedInWay) && !holdsGround) {
    // Re-route with the crowd in mind: a less busy door is worth some extra steps.
    if (wheels) {
      const re = planWheels(world, a, crowdFor(s, occ, a.id));
      if (re.path.length) Object.assign(a, { path: re.path, deadEnd: re.deadEnd });
    } else {
      const detour = findPath(world, a.pos, a.goal, widthOf(a), crowdFor(s, occ, a.id), costFor(world, a.type));
      if (detour) a.path = detour;
    }
  }

  if (a.waitTicks >= SIDESTEP_TICKS && a.waitTicks % SIDESTEP_EVERY === 0 && !holdsGround && !wheels) {
    // Step aside to break a stand-off: first free neighbour, in a seeded order.
    const [r, next] = rand(s.rng);
    s.rng = next;
    const start = Math.floor(r * 4);
    for (let i = 0; i < 4; i++) {
      const [dx, dy] = DIRS[(start + i) % 4];
      const n: Tile = [a.pos[0] + dx, a.pos[1] + dy];
      if (same(n, target) || !canStep(world, a.pos, n, widthOf(a))) continue;
      const fp = footprint(world, n, widthOf(a));
      if (othersAt(occ, fp, a.id)) continue;
      for (const [x, y] of fp) occ.set(key(x, y), a.id);
      a.next = n;
      a.dir = [dx, dy];
      a.path = []; // re-plan from the new spot on arrival
      a.state = 'walking';
      return;
    }
  }
}

/** In a crate stand-off, who backs off: whoever is in the doorway, else the later arrival (higher id). */
function yieldsTo(world: World, a: Agent, other: Agent): boolean {
  const aIn = world.doors.has(key(a.pos[0], a.pos[1]));
  const oIn = world.doors.has(key(other.pos[0], other.pos[1]));
  if (aIn !== oIn) return aIn;
  return idNum(a) > idNum(other);
}

/**
 * Walk to the nearest free spot at least 2 steps away that is off the other person's route and not in a doorway,
 * then hold there. Returns false if boxed in. Mutates `a`.
 */
function backOff(world: World, a: Agent, occ: Occupancy, other: Agent): boolean {
  const width = widthOf(a);
  const inTheirWay = new Set([other.pos, ...other.path.slice(0, BACKOFF_CLEAR_STEPS)].map(([x, y]) => key(x, y)));
  const parent = new Map<string, string | null>([[key(a.pos[0], a.pos[1]), null]]);
  let frontier: Tile[] = [a.pos];
  for (let depth = 1; depth <= BACKOFF_SEARCH_STEPS && frontier.length; depth++) {
    const nextFrontier: Tile[] = [];
    for (const cur of frontier) {
      for (const [dx, dy] of DIRS) {
        const n: Tile = [cur[0] + dx, cur[1] + dy];
        const k = key(n[0], n[1]);
        if (parent.has(k) || !canStep(world, cur, n, width) || othersAt(occ, footprint(world, n, width), a.id)) continue;
        parent.set(k, key(cur[0], cur[1]));
        if (depth >= 2 && !inTheirWay.has(k) && !world.doors.has(k)) {
          const path: Tile[] = [];
          for (let c: string | null = k; c && c !== key(a.pos[0], a.pos[1]); c = parent.get(c) ?? null) {
            path.push(c.split(',').map(Number) as Tile);
          }
          Object.assign(a, { path: path.reverse(), retreat: true, state: 'waiting', waitReason: 'yield', waitTicks: 0, blocker: undefined });
          return true;
        }
        nextFrontier.push(n);
      }
    }
    frontier = nextFrontier;
  }
  return false;
}

/** Claim the next path tile if it's free. Returns false if the agent has to wait or is stuck. Mutates `a` and `occ`. */
function tryTake(world: World, a: Agent, s: SimState, occ: Occupancy, before: Map<string, Agent>): boolean {
  const nxt = a.path[0];
  const dir: Tile = [nxt[0] - a.pos[0], nxt[1] - a.pos[1]];
  if (world.terrain && onWheels(a.type)) {
    const why = wheelTrouble(world, a, nxt);
    if (why) {
      Object.assign(a, { state: 'stuck', stuckReason: why, progress: 0 });
      return false;
    }
  }
  if (!canStep(world, a.pos, nxt, widthOf(a), onWheels(a.type) ? 'wheel' : 'walk')) {
    // Only possible for a wide carrier on its fallback route: the gap ahead is too narrow.
    Object.assign(a, { state: 'stuck', stuckReason: 'too-narrow', dir, progress: 0 });
    return false;
  }
  const fp = footprint(world, nxt, widthOf(a));
  // Resolve a long head-on stand-off.
  const other = a.blocker ? before.get(a.blocker) : undefined;
  const patience = other && goingIn(a) && goingIn(other) ? LINE_SQUEEZE_TICKS : SQUEEZE_TICKS;
  const standoff = other && other.blocker === a.id && a.waitTicks >= patience && other.waitTicks >= patience;
  let squeeze: string | undefined;
  // Done at a station: the next person in line (waiting for this very spot) lets them out.
  const nextInLine = [...occ].find(([k, id]) => k === key(nxt[0], nxt[1]) && id !== a.id)?.[1];
  const waiter = nextInLine ? before.get(nextInLine) : undefined;
  if (waiter?.waitReason === 'queue' && same(waiter.goal, a.pos)) {
    squeeze = waiter.id;
  } else if (standoff && widthOf(a) === 1 && widthOf(other) === 1) {
    squeeze = other.id; // empty-handed: squeeze past
  } else if (standoff && !onWheels(a.type)) {
    // A crate can't squeeze past anyone in a doorway: one of them backs out.
    const mine = yieldsTo(world, a, other);
    if ((mine || a.waitTicks >= YIELD_FALLBACK_TICKS) && backOff(world, a, occ, other)) return false;
  }
  const blocker = othersAt(occ, fp, a.id, squeeze);
  if (blocker) {
    wait(world, a, s, occ, before, 'occupied', blocker, nxt);
    return false;
  }
  // A hinged door only opens if nobody else stands in its swing.
  const sweep = world.swing.get(key(nxt[0], nxt[1]));
  if (sweep) {
    const inSwing = othersAt(occ, [sweep], a.id);
    if (inSwing) {
      wait(world, a, s, occ, before, 'swing', inSwing, nxt);
      return false;
    }
  }
  for (const [x, y] of fp) occ.set(key(x, y), a.id);
  a.path = a.path.slice(1);
  a.next = nxt;
  a.dir = dir;
  a.state = 'walking';
  a.waitTicks = 0;
  a.waitReason = undefined;
  a.blocker = undefined;
  a.stuckReason = undefined;
  return true;
}

function holdAfterRetreat(a: Agent, s: SimState): Agent {
  return { ...a, retreat: false, holdUntil: s.tick + YIELD_HOLD_TICKS, state: 'waiting', waitReason: 'yield', progress: 0 };
}

function move(world: World, prev: Agent, s: SimState, occ: Occupancy, before: Map<string, Agent>): Agent {
  if (prev.state === 'done' || prev.state === 'seated') return prev;
  if (prev.state === 'stuck' && prev.stuckReason !== 'jam') return prev;
  if (prev.rolling) return rollBack(prev);
  let a: Agent = { ...prev };

  // Being served at a station: stay until done, then move on.
  if (a.serveUntil !== undefined) {
    if (s.tick < a.serveUntil) return a;
    return nextStop(world, { ...a, serveUntil: undefined }, s, occ, a.todo!.slice(1));
  }

  // Backed off for someone else: wait, then plan afresh.
  if (a.holdUntil !== undefined) {
    if (s.tick < a.holdUntil) return a;
    a.holdUntil = undefined;
    a = plan(world, a, crowdFor(s, occ, a.id));
    if (a.state === 'stuck') return a;
  }

  if (!a.next) {
    if (!a.path.length) {
      if (reached(world, a)) return arrive(world, { ...a, progress: 0 }, s, occ);
      if (a.retreat) return holdAfterRetreat(a, s);
      if (a.deadEnd) return stopShort(a);
      a = plan(world, a, crowdFor(s, occ, a.id)); // after a sidestep
      if (a.state === 'stuck') return a;
    }
    if (!tryTake(world, a, s, occ, before)) return a;
  }

  a.progress += speedAt(world, a) / TICKS_PER_SEC;
  // May cross more than one tile in a tick; keep claiming tiles until progress < 1.
  while (a.progress >= 1 && a.next) {
    a.progress -= 1;
    a.pos = a.next;
    a.next = null;
    if (isDining(world, a.pos[0], a.pos[1])) s.disturbances.push({ tile: a.pos, tick: s.tick, agent: a.id });
    if (world.terrain && onWheels(a.type)) {
      a = rolled(world, a);
      if (a.rolling) return { ...a, progress: 0 };
    }
    if (world.terrain && a.type === 'elderly') {
      const i = a.pos[1] * world.terrain.w + a.pos[0];
      a.unrailed = isSlope(world.terrain, i) && !railed(world.terrain, i);
    }
    if (reached(world, a)) return arrive(world, { ...a, progress: 0 }, s, occ);
    if (!a.path.length) {
      a.progress = 0;
      return a.retreat ? holdAfterRetreat(a, s) : a.deadEnd ? stopShort(a) : a;
    }
    if (!tryTake(world, a, s, occ, before)) {
      a.progress = 0;
      return a;
    }
  }
  return a;
}

/** Advance one tick. Pure: returns a new state. */
export function step(level: Level, world: World, prev: SimState): SimState {
  if (prev.finished || prev.timeUp) return prev;
  const s: SimState = {
    ...prev,
    tick: prev.tick + 1,
    pending: [...prev.pending],
    agents: [...prev.agents],
    heat: [...prev.heat],
    seatTaken: [...prev.seatTaken],
    loads: loadsOf(world, prev.agents),
    peak: { ...prev.peak },
    recent: prev.recent.map((v) => v * RECENT_DECAY),
    disturbances: prev.disturbances.filter((d) => d.tick > prev.tick - DISTURBANCE_TICKS),
  };
  const occ = occupancy(world, s.agents);

  // Spawn whoever is due, unless someone is standing on their start tile (then they wait their turn).
  while (s.pending.length && s.pending[0].tick <= s.tick) {
    const sp = s.pending[0];
    let home: Tile;
    let goal: Tile;
    let rng = s.rng;
    [home, rng] = pickServiceTile(level, world, sp.from, rng);
    [goal, rng] = pickServiceTile(level, world, sp.to, rng);
    const dir: Tile = [goal[0] > home[0] ? 1 : -1, 0];
    const width = AGENT_INFO[sp.type].width;
    // On the ramp level people arrive anywhere in the yard, so someone standing at the gate doesn't stop the rest.
    const standing = new Set(s.agents.filter((a) => a.state !== 'done').map((a) => key(...a.pos)));
    if (level.rise && (occ.has(key(...home)) || standing.has(key(...home)))) {
      const z = level.zones[sp.from];
      const free: Tile[] = [];
      for (let y = z.y; y < z.y + z.h; y++) {
        for (let x = z.x; x < z.x + z.w; x++) if (!occ.has(key(x, y)) && !standing.has(key(x, y))) free.push([x, y]);
      }
      const near = (t: Tile) => Math.abs(t[0] - home[0]) + Math.abs(t[1] - home[1]);
      if (free.length) home = free.sort((a, b) => near(a) - near(b))[0];
    }
    const fp = footprint(world, home, width);
    if (fp.some(([x, y]) => occ.has(key(x, y)))) break;
    s.pending.shift();
    s.rng = rng;
    if (sp.type === 'sangat' && level.queue) {
      // Langar line: walk in and join the shortest line for the first station.
      const base: Agent = {
        id: `p${s.nextId++}`,
        type: 'sangat',
        carrying: false,
        pos: home,
        next: null,
        progress: 0,
        path: [],
        home,
        goal: home,
        phase: 'deliver',
        state: 'walking',
        waitTicks: 0,
        dir: [1, 0],
      };
      const agent = nextStop(world, base, s, occ, level.queue.visit);
      for (const [x, y] of fp) occ.set(key(x, y), agent.id);
      s.agents.push(agent);
      continue;
    }
    const agent = plan(world, {
      id: `p${s.nextId++}`,
      type: sp.type,
      carrying: sp.type === 'crate' || sp.type === 'tray' || sp.type === 'sack' || sp.type === 'trolley',
      pos: home,
      next: null,
      progress: 0,
      path: [],
      home,
      goal,
      phase: 'deliver',
      state: 'walking',
      waitTicks: 0,
      dir,
    }, crowdFor(s, occ, ''));
    for (const [x, y] of fp) occ.set(key(x, y), agent.id);
    s.agents.push(agent);
  }

  // The previous pangat gets up when it's their turn and walks out.
  if (level.queue) {
    const exit = level.queue.exit;
    s.agents = s.agents.map((a) => {
      if (a.state !== 'seated' || a.leaveAt === undefined || s.tick < a.leaveAt) return a;
      s.seatTaken[a.seat!] = null;
      const [goal, rng] = pickServiceTile(level, world, exit, s.rng);
      s.rng = rng;
      const up: Agent = { ...a, state: 'walking', leaving: true, leaveAt: undefined, seat: undefined, goal };
      return plan(world, up, crowdFor(s, occ, a.id));
    });
  }

  const before = new Map(s.agents.map((a) => [a.id, a]));
  s.agents = s.agents.map((a) => move(world, a, s, occ, before));

  s.loads = loadsOf(world, s.agents);
  world.units.forEach((u, i) => (s.peak[u.kind] = Math.max(s.peak[u.kind] ?? 0, s.loads[i])));

  s.finished = !s.pending.length && s.agents.every((a) => a.state === 'done' || (a.state === 'seated' && a.leaveAt === undefined));
  s.timeUp = level.timeLimitSec > 0 && s.tick >= level.timeLimitSec * TICKS_PER_SEC && !s.finished;

  const byId = new Map(s.agents.map((a) => [a.id, a]));
  s.agents = s.agents.map((a) => {
    const complaint = complaintOf(a, byId, s.timeUp, level.queue && level.zones[level.queue.entrance]);
    return complaint === a.complaint ? a : { ...a, complaint };
  });
  s.incidents = detect(prev.incidents, {
    tick: s.tick,
    agents: s.agents,
    diningSteps: s.disturbances.filter((d) => d.tick === s.tick),
    timeUp: s.timeUp,
    ended: s.finished || s.timeUp,
    delivered: s.delivered,
    totalTasks: s.totalTasks,
    timeLimitSec: level.timeLimitSec,
    heat: s.heat,
    gridW: level.grid.w,
    queue: level.queue && {
      entrance: level.zones[level.queue.entrance],
      seats: world.seats.length,
      peak: s.peak,
    },
    rise: !!level.rise,
  });
  return s;
}

/** Convenience for tests: run until finished, time up, or maxTicks. */
export function runToEnd(level: Level, design: Design, seed = level.seed ?? 1, maxTicks = 5000): SimState {
  const world = makeWorld(level, design);
  let s = initSim(level, seed, world);
  while (!s.finished && !s.timeUp && s.tick < maxTicks) s = step(level, world, s);
  return s;
}
