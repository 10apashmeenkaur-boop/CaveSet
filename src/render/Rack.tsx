import { useMemo } from 'react';
import { CanvasTexture, Color, DoubleSide, RepeatWrapping } from 'three';
import { RACK_WATER_ML } from '../sim/constants';
import { DEFAULT_RACK, initRack, type RackDesign, type RackState, type Utensil } from '../sim/rack';
import type { Level } from '../sim/types';
import { useStore } from '../store';
import { COLORS } from './palette';

/**
 * The Utensil Rack, close up on a kitchen bench. 1 world unit = 100 mm. The rack is drawn from the design
 * (base, gap, material, extras) and the sim's water: wet utensils look dark and glossy and dry to matt;
 * standing water shows on the base, in the cup, in the drip tray and on the counter.
 */

const W = 9; // rack width (x)
const D = 5; // rack depth (z)
const BASE_Y = 1; // base height above the bench (legs)
const PLATE_R = 1.05;
const BOWL_R = 0.55;
const CUP = { x: 3.4, z: 1.5, r: 0.55, h: 1.3 };

const FRAME_COLOR: Record<RackDesign['material'], string> = {
  plastic: COLORS.rackPlastic,
  aluminium: COLORS.rackAluminium,
  stainless: COLORS.rackStainless,
  mildSteel: COLORS.rackMildSteel,
};

/** How wet (0 dry .. 1 straight from the wash). */
const wetness = (u: Utensil) => Math.min(1, u.water / RACK_WATER_ML[u.kind]);

/** Dishware material: darker, bluer and glossy when wet; matt when dry. */
function DishMat({ color, wet, metal = 0.05 }: { color: string; wet: number; metal?: number }) {
  const c = useMemo(() => new Color(color).lerp(new Color(COLORS.wetTint), 0.4 * Math.sqrt(wet)), [color, wet]);
  return <meshStandardMaterial color={c} roughness={0.75 - 0.6 * Math.sqrt(wet)} metalness={metal} />;
}

/** A sheet with round holes `gap` mm across (transparent where the holes are). */
function useHoleTexture(gap: number) {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 64, 64);
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(32, 32, 20, 0, Math.PI * 2);
    g.fill();
    const t = new CanvasTexture(c);
    t.wrapS = t.wrapT = RepeatWrapping;
    // One hole per tile; tile = hole + a bit of metal around it.
    const tile = (gap * 1.6) / 100;
    t.repeat.set(W / tile, D / tile);
    return t;
  }, [gap]);
}

/** The base the dishes sit on: a solid tray with a lip, a perforated sheet, or a wire mesh, sagging if the frame bends. */
function Base({ r, sag }: { r: RackDesign; sag: number }) {
  const holes = useHoleTexture(r.gap);
  const color = FRAME_COLOR[r.material];
  const wires = useMemo(() => {
    const step = (r.gap + 3) / 100;
    const pts: number[] = [];
    for (let x = -W / 2; x <= W / 2 + 1e-6; x += step) pts.push(x, 0, -D / 2, x, 0, D / 2);
    for (let z = -D / 2; z <= D / 2 + 1e-6; z += step) pts.push(-W / 2, 0, z, W / 2, 0, z);
    return new Float32Array(pts);
  }, [r.gap]);
  // Two halves tilted down to the middle when the frame sags.
  const halves = sag ? [-1, 1] : [0];
  return (
    <group position={[0, BASE_Y, 0]}>
      {halves.map((side) => (
        <group key={side} position={[side * (W / 4), -sag / 2, 0]} rotation={[0, 0, side * Math.atan2(sag, W / 2)]} scale={[side ? 0.5 : 1, 1, 1]}>
          {r.base === 'tray' && (
            <>
              <mesh receiveShadow castShadow>
                <boxGeometry args={[W, 0.08, D]} />
                <meshStandardMaterial color={color} />
              </mesh>
              {[-1, 1].map((s) => (
                <mesh key={`x${s}`} position={[0, 0.12, (s * D) / 2]}>
                  <boxGeometry args={[W, 0.25, 0.06]} />
                  <meshStandardMaterial color={color} />
                </mesh>
              ))}
              {[-1, 1].map((s) => (
                <mesh key={`z${s}`} position={[(s * W) / 2, 0.12, 0]}>
                  <boxGeometry args={[0.06, 0.25, D]} />
                  <meshStandardMaterial color={color} />
                </mesh>
              ))}
            </>
          )}
          {r.base === 'perforated' && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[W, D]} />
              <meshStandardMaterial color={color} alphaMap={holes} alphaTest={0.5} transparent side={DoubleSide} metalness={0.4} roughness={0.4} />
            </mesh>
          )}
          {r.base === 'mesh' && (
            <lineSegments>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[wires, 3]} />
              </bufferGeometry>
              <lineBasicMaterial color={color} />
            </lineSegments>
          )}
        </group>
      ))}
    </group>
  );
}

