import { costOf } from '../sim/design';
import { gameSeconds } from '../sim/scoring';
import { goalText } from '../sim/progress';
import type { Level } from '../sim/types';
import { useStore } from '../store';

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** Play button in design mode; play/pause, speed, stats, incidents and "back to design" while simulating. */
export function SimBar({ level }: { level: Level }) {
  const { mode, sim, running, speed, play, pause, backToDesign, setSpeed, design, notice, showHeat, toggleHeat, showGhost, toggleGhost } = useStore();
  const hasBest = useStore((s) => !!s.levelId && !!s.progress.best[s.levelId]);
  const overBudget = Number.isFinite(level.budget) && costOf(design) > level.budget;

  if (mode === 'design' || !sim) {
    return (
      <div className="play-wrap">
        {notice && <div className="blocked">{notice}</div>}
        <button
          className={`btn play-btn ${overBudget ? 'over' : ''}`}
          onClick={play}
          title={overBudget ? 'Over budget: remove something first' : 'Shortcut: Space'}
        >
          {overBudget ? '₹ Over budget' : '▶ Simulate'}
        </button>
      </div>
    );
  }

  const elapsed = gameSeconds(level, sim.tick);
  const stuck = sim.agents.filter((a) => a.state === 'stuck').length;
  const ended = sim.finished || sim.timeUp;

  return (
    <div className="simbar blueprint">
      <div className="sim-buttons">
        {ended ? null : running ? (
          <button className="btn small" onClick={pause}>⏸ Pause</button>
        ) : (
          <button className="btn small" onClick={play}>▶ Play</button>
        )}
        {([1, 2, 4] as const).map((s) => (
          <button key={s} className={`btn ghost small speed ${speed === s ? 'on' : ''}`} onClick={() => setSpeed(s)}>
            {s}×
          </button>
        ))}
        <button className={`btn ghost small speed ${showHeat ? 'on' : ''}`} onClick={toggleHeat} title="Where people waited">
          🔥 Heatmap
        </button>
        <button
          className={`btn ghost small speed ${showGhost && hasBest ? 'on' : ''}`}
          onClick={toggleGhost}
          disabled={!hasBest}
          title={hasBest ? 'Show faint people from your best run' : 'Pass this level once to race your best run'}
        >
          👻 Best run
        </button>
        <button className="btn ghost small" onClick={backToDesign}>↺ Back to design</button>
      </div>
      <div className="sim-stats">
        <span>
          ⏱ {fmt(elapsed)}
          {level.timeLimitSec > 0 && <span className="muted"> / {fmt(level.timeLimitSec)}</span>}
        </span>
        <span>{goalText(level, sim.delivered, sim.totalTasks)}</span>
        {sim.rack && <span>💧 Counter: {Math.round(sim.rack.counter)} mL</span>}
        {ended && <span className={sim.finished ? 'good' : 'bad'}>{sim.finished ? '✓ Finished' : '⏰ Time’s up'}</span>}
        {stuck > 0 && <span className="bad">⚠ {stuck} stuck</span>}
      </div>
      {sim.incidents.length > 0 && !ended && (
        <ul className="incidents">
          {sim.incidents.map((i) => (
            <li key={`${i.code}-${i.tick}`} title={`${i.evidence}\n\n${i.principle}\n\nHint: ${i.hint}`}>
              <span className="dot" /> {i.title}
              {i.count > 1 && <span className="muted"> ×{i.count}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
