import { Edges, Html, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { MeshBasicMaterial } from 'three';
import { buildGrid, isEditable, TOOL_INFO } from '../sim/design';
import { getCell } from '../sim/grid';
import type { Level, Zone } from '../sim/types';
import { hintSeen, useStore } from '../store';
import { tileToWorld } from './coords';
import { WALL_H } from './Items';
import { COLORS } from './palette';

/** Pulsing glow + outline on every wall tile you're allowed to put a door in. Design mode only. */
export function EditableGlow({ level }: { level: Level }) {
  const design = useStore((s) => s.design);
  const material = useMemo(() => new MeshBasicMaterial({ color: COLORS.editable, transparent: true, depthWrite: false }), []);
  useFrame(({ clock }) => {
    material.opacity = 0.45 + 0.4 * Math.sin(clock.elapsedTime * 3);
  });

  const tiles = useMemo(() => {
    const grid = buildGrid(level, design);
    return level.fixedWalls.filter(([x, y]) => isEditable(level, x, y) && getCell(grid, x, y) === 'wall');
  }, [level, design]);

  return (
    <group>
      {tiles.map(([x, y]) => {
        const [wx, , wz] = tileToWorld(level, x, y);
        return (
          <group key={`${x},${y}`} position={[wx, 0, wz]}>
            <mesh position={[0, WALL_H + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
              <planeGeometry args={[0.86, 0.86]} />
            </mesh>
            <mesh position={[0, WALL_H / 2, 0]}>
              <boxGeometry args={[1.02, WALL_H + 0.02, 1.02]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              <Edges color={COLORS.editableEdge} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** First visit: a bouncing arrow pointing at where to click, until the first door goes in. */
export function TutorialHint({ level }: { level: Level }) {
  const hint = level.tutorial;
  const doors = useStore((s) => s.design.items.filter((it) => TOOL_INFO[it.tool].door).length);
  useStore((s) => s.progress.seenHints); // re-render when a hint is marked seen
  if (!hint || doors > 0 || hintSeen(hint.id)) return null;
  const [wx, , wz] = tileToWorld(level, ...hint.tile);
  return (
    <Html position={[wx, WALL_H + 0.1, wz]} center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
      <div className="tutorial-hint">
        <span>{hint.text}</span>
        <span className="tutorial-arrow">⬇</span>
      </div>
    </Html>
  );
}

function serviceMid(level: Level, z: Zone): [number, number, number] {
  const x = z.x === 0 ? 0 : z.x + z.w === level.grid.w ? level.grid.w - 1 : z.x + Math.floor(z.w / 2);
  return tileToWorld(level, x, z.y + Math.floor(z.h / 2));
}

const FLOW_LABEL: Record<string, string> = { crate: '📦 crates', tray: '🍽 trays', elderly: '🧓 visitors', empty: '🙂 people' };

/** Before the first run: dotted, moving arrows from where people start to where they're going (and back). */
export function FlowArrows({ level }: { level: Level }) {
  const flows = useMemo(() => {
    const seen = new Map<string, { from: string; to: string; type: string; count: number }>();
    for (const r of level.spawns) {
      const k = `${r.from}>${r.to}>${r.type}`;
      const f = seen.get(k) ?? { from: r.from, to: r.to, type: r.type, count: 0 };
      f.count += r.count;
      seen.set(k, f);
    }
    return [...seen.values()];
  }, [level]);
  const lines = useRef<({ material: { dashOffset: number } } | null)[]>([]);
  useFrame((_, dt) => {
    for (const l of lines.current) if (l) l.material.dashOffset -= dt * 1.5;
  });

  return (
    <group>
      {flows.map((f, i) => {
        const a = serviceMid(level, level.zones[f.from]);
        const b = serviceMid(level, level.zones[f.to]);
        // Each flow keeps to its own lane on the right of its direction (the normal flips with direction),
        // and flows between the same zones stack outwards.
        const sameWay = flows.filter((g) => g.from === f.from && g.to === f.to);
        const reverse = flows.some((g) => g.from === f.to && g.to === f.from);
        const side = (reverse || sameWay.length > 1 ? 0.8 : 0) + 1.1 * sameWay.indexOf(f);
        const dx = b[0] - a[0];
        const dz = b[2] - a[2];
        const len = Math.hypot(dx, dz) || 1;
        const [nx, nz] = [-dz / len, dx / len];
        const start: [number, number, number] = [a[0] + nx * side, 0.06, a[2] + nz * side];
        const end: [number, number, number] = [b[0] + nx * side - (dx / len) * 0.6, 0.06, b[2] + nz * side - (dz / len) * 0.6];
        const color = f.type === 'crate' ? '#e07b24' : f.type === 'elderly' ? '#5b7fa6' : '#2f9e8f';
        return (
          <group key={i}>
            <Line
              ref={(el) => {
                lines.current[i] = el as never;
              }}
              points={[start, end]}
              color={color}
              lineWidth={4}
              dashed
              dashSize={0.35}
              gapSize={0.25}
            />
            {/* Cone tips +y; tip it forward to +z, then turn towards the target. */}
            <mesh position={end} rotation={[Math.PI / 2, Math.atan2(dx, dz), 0, 'YXZ']}>
              <coneGeometry args={[0.28, 0.6, 3]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <mesh position={[start[0], 0.04, start[2]]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.3, 20]} />
              <meshBasicMaterial color={color} transparent opacity={0.8} />
            </mesh>
            <Html
              position={[(start[0] + end[0]) / 2, 0.1, (start[2] + end[2]) / 2]}
              center
              zIndexRange={[4, 0]}
              style={{ pointerEvents: 'none' }}
            >
              <div className="flow-label" style={{ borderColor: color }}>
                {f.count} {FLOW_LABEL[f.type] ?? f.type}: {f.from} → {f.to}
                {f.type !== 'elderly' && ' & back'}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

