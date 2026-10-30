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
};

/** Cartoon bobble-head: round body, big head, dot eyes, no limbs. */
export function Person({ type, position, facing = 0, skin = 0, phase = 0, walking = true }: Props) {
  const bob = useRef<Group>(null);
  const slow = type === 'elderly';

  useFrame(({ clock }) => {
    if (!bob.current) return;
    const t = clock.elapsedTime * (slow ? 5 : 8) + phase;
    const amp = walking ? 0.08 : 0.02;
    bob.current.position.y = Math.abs(Math.sin(t)) * amp;
    bob.current.rotation.z = walking ? Math.sin(t) * 0.08 : 0;
  });

  return (
    <group position={position} rotation={[0, facing, 0]}>
      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <circleGeometry args={[0.28, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.12} />
      </mesh>

      <group ref={bob} rotation={[slow ? 0.15 : 0, 0, 0]}>
        {/* Body */}
        <mesh position={[0, 0.3, 0]} scale={[1, 1.15, 0.9]} castShadow>
          <sphereGeometry args={[0.24, 16, 12]} />
          <meshStandardMaterial color={SHIRT[type]} flatShading />
        </mesh>
        {/* Head */}
        <mesh position={[0, 0.72, 0]} castShadow>
          <sphereGeometry args={[0.24, 18, 14]} />
          <meshStandardMaterial color={SKIN[skin % SKIN.length]} flatShading />
        </mesh>
        {/* Eyes, facing +z */}
        {[-0.08, 0.08].map((x) => (
          <mesh key={x} position={[x, 0.75, 0.215]}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshBasicMaterial color="#2b2b3a" />
          </mesh>
        ))}
        {type === 'crate' && (
          <mesh position={[0, 0.42, 0.3]} castShadow>
            <boxGeometry args={[0.5, 0.3, 0.32]} />
            <meshStandardMaterial color="#a8794e" flatShading />
          </mesh>
        )}
        {type === 'tray' && (
          <mesh position={[0, 0.48, 0.28]}>
            <cylinderGeometry args={[0.2, 0.2, 0.03, 16]} />
            <meshStandardMaterial color="#d9dde2" metalness={0.4} roughness={0.4} />
          </mesh>
        )}
      </group>
    </group>
  );
}
