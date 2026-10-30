import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BoxGeometry, EdgesGeometry, LineBasicMaterial, type Group, type Material } from 'three';
import { buildGrid, isEditable } from '../sim/design';
import { getCell } from '../sim/grid';
import { findPath, makeWorld, type World } from '../sim/pathfinding';
import type { Level, Tile, Zone } from '../sim/types';
import { useStore } from '../store';
import { tileToWorld } from './coords';
import { WALL_H } from './Items';
import { COLORS } from './palette';
import { surfaceY } from './Terrain';

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

/** Middle of a zone's service edge (counters on the outer wall), as the old flow arrows used. */
function serviceMid(level: Level, z: Zone): Tile {
  const x = z.x === 0 ? 0 : z.x + z.w === level.grid.w ? level.grid.w - 1 : z.x + Math.floor(z.w / 2);
  return [x, z.y + Math.floor(z.h / 2)];
}

/** Tiles from stop to stop along the route people would take now (straight across where there's no way through yet). */
function route(world: World, stops: Tile[]): Tile[] {
  const tiles: Tile[] = [stops[0]];
  for (let i = 1; i < stops.length; i++) tiles.push(...(findPath(world, stops[i - 1], stops[i], 1) ?? [stops[i]]));
  return tiles;
}

type Flow = { stops: Tile[]; color: string; twoWay: boolean };

function flowsOf(level: Level, world: World): Flow[] {
  const q = level.queue;
  if (q) {
    // In: entrance → each kind of station in order → the hall. Out: the seats by the exit → the exit.
    const firstOf = (kind: string) => world.units.find((u) => u.kind === kind)?.serve;
    const hall = level.zones[q.hall];
    const exit = level.zones[q.exit];
    const exitTile: Tile = [exit.x, exit.y + Math.floor(exit.h / 2)];
    const byExit = [...world.seats].sort((a, b) => a[0] + Math.abs(a[1] - exitTile[1]) - (b[0] + Math.abs(b[1] - exitTile[1])))[0];
    const inStops = [serviceMid(level, level.zones[q.entrance]), ...q.visit.map(firstOf).filter((t): t is Tile => !!t)];
    inStops.push([hall.x + Math.floor(hall.w / 2), hall.y + Math.floor(hall.h / 2)]);
    const flows: Flow[] = [{ stops: inStops, color: COLORS.routeIn, twoWay: false }];
    if (byExit) flows.push({ stops: [byExit, exitTile], color: COLORS.routeOut, twoWay: false });
    return flows;
  }
  const seen = new Map<string, Flow>();
  for (const r of level.spawns) {
    const k = `${r.from}>${r.to}`;
    if (seen.has(k)) continue;
    const back = level.spawns.some((o) => o.from === r.to && o.to === r.from);
    seen.set(k, {
      stops: [serviceMid(level, level.zones[r.from]), serviceMid(level, level.zones[r.to])],
      color: r.from < r.to ? COLORS.routeOut : COLORS.routeIn,
      twoWay: back,
    });
  }
  return [...seen.values()];
}

/** World points for a tile route; two-way flows keep to the right of their direction so they don't overlap. On the ramp level they follow the slope. */
function points(level: Level, world: World, tiles: Tile[], keepRight: boolean): [number, number, number][] {
  const t = world.terrain;
  return tiles.map((p, i) => {
    const a = tiles[Math.max(0, i - 1)];
    const b = tiles[Math.min(tiles.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const side = keepRight ? 0.25 : 0;
    const [wx, , wz] = tileToWorld(level, p[0] - ((b[1] - a[1]) / len) * side, p[1] + ((b[0] - a[0]) / len) * side);
    return [wx, 0.07 + surfaceY(t, p[0], p[1]), wz];
  });
}

/**
 * Dotted, moving arrows along the routes people take (entrance → stations → hall → exit, or kitchen ↔ washing).
 * Shown in design mode; they fade out once the simulation starts. No labels.
 */
export function RouteArrows({ level }: { level: Level }) {
  const design = useStore((s) => s.design);
  const mode = useStore((s) => s.mode);
  const flows = useMemo(() => {
    const world = makeWorld(level, design);
    return flowsOf(level, world).map((f) => ({ ...f, pts: points(level, world, route(world, f.stops), f.twoWay) }));
  }, [level, design]);
  const group = useRef<Group>(null);
  const fade = useRef(1);
  const lines = useRef<({ material: { dashOffset: number } } | null)[]>([]);

  useFrame((_, dt) => {
    fade.current += ((mode === 'design' ? 1 : 0) - fade.current) * Math.min(1, dt * 3);
    for (const l of lines.current) if (l) l.material.dashOffset -= dt * 1.2;
    const g = group.current;
    if (!g) return;
    g.visible = fade.current > 0.02;
    g.traverse((o) => {
      const m = (o as { material?: Material & { opacity: number } }).material;
      if (m) m.opacity = 0.85 * fade.current;
    });
  });

  return (
    <group ref={group}>
      {flows.map((f, i) => {
        const end = f.pts[f.pts.length - 1];
        const prev = f.pts[Math.max(0, f.pts.length - 2)];
        return (
          <group key={i}>
            <Line
              ref={(el) => {
                lines.current[i] = el as never;
              }}
              points={f.pts}
              color={f.color}
              lineWidth={4}
              dashed
              dashSize={0.3}
              gapSize={0.22}
              transparent
            />
            {/* Cone tips +y; tip it forward to +z, then turn towards the direction of travel. */}
            <mesh position={end} rotation={[Math.PI / 2, Math.atan2(end[0] - prev[0], end[2] - prev[2]), 0, 'YXZ']}>
              <coneGeometry args={[0.26, 0.55, 3]} />
              <meshBasicMaterial color={f.color} transparent />
            </mesh>
            <mesh position={[f.pts[0][0], 0.04, f.pts[0][2]]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.26, 20]} />
              <meshBasicMaterial color={f.color} transparent />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
