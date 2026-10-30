import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { effectiveType, speedOf, type Agent } from '../sim/agents';
import { TICKS_PER_SEC } from '../sim/constants';
import type { IncidentCode } from '../sim/failures';
import type { Level, Tile } from '../sim/types';
import { useStore } from '../store';
import { quoteFor } from '../ui/quotes';
import { tileToWorld } from './coords';
import { COLORS } from './palette';
import { Person } from './Person';

const TICK_SEC = 1 / TICKS_PER_SEC;

/** Fraction of the way to the next sim tick, so people glide between ticks instead of hopping. */
const clock = { acc: 0 };

/** Drives the fixed-timestep sim from the render loop. */
export function SimRunner() {
  useFrame((_, dt) => {
    const s = useStore.getState();
    if (!s.running) return;
    clock.acc += Math.min(dt, 0.25) * s.speed;
    while (clock.acc >= TICK_SEC && useStore.getState().running) {
      clock.acc -= TICK_SEC;
      useStore.getState().tick();
    }
  });
  return null;
}

export function interpolated(level: Level, a: Agent, alpha: number): [number, number, number] {
  const from = tileToWorld(level, ...a.pos);
  if (!a.next || a.state !== 'walking') return from;
  const to = tileToWorld(level, ...a.next);
  const t = Math.min(1, a.progress + (alpha * speedOf(a)) / TICKS_PER_SEC);
  return [from[0] + (to[0] - from[0]) * t, 0, from[2] + (to[2] - from[2]) * t];
}

function AgentView({ level, index }: { level: Level; index: number }) {
  const group = useRef<Group>(null);
  // Re-render only when what the person looks like changes; motion happens in useFrame.
  const look = useStore((s) => {
    const a = s.sim?.agents[index];
    return a ? `${effectiveType(a)}|${a.state}|${a.complaint ?? ''}|${a.id}` : '';
  });
  const [type, state, complaint, id] = look.split('|') as [Agent['type'], Agent['state'], string, string];

  useFrame(() => {
    const a = useStore.getState().sim?.agents[index];
    if (!a || !group.current) return;
    const [x, , z] = interpolated(level, a, clock.acc / TICK_SEC);
    group.current.position.set(x, 0, z);
    // Turn smoothly towards the walking direction (Person faces +z).
    const target = Math.atan2(a.dir[0], a.dir[1]);
    let diff = target - group.current.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    group.current.rotation.y += diff * 0.25;
  });

  if (!look || state === 'done') return null;
  const n = Number(id.slice(1));
  const seated = state === 'seated';
  // When time runs out everyone is late; only some of them say so, or the bubbles pile up.
  const speaks = complaint && ((complaint !== 'TIME_LIMIT' && complaint !== 'UNDERUSED_HALL') || n % 4 === 1);
  const line = speaks ? quoteFor(complaint as IncidentCode, id) : null;

  return (
    <group ref={group}>
      <Person
        type={type}
        position={[0, 0, 0]}
        skin={n}
        phase={n * 1.7}
        walking={state === 'walking'}
        seated={seated}
        shirt={type === 'sangat' ? COLORS.diners[n % COLORS.diners.length] : undefined}
      />
      {line ? <Bubble text={line} height={1.2} /> : state === 'stuck' ? <Bubble text="?!" height={1.2} small /> : null}
    </group>
  );
}

/** White speech card above someone's head. */
export function Bubble({ text, height, small }: { text: string; height: number; small?: boolean }) {
  return (
    <Html position={[0, height, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`bubble ${small ? 'small' : ''}`}>{text}</div>
    </Html>
  );
}

/** Diners complain when someone walks through the langar. One bubble per spot, for a couple of seconds. */
export function DinerBubbles({ level }: { level: Level }) {
  const spots = useStore((s) => {
    const sim = s.sim;
    if (!sim) return '';
    const shown: Tile[] = [];
    for (const d of [...sim.disturbances].reverse()) {
      if (sim.tick - d.tick > 25 || shown.length >= 3) break;
      if (!shown.some((t) => Math.abs(t[0] - d.tile[0]) + Math.abs(t[1] - d.tile[1]) < 4)) shown.push(d.tile);
    }
    return shown.map((t) => t.join(',')).join(';');
  });
  if (!spots) return null;
  return (
    <group>
      {spots.split(';').map((k) => {
        const [x, y] = k.split(',').map(Number);
        const [wx, , wz] = tileToWorld(level, x, y);
        return (
          <group key={k} position={[wx + 0.6, 0, wz]}>
            <Bubble text={quoteFor('DINING_DISTURBED', `diner-${k}`)!} height={0.9} />
          </group>
        );
      })}
    </group>
  );
}

export function AgentsLayer({ level }: { level: Level }) {
  const count = useStore((s) => s.sim?.agents.length ?? 0);
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <AgentView key={i} level={level} index={i} />
      ))}
    </group>
  );
}

/** One faint person from the best run, gliding like the real ones. */
function GhostView({ level, index }: { level: Level; index: number }) {
  const group = useRef<Group>(null);
  const look = useStore((s) => {
    const a = s.ghostSim?.agents[index];
    return a ? `${effectiveType(a)}|${a.state}|${a.id}` : '';
  });
  const [type, state, id] = look.split('|') as [Agent['type'], Agent['state'], string];
  useFrame(() => {
    const a = useStore.getState().ghostSim?.agents[index];
    if (!a || !group.current) return;
    const [x, , z] = interpolated(level, a, clock.acc / TICK_SEC);
    group.current.position.set(x, 0, z);
    group.current.rotation.y = Math.atan2(a.dir[0], a.dir[1]);
  });
  if (!look || state === 'done') return null;
  const n = Number(id.slice(1));
  return (
    <group ref={group}>
      <Person type={type} position={[0, 0, 0]} skin={n} phase={n * 1.7} walking={state === 'walking'} seated={state === 'seated'} ghost />
    </group>
  );
}

/** Personal-best ghost: the best passing run replayed beside this one. Off unless toggled in the sim bar. */
export function BestRunGhosts({ level }: { level: Level }) {
  const on = useStore((s) => s.showGhost);
  const count = useStore((s) => s.ghostSim?.agents.length ?? 0);
  if (!on) return null;
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <GhostView key={i} level={level} index={i} />
      ))}
    </group>
  );
}
