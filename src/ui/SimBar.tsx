import { costOf } from '../sim/design';
import { TICKS_PER_SEC } from '../sim/simulate';
import type { Level } from '../sim/types';
import { useStore } from '../store';

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** Play button in design mode; play/pause, speed, stats, incidents and "back to design" while simulating. */
export function SimBar({ level }: { level: Level }) {
  const { mode, sim, running, speed, play, pause, backToDesign, setSpeed, design, notice, showHeat, toggleHeat } = useStore();
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

  const elapsed = sim.tick / TICKS_PER_SEC;
  const stuck = sim.agents.filter((a) => a.state === 'stuck').length;
  const ended = sim.finished || sim.timeUp;
  const failed = sim.incidents.some((i) => ['NO_PATH', 'TOO_NARROW', 'TIME_LIMIT', 'DINING_DISTURBED'].includes(i.code));

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
        <button className="btn ghost small" onClick={backToDesign}>↺ Back to design</button>
      </div>
      <div className="sim-stats">
        <span>
          ⏱ {fmt(elapsed)}
          {level.timeLimitSec > 0 && <span className="muted"> / {fmt(level.timeLimitSec)}</span>}
        </span>
        <span>📦 {sim.delivered}/{sim.totalTasks} delivered</span>
        {stuck > 0 && <span className="bad">⚠ {stuck} stuck</span>}
      </div>
      {sim.incidents.length > 0 && (
        <ul className="incidents">
          {sim.incidents.map((i) => (
            <li key={`${i.code}-${i.tick}`} title={`${i.evidence}\n\n${i.principle}\n\nHint: ${i.hint}`}>
              <span className="dot" /> {i.title}
              {i.count > 1 && <span className="muted"> ×{i.count}</span>}
            </li>
          ))}
        </ul>
      )}
      {ended && (
        <div className={`sim-result ${sim.finished && !failed ? 'good' : 'bad'}`}>
          {sim.finished
            ? failed
              ? `Everything delivered in ${fmt(elapsed)}, but not cleanly. Check the problems above.`
              : `Everything delivered in ${fmt(elapsed)}!`
            : `Time’s up. ${sim.delivered} of ${sim.totalTasks} delivered.`}
        </div>
      )}
    </div>
  );
}
