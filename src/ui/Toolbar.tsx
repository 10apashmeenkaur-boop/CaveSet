import { useEffect, useMemo } from 'react';
import { eraseTarget, TOOL_INFO, type BuildTool } from '../sim/design';
import type { Level, ToolId } from '../sim/types';
import { RAMP_SLOPES } from '../sim/constants';
import { orientationOf, rampDraft, resolveDraft, useStore } from '../store';

const ICON: Record<ToolId, string> = {
  wall: '🧱',
  door1: '🚪',
  door2: '🚪🚪',
  slide1: '↔️',
  slide2: '⇔',
  oneway: '➡️',
  shoe: '👟',
  tap: '🚰',
  rail: '🚧',
  stairs: '🪜',
  ramp: '📐',
  landing: '🟫',
  handrail: '🤚',
  eraser: '🧽',
};

export const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function Toolbar({ level }: { level: Level }) {
  const { tool, setTool, rotate, orientIdx, slopeIdx, rampDir, clearDesign, design, hover, undo, redo, past, future } = useStore();
  const tools = useMemo<ToolId[]>(() => [...level.allowedTools, 'eraser'], [level]);
  const [orient, swing] = orientationOf(orientIdx);
  const isDoor = tool !== 'eraser' && TOOL_INFO[tool].door;
  const isSign = tool !== 'eraser' && !!TOOL_INFO[tool].sign;
  const isStation = tool !== 'eraser' && !!TOOL_INFO[tool].station;
  const isRamp = tool === 'ramp';
  const isStairs = tool === 'stairs';
  const arrow = orient === 'v' ? (swing === 1 ? '→' : '←') : swing === 1 ? '↓' : '↑';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') rotate();
      else if (e.key === 'e' || e.key === 'E') setTool('eraser');
      else {
        const n = Number(e.key);
        if (n >= 1 && n <= tools.length) setTool(tools[n - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rotate, setTool, tools]);

  // Why the ghost is red, if it is.
  let blocked: string | null = null;
  if (hover && tool !== 'eraser') {
    const r = isRamp
      ? resolveDraft(level, design, tool, hover[0], hover[1], orientIdx, rampDraft({ design, slopeIdx, rampDir }, hover[0], hover[1]))
      : resolveDraft(level, design, tool, hover[0], hover[1], orientIdx);
    // Hovering something already built (e.g. the door you just placed) needs no warning: the red ghost says enough.
    if (r.relevant && !r.check.ok && !eraseTarget(design, hover[0], hover[1])) blocked = r.check.reason;
  }

  return (
    <div className="hud bottom-center">
      {blocked && <div className="blocked">{blocked}</div>}
      <div className="toolbar blueprint">
        {tools.map((t, i) => (
          <button key={t} className={`tool ${tool === t ? 'active' : ''}`} onClick={() => setTool(t)} title={`Shortcut: ${i + 1}`}>
            <span className="tool-icon">{ICON[t]}</span>
            <span className="tool-name">{t === 'eraser' ? 'Eraser' : TOOL_INFO[t as BuildTool].name}</span>
            <span className="tool-cost">{t === 'eraser' ? 'refund' : inr(TOOL_INFO[t as BuildTool].cost)}</span>
          </button>
        ))}
        <div className="tool-side">
          <button className="btn ghost small" onClick={rotate} disabled={!isDoor && !isSign && !isStation && !isRamp && !isStairs} title="Shortcut: R">
            {isSign
              ? '⟳ Flip arrow'
              : isDoor
                ? '⟳ Flip door'
                : isStation
                  ? `⟳ Faces ${arrow}`
                  : isRamp
                    ? `⟳ Slope 1:${RAMP_SLOPES[slopeIdx]}`
                    : isStairs
                      ? `⟳ Up ${arrow}`
                      : '⟳ Rotate'}
          </button>
          <div className="undo-row">
            <button className="btn ghost small" onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)">
              ↶ Undo
            </button>
            <button className="btn ghost small" onClick={redo} disabled={!future.length} title="Redo (Ctrl+Y)">
              ↷
            </button>
          </div>
          <button className="btn ghost small" onClick={clearDesign} disabled={!design.items.length}>
            Clear all
          </button>
        </div>
      </div>
      <div className="controls-hint">
        {isRamp
          ? 'Drag uphill: paint a ramp · R: slope · right click: erase · right drag: pan · scroll: zoom'
          : isStairs
            ? 'Left click: build · R: turn the stairs · right click: erase · right drag: pan · scroll: zoom'
            : 'Left click: build · drag: paint walls · right click: erase · right drag: pan · scroll: zoom · R: flip door'}
      </div>
    </div>
  );
}
