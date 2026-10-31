import { LEVELS } from '../levels';
import { PRINCIPLES, type IncidentCode } from '../sim/failures';
import type { Level } from '../sim/types';
import { useStore } from '../store';
import { QuoteBanner } from './QuoteBanner';
import { quoteFor } from './quotes';

const CODES = Object.keys(PRINCIPLES) as IncidentCode[];

/** "Level 3" for Stage 1 levels, "Object 1" for the objects section. */
export function levelLabel(lvl: Level): string {
  const same = LEVELS.filter((l) => l.section === lvl.section);
  return `${lvl.section === 'objects' ? 'Object' : 'Level'} ${same.indexOf(lvl) + 1}`;
}

/** Design Notebook: one insight page per level (fail it, then pass it), then every principle learned from a failure. */
export function Journal() {
  const { progress, goTo } = useStore();
  const unlocked = new Set(progress.principles);
  const pages = LEVELS.filter((l) => l.insight);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Design Notebook</h1>
          <p className="tagline">
            {pages.filter((l) => progress.insights.includes(l.id)).length} of {pages.length} pages written. Fail a level, then pass it, to fill
            in its page.
          </p>
        </div>
        <button className="btn ghost" onClick={() => goTo('levels')}>
          ← Levels
        </button>
      </header>

      <QuoteBanner />

      <div className="cards">
        {pages.map((lvl) => {
          const page = lvl.insight!;
          return progress.insights.includes(lvl.id) ? (
            <article key={lvl.id} className="card blueprint diary-card">
              <span className="card-num">{levelLabel(lvl)} · {lvl.title}</span>
              <h3>{page.title}</h3>
              <p>{page.principle}</p>
              <p className="diary-example">🌍 {page.example}</p>
              {page.number && <p className="diary-number">📏 {page.number}</p>}
              <p className="journal-quote">“{page.quote}” <span className="diary-by">— The Master Builder</span></p>
            </article>
          ) : (
            <article key={lvl.id} className="card blueprint locked-card">
              <span className="card-num">{levelLabel(lvl)} · {lvl.title}</span>
              <h3>Page still blank</h3>
              <p>Fail this level once, then pass it.</p>
            </article>
          );
        })}
      </div>

      <h2 className="section-title">Learned the hard way · {CODES.filter((c) => unlocked.has(c)).length} of {CODES.length}</h2>
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
