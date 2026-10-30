import { costOf } from '../sim/design';
import { TICKS_PER_SEC } from '../sim/simulate';
import type { Level } from '../sim/types';
import { useStore } from '../store';

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** Play button in design mode; play/pause, speed, stats and "back to design" while simulating. */
export function SimBar({ level }: { level: Level }) {
  const { mode, sim, running, speed, play, pause, backToDesign, setSpeed, design } = useStore();

  if (mode === 'design' || !sim) {
    return (
      <button className="btn play-btn" onClick={play} title="Shortcut: Space">
        ▶ Simulate
      </button>
    );
  }

  const elapsed = sim.tick / TICKS_PER_SEC;
  const stuck = sim.agents.filter((a) => a.state === 'stuck').length;
  const ended = sim.finished || sim.timeUp;
  const overBudget = Number.isFinite(level.budget) && costOf(design) > level.budget;

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
      {ended && (
        <div className={`sim-result ${sim.finished && !overBudget ? 'good' : 'bad'}`}>
          {sim.finished
            ? `Everything delivered in ${fmt(elapsed)}!${overBudget ? ' But you went over budget.' : ''}`
            : `Time’s up. ${sim.delivered} of ${sim.totalTasks} delivered.`}
        </div>
      )}
    </div>
  );
}
