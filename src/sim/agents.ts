import type { AgentType, Tile } from './types';

export const AGENT_INFO: Record<AgentType, { width: 1 | 2; speed: number; label: string }> = {
  empty: { width: 1, speed: 1.0, label: 'Sevadar' },
  crate: { width: 2, speed: 0.7, label: 'Crate carrier' },
  tray: { width: 1, speed: 0.8, label: 'Tray carrier' },
  elderly: { width: 1, speed: 0.5, label: 'Elderly visitor' },
};

export type AgentState = 'walking' | 'waiting' | 'stuck' | 'done';
/** deliver: carrying the load to the goal. return: walking home empty-handed. */
export type Phase = 'deliver' | 'return';
export type StuckReason = 'no-path' | 'too-narrow';

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
  stuckReason?: StuckReason;
  /** Last movement direction, for facing. */
  dir: Tile;
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
