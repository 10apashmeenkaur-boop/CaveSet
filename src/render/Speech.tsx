import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Group } from 'three';
import type { Agent } from '../sim/agents';
import { SIDESTEP_TICKS } from '../sim/constants';
import type { IncidentCode } from '../sim/failures';
import type { Level, Tile } from '../sim/types';
import { useStore } from '../store';
import { quoteFor, STUCK_LINES, type StuckKind } from '../ui/quotes';
import { agentPosition } from './Agents';
import { tileToWorld } from './coords';

/** Speech bubbles are paced in real time (not sim time) so they can be read at any speed. */
const SHOW_MS = 4000;
const FADE_MS = 1000;
/** Someone who just spoke waits this long before speaking again. */
const COOLDOWN_MS = 3000;
const MAX_BUBBLES = 3;
const MAX_MARKS = 3;
/** Bubbles that start this close (in tiles) to another stack upwards instead of overlapping. */
const STACK_TILES = 3;
const STACK_STEP = 0.5;
/** Diners complain about a walk-through for this many ticks after it happens. */
const DINER_TICKS = 25;

type Said = { key: string; text: string; born: number; agent?: string; tile?: Tile; at: Tile; lift: number };
type Candidate = { key: string; text: string; rank: number; agent?: string; tile?: Tile };

/** What a person says right now, if anything, and how urgent it is (higher speaks first). */
function lineFor(a: Agent): { text: string; rank: number } | null {
  if (a.state === 'done' || a.state === 'seated') return null;
  const stuck = (kind: StuckKind) => {
    const list = STUCK_LINES[kind];
    return list[Number(a.id.slice(1)) % list.length];
  };
  if (a.state === 'stuck') {
    const text = a.stuckReason === 'no-path' ? stuck('noWay') : a.complaint ? quoteFor(a.complaint as IncidentCode, a.id) : stuck('stuck');
    return { text: text ?? stuck('stuck'), rank: 3000 + a.waitTicks };
  }
  if (a.complaint) {
    // When time runs out everyone is late; only some of them say so.
    const late = a.complaint === 'TIME_LIMIT' || a.complaint === 'UNDERUSED_HALL';
    if (late && Number(a.id.slice(1)) % 4 !== 1) return null;
    const text = quoteFor(a.complaint as IncidentCode, a.id);
    return text ? { text, rank: (late ? 0 : 2000) + a.waitTicks } : null;
  }
  // Waiting a long time for someone in the way (not just standing in a queue or being served).
  if (a.state === 'waiting' && a.waitTicks >= SIDESTEP_TICKS && (a.waitReason === 'occupied' || a.waitReason === 'swing')) {
    return { text: stuck('blocked'), rank: 1000 + a.waitTicks };
  }
  return null;
}

/**
 * All speech in one place: people who are stuck or kept waiting, people with a complaint, and diners
 * disturbed by a walk-through. At most 3 bubbles at once; each stays 4 s, then fades over 1 s.
 * The 3 most stuck people without a bubble get a small "?!" marker.
 */
export function SpeechLayer({ level }: { level: Level }) {
  const [said, setSaid] = useState<Said[]>([]);
  const [marks, setMarks] = useState<string[]>([]);
  const quietUntil = useRef(new Map<string, number>());
  const lastSim = useRef<unknown>(null);

  useFrame(() => {
    const sim = useStore.getState().sim;
    const now = performance.now();
    if (sim !== lastSim.current && (!sim || sim.tick === 0)) {
      // New run or back to design: start fresh.
      quietUntil.current.clear();
      if (said.length) setSaid([]);
      if (marks.length) setMarks([]);
    }
    lastSim.current = sim;
    if (!sim) return;

    // Drop finished bubbles.
    let next = said.filter((b) => now - b.born < SHOW_MS + FADE_MS);
    for (const b of said) if (!next.includes(b)) quietUntil.current.set(b.key, now + COOLDOWN_MS);

    if (next.length < MAX_BUBBLES) {
      const cands: Candidate[] = [];
      for (const a of sim.agents) {
        const l = lineFor(a);
        if (l) cands.push({ key: a.id, agent: a.id, ...l });
      }
      for (const d of sim.disturbances) {
        if (sim.tick - d.tick > DINER_TICKS) continue;
        const key = `diner-${d.tile[0]},${d.tile[1]}`;
        cands.push({ key, tile: d.tile, text: quoteFor('DINING_DISTURBED', key)!, rank: 2500 });
      }
      cands.sort((x, y) => y.rank - x.rank);
      for (const c of cands) {
        if (next.length >= MAX_BUBBLES) break;
        if ((quietUntil.current.get(c.key) ?? 0) > now || next.some((b) => b.key === c.key)) continue;
        // One diner bubble per spot of the hall.
        if (c.tile && next.some((b) => b.tile && Math.abs(b.tile[0] - c.tile![0]) + Math.abs(b.tile[1] - c.tile![1]) < 4)) continue;
        const at = c.tile ?? sim.agents.find((a) => a.id === c.agent)!.pos;
        const close = next.filter((b) => Math.abs(b.at[0] - at[0]) + Math.abs(b.at[1] - at[1]) <= STACK_TILES);
        const lift = close.length ? Math.max(...close.map((b) => b.lift)) + 1 : 0;
        next = [...next, { key: c.key, text: c.text, born: now, agent: c.agent, tile: c.tile, at, lift }];
      }
    }
    if (next.length !== said.length || next.some((b, i) => b !== said[i])) setSaid(next);

    const speaking = new Set(next.map((b) => b.agent));
    const worst = sim.agents
      .filter((a) => a.state === 'stuck' && !speaking.has(a.id))
      .sort((x, y) => y.waitTicks - x.waitTicks)
      .slice(0, MAX_MARKS)
      .map((a) => a.id);
    if (worst.join() !== marks.join()) setMarks(worst);
  });

  return (
    <group>
      {said.map((b) => (
        <SpeechBubble key={`${b.key}-${b.born}`} level={level} said={b} />
      ))}
      {marks.map((id) => (
        <Follow key={id} level={level} agent={id}>
          <Html position={[0, 1.25, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <div className="bubble small">?!</div>
          </Html>
        </Follow>
      ))}
    </group>
  );
}

/** Keeps its children over one person as they move. */
function Follow({ level, agent, children }: { level: Level; agent: string; children: React.ReactNode }) {
  const g = useRef<Group>(null);
  useFrame(() => {
    const st = useStore.getState();
    const a = st.sim?.agents.find((x) => x.id === agent);
    if (a && g.current) g.current.position.set(...agentPosition(level, a, st.world));
  });
  return <group ref={g}>{children}</group>;
}

function SpeechBubble({ level, said }: { level: Level; said: Said }) {
  const div = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const age = performance.now() - said.born;
    if (div.current) div.current.style.opacity = String(age < SHOW_MS ? 1 : Math.max(0, 1 - (age - SHOW_MS) / FADE_MS));
  });
  const bubble = (height: number) => (
    <Html position={[0, height, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div ref={div} className="bubble">
        {said.text}
      </div>
    </Html>
  );
  if (said.agent) {
    return (
      <Follow level={level} agent={said.agent}>
        {bubble(1.25 + said.lift * STACK_STEP)}
      </Follow>
    );
  }
  const [wx, , wz] = tileToWorld(level, ...said.tile!);
  return <group position={[wx + 0.6, 0, wz]}>{bubble(0.9 + said.lift * STACK_STEP)}</group>;
}
