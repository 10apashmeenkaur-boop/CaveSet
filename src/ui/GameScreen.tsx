import { findLevel } from '../levels';
import { Scene } from '../render/Scene';
import { useStore } from '../store';
import { QuoteBanner } from './QuoteBanner';

export function GameScreen() {
  const { levelId, goTo } = useStore();
  const level = levelId ? findLevel(levelId) : undefined;
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
        {Number.isFinite(level.budget) && <span className="pill">Budget ₹{level.budget.toLocaleString('en-IN')}</span>}
      </div>

      <div className="hud bottom-left">
        <QuoteBanner />
      </div>

      <div className="hud bottom-right blueprint hint">Drag to pan · scroll to zoom</div>
    </div>
  );
}
