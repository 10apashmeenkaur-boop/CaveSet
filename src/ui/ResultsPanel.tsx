import { useState } from 'react';
import { LEVELS } from '../levels';
import { costOf } from '../sim/design';
import { score } from '../sim/scoring';
import type { Level } from '../sim/types';
import { useStore } from '../store';
import { quoteFor } from './quotes';

function Stars({ n }: { n: number }) {
  return (
    <span className="result-stars" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? 'on' : ''}>★</span>
      ))}
    </span>
  );
}

/** End-of-run report: stars, the three checks, and one card per incident. Click a card to see where it happened. */
export function ResultsPanel({ level }: { level: Level }) {
  const sim = useStore((s) => s.sim);
  const design = useStore((s) => s.design);
  const focus = useStore((s) => s.focus);
  const { setFocus, backToDesign, openLevel, goTo } = useStore.getState();
  // The panel can be tucked away to look at the scene; a small tab brings it back.
  const [open, setOpen] = useState(true);
  if (!sim) return null;

  const sandbox = !Number.isFinite(level.budget);
  const r = score(level, sim, costOf(design));
  const next = LEVELS[LEVELS.findIndex((l) => l.id === level.id) + 1];

  const title = sandbox ? 'Sandbox run' : r.passed ? 'Service complete' : 'Not quite yet';
  if (!open) {
    return (
      <button className="results-tab blueprint" onClick={() => setOpen(true)} title="Show the results again">
        <span>{title}</span>
        {!sandbox && <Stars n={r.stars} />}
        <span className="results-tab-open">Show results ◂</span>
      </button>
    );
  }

  return (
    <aside className="results blueprint">
      <header>
        <h2>{title}</h2>
        {!sandbox && <Stars n={r.stars} />}
        <button className="results-close" onClick={() => setOpen(false)} title="Hide results to see the scene" aria-label="Hide results">
          ✕
        </button>
      </header>

      {!sandbox && (
        <ul className="checks">
          {r.checks.map((c) => (
            <li key={c.label} className={c.ok ? 'ok' : 'no'}>
              <span className="mark">{c.ok ? '★' : '☆'}</span>
              <div>
                <strong>{c.label}</strong>
                <span>{c.detail}</span>
              </div>
            </li>
          ))}
          {!level.rack && (
          <li className="info">
            <span className="mark">💬</span>
            <div>
              <strong>Comfort</strong>
              <span>
                {r.complaints} {r.complaints === 1 ? 'complaint' : 'complaints'} (jams and door bumps)
              </span>
            </div>
          </li>
          )}
        </ul>
      )}

      {sim.incidents.length > 0 ? (
        <>
          <h3 className="cards-title">What went wrong ({sim.incidents.length})</h3>
          <div className="incident-cards">
            {sim.incidents.map((inc, i) => {
              const said = quoteFor(inc.code, `${inc.code}-${inc.tick}`);
              return (
                <button
                  key={`${inc.code}-${inc.tick}`}
                  className={`incident-card ${focus === i ? 'focused' : ''}`}
                  onClick={() => setFocus(focus === i ? null : i)}
                >
                  <span className="code">{inc.code.replace(/_/g, ' ')}</span>
                  <strong>{inc.title}</strong>
                  <span className="evidence">{inc.evidence}</span>
                  {said && <span className="said">“{said}”</span>}
                  <span className="principle">{inc.principle}</span>
                  <span className="hint">💡 {inc.hint}</span>
                </button>
              );
            })}
          </div>
          <p className="cards-tip">Click a card to see where it happened.</p>
        </>
      ) : (
        <p className="clean">No incidents. Everything ran smoothly and nobody complained.</p>
      )}

      <footer>
        <button className="btn ghost small" onClick={() => goTo('levels')}>Levels</button>
        <button className="btn ghost small" onClick={backToDesign}>✏️ Redesign</button>
        {r.passed && next && (
          <button className="btn small" onClick={() => openLevel(next.id)}>Next level →</button>
        )}
      </footer>
    </aside>
  );
}
