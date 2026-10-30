import { costOf } from '../sim/design';
import type { Level } from '../sim/types';
import { useStore } from '../store';
import { inr } from './Toolbar';

export function BudgetBar({ level }: { level: Level }) {
  const design = useStore((s) => s.design);
  const cost = costOf(design);
  const limited = Number.isFinite(level.budget);
  const pct = limited ? Math.min(100, (cost / level.budget) * 100) : 0;
  const over = limited && cost > level.budget;

  return (
    <div className={`budget blueprint ${over ? 'over' : ''}`}>
      <div className="budget-row">
        <span className="budget-label">Spent</span>
        <strong>
          {inr(cost)}
          {limited && <span className="budget-of"> / {inr(level.budget)}</span>}
        </strong>
      </div>
      {limited && (
        <>
          <div className="budget-track">
            <div className="budget-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="budget-note">{over ? `Over budget by ${inr(cost - level.budget)}` : `${inr(level.budget - cost)} left`}</div>
        </>
      )}
    </div>
  );
}
