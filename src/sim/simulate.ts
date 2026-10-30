import { speedOf, widthOf, type Agent } from './agents';
import type { Design } from './design';
import { getCell } from './grid';
import { canStep, findPath, makeWorld, type World } from './pathfinding';
import { rand } from './rng';
import type { AgentType, Level, Tile, Zone } from './types';

export const TICKS_PER_SEC = 10;
/** Tiles per second at speed 1.0. */
export const BASE_SPEED = 2;

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
  finished: boolean;
  timeUp: boolean;
};

export function initSim(level: Level, seed = 1): SimState {
  const pending: PendingSpawn[] = [];
  for (const rule of level.spawns) {
    for (let i = 0; i < rule.count; i++) {
      pending.push({ tick: (rule.delay ?? 0) + i * rule.every, type: rule.type, from: rule.from, to: rule.to });
    }
  }
  // Stable sort keeps rule order for equal ticks, so spawning is deterministic.
  pending.sort((a, b) => a.tick - b.tick);
  const totalTasks = level.spawns.filter((r) => r.type !== 'elderly').reduce((n, r) => n + r.count, 0);
  return { tick: 0, rng: seed, agents: [], pending, nextId: 1, delivered: 0, totalTasks, finished: false, timeUp: false };
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

/** Plan a route. If the agent is too wide for every route, it heads for the narrow one and gets stuck there. */
function plan(world: World, a: Agent): Agent {
  const route = findPath(world, a.pos, a.goal, widthOf(a)) ?? (widthOf(a) === 2 ? findPath(world, a.pos, a.goal, 1) : null);
  if (!route) return { ...a, path: [], state: 'stuck', stuckReason: 'no-path' };
  return { ...a, path: route, state: 'walking', stuckReason: undefined };
}

function arrive(world: World, a: Agent, s: SimState): Agent {
  if (a.phase === 'deliver') {
    if (a.type === 'elderly') return { ...a, state: 'done' };
    s.delivered++;
    return plan(world, { ...a, carrying: false, phase: 'return', goal: a.home });
  }
  return { ...a, state: 'done' };
}

function move(world: World, a: Agent, s: SimState): Agent {
  if (a.state === 'done' || a.state === 'stuck') return a;
  let agent = { ...a };
  agent.progress += (speedOf(agent) * BASE_SPEED) / TICKS_PER_SEC;

  // May cross more than one tile boundary in a tick at high speed; loop until progress < 1.
  for (;;) {
    if (!agent.next) {
      if (!agent.path.length) {
        agent = arrive(world, agent, s);
        agent.progress = 0;
        return agent;
      }
      const [nxt, ...rest] = agent.path;
      if (!canStep(world, agent.pos, nxt, widthOf(agent))) {
        return { ...agent, progress: 0, state: 'stuck', stuckReason: 'too-narrow', dir: [nxt[0] - agent.pos[0], nxt[1] - agent.pos[1]] };
      }
      agent.next = nxt;
      agent.path = rest;
      agent.dir = [nxt[0] - agent.pos[0], nxt[1] - agent.pos[1]];
    }
    if (agent.progress < 1) return agent;
    agent.progress -= 1;
    agent.pos = agent.next;
    agent.next = null;
  }
}

/** Advance one tick. Pure: returns a new state. */
export function step(level: Level, world: World, prev: SimState): SimState {
  if (prev.finished || prev.timeUp) return prev;
  const s: SimState = { ...prev, tick: prev.tick + 1, pending: [...prev.pending], agents: [...prev.agents] };

  while (s.pending.length && s.pending[0].tick <= s.tick) {
    const sp = s.pending.shift()!;
    let home: Tile;
    let goal: Tile;
    [home, s.rng] = pickServiceTile(level, world, sp.from, s.rng);
    [goal, s.rng] = pickServiceTile(level, world, sp.to, s.rng);
    const agent: Agent = {
      id: `p${s.nextId++}`,
      type: sp.type,
      carrying: sp.type === 'crate' || sp.type === 'tray',
      pos: home,
      next: null,
      progress: 0,
      path: [],
      home,
      goal,
      phase: 'deliver',
      state: 'walking',
      waitTicks: 0,
      dir: [goal[0] > home[0] ? 1 : -1, 0],
    };
    s.agents.push(plan(world, agent));
  }

  s.agents = s.agents.map((a) => move(world, a, s));

  s.finished = !s.pending.length && s.agents.every((a) => a.state === 'done');
  s.timeUp = level.timeLimitSec > 0 && s.tick >= level.timeLimitSec * TICKS_PER_SEC && !s.finished;
  return s;
}

/** Convenience for tests: run until finished, time up, or maxTicks. */
export function runToEnd(level: Level, design: Design, seed = 1, maxTicks = 5000): SimState {
  const world = makeWorld(level, design);
  let s = initSim(level, seed);
  while (!s.finished && !s.timeUp && s.tick < maxTicks) s = step(level, world, s);
  return s;
}

