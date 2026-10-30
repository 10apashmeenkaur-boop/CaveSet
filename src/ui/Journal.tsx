import { useStore } from '../store';
import { QuoteBanner } from './QuoteBanner';

/** Principles unlocked by failing. Wired to real incidents in M5/M6. */
const PRINCIPLES: { code: string; title: string; principle: string }[] = [
  { code: 'TOO_NARROW', title: 'Fit the load', principle: 'Openings must fit the largest thing passing through, not just the person.' },
  { code: 'HEAD_ON_JAM', title: 'Separate the flows', principle: 'When traffic goes both ways, give each direction its own path.' },
  { code: 'SWING_BLOCK', title: 'Mind the swing', principle: 'A hinged door needs empty floor where it opens. Keep paths out of the arc.' },
  { code: 'NO_PATH', title: 'Leave a way through', principle: 'Every task needs a route. Check for dead ends before you build.' },
  { code: 'CONGESTION', title: 'Widen the busy spots', principle: 'Where people wait most, space is worth the most.' },
  { code: 'TIME_LIMIT', title: 'Short routes win', principle: 'Every extra step is paid for on every trip, by every person.' },
  { code: 'OVER_BUDGET', title: 'Spend where it matters', principle: 'Put money into the parts that carry the load.' },
];

export function Journal() {
  const { progress, goTo } = useStore();
  const unlocked = new Set(progress.principles);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Design Journal</h1>
          <p className="tagline">
            {unlocked.size} of {PRINCIPLES.length} principles learned, each one the hard way.
          </p>
        </div>
        <button className="btn ghost" onClick={() => goTo('levels')}>
          ← Levels
        </button>
      </header>

      <QuoteBanner />

      <div className="cards">
        {PRINCIPLES.map((p) =>
          unlocked.has(p.code) ? (
            <article key={p.code} className="card blueprint">
              <span className="card-num">{p.code}</span>
              <h3>{p.title}</h3>
              <p>{p.principle}</p>
            </article>
          ) : (
            <article key={p.code} className="card blueprint locked-card">
              <span className="card-num">???</span>
              <h3>Not yet learned</h3>
              <p>Something has to go wrong first.</p>
            </article>
          ),
        )}
      </div>
    </div>
  );
}
