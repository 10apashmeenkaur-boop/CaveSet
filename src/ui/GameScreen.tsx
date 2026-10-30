import { findLevel } from '../levels';
import { Scene } from '../render/Scene';
import { useStore } from '../store';
import { BudgetBar } from './BudgetBar';
import { QuoteBanner } from './QuoteBanner';
import { Toolbar } from './Toolbar';

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
      </div>

      <div className="hud top-right">
        <BudgetBar level={level} />
        <QuoteBanner />
      </div>

      <Toolbar level={level} />
    </div>
  );
}
