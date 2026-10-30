import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import { BoxGeometry } from 'three';
import { STAIR_MAX_RISER_M, STAIR_STEPS, TILE_M } from '../sim/constants';
import { buildGrid, itemTiles, TOOL_INFO, upDir, type Design, type Draft } from '../sim/design';
import { buildTerrain, type Terrain } from '../sim/terrain';
import type { Level, Tile } from '../sim/types';
import { useStore } from '../store';
import { brickTexture } from './brick';
import { tileToWorld } from './coords';
import { DropIn } from './Feel';
import type { Ghost } from './Items';
import { COLORS } from './palette';

/** Millimetres of real height → world units (1 tile = 0.6 m = 1 unit). */
export const mmToY = (mm: number) => mm / (TILE_M * 1000);

/** Heights for a design on the ramp level (undefined on other levels). */
export function terrainOf(level: Level, design: Design): Terrain | undefined {
  return buildTerrain(level, design, buildGrid(level, design));
}

/** Height of the walking surface at the centre of tile (x, y), in world units. */
export function surfaceY(t: Terrain | undefined, x: number, y: number): number {
  return t ? mmToY(t.center[y * t.w + x]) : 0;
}

function Mat({ color, ghost }: { color: string; ghost: Ghost }) {
  if (!ghost) return <meshStandardMaterial color={color} flatShading />;
  return <meshStandardMaterial color={ghost === 'ok' ? '#5fbf7f' : '#e5675a'} transparent opacity={0.55} depthWrite={false} />;
}

/** Centre of an item's tiles in world space, and the rotation that turns local +x uphill. */
function pieceFrame(level: Level, item: Draft) {
  const tiles = itemTiles(item);
  const pts = tiles.map((t) => tileToWorld(level, ...t));
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[2], 0) / pts.length;
  const [dx, dy] = upDir(item);
  return { center: [cx, 0, cz] as [number, number, number], rot: Math.atan2(-dy, dx), tiles };
}

