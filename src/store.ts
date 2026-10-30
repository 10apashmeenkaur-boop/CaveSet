import { create } from 'zustand';
import { findLevel } from './levels';
import { costOf, EMPTY_DESIGN, eraseAt, place, type BuildTool, type Design, type Orient, type Side } from './sim/design';
import { makeWorld, type World } from './sim/pathfinding';
import { score } from './sim/scoring';
import { initSim, step, type SimState } from './sim/simulate';
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

  // Simulation
  mode: 'design' | 'sim';
  sim: SimState | null;
  world: World | null;
  running: boolean;
  speed: 1 | 2 | 4;
  play: () => void;
  pause: () => void;
  backToDesign: () => void;
  setSpeed: (speed: 1 | 2 | 4) => void;
  tick: () => void;
  showHeat: boolean;
  toggleHeat: () => void;
  /** Why Play was refused, shown to the player. */
  notice: string | null;
  /** Incident card being inspected (index into sim.incidents): its tiles are highlighted. */
  focus: number | null;
  setFocus: (i: number | null) => void;
};

/** Add newly learned principles to saved progress. */
function unlock(set: (fn: (s: Store) => Partial<Store>) => void, codes: string[]) {
  set((s) => {
    const fresh = codes.filter((c) => !s.progress.principles.includes(c));
    if (!fresh.length) return {};
    const progress = { ...s.progress, principles: [...s.progress.principles, ...fresh] };
    saveProgress(progress);
    return { progress };
  });
}

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
      mode: 'design',
      sim: null,
      world: null,
      running: false,
      notice: null,
      focus: null,
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
    set({ design: place(level, design, draftFor(tool, x, y, get().orientIdx)), notice: null });
  },
  eraseAt: (x, y) => set((s) => ({ design: eraseAt(s.design, x, y), notice: null })),
  clearDesign: () => set({ design: EMPTY_DESIGN, notice: null }),

  mode: 'design',
  sim: null,
  world: null,
  running: false,
  speed: 1,
  play: () => {
    const { mode, levelId, design } = get();
    const level = levelId ? findLevel(levelId) : undefined;
    if (!level) return;
    if (mode === 'design') {
      const over = costOf(design) - level.budget;
      if (over > 0) {
        set({ notice: `Over budget by ₹${over.toLocaleString('en-IN')}. Remove something before you simulate.` });
        unlock(set, ['OVER_BUDGET']);
        return;
      }
    }
    // Starting fresh from design mode bakes the design into a world once.
    if (mode === 'design') set({ notice: null, mode: 'sim', world: makeWorld(level, design), sim: initSim(level), running: true, hover: null });
    else set({ running: true });
  },
  pause: () => set({ running: false }),
  backToDesign: () => set({ mode: 'design', sim: null, world: null, running: false, focus: null }),
  setSpeed: (speed) => set({ speed }),
  tick: () => {
    const { levelId, world, sim } = get();
    const level = levelId ? findLevel(levelId) : undefined;
    if (!level || !world || !sim) return;
    const next = step(level, world, sim);
    set({ sim: next, running: get().running && !next.finished && !next.timeUp });
    if ((next.finished || next.timeUp) && !(sim.finished || sim.timeUp)) {
      // Failing teaches: every incident's principle goes into the Design Journal.
      unlock(set, next.incidents.map((i) => i.code));
      // Keep the best star count per level; any star unlocks the next level.
      const { stars } = score(level, next, costOf(get().design));
      if (stars > (get().progress.stars[level.id] ?? 0)) get().setProgress((p) => ({ ...p, stars: { ...p.stars, [level.id]: stars } }));
    }
  },
  showHeat: false,
  toggleHeat: () => set((s) => ({ showHeat: !s.showHeat })),
  notice: null,
  focus: null,
  setFocus: (focus) => set({ focus }),
}));

export function draftFor(tool: BuildTool, x: number, y: number, orientIdx: number) {
  const [orient, swing] = ORIENTATIONS[orientIdx];
  return { tool, x, y, orient, swing };
}

export function orientationOf(orientIdx: number) {
  return ORIENTATIONS[orientIdx];
}
