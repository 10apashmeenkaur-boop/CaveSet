import { LEVELS, SANDBOX } from '../levels';
import { useStore } from '../store';
import { useEffect } from 'react';
import type { Level } from '../sim/types';
import { levelLabel } from './Journal';

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (i < n ? '★' : '☆')).join('')}
    </span>
  );
}

const STAGE_1 = LEVELS.filter((l) => !l.section);
const OBJECTS = LEVELS.filter((l) => l.section === 'objects');

/** One level card: a stage level unlocks once the previous one has at least one star. */
function LevelCard({ lvl, label, locked, stars }: { lvl: Level; label: string; locked: boolean; stars: number }) {
  const openLevel = useStore((s) => s.openLevel);
  return (
    <button className="card blueprint" disabled={locked} onClick={() => openLevel(lvl.id)}>
      <span className="card-num">{label}</span>
      <h3>{lvl.title}</h3>
      <p>{lvl.brief}</p>
      <footer>
        <span className="pill">Budget ₹{lvl.budget.toLocaleString('en-IN')}</span>
        {locked ? <span className="lock">🔒 Finish the previous level</span> : <Stars n={stars} />}
      </footer>
    </button>
  );
}

export function LevelSelect() {
  const { progress, openLevel, goTo, setProgress } = useStore();
  const devOpen = import.meta.env.DEV && !!progress.devUnlock;

  // Dev builds only: U unlocks (or relocks) every level, for testing without replaying.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'u' || e.key === 'U') setProgress((p) => ({ ...p, devUnlock: !p.devUnlock }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setProgress]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Design Lab</h1>
          <p className="tagline">Design for how a thing is used, not just what it holds.</p>
        </div>
        <button className="btn ghost" onClick={() => goTo('journal')}>
          📓 Design Notebook
        </button>
      </header>

      <h2 className="section-title">Stage 1 · The Dining Hall Service Path</h2>
      <div className="cards">
        {STAGE_1.map((lvl, i) => (
          <LevelCard key={lvl.id} lvl={lvl} label={levelLabel(lvl)} locked={i > 0 && !progress.stars[STAGE_1[i - 1].id] && !devOpen} stars={progress.stars[lvl.id] ?? 0} />
        ))}
        <button className="card blueprint sandbox" onClick={() => openLevel(SANDBOX.id)}>
          <span className="card-num">Free build</span>
          <h3>{SANDBOX.title}</h3>
          <p>{SANDBOX.brief}</p>
          <footer>
            <span className="pill">No budget</span>
          </footer>
        </button>
      </div>

      <h2 className="section-title">Objects</h2>
      <div className="cards">
        {OBJECTS.map((lvl, i) => (
          // The first object is open from the start; each one after needs a star on the one before.
          <LevelCard key={lvl.id} lvl={lvl} label={levelLabel(lvl)} locked={i > 0 && !progress.stars[OBJECTS[i - 1].id] && !devOpen} stars={progress.stars[lvl.id] ?? 0} />
        ))}
      </div>
    </div>
  );
}
