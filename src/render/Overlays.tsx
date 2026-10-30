import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { MeshBasicMaterial } from 'three';
import type { Level } from '../sim/types';
import { useStore } from '../store';
import { tileToWorld } from './coords';

function FloorTile({ level, x, y, color, opacity }: { level: Level; x: number; y: number; color: string; opacity: number }) {
  const [wx, , wz] = tileToWorld(level, x, y);
  return (
    <mesh position={[wx, 0.025, wz]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.96, 0.96]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

/** Pulsing red floor under every incident's tiles. */
export function IncidentTiles({ level }: { level: Level }) {
  const tiles = useStore((s) => {
    const set = new Set<string>();
    for (const i of s.sim?.incidents ?? []) {
      if (i.code === 'TIME_LIMIT' || i.code === 'CONGESTION') continue;
      for (const t of i.tiles) set.add(t.join(','));
    }
    return [...set].sort().join(';');
  });
  const group = useRef<{ children: { material?: MeshBasicMaterial }[] }>(null);

  useFrame(({ clock }) => {
    const o = 0.35 + 0.2 * Math.sin(clock.elapsedTime * 4);
    group.current?.children.forEach((m) => m.material && (m.material.opacity = o));
  });

  if (!tiles) return null;
  return (
    <group ref={group as never}>
      {tiles.split(';').map((k) => {
        const [x, y] = k.split(',').map(Number);
        return <FloorTile key={k} level={level} x={x} y={y} color="#e5394b" opacity={0.45} />;
      })}
    </group>
  );
}

/** Where people waited, yellow (a little) to red (a lot). */
export function HeatLayer({ level }: { level: Level }) {
  const on = useStore((s) => s.showHeat);
  // Coarse snapshot so this re-renders a few times a second, not every tick.
  const heat = useStore((s) => (on && s.sim ? s.sim.heat.map((v) => Math.round(v / 5)).join(',') : ''));
  if (!on || !heat) return null;
  const values = heat.split(',').map(Number);
  const max = Math.max(1, ...values);
  return (
    <group>
      {values.map((v, i) => {
        if (!v) return null;
        const t = v / max;
        const color = `hsl(${50 - 50 * t}, 95%, 55%)`;
        return <FloorTile key={i} level={level} x={i % level.grid.w} y={Math.floor(i / level.grid.w)} color={color} opacity={0.3 + 0.5 * t} />;
      })}
    </group>
  );
}
