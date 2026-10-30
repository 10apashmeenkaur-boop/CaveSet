import type { AgentType } from '../sim/types';

export const COLORS = {
  background: '#f3ece2',
  floor: '#e6e2dc',
  gridLine: '#cfc8bf',
  wall: '#c9705a',
  wallTop: '#d98a72',
  zones: {
    kitchen: '#f6c99b',
    washing: '#a9d6e5',
    dining: '#c7e3b0',
  } as Record<string, string>,
};

/** Shirt colour tells you what someone is doing. */
export const SHIRT: Record<AgentType, string> = {
  crate: '#f2a65a',
  tray: '#6cc4b8',
  empty: '#b7a6e0',
  elderly: '#9fb4c7',
};

export const SKIN = ['#f5d0b5', '#e0ac85', '#c68a62', '#8d5a3b'];
