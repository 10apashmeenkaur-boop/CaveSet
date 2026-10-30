import { create } from 'zustand';

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

type Store = {
  screen: Screen;
  levelId: string | null;
  progress: Progress;
  openLevel: (id: string) => void;
  goTo: (screen: Screen) => void;
  setProgress: (fn: (p: Progress) => Progress) => void;
};

export const useStore = create<Store>((set) => ({
  screen: 'levels',
  levelId: null,
  progress: loadProgress(),
  openLevel: (id) => set({ screen: 'game', levelId: id }),
  goTo: (screen) => set({ screen }),
  setProgress: (fn) =>
    set((s) => {
      const progress = fn(s.progress);
      saveProgress(progress);
      return { progress };
    }),
}));
