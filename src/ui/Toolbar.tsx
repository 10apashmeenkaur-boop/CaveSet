import { useEffect, useMemo } from 'react';
import { TOOL_INFO, type BuildTool } from '../sim/design';
import type { Level, ToolId } from '../sim/types';
import { orientationOf, resolveDraft, useStore } from '../store';

const ICON: Record<ToolId, string> = {
  wall: '🧱',
  door1: '🚪',
  door2: '🚪🚪',
  slide1: '↔️',
  slide2: '⇔',
  oneway: '➡️',
  eraser: '🧽',
};

export const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function Toolbar({ level }: { level: Level }) {
  const { tool, setTool, rotate, orientIdx, clearDesign, design, hover } = useStore();
  const tools = useMemo<ToolId[]>(() => [...level.allowedTools, 'eraser'], [level]);
  const [orient, swing] = orientationOf(orientIdx);
  const isDoor = tool !== 'eraser' && TOOL_INFO[tool].door;
  const isSign = tool !== 'eraser' && !!TOOL_INFO[tool].sign;

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
    const r = resolveDraft(level, design, tool, hover[0], hover[1], orientIdx);
    if (r.relevant && !r.check.ok) blocked = r.check.reason;
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
          <button className="btn ghost small" onClick={rotate} disabled={!isDoor && !isSign} title="Shortcut: R">
            {isSign
              ? `⟳ Flip arrow (${swing === 1 ? 'right/down' : 'left/up'})`
              : `⟳ ${orient === 'v' ? 'Vertical' : 'Horizontal'} · swings ${orient === 'v' ? (swing === 1 ? '→' : '←') : swing === 1 ? '↓' : '↑'}`}
          </button>
          <button className="btn ghost small" onClick={clearDesign} disabled={!design.items.length}>
            Clear all
          </button>
        </div>
      </div>
      <div className="controls-hint">Left click: build · drag: paint walls · right click: erase · right drag: pan · scroll: zoom · R: rotate door</div>
    </div>
  );
}
