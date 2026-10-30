import type { Level } from '../sim/types';
import l1 from './l1-doorway.json';
import l2 from './l2-corridor.json';

// JSON arrays infer as number[][], not tuples — levels are trusted data.
export const LEVELS = [l1, l2] as unknown as Level[];

export const SANDBOX: Level = {
  id: 'sandbox',
  title: 'Sandbox',
  brief: 'No client, no deadline, no budget. Build whatever you like and watch what happens.',
  grid: { w: 16, h: 10 },
  fixedWalls: [],
  editableTiles: 'all',
  zones: {
    kitchen: { x: 0, y: 0, w: 5, h: 10 },
    washing: { x: 11, y: 0, w: 5, h: 10 },
  },
  noWalk: [],
  spawns: [],
  budget: Infinity,
  timeLimitSec: 0,
  allowedTools: ['wall', 'door1', 'door2', 'slide1', 'slide2'],
};

export function findLevel(id: string): Level | undefined {
  return id === SANDBOX.id ? SANDBOX : LEVELS.find((l) => l.id === id);
}