/** The raised roof: a brick block with a flat deck on top, and a few sacks already stored. */
export function RoofDeck({ level }: { level: Level }) {
  const rise = level.rise!;
  const z = level.zones[rise.zone];
  const h = rise.heightM / TILE_M;
  const [x0, , z0] = tileToWorld(level, z.x, z.y);
  const cx = x0 + (z.w - 1) / 2;
  const cz = z0 + (z.h - 1) / 2;
  const bricks = brickTexture();
  return (
    <group>
      <mesh position={[cx, h / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[z.w, h, z.h]} />
        {[0, 1, 2, 3, 4, 5].map((i) =>
          i === 2 ? (
            <meshStandardMaterial key={i} attach={`material-${i}`} color={COLORS.deck} />
          ) : (
            <meshStandardMaterial key={i} attach={`material-${i}`} map={bricks} />
          ),
        )}
      </mesh>
      <mesh position={[cx, h + 0.006, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[z.w, z.h]} />
        <meshStandardMaterial color={COLORS.zones[rise.zone] ?? COLORS.deck} transparent opacity={0.6} />
      </mesh>
      {[
        [0, 0.6],
        [0, 1.5],
        [0.5, 1.05],
      ].map(([dx, dz], i) => (
        <mesh key={i} position={[x0 + 0.1 + dx * 0.6, h + 0.22 + (i === 2 ? 0.3 : 0), z0 + dz]} scale={[1, 0.62, 0.75]} castShadow>
          <sphereGeometry args={[0.36, 12, 10]} />
          <meshStandardMaterial color={COLORS.sack} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** A ramp piece: a solid wedge from the ground up to its sloped top. */
function RampPiece({ level, item, t, ghost }: { level: Level; item: Draft; t: Terrain; ghost?: Ghost }) {
  const { center, rot, tiles } = pieceFrame(level, item);
  const [tx, ty] = tiles[0];
  const i = ty * t.w + tx;
  const low = mmToY(t.center[i] - t.rise[i] / 2);
  const high = mmToY(t.center[i] + t.rise[i] / 2);
  const geo = useMemo(() => {
    const g = new BoxGeometry(1, 1, 2);
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      pos.setY(k, pos.getY(k) > 0 ? Math.max(0.02, pos.getX(k) < 0 ? low : high) : 0);
    }
    g.computeVertexNormals();
    return g;
  }, [low, high]);
  return (
    <group position={center} rotation={[0, rot, 0]}>
      <mesh geometry={geo} castShadow={!ghost} receiveShadow>
        {ghost ? (
          <Mat color={COLORS.ramp} ghost={ghost} />
        ) : (
          // Box faces: +x, -x, top, bottom, +z, -z. A lighter walking surface so the slope reads.
          [0, 1, 2, 3, 4, 5].map((f) => (
            <meshStandardMaterial key={f} attach={`material-${f}`} color={f === 2 ? COLORS.rampTop : COLORS.ramp} flatShading />
          ))
        )}
      </mesh>
      {ghost && <UphillArrow y={(low + high) / 2 + 0.05} />}
    </group>
  );
}

/** Chevron on a ramp or stairs ghost, pointing uphill. */
function UphillArrow({ y }: { y: number }) {
  return (
    <mesh position={[0.05, y, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
      <coneGeometry args={[0.32, 0.5, 3]} />
      <meshBasicMaterial color={COLORS.hover} transparent opacity={0.8} depthWrite={false} />
    </mesh>
  );
}

/** Stairs: 8 steps of 15 cm over 4 tiles, solid underneath. */
function StairsPiece({ level, item, t, ghost }: { level: Level; item: Draft; t: Terrain; ghost?: Ghost }) {
  const { center, rot, tiles } = pieceFrame(level, item);
  const [tx, ty] = tiles[0];
  const base = mmToY(t.center[ty * t.w + tx] - t.rise[ty * t.w + tx] / 2);
  const riser = STAIR_MAX_RISER_M / TILE_M;
  const len = TOOL_INFO.stairs.length ?? 4;
  const tread = len / STAIR_STEPS;
  return (
    <group position={center} rotation={[0, rot, 0]}>
      {Array.from({ length: STAIR_STEPS }, (_, k) => {
        const top = base + (k + 1) * riser;
        return (
          <mesh key={k} position={[-len / 2 + (k + 0.5) * tread, top / 2, 0]} castShadow={!ghost} receiveShadow>
            <boxGeometry args={[tread, top, 2]} />
            <Mat color={k % 2 ? COLORS.stairs : COLORS.stairsAlt} ghost={ghost} />
          </mesh>
        );
      })}
      {ghost && <UphillArrow y={base + STAIR_STEPS * riser + 0.05} />}
    </group>
  );
}

/** A 3×3 landing: a flat platform at its height, with the height written on it. */
function LandingPiece({ level, item, t, ghost }: { level: Level; item: Draft; t: Terrain; ghost?: Ghost }) {
  const [x, , z] = tileToWorld(level, item.x, item.y);
  const mm = t.center[item.y * t.w + item.x];
  const h = Math.max(0.04, mmToY(mm));
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} castShadow={!ghost} receiveShadow>
        <boxGeometry args={[3, h, 3]} />
        <Mat color={COLORS.landing} ghost={ghost} />
      </mesh>
      <Html position={[0, h + 0.05, 0]} center zIndexRange={[2, 0]} style={{ pointerEvents: 'none' }}>
        <div className="height-tag">{(mm / 1000).toFixed(2).replace(/0$/, '')} m</div>
      </Html>
    </group>
  );
}

/** Handrail along the outer side of a ramp or stairs tile: two posts and a bar following the slope. */
function HandrailPiece({ level, at, t, ghost }: { level: Level; at: Tile; t: Terrain; ghost?: Ghost }) {
  const i = at[1] * t.w + at[0];
  const [ux, uy] = [t.dx[i], t.dy[i]];
  const s = t.sibling[i];
  // Outer side: away from the other half of the ramp.
  const [px, py] = ux !== 0 ? [0, 1] : [1, 0];
  const sib: Tile = s >= 0 ? [s % t.w, Math.floor(s / t.w)] : at;
  const out = sib[0] - at[0] === px && sib[1] - at[1] === py ? -1 : 1;
  const [wx, , wz] = tileToWorld(level, ...at);
  const low = mmToY(t.center[i] - t.rise[i] / 2);
  const high = mmToY(t.center[i] + t.rise[i] / 2);
  const RAIL = 0.75;
  const ends: [number, number][] = [
    [-0.45, low],
    [0.45, high],
  ];
  const run = Math.hypot(0.9, high - low);
  return (
    <group position={[wx + px * out * 0.44, 0, wz + py * out * 0.44]} rotation={[0, Math.atan2(-uy, ux), 0]}>
      {ends.map(([lx, y]) => (
        <mesh key={lx} position={[lx, y + RAIL / 2, 0]}>
          <cylinderGeometry args={[0.035, 0.035, RAIL, 6]} />
          <Mat color={COLORS.handrail} ghost={ghost} />
        </mesh>
      ))}
      <mesh position={[0, (low + high) / 2 + RAIL, 0]} rotation={[0, 0, Math.atan2(high - low, 0.9)]}>
        <boxGeometry args={[run + 0.06, 0.06, 0.06]} />
        <Mat color={COLORS.handrail} ghost={ghost} />
      </mesh>
    </group>
  );
}

function PieceView({ level, item, t, ghost }: { level: Level; item: Draft; t: Terrain; ghost?: Ghost }) {
  const kind = TOOL_INFO[item.tool].terrain;
  if (kind === 'ramp') return <RampPiece level={level} item={item} t={t} ghost={ghost} />;
  if (kind === 'stairs') return <StairsPiece level={level} item={item} t={t} ghost={ghost} />;
  if (kind === 'landing') return <LandingPiece level={level} item={item} t={t} ghost={ghost} />;
  if (TOOL_INFO[item.tool].attach) return <HandrailPiece level={level} at={[item.x, item.y]} t={t} ghost={ghost} />;
  return null;
}

/** Everything built on the ramp level, at its real height. */
export function TerrainLayer({ level }: { level: Level }) {
  const design = useStore((s) => s.design);
  const t = useMemo(() => terrainOf(level, design), [level, design]);
  if (!t) return null;
  return (
    <group>
      {design.items
        .filter((it) => TOOL_INFO[it.tool].terrain || TOOL_INFO[it.tool].attach)
        .map((it) => (
          <DropIn key={it.id}>
            <PieceView level={level} item={it} t={t} />
          </DropIn>
        ))}
    </group>
  );
}

/** Placement ghost for a stair, ramp, landing or handrail, at the height it would get if built. */
export function TerrainGhost({ level, design, draft, ghost }: { level: Level; design: Design; draft: Draft; ghost: Ghost }) {
  const t = useMemo(() => terrainOf(level, { items: [...design.items, { ...draft, id: design.nextId }], nextId: design.nextId + 1 }), [level, design, draft]);
  return t ? <PieceView level={level} item={draft} t={t} ghost={ghost} /> : null;
}
