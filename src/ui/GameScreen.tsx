import { useEffect } from 'react';
import { findLevel } from '../levels';
import { Scene } from '../render/Scene';
import { useStore } from '../store';
import { BudgetBar } from './BudgetBar';
import { MistriCard } from './QuoteBanner';
import { ResultsPanel } from './ResultsPanel';
import { SimBar } from './SimBar';
import { RackParts } from './RackParts';
import { DictionaryCard, RackSheetCard } from './RackSheet';
import { Toolbar } from './Toolbar';

export function GameScreen() {
  // Narrow selectors: this wraps the 3D scene, so it must not re-render on every sim tick.
  const levelId = useStore((s) => s.levelId);
  const goTo = useStore((s) => s.goTo);
  const mode = useStore((s) => s.mode);
  const ended = useStore((s) => !!s.sim && (s.sim.finished || s.sim.timeUp));
  const level = levelId ? findLevel(levelId) : undefined;

  // Space: start / pause / resume.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+Z undo, Ctrl+Y or Ctrl+Shift+Z redo (Cmd on Mac).
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        const s = useStore.getState();
        if (e.key === 'y' || e.key === 'Y' || e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (e.code !== 'Space') return;
      e.preventDefault();
      const s = useStore.getState();
      if (s.running) s.pause();
      else if (!s.sim?.finished && !s.sim?.timeUp) s.play();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!level) return null;

  return (
    <div className="game">
      <Scene level={level} />

      <div className={`hud top-left blueprint ${level.rack ? 'with-parts' : ''}`}>
        <button className="btn ghost small" onClick={() => goTo('levels')}>
          ← Levels
        </button>
        <h2>{level.title}</h2>
        <p>{level.brief}</p>
        {/* The Utensil Rack is built from this panel: every option visible, each explained. */}
        {level.rack && mode === 'design' && <RackParts />}
      </div>

      {ended ? (
        <ResultsPanel level={level} />
      ) : (
        <div className={`hud top-right ${level.rack ? 'scroll' : ''}`}>
          <BudgetBar level={level} />
          <MistriCard level={level} />
          {level.rack && <RackSheetCard level={level} />}
          {level.rack && <DictionaryCard />}
        </div>
      )}

      {mode === 'design' ? (
        <>
          {!level.rack && <Toolbar level={level} />}
          <div className="hud bottom-right">
            <SimBar level={level} />
          </div>
        </>
      ) : (
        <div className="hud bottom-center">
          <SimBar level={level} />
        </div>
      )}
    </div>
  );
}
