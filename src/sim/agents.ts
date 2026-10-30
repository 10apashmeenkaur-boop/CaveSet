import { CRATE_CARRIER_TILES, CRATE_SPEED, ELDERLY_SPEED, PERSON_TILES, TRAY_SPEED, WALK_SPEED } from './constants';
import type { IncidentCode } from './failures';
import type { AgentType, Tile } from './types';

/** Width in tiles and speed in tiles per second, from the real-world scale in constants.ts. */
export const AGENT_INFO: Record<AgentType, { width: 1 | 2; speed: number; label: string }> = {
  empty: { width: PERSON_TILES, speed: WALK_SPEED, label: 'Sevadar' },
  crate: { width: CRATE_CARRIER_TILES, speed: CRATE_SPEED, label: 'Crate carrier' },
  tray: { width: PERSON_TILES, speed: TRAY_SPEED, label: 'Tray carrier' },
  elderly: { width: PERSON_TILES, speed: ELDERLY_SPEED, label: 'Elderly visitor' },
};

export type AgentState = 'walking' | 'waiting' | 'stuck' | 'done';
/** deliver: carrying the load to the goal. return: walking home empty-handed. */
export type Phase = 'deliver' | 'return';
/** no-path and too-narrow are final; jam means waited too long but still trying. */
export type StuckReason = 'no-path' | 'too-narrow' | 'jam';
/**
 * occupied: someone is standing where I need to go. swing: a door can't open because someone is in its swing.
 * yield: backed out of a doorway and waiting for the other carrier to pass.
 */
export type WaitReason = 'occupied' | 'swing' | 'yield';

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
};

/** Crate and tray carriers only count as their type while carrying; afterwards they walk like anyone else. */
export function effectiveType(a: Agent): AgentType {
  return a.carrying || a.type === 'elderly' ? a.type : 'empty';
}

export function widthOf(a: Agent): 1 | 2 {
  return AGENT_INFO[effectiveType(a)].width;
}

export function speedOf(a: Agent): number {
  return AGENT_INFO[effectiveType(a)].speed;
}
