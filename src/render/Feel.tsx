import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type ReactNode } from 'react';
import { Vector3, type Group } from 'three';
import { sfx } from '../audio/sfx';
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

/** Eases the camera to an incident card when one is clicked on the results screen. */
export function CameraDirector({ level }: { level: Level }) {
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null;
  const camera = useThree((s) => s.camera);
  const goal = useRef<Vector3 | null>(null);

  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        const incidents = s.sim?.incidents ?? [];
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

export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight
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

/** Door creaks and the end-of-run chime or oops (only heard if sound is switched on). */
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
      onDoor.current.clear();
      return;
    }
    const active = sim.agents.filter((a) => a.state !== 'done');

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