/** Corner legs, a rim round the base and a back rail. */
function Frame({ r, rusted }: { r: RackDesign; rusted: boolean }) {
  const color = rusted ? COLORS.rust : FRAME_COLOR[r.material];
  const metal = r.material === 'plastic' ? 0.05 : 0.6;
  const posts: [number, number][] = [
    [-W / 2, -D / 2],
    [W / 2, -D / 2],
    [-W / 2, D / 2],
    [W / 2, D / 2],
  ];
  return (
    <group>
      {posts.map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, (BASE_Y + 1.6) / 2, z]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, BASE_Y + 1.6, 8]} />
          <meshStandardMaterial color={color} metalness={metal} roughness={0.4} />
        </mesh>
      ))}
      {[BASE_Y, BASE_Y + 1.6].map((y) =>
        [-1, 1].map((s) => (
          <group key={`${y},${s}`}>
            <mesh position={[0, y, (s * D) / 2]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.05, 0.05, W, 6]} />
              <meshStandardMaterial color={color} metalness={metal} roughness={0.4} />
            </mesh>
            <mesh position={[(s * W) / 2, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, D, 6]} />
              <meshStandardMaterial color={color} metalness={metal} roughness={0.4} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}

/** Where the plates stand (dividers) or lie (piles), along the back half of the rack. */
function platePlaces(r: RackDesign, n: number): { pos: [number, number, number]; upright: boolean }[] {
  if (r.dividers) {
    const step = (r.gap + 8) / 100;
    return Array.from({ length: n }, (_, i) => ({ pos: [(i - (n - 1) / 2) * step, BASE_Y + PLATE_R + 0.02, -1.2], upright: true }));
  }
  const piles = 4;
  return Array.from({ length: n }, (_, i) => ({
    pos: [((i % piles) - (piles - 1) / 2) * 2.2, BASE_Y + 0.05 + Math.floor(i / piles) * 0.08, -1.2],
    upright: false,
  }));
}

function Dividers({ r, n }: { r: RackDesign; n: number }) {
  const step = (r.gap + 8) / 100;
  const color = FRAME_COLOR[r.material];
  return (
    <group>
      {Array.from({ length: n + 1 }, (_, i) => (i - n / 2) * step).flatMap((x) =>
        [-2.1, -0.3].map((z) => (
          <mesh key={`${x},${z}`} position={[x, BASE_Y + 0.4, z]}>
            <cylinderGeometry args={[0.025, 0.025, 0.8, 5]} />
            <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** Blue standing water: a flat sheet whose opacity grows with the volume. */
function Water({ y, w, d, ml, full, round }: { y: number; w: number; d: number; ml: number; full: number; round?: boolean }) {
  if (ml < 0.5) return null;
  const a = Math.min(1, ml / full);
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {round ? <circleGeometry args={[w, 32]} /> : <planeGeometry args={[w, d]} />}
      <meshStandardMaterial color={COLORS.water} transparent opacity={0.25 + 0.45 * a} roughness={0.05} metalness={0.2} depthWrite={false} />
    </mesh>
  );
}

function Plate({ u, pos, upright }: { u: Utensil; pos: [number, number, number]; upright: boolean }) {
  return (
    <mesh position={pos} rotation={upright ? [0, 0, Math.PI / 2] : [0, 0, 0]} castShadow>
      <cylinderGeometry args={[PLATE_R, PLATE_R * 0.8, 0.05, 28]} />
      <DishMat color={COLORS.plate} wet={wetness(u)} />
    </mesh>
  );
}

function Bowl({ u, pos }: { u: Utensil; pos: [number, number, number] }) {
  // Upside down: a half-sphere shell, open side on the base.
  return (
    <mesh position={pos} castShadow>
      <sphereGeometry args={[BOWL_R, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <DishMat color={COLORS.bowl} wet={wetness(u)} />
    </mesh>
  );
}

function Spoon({ u, pos, rot }: { u: Utensil; pos: [number, number, number]; rot: [number, number, number] }) {
  return (
    <group position={pos} rotation={rot}>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 1.6, 6]} />
        <DishMat color={COLORS.spoon} wet={wetness(u)} metal={0.6} />
      </mesh>
      <mesh position={[0, -0.05, 0]} scale={[1, 1.5, 0.45]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <DishMat color={COLORS.spoon} wet={wetness(u)} metal={0.6} />
      </mesh>
    </group>
  );
}

function CutleryCup({ r, pool }: { r: RackDesign; pool: number }) {
  const holes = useHoleTexture(8);
  return (
    <group position={[CUP.x, BASE_Y + CUP.h / 2, CUP.z]}>
      <mesh castShadow>
        <cylinderGeometry args={[CUP.r, CUP.r * 0.9, CUP.h, 24, 1, true]} />
        {r.cup === 'perforated' ? (
          <meshStandardMaterial color={COLORS.cup} alphaMap={holes} alphaTest={0.5} side={DoubleSide} />
        ) : (
          <meshStandardMaterial color={COLORS.cup} side={DoubleSide} />
        )}
      </mesh>
      <mesh position={[0, -CUP.h / 2 + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[CUP.r * 0.9, 24]} />
        <meshStandardMaterial color={COLORS.cup} />
      </mesh>
      <group position={[0, -CUP.h / 2 + 0.06, 0]}>
        <Water y={0} w={CUP.r * 0.88} d={0} ml={pool} full={8} round />
      </group>
    </group>
  );
}

/** The kitchen bench: worktop, and a tiled wall behind and to the left. */
function Bench() {
  return (
    <group>
      <mesh position={[0, -0.25, 0.5]} receiveShadow>
        <boxGeometry args={[16, 0.5, 10]} />
        <meshStandardMaterial color={COLORS.benchTop} />
      </mesh>
      <mesh position={[0, 3, -4.6]} receiveShadow>
        <boxGeometry args={[16, 6.5, 0.2]} />
        <meshStandardMaterial color={COLORS.benchWall} />
      </mesh>
      <mesh position={[-8, 3, 0.5]} receiveShadow>
        <boxGeometry args={[0.2, 6.5, 10]} />
        <meshStandardMaterial color={COLORS.benchWall} />
      </mesh>
    </group>
  );
}

/** The whole close-up: bench, rack, utensils and water. */
export function RackScene({ level }: { level: Level }) {
  const r = useStore((s) => s.design.rack ?? DEFAULT_RACK);
  const rackState = useStore((s) => s.sim?.rack);
  const incidents = useStore((s) => s.sim?.incidents);
  // In design mode everything sits there straight out of the wash.
  const st: RackState = useMemo(() => rackState ?? initRack(level, r), [rackState, level, r]);
  const sag = incidents?.some((i) => i.code === 'FRAME_SAG') ? 0.35 : 0;
  const rusted = !!incidents?.some((i) => i.code === 'RUSTED');

  const plates = st.items.filter((u) => u.kind === 'plate');
  const bowls = st.items.filter((u) => u.kind === 'bowl');
  const spoons = st.items.filter((u) => u.kind === 'spoon');
  const places = platePlaces(r, plates.length);
  const dip = (x: number) => sag * (1 - (2 * Math.abs(x)) / W);

  return (
    <group>
      <Bench />
      {/* Water that reached the counter spreads out from under the rack. */}
      <Water y={0.01} w={2 + Math.sqrt(st.counter) * 0.13} d={0} ml={st.counter} full={150} round />
      {r.dripTray && (
        <group>
          <mesh position={[0, 0.08, 0]} receiveShadow>
            <boxGeometry args={[W + 0.4, 0.16, D + 0.4]} />
            <meshStandardMaterial color={COLORS.dripTray} />
          </mesh>
          <Water y={0.17} w={W + 0.2} d={D + 0.2} ml={st.tray} full={300} />
        </group>
      )}
      <Frame r={r} rusted={rusted} />
      <Base r={r} sag={sag} />
      <group position={[0, -sag * 0.6, 0]}>
        <Water y={BASE_Y + 0.07} w={W} d={D} ml={st.pool} full={150} />
      </group>
      {r.dividers && <Dividers r={r} n={plates.length} />}
      {plates.map((u, i) => {
        const p = places[i];
        return <Plate key={`p${i}`} u={u} pos={[p.pos[0], p.pos[1] - dip(p.pos[0]), p.pos[2]]} upright={p.upright} />;
      })}
      {bowls.map((u, i) => {
        const x = -4 + (i % 5) * 1.2;
        return <Bowl key={`b${i}`} u={u} pos={[x, BASE_Y + 0.02 - dip(x), i < 5 ? 0.9 : 2.0]} />;
      })}
      {r.cup !== 'none' && <CutleryCup r={r} pool={st.cupPool} />}
      {spoons.map((u, i) => {
        if (u.fallen) {
          // On the drip tray or the counter, under the front right of the rack.
          const y = r.dripTray ? 0.2 : 0.04;
          return <Spoon key={`s${i}`} u={u} pos={[2 + (i % 5) * 0.45, y, 0.8 + Math.floor(i / 5) * 0.9]} rot={[Math.PI / 2, 0, 0.4 * (i % 3)]} />;
        }
        if (r.cup !== 'none') {
          const a = (i / spoons.length) * Math.PI * 2;
          return (
            <Spoon
              key={`s${i}`}
              u={u}
              pos={[CUP.x + Math.cos(a) * 0.25, BASE_Y + 0.2, CUP.z + Math.sin(a) * 0.25]}
              rot={[Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25]}
            />
          );
        }
        return <Spoon key={`s${i}`} u={u} pos={[2.2 + (i % 5) * 0.45, BASE_Y + 0.06, 0.7 + Math.floor(i / 5) * 1.1]} rot={[Math.PI / 2, 0, 0.3]} />;
      })}
    </group>
  );
}
