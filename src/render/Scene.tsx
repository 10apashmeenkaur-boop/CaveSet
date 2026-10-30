import { MapControls, OrthographicCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { MOUSE } from 'three';
import type { Level } from '../sim/types';
import { DesignLayer, GhostLayer, InteractionPlane } from './Build';
import { tileToWorld } from './coords';
import { COLORS } from './palette';
import { Floor, Props, ZoneLabels } from './World';
import { Person } from './Person';

// Isometric-ish view: ~45° yaw, ~35° pitch.
const YAW = Math.PI / 4;
const PITCH = (35 * Math.PI) / 180;
const DIST = 40;
const CAM_POS: [number, number, number] = [
  DIST * Math.cos(PITCH) * Math.sin(YAW),
  DIST * Math.sin(PITCH),
  DIST * Math.cos(PITCH) * Math.cos(YAW),
];

// Left button is for building; right/middle drag pans. (-1 = no action in OrbitControls.)
const MOUSE_BUTTONS = { LEFT: -1 as MOUSE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.PAN };

/** Idle preview crowd so the character style is visible before agents exist (replaced in M3). */
function PreviewPeople({ level }: { level: Level }) {
  const spots: { type: 'crate' | 'tray' | 'empty' | 'elderly'; x: number; y: number }[] = [
    { type: 'crate', x: 3, y: 3 },
    { type: 'tray', x: 5, y: 6 },
    { type: 'empty', x: 2, y: 7 },
    { type: 'elderly', x: level.grid.w - 3, y: 4 },
  ];
  return (
    <group>
      {spots.map((s, i) => (
        <Person key={i} type={s.type} position={tileToWorld(level, s.x, s.y)} facing={YAW} skin={i} phase={i * 1.3} />
      ))}
    </group>
  );
}

export function Scene({ level }: { level: Level }) {
  return (
    <Canvas shadows style={{ background: COLORS.background }} onContextMenu={(e) => e.preventDefault()}>
      <OrthographicCamera makeDefault position={CAM_POS} zoom={42} near={0.1} far={200} />
      <MapControls enableRotate={false} screenSpacePanning minZoom={15} maxZoom={120} mouseButtons={MOUSE_BUTTONS} />
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
      <Floor level={level} />
      <Props level={level} />
      <ZoneLabels level={level} />
      <DesignLayer level={level} />
      <GhostLayer level={level} />
      <InteractionPlane level={level} />
      <PreviewPeople level={level} />
    </Canvas>
  );
}
