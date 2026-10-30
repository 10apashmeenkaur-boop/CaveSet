import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import type { AgentType } from '../sim/types';
import { COLORS, SHIRT, SKIN } from './palette';

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

/** A wheelchair under a seated person, facing +z. */
function Wheelchair({ see }: { see: object }) {
  return (
    <group>
      <mesh position={[0, 0.4, 0.02]}>
        <boxGeometry args={[0.46, 0.06, 0.42]} />
        <meshStandardMaterial color={COLORS.chair} flatShading {...see} />
      </mesh>
      <mesh position={[0, 0.62, -0.2]}>
        <boxGeometry args={[0.46, 0.4, 0.05]} />
        <meshStandardMaterial color={COLORS.chair} flatShading {...see} />
      </mesh>
      {[-0.29, 0.29].map((x) => (
        <mesh key={x} position={[x, 0.3, -0.04]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.3, 0.3, 0.05, 18]} />
          <meshStandardMaterial color={COLORS.wheel} {...see} />
        </mesh>
      ))}
      {[-0.18, 0.18].map((x) => (
        <mesh key={x} position={[x, 0.07, 0.26]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.04, 10]} />
          <meshStandardMaterial color={COLORS.wheel} {...see} />
        </mesh>
      ))}
    </group>
  );
}

/** A flat sack trolley with three sacks, out in front of the person pushing it. */
function Trolley({ see }: { see: object }) {
  return (
    <group position={[0, 0, 0.5]}>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[1.05, 0.07, 0.95]} />
        <meshStandardMaterial color={COLORS.cart} flatShading {...see} />
      </mesh>
      {[-0.42, 0.42].flatMap((x) =>
        [-0.36, 0.36].map((z) => (
          <mesh key={`${x},${z}`} position={[x, 0.08, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.08, 0.08, 0.05, 10]} />
            <meshStandardMaterial color={COLORS.wheel} {...see} />
          </mesh>
        )),
      )}
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.5, -0.45]}>
          <cylinderGeometry args={[0.025, 0.025, 0.6, 6]} />
          <meshStandardMaterial color={COLORS.cart} {...see} />
        </mesh>
      ))}
      <mesh position={[0, 0.8, -0.45]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.9, 6]} />
        <meshStandardMaterial color={COLORS.cart} {...see} />
      </mesh>
      {[
        [-0.24, 0.1, 0],
        [0.24, 0.1, 0],
        [0, -0.18, 0.28],
      ].map(([x, z, up]) => (
        <mesh key={`${x},${z}`} position={[x, 0.42 + up, z]} scale={[1, 0.62, 0.8]}>
          <sphereGeometry args={[0.28, 12, 10]} />
          <meshStandardMaterial color={COLORS.sack} flatShading {...see} />
        </mesh>
      ))}
    </group>
  );
}

/** Cartoon bobble-head: rounded torso, big head, dot eyes, little legs and feet. Gentle bob, legs step when walking. */
export function Person({ type, position, facing = 0, skin = 0, phase = 0, walking = true, seated = false, shirt, ghost = false }: Props) {
  const see = ghost ? GHOST : {};
  const bob = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const slow = type === 'elderly';
  const chair = type === 'wheelchair';
  // A trolley's pusher walks behind it; someone in a wheelchair sits up on the seat.
  const back = type === 'trolley' ? -0.45 : 0;
  const lift = chair ? 0.2 : 0;

  useFrame(({ clock }) => {
    if (!bob.current) return;
    const t = clock.elapsedTime * (slow ? 5 : 8) + phase;
    const amp = chair ? 0.004 : walking ? 0.025 : 0.006;
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

      {chair && <Wheelchair see={see} />}
      {type === 'trolley' && <Trolley see={see} />}
      <group ref={bob} rotation={[slow ? 0.15 : 0, 0, 0]} position={[0, lift, back]}>
        {/* Sitting in a wheelchair: legs forward on the footrest. */}
        {chair &&
          [-0.08, 0.08].map((x) => (
            <mesh key={x} position={[x, 0.24, 0.18]} rotation={[Math.PI / 2.4, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.055, 0.3, 8]} />
              <meshStandardMaterial color="#5b6275" flatShading {...see} />
            </mesh>
          ))}
        {/* Legs and feet, hinged at the hip; tucked away when sitting cross-legged. */}
        {!seated &&
          !chair &&
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
        {type === 'sack' && (
          <mesh position={[0.16, 0.7, -0.04]} rotation={[0, 0, -0.5]} scale={[1, 0.6, 0.75]} castShadow={!ghost}>
            <sphereGeometry args={[0.24, 12, 10]} />
            <meshStandardMaterial color={COLORS.sack} flatShading {...see} />
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
