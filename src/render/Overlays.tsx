import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, MeshBasicMaterial } from 'three';
import { BUSY_MARKER_MIN } from '../sim/constants';
import { COLORS } from './palette';
import type { Level } from '../sim/types';
import { useStore } from '../store';
import { tileToWorld } from './coords';
import { surfaceY } from './Terrain';

function FloorTile({ level, x, y, color, opacity }: { level: Level; x: number; y: number; color: string; opacity: number }) {
  const [wx, , wz] = tileToWorld(level, x, y);
  // On the ramp level, sit on whatever surface is there (roof, landing, ramp).
  const h = surfaceY(useStore.getState().world?.terrain, x, y);
  return (
    <mesh position={[wx, 0.025 + h + (h ? 0.06 : 0), wz]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.96, 0.96]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

/** Pulsing red floor under every incident's tiles. */
export function IncidentTiles({ level }: { level: Level }) {
  const focused = useStore((s) => s.focus !== null);
  const tiles = useStore((s) => {
    const set = new Set<string>();
    const all = s.sim?.incidents ?? [];
    // With a card selected, show only that incident (whatever its kind).
    const shown = s.focus !== null ? all.slice(s.focus, s.focus + 1) : all.filter((i) => i.code !== 'TIME_LIMIT' && i.code !== 'CONGESTION');
    for (const i of shown) for (const t of i.tiles) set.add(t.join(','));
    return [...set].sort().join(';');
  });
  const group = useRef<{ children: { material?: MeshBasicMaterial }[] }>(null);

  useFrame(({ clock }) => {
    const o = (focused ? 0.55 : 0.35) + 0.2 * Math.sin(clock.elapsedTime * (focused ? 7 : 4));
    group.current?.children.forEach((m) => m.material && (m.material.opacity = o));
  });

  if (!tiles) return null;
  return (
    <group ref={group as never}>
      {tiles.split(';').map((k) => {
        const [x, y] = k.split(',').map(Number);
        return <FloorTile key={k} level={level} x={x} y={y} color={focused ? '#ff2d55' : '#e5394b'} opacity={0.45} />;
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

/** Small bobbing marker over the station unit with the longest line right now. Langar-line levels only. */
export function BusiestMarker({ level }: { level: Level }) {
  const at = useStore((s) => {
    if (!s.sim || !s.world || s.sim.finished || s.sim.timeUp) return '';
    const loads = s.sim.loads;
    let best = -1;
    loads.forEach((n, i) => {
      if (n >= BUSY_MARKER_MIN && (best < 0 || n > loads[best])) best = i;
    });
    return best < 0 ? '' : s.world.units[best].tile.join(',');
  });
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (g.current) g.current.position.y = 1.55 + Math.sin(clock.elapsedTime * 4) * 0.08;
  });
  if (!at) return null;
  const [x, y] = at.split(',').map(Number);
  const [wx, , wz] = tileToWorld(level, x, y);
  return (
    <group position={[wx, 0, wz]}>
      <group ref={g}>
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.16, 0.32, 12]} />
          <meshBasicMaterial color={COLORS.busiest} />
        </mesh>
      </group>
    </group>
  );
}
