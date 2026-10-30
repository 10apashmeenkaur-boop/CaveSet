import { useCallback, useEffect, useState } from 'react';
import { findLevel } from '../levels';
import { Scene } from '../render/Scene';
import { useStore } from '../store';
import { BriefToast, Controls, IncidentStrip, LevelChip } from './Hud';
import { ResultsPanel } from './ResultsPanel';
import { Toolbar } from './Toolbar';

export function GameScreen() {
  // Narrow selectors: this wraps the 3D scene, so it must not re-render on every sim tick.
  const levelId = useStore((s) => s.levelId);
  const mode = useStore((s) => s.mode);
  const ended = useStore((s) => !!s.sim && (s.sim.finished || s.sim.timeUp));
  const level = levelId ? findLevel(levelId) : undefined;
  const [brief, setBrief] = useState(true);
  const closeBrief = useCallback(() => setBrief(false), []);

  useEffect(() => setBrief(true), [levelId]);

  // Space: start / pause / resume.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      const s = useStore.getState();
      if (s.running) s.pause();
      else if (!s.sim?.finished && !s.sim?.timeUp) s.play();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!level) return null;

  return (
    <div className="game">
      <Scene level={level} />
      <LevelChip level={level} onBrief={() => setBrief(true)} />
      <Controls level={level} />
      {mode === 'design' && <Toolbar level={level} />}
      {mode === 'sim' && !ended && <IncidentStrip />}
      {ended && <ResultsPanel level={level} />}
      <BriefToast level={level} open={brief && mode === 'design'} onClose={closeBrief} />
    </div>
  );
}
