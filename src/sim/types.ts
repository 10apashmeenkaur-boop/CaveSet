export type Tile = [number, number];

export type Zone = { x: number; y: number; w: number; h: number };

export type AgentType = 'empty' | 'crate' | 'tray' | 'elderly';

export type SpawnRule = {
  type: AgentType;
  from: string;
  to: string;
  count: number;
  every: number;
  delay?: number;
};

export type ToolId = 'wall' | 'door1' | 'door2' | 'slide1' | 'slide2' | 'oneway' | 'eraser';

export type Level = {
  id: string;
  title: string;
  brief: string;
  grid: { w: number; h: number };
  fixedWalls: Tile[];
  editableTiles: string;
  zones: Record<string, Zone>;
  noWalk: Tile[];
  spawns: SpawnRule[];
  budget: number;
  timeLimitSec: number;
  /** Finishing within this earns the Time star. Defaults to 80% of the limit. */
  targetSec?: number;
  allowedTools: ToolId[];
};
