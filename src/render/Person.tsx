import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import type { AgentType } from '../sim/types';
import { SHIRT, SKIN } from './palette';

type Props = {
  type: AgentType;
  position: [number, number, number];
  facing?: number;
  skin?: number;
  /** Phase offset so a crowd doesn't bounce in sync. */
  phase?: number;
  walking?: boolean;
  /** Sitting cross-legged on the floor (diners). */
  seated?: boolean;
  /** Override the role colour. */
  shirt?: string;
  /** Faint and see-through: a personal-best ghost. */
  ghost?: boolean;
};

const GHOST = { transparent: true, opacity: 0.28, depthWrite: false } as const;

/** Cartoon bobble-head: rounded torso, big head, dot eyes, little legs and feet. Gentle bob, legs step when walking. */
export function Person({ type, position, facing = 0, skin = 0, phase = 0, walking = true, seated = false, shirt, ghost = false }: Props) {
  const see = ghost ? GHOST : {};
  const bob = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const slow = type === 'elderly';

  useFrame(({ clock }) => {
    if (!bob.current) return;
    const t = clock.elapsedTime * (slow ? 5 : 8) + phase;
    const amp = walking ? 0.025 : 0.006;
    bob.current.position.y = (seated ? -0.12 : 0) + Math.abs(Math.sin(t)) * amp;
    bob.current.rotation.z = walking ? Math.sin(t) * 0.03 : 0;
    const stride = walking ? Math.sin(t) * 0.45 : 0;
    if (legL.current) legL.current.rotation.x = stride;
    if (legR.current) legR.current.rotation.x = -stride;
  });
  const skinColor = SKIN[skin % SKIN.length];

  return (
    <group position={position} rotation={[0, facing, 0]} scale={seated ? 0.8 : 1}>
      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <circleGeometry args={[0.28, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.12} />
      </mesh>

      <group ref={bob} rotation={[slow ? 0.15 : 0, 0, 0]}>
        {/* Legs and feet, hinged at the hip; tucked away when sitting cross-legged. */}
        {!seated &&
          ([
            [-0.08, legL],
            [0.08, legR],
          ] as const).map(([x, ref]) => (
            <group key={x} ref={ref} position={[x, 0.24, 0]}>
              <mesh position={[0, -0.11, 0]} castShadow={!ghost}>
                <cylinderGeometry args={[0.05, 0.055, 0.22, 8]} />
                <meshStandardMaterial color="#5b6275" flatShading {...see} />
              </mesh>
              <mesh position={[0, -0.215, 0.04]}>
                <boxGeometry args={[0.1, 0.05, 0.17]} />
                <meshStandardMaterial color="#3d3a46" flatShading {...see} />
              </mesh>
            </group>
          ))}
        {/* Torso */}
        <mesh position={[0, 0.42, 0]} scale={[0.85, 1.05, 0.75]} castShadow={!ghost}>
          <sphereGeometry args={[0.24, 16, 12]} />
          <meshStandardMaterial color={shirt ?? SHIRT[type]} flatShading {...see} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 0.82, 0]} castShadow={!ghost}>
          <sphereGeometry args={[0.22, 18, 14]} />
          <meshStandardMaterial color={skinColor} flatShading {...see} />
        </mesh>
        {/* Eyes, facing +z */}
        {[-0.075, 0.075].map((x) => (
          <mesh key={x} position={[x, 0.85, 0.195]}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshBasicMaterial color="#2b2b3a" {...see} />
          </mesh>
        ))}
        {type === 'crate' && (
          <mesh position={[0, 0.5, 0.3]} castShadow>
            <boxGeometry args={[0.5, 0.3, 0.32]} />
            <meshStandardMaterial color="#a8794e" flatShading />
          </mesh>
        )}
        {type === 'tray' && (
          <mesh position={[0, 0.56, 0.28]}>
            <cylinderGeometry args={[0.2, 0.2, 0.03, 16]} />
            <meshStandardMaterial color="#d9dde2" metalness={0.4} roughness={0.4} />
          </mesh>
        )}
      </group>
    </group>
  );
}
