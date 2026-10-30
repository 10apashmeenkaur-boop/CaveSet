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
      <div className="toolbar">
        {tools.map((t, i) => {
          const name = t === 'eraser' ? 'Eraser (right-click also erases)' : TOOL_INFO[t as BuildTool].name;
          return (
            <button key={t} className={`tool ${tool === t ? 'active' : ''}`} onClick={() => setTool(t)} title={`${name} · key ${i + 1}`}>
              <span className="tool-icon">{ICON[t]}</span>
              <span className="tool-cost">{t === 'eraser' ? 'free' : inr(TOOL_INFO[t as BuildTool].cost)}</span>
            </button>
          );
        })}
        <span className="tool-sep" />
        <button
          className="tool"
          onClick={rotate}
          disabled={!isDoor && !isSign}
          title={isSign ? 'Flip the arrow (R)' : `Rotate / flip the door swing (R): ${orient === 'v' ? 'vertical' : 'horizontal'}`}
        >
          <span className="tool-icon">⟳</span>
          <span className="tool-cost">{isSign ? (swing === 1 ? '→ / ↓' : '← / ↑') : orient === 'v' ? (swing === 1 ? 'swing →' : 'swing ←') : swing === 1 ? 'swing ↓' : 'swing ↑'}</span>
        </button>
        <button className="tool" onClick={clearDesign} disabled={!design.items.length} title="Clear everything you built">
          <span className="tool-icon">🗑</span>
          <span className="tool-cost">clear</span>
        </button>
      </div>
    </div>
  );
}
