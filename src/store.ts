import { create } from 'zustand';
import { findLevel } from './levels';
import { EMPTY_DESIGN, eraseAt, place, type BuildTool, type Design, type Orient, type Side } from './sim/design';
import type { Tile, ToolId } from './sim/types';

export type Screen = 'levels' | 'game' | 'journal';

export type Progress = {
  stars: Record<string, number>;
  /** Incident codes whose principles the player has unlocked. */
  principles: string[];
};

const STORAGE_KEY = 'design-lab.progress.v1';
const EMPTY: Progress = { stars: {}, principles: [] };

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function saveProgress(p: Progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable (private mode etc.) — progress just won't persist.
  }
}

/** R cycles through these: flip swing side, then rotate. */
const ORIENTATIONS: [Orient, Side][] = [
  ['v', 1],
  ['v', -1],
  ['h', 1],
  ['h', -1],
];

type Store = {
  screen: Screen;
  levelId: string | null;
  progress: Progress;
  openLevel: (id: string) => void;
  goTo: (screen: Screen) => void;
  setProgress: (fn: (p: Progress) => Progress) => void;

  // Design mode
  design: Design;
  tool: ToolId;
  orientIdx: number;
  hover: Tile | null;
  setTool: (tool: ToolId) => void;
  rotate: () => void;
  setHover: (t: Tile | null) => void;
  placeAt: (x: number, y: number) => void;
  eraseAt: (x: number, y: number) => void;
  clearDesign: () => void;
};

export const useStore = create<Store>((set, get) => ({
  screen: 'levels',
  levelId: null,
  progress: loadProgress(),
  openLevel: (id) =>
    set({
      screen: 'game',
      levelId: id,
      design: EMPTY_DESIGN,
      tool: findLevel(id)?.allowedTools[0] ?? 'wall',
      orientIdx: 0,
      hover: null,
    }),
  goTo: (screen) => set({ screen }),
  setProgress: (fn) =>
    set((s) => {
      const progress = fn(s.progress);
      saveProgress(progress);
      return { progress };
    }),

  design: EMPTY_DESIGN,
  tool: 'wall',
  orientIdx: 0,
  hover: null,
  setTool: (tool) => set({ tool }),
  rotate: () => set((s) => ({ orientIdx: (s.orientIdx + 1) % ORIENTATIONS.length })),
  setHover: (hover) => set({ hover }),
  placeAt: (x, y) => {
    const { levelId, tool, design } = get();
    const level = levelId ? findLevel(levelId) : undefined;
    if (!level || tool === 'eraser') return;
    set({ design: place(level, design, draftFor(tool, x, y, get().orientIdx)) });
  },
  eraseAt: (x, y) => set((s) => ({ design: eraseAt(s.design, x, y) })),
  clearDesign: () => set({ design: EMPTY_DESIGN }),
}));

export function draftFor(tool: BuildTool, x: number, y: number, orientIdx: number) {
  const [orient, swing] = ORIENTATIONS[orientIdx];
  return { tool, x, y, orient, swing };
}

export function orientationOf(orientIdx: number) {
  return ORIENTATIONS[orientIdx];
}
