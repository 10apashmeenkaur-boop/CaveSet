import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { Vector3, type Group } from 'three';
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
/** A new bubble appears at most this often, so they come one at a time at a steady pace. */
const NEW_EVERY_MS = 2000;
const MAX_BUBBLES = 3;
const MAX_MARKS = 3;
/** Bubbles never overlap on screen: one that would is lifted by a bubble's height (at most this many times), else skipped. */
const MAX_LIFTS = 2;
const GAP_PX = 6;
/** On-screen bubble size (13px font) with a little to spare, for the overlap check. */
const bubbleSize = (text: string): [number, number] => [text.length * 7 + 24, 32];
const BUBBLE_Y = 1.25;
const DINER_Y = 0.9;
/** Diners complain about a walk-through for this many ticks after it happens. */
const DINER_TICKS = 25;

type Said = { key: string; text: string; born: number; agent?: string; tile?: Tile };
type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect) => Math.abs(a.x - b.x) * 2 < a.w + b.w + GAP_PX && Math.abs(a.y - b.y) * 2 < a.h + b.h + GAP_PX;
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
 * disturbed by a walk-through. One new bubble about every 2 s, at most 3 at once; each stays 4 s, then
 * fades over 1 s. Bubbles never overlap: each frame they're laid out on screen, oldest first, and one that
 * would cover another is lifted above it. The 3 most stuck people without a bubble get a red "?!" marker.
 */
