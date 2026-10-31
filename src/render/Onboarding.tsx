import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { BoxGeometry, EdgesGeometry, LineBasicMaterial } from 'three';
import { buildGrid, isEditable } from '../sim/design';
import { getCell } from '../sim/grid';
import type { Level } from '../sim/types';
import { useStore } from '../store';
import { tileToWorld } from './coords';
import { WALL_H } from './Items';
import { COLORS } from './palette';

/** Soft pulsing outline around every wall tile you're allowed to put a door in. Design mode only. */
export function EditableGlow({ level }: { level: Level }) {
  const design = useStore((s) => s.design);
  const edges = useMemo(() => new EdgesGeometry(new BoxGeometry(1.02, WALL_H + 0.02, 1.02)), []);
  const material = useMemo(() => new LineBasicMaterial({ color: COLORS.editableEdge, transparent: true }), []);
  useFrame(({ clock }) => {
    material.opacity = 0.55 + 0.35 * Math.sin(clock.elapsedTime * 2.5);
  });

  const tiles = useMemo(() => {
    const grid = buildGrid(level, design);
    const open = (x: number, y: number) => {
      const c = getCell(grid, x, y);
      return c !== null && c !== 'wall';
    };
    // A wall on the site's edge only counts if there's floor on both sides of it along the edge.
    const onEdge = (x: number, y: number) => x === 0 || y === 0 || x === grid.w - 1 || y === grid.h - 1;
    const doorable = (x: number, y: number) => !onEdge(x, y) || (open(x - 1, y) && open(x + 1, y)) || (open(x, y - 1) && open(x, y + 1));
    return level.fixedWalls.filter(([x, y]) => isEditable(level, x, y) && getCell(grid, x, y) === 'wall' && doorable(x, y));
  }, [level, design]);

  return (
    <group>
      {tiles.map(([x, y]) => {
        const [wx, , wz] = tileToWorld(level, x, y);
        return <lineSegments key={`${x},${y}`} geometry={edges} material={material} position={[wx, WALL_H / 2, wz]} />;
      })}
    </group>
  );
}
