import { LEVELS, SANDBOX } from '../levels';
import { useStore } from '../store';
import { QuoteBanner } from './QuoteBanner';

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (i < n ? '★' : '☆')).join('')}
    </span>
  );
}

export function LevelSelect() {
  const { progress, openLevel, goTo } = useStore();

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Design Lab</h1>
          <p className="tagline">Design for how a thing is used, not just what it holds.</p>
        </div>
        <button className="btn ghost" onClick={() => goTo('journal')}>
          📓 Design Journal
        </button>
      </header>

      <QuoteBanner />

      <h2 className="section-title">Stage 1 · The Langar Hall Service Path</h2>
      <div className="cards">
        {LEVELS.map((lvl, i) => {
          // A level unlocks once the previous one has at least one star.
          const locked = i > 0 && !progress.stars[LEVELS[i - 1].id];
          return (
            <button key={lvl.id} className="card blueprint" disabled={locked} onClick={() => openLevel(lvl.id)}>
              <span className="card-num">Level {i + 1}</span>
              <h3>{lvl.title}</h3>
              <p>{lvl.brief}</p>
              <footer>
                <span className="pill">Budget ₹{lvl.budget.toLocaleString('en-IN')}</span>
                {locked ? <span className="lock">🔒 Finish the previous level</span> : <Stars n={progress.stars[lvl.id] ?? 0} />}
              </footer>
            </button>
          );
        })}
        <button className="card blueprint sandbox" onClick={() => openLevel(SANDBOX.id)}>
          <span className="card-num">Free build</span>
          <h3>{SANDBOX.title}</h3>
          <p>{SANDBOX.brief}</p>
          <footer>
            <span className="pill">No budget</span>
          </footer>
        </button>
      </div>
    </div>
  );
}
