import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { effectiveType, speedOf, type Agent } from '../sim/agents';
import { BASE_SPEED, TICKS_PER_SEC } from '../sim/simulate';
import type { Level } from '../sim/types';
import { useStore } from '../store';
import { tileToWorld } from './coords';
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

function interpolated(level: Level, a: Agent, alpha: number): [number, number, number] {
  const from = tileToWorld(level, ...a.pos);
  if (!a.next || a.state !== 'walking') return from;
  const to = tileToWorld(level, ...a.next);
  const t = Math.min(1, a.progress + (alpha * speedOf(a) * BASE_SPEED) / TICKS_PER_SEC);
  return [from[0] + (to[0] - from[0]) * t, 0, from[2] + (to[2] - from[2]) * t];
}

function AgentView({ level, index }: { level: Level; index: number }) {
  const group = useRef<Group>(null);
  // Re-render only when what the person looks like changes; motion happens in useFrame.
  const look = useStore((s) => {
    const a = s.sim?.agents[index];
    return a ? `${effectiveType(a)}|${a.state}` : '';
  });
  const [type, state] = look.split('|') as [Agent['type'], Agent['state']];

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
  const n = Number(useStore.getState().sim?.agents[index].id.slice(1) ?? 0);

  return (
    <group ref={group}>
      <Person type={type} position={[0, 0, 0]} skin={n} phase={n * 1.7} walking={state === 'walking'} />
      {state === 'stuck' && (
        <Html position={[0, 1.25, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="stuck-mark">?!</div>
        </Html>
      )}
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
