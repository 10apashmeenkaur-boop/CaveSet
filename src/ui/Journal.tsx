import { PRINCIPLES, type IncidentCode } from '../sim/failures';
import { useStore } from '../store';
import { QuoteBanner } from './QuoteBanner';
import { quoteFor } from './quotes';

const CODES = Object.keys(PRINCIPLES) as IncidentCode[];

export function Journal() {
  const { progress, goTo } = useStore();
  const unlocked = new Set(progress.principles);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Design Journal</h1>
          <p className="tagline">
            {CODES.filter((c) => unlocked.has(c)).length} of {CODES.length} principles learned, each one the hard way.
          </p>
        </div>
        <button className="btn ghost" onClick={() => goTo('levels')}>
          ← Levels
        </button>
      </header>

      <QuoteBanner />

      <div className="cards">
        {CODES.map((code) => {
          const p = PRINCIPLES[code];
          const said = quoteFor(code, code);
          return unlocked.has(code) ? (
            <article key={code} className="card blueprint">
              <span className="card-num">{code.replace(/_/g, ' ')}</span>
              <h3>{p.title}</h3>
              <p>{p.principle}</p>
              {said && <p className="journal-quote">“{said}”</p>}
            </article>
          ) : (
            <article key={code} className="card blueprint locked-card">
              <span className="card-num">???</span>
              <h3>Not yet learned</h3>
              <p>Something has to go wrong first.</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
