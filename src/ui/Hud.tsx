import { useEffect, useState } from 'react';
import { isMuted, setMuted } from '../audio/sfx';
import { TICKS_PER_SEC } from '../sim/constants';
import { costOf } from '../sim/design';
import type { Level } from '../sim/types';
import { useStore } from '../store';
import { inr } from './Toolbar';

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** Top-left: level name, money, and (while running) the clock and deliveries. */
export function LevelChip({ level, onBrief }: { level: Level; onBrief: () => void }) {
  const goTo = useStore((s) => s.goTo);
  const cost = useStore((s) => costOf(s.design));
  const sim = useStore((s) => s.sim);
  const limited = Number.isFinite(level.budget);
  const over = limited && cost > level.budget;
  const stuck = sim?.agents.filter((a) => a.state === 'stuck').length ?? 0;

  return (
    <div className="hud top-left chip">
      <div className="chip-row">
        <button className="icon-btn" onClick={() => goTo('levels')} title="Back to levels">←</button>
        <strong className="chip-title">{level.title}</strong>
        <button className="icon-btn" onClick={onBrief} title="What do I need to do?">?</button>
      </div>
      <div className={`chip-row money ${over ? 'over' : ''}`} title={limited ? `${inr(cost)} of ${inr(level.budget)}` : 'No budget'}>
        <span>{inr(cost)}</span>
        {limited && (
          <>
            <span className="muted">/ {inr(level.budget)}</span>
            <span className="mini-track">
              <span className="mini-fill" style={{ width: `${Math.min(100, (cost / level.budget) * 100)}%` }} />
            </span>
          </>
        )}
      </div>
      {sim && (
        <div className="chip-row stats">
          <span>
            ⏱ {fmt(sim.tick / TICKS_PER_SEC)}
            {level.timeLimitSec > 0 && <span className="muted"> / {fmt(level.timeLimitSec)}</span>}
          </span>
          <span>📦 {sim.delivered}/{sim.totalTasks}</span>
          {stuck > 0 && <span className="bad">⚠ {stuck}</span>}
        </div>
      )}
    </div>
  );
}

function MuteButton() {
  const [muted, setM] = useState(isMuted);
  return (
    <button
      className="icon-btn"
      onClick={() => {
        setMuted(!muted);
        setM(!muted);
      }}
      title={muted ? 'Sound off' : 'Sound on'}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

/** Top-right: simulate / play-pause / speed / heatmap / back to design, and mute. */
export function Controls({ level }: { level: Level }) {
  const { mode, sim, running, speed, play, pause, backToDesign, setSpeed, showHeat, toggleHeat, notice } = useStore();
  const overBudget = useStore((s) => Number.isFinite(level.budget) && costOf(s.design) > level.budget);
  const ended = !!sim && (sim.finished || sim.timeUp);

  return (
    <div className="hud top-right controls">
      <div className="controls-row">
        {mode === 'design' ? (
          <button className={`btn play-btn ${overBudget ? 'over' : ''}`} onClick={play} title={overBudget ? 'Over budget' : 'Simulate (Space)'}>
            {overBudget ? '₹ Over budget' : '▶ Simulate'}
          </button>
        ) : (
          !ended && (
            <>
              <button className="icon-btn big" onClick={running ? pause : play} title="Pause / play (Space)">
                {running ? '⏸' : '▶'}
              </button>
              {([1, 2, 4] as const).map((s) => (
                <button key={s} className={`icon-btn ${speed === s ? 'on' : ''}`} onClick={() => setSpeed(s)}>
                  {s}×
                </button>
              ))}
              <button className={`icon-btn ${showHeat ? 'on' : ''}`} onClick={toggleHeat} title="Heatmap: where people waited">
                🔥
              </button>
              <button className="icon-btn" onClick={backToDesign} title="Stop and go back to building">
                ✏️
              </button>
            </>
          )
        )}
        <MuteButton />
      </div>
      {notice && mode === 'design' && <div className="blocked">{notice}</div>}
    </div>
  );
}

/** Bottom, while running: one pill per problem so far. Hover for the details. */
export function IncidentStrip() {
  const incidents = useStore((s) => s.sim?.incidents ?? []);
  if (!incidents.length) return null;
  return (
    <div className="hud bottom-center">
      <ul className="incidents">
        {incidents.map((i) => (
          <li key={`${i.code}-${i.tick}`} title={`${i.evidence}\n\n${i.principle}\n\nHint: ${i.hint}`}>
            <span className="dot" /> {i.title}
            {i.count > 1 && <span className="muted"> ×{i.count}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One-line brief that pops up when a level opens; fades on its own or on click. */
export function BriefToast({ level, open, onClose }: { level: Level; open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 7000);
    return () => clearTimeout(t);
  }, [open, onClose]);
  if (!open) return null;
  const goal = level.brief.split('. ')[0].replace(/\.$/, '');
  return (
    <button className="brief-toast" onClick={onClose}>
      <strong>{goal}.</strong>
      <span>
        {Number.isFinite(level.budget) ? `${inr(level.budget)} budget` : 'No budget'}
        {level.timeLimitSec > 0 ? ` · ${level.timeLimitSec}s` : ''} · click to build · right-click erases · R rotates · right-drag pans
      </span>
    </button>
  );
}
