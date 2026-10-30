import { useEffect } from 'react';
import { findLevel } from '../levels';
import { Scene } from '../render/Scene';
import { useStore } from '../store';
import { BudgetBar } from './BudgetBar';
import { QuoteBanner } from './QuoteBanner';
import { ResultsPanel } from './ResultsPanel';
import { SimBar } from './SimBar';
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

      <div className="hud top-left blueprint">
        <button className="btn ghost small" onClick={() => goTo('levels')}>
          ← Levels
        </button>
        <h2>{level.title}</h2>
        <p>{level.brief}</p>
      </div>

      {ended ? (
        <ResultsPanel level={level} />
      ) : (
        <div className="hud top-right">
          <BudgetBar level={level} />
          <QuoteBanner />
        </div>
      )}

      {mode === 'design' ? (
        <>
          <Toolbar level={level} />
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
