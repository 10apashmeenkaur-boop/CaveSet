import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type ReactNode } from 'react';
import { Color, Vector3, type DirectionalLight, type Group } from 'three';
import { murmur, sfx } from '../audio/sfx';
import { TICKS_PER_SEC } from '../sim/constants';
import { costOf } from '../sim/design';
import { score } from '../sim/scoring';
import type { Level } from '../sim/types';
import { useStore } from '../store';
import { tileToWorld } from './coords';

const easeOutBounce = (x: number) => {
  const n = 7.5625;
  const d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
};

/** Children fall into place with a little bounce when they first appear. */
export function DropIn({ children }: { children: ReactNode }) {
  const g = useRef<Group>(null);
  const born = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    born.current ??= clock.elapsedTime;
    const p = Math.min(1, (clock.elapsedTime - born.current) / 0.45);
    g.current.position.y = (1 - easeOutBounce(p)) * 1.4;
  });
  return (
    <group ref={g} position-y={1.4}>
      {children}
    </group>
  );
}

/** Slow-motion window after a failure: the sim runner scales time by this while it lasts. */
export const slowmo = { until: 0, factor: 0.25 };

const SKIP_CAMERA = new Set(['TIME_LIMIT', 'CONGESTION']);

/** Eases the camera to each new failure (with 1 s of slow-mo), and to an incident card when one is clicked. */
export function CameraDirector({ level }: { level: Level }) {
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null;
  const camera = useThree((s) => s.camera);
  const goal = useRef<Vector3 | null>(null);
  const seen = useRef(0);

  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        const incidents = s.sim?.incidents ?? [];
        if (!s.sim) seen.current = 0;
        if (incidents.length > seen.current) {
          const fresh = incidents.slice(seen.current).find((i) => !SKIP_CAMERA.has(i.code) && i.tiles.length);
          seen.current = incidents.length;
          if (fresh && s.running) {
            goal.current = new Vector3(...tileToWorld(level, ...fresh.tiles[0]));
            slowmo.until = performance.now() + 1000;
          }
        }
        if (s.focus !== null && s.focus !== prev.focus) {
          const inc = incidents[s.focus];
          if (inc?.tiles.length) goal.current = new Vector3(...tileToWorld(level, ...inc.tiles[0]));
        }
      }),
    [level],
  );

  useFrame((_, dt) => {
    if (!goal.current || !controls) return;
    const step = goal.current.clone().sub(controls.target).multiplyScalar(Math.min(1, dt * 3));
    controls.target.add(step);
    camera.position.add(step);
    controls.update();
    if (goal.current.distanceTo(controls.target) < 0.02) goal.current = null;
  });
  return null;
}

const DAY = new Color('#fff6e8');
const EVENING = new Color('#ffad73');

/** Sunlight warms toward evening as a run goes on. */
export function Lighting({ level }: { level: Level }) {
  const sun = useRef<DirectionalLight>(null);
  useFrame(() => {
    const sim = useStore.getState().sim;
    const total = (level.timeLimitSec || 120) * TICKS_PER_SEC;
    const t = sim ? Math.min(1, sim.tick / total) : 0;
    if (!sun.current) return;
    sun.current.color.copy(DAY).lerp(EVENING, t * 0.85);
    sun.current.intensity = 1.4 - 0.35 * t;
  });
  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight
        ref={sun}
        position={[8, 16, 6]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
    </>
  );
}

/** Crowd murmur that rises in jams, door creaks, and the end-of-run chime or oops. */
export function AudioDirector({ level }: { level: Level }) {
  const onDoor = useRef(new Set<string>());

  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        const ended = (x: typeof s) => !!x.sim && (x.sim.finished || x.sim.timeUp);
        if (ended(s) && !ended(prev) && s.sim) sfx(score(level, s.sim, costOf(s.design)).passed ? 'chime' : 'oops');
      }),
    [level],
  );

  useFrame(() => {
    const { sim, running, world } = useStore.getState();
    if (!sim || !running || !world) {
      murmur(0);
      onDoor.current.clear();
      return;
    }
    const active = sim.agents.filter((a) => a.state !== 'done');
    const grumbling = active.filter((a) => a.state === 'waiting' || a.state === 'stuck').length;
    murmur(active.length ? grumbling / Math.max(4, active.length) : 0);

    // Someone stepping into a hinged doorway: creak.
    const now = new Set<string>();
    for (const a of active) {
      const k = `${a.pos[0]},${a.pos[1]}`;
      if (!world.swing.has(k)) continue;
      now.add(a.id);
      if (!onDoor.current.has(a.id)) sfx('creak', 500);
    }
    onDoor.current = now;
  });
  return null;
}
