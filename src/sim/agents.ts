import {
  CRATE_CARRIER_TILES,
  CRATE_SPEED,
  ELDERLY_SPEED,
  PERSON_TILES,
  SACK_SPEED,
  TRAY_SPEED,
  TROLLEY_SPEED,
  WALK_SPEED,
  WHEELCHAIR_SPEED,
  WHEELCHAIR_TILES,
} from './constants';
import type { IncidentCode } from './failures';
import type { AgentType, StationKind, Tile } from './types';

/** Width in tiles and speed in tiles per second, from the real-world scale in constants.ts. */
export const AGENT_INFO: Record<AgentType, { width: 1 | 2; speed: number; label: string }> = {
  empty: { width: PERSON_TILES, speed: WALK_SPEED, label: 'Volunteer' },
  crate: { width: CRATE_CARRIER_TILES, speed: CRATE_SPEED, label: 'Crate carrier' },
  tray: { width: PERSON_TILES, speed: TRAY_SPEED, label: 'Tray carrier' },
  elderly: { width: PERSON_TILES, speed: ELDERLY_SPEED, label: 'Elderly visitor' },
  sangat: { width: PERSON_TILES, speed: WALK_SPEED, label: 'Visitor' },
  sack: { width: PERSON_TILES, speed: SACK_SPEED, label: 'Sack carrier' },
  wheelchair: { width: WHEELCHAIR_TILES, speed: WHEELCHAIR_SPEED, label: 'Wheelchair user' },
  trolley: { width: 2, speed: TROLLEY_SPEED, label: 'Sack trolley' },
};

/** On wheels: ramps only, never stairs, and the edges they roll over must meet exactly. */
export const onWheels = (type: AgentType) => type === 'wheelchair' || type === 'trolley';

/** seated: sitting in the hall. Still takes up the tile, but no longer moving. */
export type AgentState = 'walking' | 'waiting' | 'stuck' | 'seated' | 'done';
/** deliver: carrying the load to the goal. return: walking home empty-handed. */
export type Phase = 'deliver' | 'return';
/**
 * no-path and too-narrow are final; jam means waited too long but still trying.
 * Level 4, all final: too-steep (wheelchair can't climb), rollback (trolley rolled back down),
 * tight-turn (no 3×3 landing to turn on), no-access (no step-free way up at all).
 */
export type StuckReason = 'no-path' | 'too-narrow' | 'jam' | 'too-steep' | 'rollback' | 'tight-turn' | 'no-access';
/**
 * occupied: someone is standing where I need to go. swing: a door can't open because someone is in its swing.
 * yield: backed out of a doorway and waiting for the other carrier to pass.
 * queue: standing in line behind someone using (or waiting for) the same station. service: being served.
 */
export type WaitReason = 'occupied' | 'swing' | 'yield' | 'queue' | 'service';

export type Agent = {
  id: string;
  type: AgentType;
  carrying: boolean;
  pos: Tile;
  /** Tile being walked into, with progress 0..1 towards it. */
  next: Tile | null;
  progress: number;
  path: Tile[];
  home: Tile;
  goal: Tile;
  phase: Phase;
  state: AgentState;
  waitTicks: number;
  waitReason?: WaitReason;
  /** Who is in the way (agent id), while waiting. */
  blocker?: string;
  stuckReason?: StuckReason;
  /** Last movement direction, for facing. */
  dir: Tile;
  /** Walking out of the way to let someone through (then holds until holdUntil). */
  retreat?: boolean;
  holdUntil?: number;
  /** What they're complaining about right now (speech bubble). */
  complaint?: IncidentCode;

  // Langar line (Level 3) only.
  /** Station kinds still to visit, current one first. Set for everyone going in. */
  todo?: StationKind[];
  /** Index (into world.units) of the station unit they're heading for or using. */
  station?: number;
  /** Being served until this tick. */
  serveUntil?: number;
  /** Index (into world.seats) of their seat. */
  seat?: number;
  /** Finished eating and walking out to the exit. */
  leaving?: boolean;
  /** Seated from the start; gets up at this tick. */
  leaveAt?: number;

  // Ramp to the roof (Level 4) only, for people on wheels.
  /** Ramp tiles rolled since the last flat tile, and how many of them were too steep. */
  trail?: Tile[];
  steep?: number;
  /** A trolley rolling back down a too-steep ramp. */
  rolling?: boolean;
  /** Following a route that ends short of the goal: stop there, for this reason. */
  deadEnd?: StuckReason;
  /** An elderly visitor on a ramp or stairs with nothing to hold on to. */
  unrailed?: boolean;
};

/** Going in (towards stations / a seat) vs. going out: when these block each other it's cross-flow. */
export const goingIn = (a: Agent) => a.todo !== undefined && !a.leaving;

/** Crate and tray carriers only count as their type while carrying; afterwards they walk like anyone else. */
export function effectiveType(a: Agent): AgentType {
  return a.carrying || a.type === 'elderly' || a.type === 'sangat' || onWheels(a.type) ? a.type : 'empty';
}

export function widthOf(a: Agent): 1 | 2 {
  return AGENT_INFO[effectiveType(a)].width;
}

export function speedOf(a: Agent): number {
  return AGENT_INFO[effectiveType(a)].speed;
}
