import { DoubleSide, Shape } from 'three';
import { itemTiles, TOOL_INFO, type Draft } from '../sim/design';
import { useMemo } from 'react';
import type { Level } from '../sim/types';
import { brickTexture } from './brick';
import { tileToWorld } from './coords';
import { COLORS } from './palette';

export const WALL_H = 1.2;
const LEAF_H = 0.95;
const OPEN_ANGLE = (70 * Math.PI) / 180;

/** 'ok' / 'bad' render the item as a translucent placement ghost. */
export type Ghost = 'ok' | 'bad' | undefined;

function Mat({ color, ghost }: { color: string; ghost: Ghost }) {
  if (!ghost) return <meshStandardMaterial color={color} flatShading />;
  return <meshStandardMaterial color={ghost === 'ok' ? '#5fbf7f' : '#e5675a'} transparent opacity={0.55} depthWrite={false} />;
}

/** World centre of an item and its rotation, in a local frame where width runs along +X and the swing side is +Z. */
function frame(level: Level, item: Draft) {
  const tiles = itemTiles(item);
  const a = tileToWorld(level, ...tiles[0]);
  const b = tileToWorld(level, ...tiles[tiles.length - 1]);
  const center: [number, number, number] = [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2];
  const rot = item.orient === 'h' ? (item.swing === 1 ? 0 : Math.PI) : item.swing === 1 ? Math.PI / 2 : -Math.PI / 2;
  return { center, rot };
}

// Box faces in order: +x, -x, +y (top), -y, +z, -z.
const WALL_FACES = [0, 1, 2, 3, 4, 5];

export function WallBlock({ position, ghost }: { position: [number, number, number]; ghost?: Ghost }) {
  if (ghost) {
    return (
      <mesh position={[position[0], WALL_H / 2, position[2]]}>
        <boxGeometry args={[1, WALL_H, 1]} />
        <Mat color={COLORS.wall} ghost={ghost} />
      </mesh>
    );
  }
  const bricks = brickTexture();
  return (
    <mesh position={[position[0], WALL_H / 2, position[2]]} castShadow receiveShadow>
      <boxGeometry args={[1, WALL_H, 1]} />
      {WALL_FACES.map((i) =>
        i === 2 ? (
          <meshStandardMaterial key={i} attach={`material-${i}`} color={COLORS.wallTop} />
        ) : (
          <meshStandardMaterial key={i} attach={`material-${i}`} map={bricks} />
        ),
      )}
    </mesh>
  );
}

/** Translucent quarter circle on the floor showing where a hinged leaf sweeps. */
function SwingArc({ hingeX, radius, flip, ghost }: { hingeX: number; radius: number; flip: boolean; ghost: Ghost }) {
  return (
    <mesh position={[hingeX, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 24, flip ? Math.PI / 2 : 0, Math.PI / 2]} />
      <meshBasicMaterial color={ghost === 'bad' ? '#e5675a' : COLORS.swing} transparent opacity={0.5} side={DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/** One hinged leaf, standing open into +Z. `flip` hinges it on the right end instead of the left. */
function Leaf({ hingeX, length, flip, ghost }: { hingeX: number; length: number; flip: boolean; ghost: Ghost }) {
  return (
    <group position={[hingeX, 0, 0]} rotation={[0, flip ? Math.PI + OPEN_ANGLE : -OPEN_ANGLE, 0]}>
      <mesh position={[length / 2 - 0.04, LEAF_H / 2, 0]} castShadow={!ghost}>
        <boxGeometry args={[length - 0.08, LEAF_H, 0.06]} />
        <Mat color={COLORS.door} ghost={ghost} />
      </mesh>
      {/* Handle */}
      <mesh position={[length - 0.18, LEAF_H * 0.5, 0.05]}>
        <sphereGeometry args={[0.04, 8, 6]} />
        <Mat color="#e8c25a" ghost={ghost} />
      </mesh>
    </group>
  );
}

export function DoorItem({ level, item, ghost }: { level: Level; item: Draft; ghost?: Ghost }) {
  const info = TOOL_INFO[item.tool];
  const w = info.width;
  const { center, rot } = frame(level, item);

  return (
    <group position={center} rotation={[0, rot, 0]}>
      {/* Frame: two posts and a header beam, wall-thick */}
      {[-w / 2, w / 2].map((px) => (
        <mesh key={px} position={[px, WALL_H / 2, 0]} castShadow={!ghost}>
          <boxGeometry args={[0.12, WALL_H, 1]} />
          <Mat color={COLORS.wall} ghost={ghost} />
        </mesh>
      ))}
      <mesh position={[0, LEAF_H + (WALL_H - LEAF_H) / 2, 0]} castShadow={!ghost}>
        <boxGeometry args={[w, WALL_H - LEAF_H, 1]} />
        <Mat color={COLORS.wall} ghost={ghost} />
      </mesh>
      {/* Threshold */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, 1]} />
        <Mat color={COLORS.threshold} ghost={ghost} />
      </mesh>

      {info.hinged ? (
        w === 1 ? (
          <>
            <Leaf hingeX={-0.5} length={1} flip={false} ghost={ghost} />
            <SwingArc hingeX={-0.5} radius={1} flip={false} ghost={ghost} />
          </>
        ) : (
          <>
            <Leaf hingeX={-1} length={1} flip={false} ghost={ghost} />
            <Leaf hingeX={1} length={1} flip ghost={ghost} />
            <SwingArc hingeX={-1} radius={1} flip={false} ghost={ghost} />
            <SwingArc hingeX={1} radius={1} flip ghost={ghost} />
          </>
        )
      ) : (
        <>
          {/* Sliding panel, parked to one side along its track */}
          <mesh position={[w * 0.35, LEAF_H / 2, -0.38]}>
            <boxGeometry args={[w * 0.8, LEAF_H, 0.05]} />
            {ghost ? <Mat color="" ghost={ghost} /> : <meshStandardMaterial color={COLORS.glass} transparent opacity={0.6} />}
          </mesh>
          <mesh position={[0, 0.015, -0.38]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w, 0.06]} />
            <meshBasicMaterial color="#8a8f99" />
          </mesh>
        </>
      )}
    </group>
  );
}

/** Flat arrow on the doorway floor: people may only pass this way. */
export function SignItem({ level, door, arrow, ghost }: { level: Level; door: Draft; arrow: 1 | -1; ghost?: Ghost }) {
  const shape = useMemo(() => {
    // Points along +x in its own plane.
    const s = new Shape();
    s.moveTo(-0.75, -0.14);
    s.lineTo(0.15, -0.14);
    s.lineTo(0.15, -0.36);
    s.lineTo(0.75, 0);
    s.lineTo(0.15, 0.36);
    s.lineTo(0.15, 0.14);
    s.lineTo(-0.75, 0.14);
    s.closePath();
    return s;
  }, []);
  const tiles = itemTiles(door);
  const a = tileToWorld(level, ...tiles[0]);
  const b = tileToWorld(level, ...tiles[tiles.length - 1]);
  const [dx, dz] = door.orient === 'v' ? [arrow, 0] : [0, arrow];
  const color = ghost === 'bad' ? '#e5675a' : COLORS.oneway;
  // Drawn twice: on the floor, and on top of the doorway where the iso camera always sees it.
  return (
    <group position={[(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2]} rotation={[0, Math.atan2(-dz, dx), 0]}>
      {[0.035, WALL_H + 0.03].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={TOOL_INFO[door.tool].width === 2 ? 1.25 : 1}>
          <shapeGeometry args={[shape]} />
          <meshBasicMaterial color={color} transparent opacity={ghost ? 0.55 : 0.95} side={DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