export function SpeechLayer({ level }: { level: Level }) {
  const [said, setSaid] = useState<Said[]>([]);
  const [marks, setMarks] = useState<string[]>([]);
  const quietUntil = useRef(new Map<string, number>());
  const lastSim = useRef<unknown>(null);
  const lastNew = useRef(-Infinity);
  /** The bubble and marker elements, by key, and how far each is lifted (px) to stay clear of the others. */
  const els = useRef(new Map<string, HTMLDivElement>());
  const lifts = useRef(new Map<string, number>());
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  /** Screen rect of a bubble at a world anchor point, lifted `lift` px. */
  const rectOf = (text: string, at: [number, number, number], lift: number): Rect => {
    const v = new Vector3(...at).project(camera);
    const [w, h] = bubbleSize(text);
    return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height - h / 2 - lift, w, h };
  };
  /** Where a bubble hangs: over a person's head, or beside a diner tile. */
  const anchor = (b: { agent?: string; tile?: Tile }): [number, number, number] | null => {
    const st = useStore.getState();
    if (b.tile) {
      const [wx, , wz] = tileToWorld(level, ...b.tile);
      return [wx + 0.6, DINER_Y, wz];
    }
    const a = st.sim?.agents.find((x) => x.id === b.agent);
    if (!a) return null;
    const [x, y, z] = agentPosition(level, a, st.world);
    return [x, y + BUBBLE_Y, z];
  };
  /** Lift a bubble clear of the placed ones; null if it would need more than MAX_LIFTS. */
  const fit = (text: string, at: [number, number, number], placed: Rect[]): [Rect, number] | null => {
    const step = bubbleSize(text)[1] + GAP_PX;
    for (let k = 0; k <= MAX_LIFTS; k++) {
      const r = rectOf(text, at, k * step);
      if (!placed.some((o) => overlaps(o, r))) return [r, k * step];
    }
    return null;
  };

  useFrame(() => {
    const sim = useStore.getState().sim;
    const now = performance.now();
    if (sim !== lastSim.current && (!sim || sim.tick === 0)) {
      // New run or back to design: start fresh.
      quietUntil.current.clear();
      if (said.length) setSaid([]);
      if (marks.length) setMarks([]);
    }
    if (sim !== lastSim.current && (!sim || sim.tick === 0)) lastNew.current = -Infinity;
    lastSim.current = sim;
    if (!sim) return;

    // Drop finished bubbles.
    let next = said.filter((b) => now - b.born < SHOW_MS + FADE_MS);
    for (const b of said) if (!next.includes(b)) quietUntil.current.set(b.key, now + COOLDOWN_MS);

    // Lay out the bubbles still showing, oldest first.
    const placed: Rect[] = [];
    for (const b of next) {
      const at = anchor(b);
      if (!at) continue;
      const keep = lifts.current.get(b.key) ?? 0;
      const [r, lift] = fit(b.text, at, placed) ?? [rectOf(b.text, at, keep), keep];
      placed.push(r);
      lifts.current.set(b.key, lift);
    }

    if (next.length < MAX_BUBBLES && now - lastNew.current >= NEW_EVERY_MS) {
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
      // One new bubble: the most urgent speaker with room for it on screen.
      for (const c of cands) {
        if ((quietUntil.current.get(c.key) ?? 0) > now || next.some((b) => b.key === c.key)) continue;
        // One diner bubble per spot of the hall.
        if (c.tile && next.some((b) => b.tile && Math.abs(b.tile[0] - c.tile![0]) + Math.abs(b.tile[1] - c.tile![1]) < 4)) continue;
        const at = anchor(c);
        const f = at && fit(c.text, at, placed);
        if (!f) continue;
        placed.push(f[0]);
        lifts.current.set(c.key, f[1]);
        next = [...next, { key: c.key, text: c.text, born: now, agent: c.agent, tile: c.tile }];
        lastNew.current = now;
        break;
      }
    }
    if (next.length !== said.length || next.some((b, i) => b !== said[i])) setSaid(next);

    const speaking = new Set(next.map((b) => b.agent));
    // Markers stay clear of the bubbles too; one with no room is left out this frame.
    const worst: string[] = [];
    for (const a of sim.agents.filter((x) => x.state === 'stuck' && !speaking.has(x.id)).sort((x, y) => y.waitTicks - x.waitTicks)) {
      if (worst.length >= MAX_MARKS) break;
      const at = anchor({ agent: a.id });
      const f = at && fit('?!', at, placed);
      if (!f) continue;
      placed.push(f[0]);
      lifts.current.set(`mark-${a.id}`, f[1]);
      worst.push(a.id);
    }
    if (worst.join() !== marks.join()) setMarks(worst);
    // Apply the lifts, on a wrapper so the bubble's pop-in animation keeps its own transform.
    for (const [key, el] of els.current) el.style.transform = `translateY(-${lifts.current.get(key) ?? 0}px)`;
  });
  const register = (key: string) => (el: HTMLDivElement | null) => {
    if (el) els.current.set(key, el);
    else els.current.delete(key);
  };

  return (
    <group>
      {said.map((b) => (
        <SpeechBubble key={`${b.key}-${b.born}`} level={level} said={b} register={register(b.key)} />
      ))}
      {marks.map((id) => (
        <Follow key={id} level={level} agent={id}>
          <Html position={[0, BUBBLE_Y, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <div ref={register(`mark-${id}`)}>
              <div className="bubble small">?!</div>
            </div>
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

function SpeechBubble({ level, said, register }: { level: Level; said: Said; register: (el: HTMLDivElement | null) => void }) {
  const div = useRef<HTMLDivElement | null>(null);
  useFrame(() => {
    const age = performance.now() - said.born;
    if (div.current) div.current.style.opacity = String(age < SHOW_MS ? 1 : Math.max(0, 1 - (age - SHOW_MS) / FADE_MS));
  });
  const bubble = (height: number) => (
    <Html position={[0, height, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div ref={register}>
        <div ref={div} className="bubble">
          {said.text}
        </div>
      </div>
    </Html>
  );
  if (said.agent) {
    return (
      <Follow level={level} agent={said.agent}>
        {bubble(BUBBLE_Y)}
      </Follow>
    );
  }
  const [wx, , wz] = tileToWorld(level, ...said.tile!);
  return <group position={[wx + 0.6, 0, wz]}>{bubble(DINER_Y)}</group>;
}
