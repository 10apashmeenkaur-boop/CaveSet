export type Tile = [number, number];

export type Zone = { x: number; y: number; w: number; h: number };

/**
 * sangat: a visitor going through the langar line (Level 3).
 * sack: carries a sack on the shoulder. wheelchair: a sevadar in a wheelchair. trolley: a 2×2 sack trolley, pushed (Level 4).
 */
export type AgentType = 'empty' | 'crate' | 'tray' | 'elderly' | 'sangat' | 'sack' | 'wheelchair' | 'trolley';

/** A service point people queue at, one person at a time. */
export type StationKind = 'shoe' | 'tap' | 'basket';

export type SpawnRule = {
  type: AgentType;
  from: string;
  to: string;
  count: number;
  every: number;
  delay?: number;
  /** Arrive in groups of this many at once (every `every` ticks a new group). Default 1. */
  group?: number;
};

/** A station built into the level. Faces (serves people standing on) the tile beside it, like a hinged door's swing. */
export type FixedStation = { kind: StationKind; x: number; y: number; orient: 'h' | 'v'; swing: 1 | -1 };

/** Langar-line rules (Level 3): who visits which stations, where they sit, who leaves. */
export type QueueRules = {
  /** Stations every visitor uses, in order. */
  visit: StationKind[];
  /** Zone each station kind may be built in. */
  stationZones: Partial<Record<StationKind, string>>;
  /** Where the sangat comes in (a queue standing here has spilled out the door), the hall, and the way out. */
  entrance: string;
  hall: string;
  exit: string;
  /** Hall rows/columns kept clear for walking; every other hall tile is a seat. */
  aisleRows: number[];
  aisleCols: number[];
  /** The previous pangat: already seated in the front seats, they get up in groups and walk out to the exit. */
  pangat: { count: number; group: number; every: number; delay: number };
};

/** Ramp to the roof (Level 4): a raised zone everyone has to get up to, and a yard they arrive in. */
export type RiseRules = {
  /** The raised zone (roof storage), flat at `heightM` above the ground. People and sacks go here. */
  zone: string;
  heightM: number;
  /** Where people arrive. Nothing may be built here. */
  yard: string;
};

export type ToolId =
  | 'wall'
  | 'door1'
  | 'door2'
  | 'slide1'
  | 'slide2'
  | 'oneway'
  | 'shoe'
  | 'tap'
  | 'rail'
  | 'stairs'
  | 'ramp'
  | 'landing'
  | 'handrail'
  | 'eraser';

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
  /** Spending at most this (with the Time star) earns the third star. */
  starCost?: number;
  /** Fixed RNG seed: the same design always plays out the same way in this level. */
  seed?: number;
  /** Finishing within this earns the Time star. Defaults to 80% of the limit. */
  targetSec?: number;
  allowedTools: ToolId[];
  stations?: FixedStation[];
  queue?: QueueRules;
  rise?: RiseRules;
  /** Sim bar progress text, e.g. "🍽 {n}/{total} seated". Default "📦 {n}/{total} delivered". */
  goalLabel?: string;
  /** Mistri Ji: a one-line brief, and nudges keyed by failure code (plus "default") after repeated failed runs. */
  mistri?: { brief: string; hints: Record<string, string> };
  /** Mistri Ji ki diary page, unlocked by failing this level and then passing it. */
  insight?: Insight;
};

export type Insight = { title: string; principle: string; example: string; number?: string; quote: string };
