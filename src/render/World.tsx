import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import type { Level, Zone } from '../sim/types';
import { tileToWorld } from './coords';
import { COLORS } from './palette';
import { Person } from './Person';

const ZONE_NAMES: Record<string, string> = {
  kitchen: 'Kitchen',
  washing: 'Washing',
  dining: 'Dining hall',
  entrance: 'Entrance',
  exit: 'Exit',
  shoes: 'Shoes',
  wash: 'Hand wash',
  basket: 'Head covers',
  hall: 'Dining hall',
};

function zoneCenter(level: Level, z: Zone): [number, number, number] {
  return tileToWorld(level, z.x + z.w / 2 - 0.5, z.y + z.h / 2 - 0.5);
}

export function Floor({ level }: { level: Level }) {
  const { w, h } = level.grid;
  return (
    <group>
      {/* Site slab, a little bigger than the grid */}
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <boxGeometry args={[w + 2.4, 0.15, h + 2.4]} />
        <meshStandardMaterial color={COLORS.slab} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={COLORS.floor} />
      </mesh>
      {Object.entries(level.zones).map(([name, z]) => {
        const [cx, , cz] = zoneCenter(level, z);
        return (
          <mesh key={name} rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.005, cz]} receiveShadow>
            <planeGeometry args={[z.w, z.h]} />
            <meshStandardMaterial color={COLORS.zones[name] ?? '#ddd'} transparent opacity={0.6} />
          </mesh>
        );
      })}
      <GridLines w={w} h={h} />
    </group>
  );
}

function GridLines({ w, h }: { w: number; h: number }) {
  const positions = useMemo(() => {
    const pts: number[] = [];
    for (let x = 0; x <= w; x++) pts.push(x - w / 2, 0, -h / 2, x - w / 2, 0, h / 2);
    for (let y = 0; y <= h; y++) pts.push(-w / 2, 0, y - h / 2, w / 2, 0, y - h / 2);
    return new Float32Array(pts);
  }, [w, h]);
  return (
    <lineSegments position={[0, 0.01, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={COLORS.gridLine} transparent opacity={0.7} />
    </lineSegments>
  );
}

/** Floating name tag at the far edge of each zone. */
export function ZoneLabels({ level }: { level: Level }) {
  return (
    <group>
      {Object.entries(level.zones).map(([name, z]) => {
        const [cx, , cz] = tileToWorld(level, z.x + z.w / 2 - 0.5, z.y);
        return (
          <Html key={name} position={[cx, 0.05, cz - 0.9]} center zIndexRange={[0, 0]} style={{ pointerEvents: 'none' }}>
            <div className={`zone-label zone-${name}`}>{ZONE_NAMES[name] ?? name}</div>
          </Html>
        );
      })}
    </group>
  );
}

/** Kitchen counter with pots just outside the kitchen's outer edge. */
function KitchenProps({ level, z }: { level: Level; z: Zone }) {
  const atLeft = z.x === 0;
  const [, , cz] = zoneCenter(level, z);
  const x = atLeft ? -level.grid.w / 2 - 0.55 : level.grid.w / 2 + 0.55;
  return (
    <group position={[x, 0, cz]}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.8, z.h - 0.4]} />
        <meshStandardMaterial color={COLORS.counter} flatShading />
      </mesh>
      {[-0.3, -0.1, 0.15, 0.35].map((f, i) => (
        <group key={i} position={[0, 0.8, f * z.h]}>
          <mesh position={[0, 0.17, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.26, 0.34, 14]} />
            <meshStandardMaterial color={COLORS.steel} metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.31, 0.31, 0.03, 14]} />
            <meshStandardMaterial color="#9aa1aa" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Row of sinks with taps just outside the washing area's outer edge. */
function WashingProps({ level, z }: { level: Level; z: Zone }) {
  const atRight = z.x + z.w === level.grid.w;
  const [, , cz] = zoneCenter(level, z);
  const x = atRight ? level.grid.w / 2 + 0.55 : -level.grid.w / 2 - 0.55;
  const sinks = Math.max(2, Math.floor(z.h / 3));
  return (
    <group position={[x, 0, cz]}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.8, z.h - 0.4]} />
        <meshStandardMaterial color={COLORS.sinkCounter} flatShading />
      </mesh>
      {Array.from({ length: sinks }, (_, i) => {
        const zz = ((i + 0.5) / sinks - 0.5) * (z.h - 1);
        return (
          <group key={i} position={[0, 0.8, zz]}>
            <mesh position={[0, 0.01, 0]}>
              <boxGeometry args={[0.6, 0.04, 0.9]} />
              <meshStandardMaterial color={COLORS.steel} metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[atRight ? 0.32 : -0.32, 0.2, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.4, 6]} />
              <meshStandardMaterial color="#8a9099" metalness={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Long floor mats with people sitting in rows, so nobody mistakes it for a hallway. */
function DiningHall({ level, z }: { level: Level; z: Zone }) {
  const rows: number[] = [];
  for (let x = z.x + 1; x < z.x + z.w - 1; x += 2) rows.push(x);
  return (
    <group>
      {rows.map((x) => {
        const [wx, , wz] = tileToWorld(level, x, z.y + z.h / 2 - 0.5);
        return (
          <group key={x}>
            <mesh position={[wx, 0.02, wz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[0.8, z.h - 1]} />
              <meshStandardMaterial color={COLORS.mat} />
            </mesh>
            {Array.from({ length: z.h - 2 }, (_, i) => i)
              .filter((i) => (i + x) % 2 === 0)
              .map((i) => (
                <Person
                  key={i}
                  type="empty"
                  seated
                  walking={false}
                  shirt={COLORS.diners[(i + x) % COLORS.diners.length]}
                  position={tileToWorld(level, x, z.y + 1 + i)}
                  facing={(rows.indexOf(x) % 2 ? -1 : 1) * (Math.PI / 2)}
                  skin={i + x}
                  phase={i * 0.7 + x}
                />
              ))}
          </group>
        );
      })}
    </group>
  );
}

/** Langar-line hall: a long mat down every column of seats (the sangat sits on them during the run). */
function HallMats({ level }: { level: Level }) {
  const q = level.queue!;
  const z = level.zones[q.hall];
  const rows = Array.from({ length: z.h }, (_, i) => z.y + i).filter((y) => !q.aisleRows.includes(y));
  const cols = Array.from({ length: z.w }, (_, i) => z.x + i).filter((x) => !q.aisleCols.includes(x));
  // Contiguous runs of seat rows, e.g. [2..9].
  const runs: [number, number][] = [];
  for (const y of rows) {
    const last = runs[runs.length - 1];
    if (last && last[1] === y - 1) last[1] = y;
    else runs.push([y, y]);
  }
  return (
    <group>
      {cols.flatMap((x) =>
        runs.map(([a, b]) => {
          const [wx, , wz] = tileToWorld(level, x, (a + b) / 2);
          return (
            <mesh key={`${x}-${a}`} position={[wx, 0.015, wz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[0.8, b - a + 0.9]} />
              <meshStandardMaterial color={COLORS.mat} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

export function Props({ level }: { level: Level }) {
  const { kitchen, washing, dining } = level.zones;
  return (
    <group>
      {kitchen && <KitchenProps level={level} z={kitchen} />}
      {washing && <WashingProps level={level} z={washing} />}
      {dining && <DiningHall level={level} z={dining} />}
      {level.queue && <HallMats level={level} />}
    </group>
  );
}
