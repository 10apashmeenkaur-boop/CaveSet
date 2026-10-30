import { LEVELS, SANDBOX } from '../levels';
import { useStore } from '../store';
import { useEffect, useState } from 'react';
import { getVolume, isMuted, setMuted, setVolume } from '../audio/sfx';
import { QuoteBanner } from './QuoteBanner';

/** Sound on/off (off until the player turns it on) and volume. Both remembered per browser. */
function SoundControls() {
  const [muted, setM] = useState(isMuted);
  const [volume, setV] = useState(getVolume);
  const toggle = (on: boolean) => {
    setMuted(!on);
    setM(!on);
  };
  return (
    <div className="sound-controls">
      <button
        className="btn ghost sound-toggle"
        onClick={() => toggle(muted)}
        title={muted ? 'Sound is off. Click to turn it on.' : 'Sound is on. Click to turn it off.'}
        aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <input
        className="volume"
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => {
          const v = Number(e.target.value) / 100;
          setVolume(v);
          setV(v);
        }}
        aria-label="Volume"
        title={`Volume ${Math.round(volume * 100)}%`}
      />
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (i < n ? '★' : '☆')).join('')}
    </span>
  );
}

export function LevelSelect() {
  const { progress, openLevel, goTo, setProgress } = useStore();

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
        <div className="head-buttons">
          <SoundControls />
          <button className="btn ghost" onClick={() => goTo('journal')}>
            📓 Mistri Ji ki diary
          </button>
        </div>
      </header>

      <QuoteBanner />

      <h2 className="section-title">Stage 1 · The Langar Hall Service Path</h2>
      <div className="cards">
        {LEVELS.map((lvl, i) => {
          // A level unlocks once the previous one has at least one star.
          const locked = i > 0 && !progress.stars[LEVELS[i - 1].id] && !(import.meta.env.DEV && progress.devUnlock);
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
