import { MapControls, OrthographicCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { MOUSE } from 'three';
import type { Level } from '../sim/types';
import { useStore } from '../store';
import { DesignLayer, GhostLayer, InteractionPlane } from './Build';
import { COLORS } from './palette';
import { Floor, Props, ZoneLabels } from './World';
import { AgentsLayer, DinerBubbles, SimRunner } from './Agents';
import { EditableGlow, FlowArrows, TutorialHint } from './Onboarding';
import { HeatLayer, IncidentTiles } from './Overlays';

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

export function Scene({ level }: { level: Level }) {
  const mode = useStore((s) => s.mode);
  const ranOnce = useStore((s) => s.ranOnce);
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
      {mode === 'design' && (
        <>
          <EditableGlow level={level} />
          <TutorialHint level={level} />
          {!ranOnce && <FlowArrows level={level} />}
          <GhostLayer level={level} />
        </>
      )}
      <InteractionPlane level={level} />
      <HeatLayer level={level} />
      <IncidentTiles level={level} />
      <AgentsLayer level={level} />
      <DinerBubbles level={level} />
      <SimRunner />
    </Canvas>
  );
}
