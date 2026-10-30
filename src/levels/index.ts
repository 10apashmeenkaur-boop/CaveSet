import type { Level } from '../sim/types';
import l1 from './l1-doorway.json';
import l2 from './l2-corridor.json';
import l3 from './l3-queue.json';
import l4 from './l4-ramp.json';

// JSON arrays infer as number[][], not tuples — levels are trusted data.
export const LEVELS = [l1, l2, l3, l4] as unknown as Level[];

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
  spawns: [
    { type: 'crate', from: 'kitchen', to: 'washing', count: 4, every: 25 },
    { type: 'crate', from: 'washing', to: 'kitchen', count: 4, every: 25, delay: 12 },
    { type: 'tray', from: 'kitchen', to: 'washing', count: 3, every: 30, delay: 6 },
  ],
  budget: Infinity,
  seed: 1,
  timeLimitSec: 0,
  allowedTools: ['wall', 'door1', 'door2', 'slide1', 'slide2', 'oneway'],
};

export function findLevel(id: string): Level | undefined {
  return id === SANDBOX.id ? SANDBOX : LEVELS.find((l) => l.id === id);
}
