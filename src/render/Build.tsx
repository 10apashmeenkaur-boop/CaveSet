import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { buildGrid, doorAt, eraseTarget, itemTiles, objectTiles, serveTile, stationsOf, TOOL_INFO } from '../sim/design';
import { getCell } from '../sim/grid';
import { EMPTY_DESIGN } from '../sim/design';
import type { Level } from '../sim/types';
import { rampDraft, resolveDraft, useStore } from '../store';
import { sfx } from '../audio/sfx';
import { tileToWorld } from './coords';
import { DropIn } from './Feel';
import { DoorItem, RailItem, SignItem, StationItem, WALL_H, WallBlock } from './Items';
import { COLORS } from './palette';
import { surfaceY, TerrainGhost, terrainOf } from './Terrain';

/** Every wall tile (fixed + placed) and every placed door. */
export function DesignLayer({ level }: { level: Level }) {
  const design = useStore((s) => s.design);
  const grid = useMemo(() => buildGrid(level, design), [level, design]);
  // Hovering a hinged door in design mode shows where it opens.
  const hovered = useStore((s) => {
    if (s.mode !== 'design' || !s.hover) return null;
    const d = doorAt(s.design, s.hover[0], s.hover[1]);
    return d && TOOL_INFO[d.tool].hinged ? d.id : null;
  });

  const walls: [number, number][] = [];
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) if (getCell(grid, x, y) === 'wall') walls.push([x, y]);
  const fixedStations = stationsOf(level, EMPTY_DESIGN);
  const rails = design.items.filter((it) => it.tool === 'rail');
  const railAt = (x: number, y: number) => getCell(grid, x, y) === 'rail';

  return (
    <group>
      {fixedStations.map((st) => (
        <StationItem key={`fixed-${st.tile.join(',')}`} level={level} kind={st.kind} tile={st.tile} serve={st.serve} />
      ))}
      {design.items
        .filter((it) => TOOL_INFO[it.tool].station)
        .map((it) => (
          <DropIn key={it.id}>
            <StationItem level={level} kind={TOOL_INFO[it.tool].station!} tile={[it.x, it.y]} serve={serveTile(it)} />
          </DropIn>
        ))}
      {rails.map((it) => (
        <DropIn key={it.id}>
          <RailItem
            level={level}
            x={it.x}
            y={it.y}
            links={([[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]).filter(([dx, dy]) => railAt(it.x + dx, it.y + dy))}
          />
        </DropIn>
      ))}
      {walls.map(([x, y]) => (
        <DropIn key={`${x},${y}`}>
          <WallBlock position={tileToWorld(level, x, y)} />
        </DropIn>
      ))}
      {design.items
        .filter((it) => TOOL_INFO[it.tool].door)
        .map((it) => (
          <DropIn key={it.id}>
            <DoorItem level={level} item={it} strong={it.id === hovered} />
          </DropIn>
        ))}
      {design.items
        .filter((it) => TOOL_INFO[it.tool].sign)
        .map((it) => {
          const door = doorAt(design, it.x, it.y);
          return door ? <SignItem key={it.id} level={level} door={door} arrow={it.swing} /> : null;
        })}
    </group>
  );
}

function TileOutline({ level, x, y, color }: { level: Level; x: number; y: number; color: string }) {
  const [wx, , wz] = tileToWorld(level, x, y);
  return (
    <mesh position={[wx, 0.03, wz]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.6, 0.68, 4, 1, Math.PI / 4]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} />
    </mesh>
  );
}

/** Translucent preview of what a click would build, green if allowed and red if not. */
export function GhostLayer({ level }: { level: Level }) {
  const { hover, tool, orientIdx, design, slopeIdx, rampDir } = useStore();
  const t = useMemo(() => terrainOf(level, design), [level, design]);
  if (!hover) return null;
  const [x, y] = hover;

  if (tool === 'eraser') {
    const hit = eraseTarget(design, x, y);
    if (!hit) return <TileOutline level={level} x={x} y={y} color={COLORS.hover} />;
    // Everything that will go: red floor under the whole object (swing area, standing spot too), red shell over its body.
    return (
      <group>
        {objectTiles(hit).map(([tx, ty]) => {
          const [wx, , wz] = tileToWorld(level, tx, ty);
          return (
            <group key={`${tx},${ty}`}>
              <TileOutline level={level} x={tx} y={ty} color={COLORS.erase} />
              {/* Drawn after the door's swing arc (render order 2-3), so the swing area reads red too. */}
              <mesh position={[wx, 0.035 + surfaceY(t, tx, ty), wz]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
                <planeGeometry args={[0.96, 0.96]} />
                <meshBasicMaterial color={COLORS.erase} transparent opacity={0.55} depthWrite={false} />
              </mesh>
            </group>
          );
        })}
        {itemTiles(hit).map(([tx, ty]) => {
          const [wx, , wz] = tileToWorld(level, tx, ty);
          const h = hit.tool === 'wall' || TOOL_INFO[hit.tool].door ? WALL_H : TOOL_INFO[hit.tool].terrain ? surfaceY(t, tx, ty) + 0.25 : 0.9;
          return (
            <mesh key={`shell-${tx},${ty}`} position={[wx, h / 2, wz]}>
              <boxGeometry args={[1.06, h + 0.06, 1.06]} />
              <meshBasicMaterial color={COLORS.erase} transparent opacity={0.4} depthWrite={false} />
            </mesh>
          );
        })}
      </group>
    );
  }

  const ramp = tool === 'ramp' ? rampDraft({ design, slopeIdx, rampDir }, x, y) : undefined;
  const { draft, check, relevant } = resolveDraft(level, design, tool, x, y, orientIdx, ramp);
  if (!relevant) return null; // nothing to build here: no ghost, no red
  // Over a door that's already there, its own swing arc is the preview; a red ghost on top would hide it.
  if (TOOL_INFO[tool].door && doorAt(design, x, y)) return null;
  const ghost = check.ok ? 'ok' : 'bad';
  if (TOOL_INFO[tool].terrain || TOOL_INFO[tool].attach) {
    return (
      <group>
        {itemTiles(draft).map(([tx, ty]) => (
          <TileOutline key={`${tx},${ty}`} level={level} x={tx} y={ty} color={COLORS.hover} />
        ))}
        <TerrainGhost level={level} design={design} draft={draft} ghost={ghost} />
      </group>
    );
  }
  if (TOOL_INFO[tool].sign) {
    const door = doorAt(design, x, y);
    return door ? <SignItem level={level} door={door} arrow={draft.swing} ghost={ghost} /> : null;
  }
  return (
    <group>
      {itemTiles(draft).map(([tx, ty]) => (
        <TileOutline key={`${tx},${ty}`} level={level} x={tx} y={ty} color={COLORS.hover} />
      ))}
      {tool === 'wall' ? (
        <WallBlock position={tileToWorld(level, x, y)} ghost={ghost} />
      ) : tool === 'rail' ? (
        <RailItem level={level} x={x} y={y} links={[]} ghost={ghost} />
      ) : TOOL_INFO[tool].station ? (
        <StationItem level={level} kind={TOOL_INFO[tool].station!} tile={[draft.x, draft.y]} serve={serveTile(draft)} ghost={ghost} />
      ) : (
        <DoorItem level={level} item={draft} ghost={ghost} />
      )}
    </group>
  );
}

/**
 * Invisible floor that turns the mouse into tile actions.
 * Left click/drag builds (drag paints walls), right click erases, right/middle drag pans.
 */
export function InteractionPlane({ level }: { level: Level }) {
  const { w, h } = level.grid;
  const painting = useRef<null | 'build' | 'erase'>(null);
  const rightDown = useRef<{ x: number; y: number } | null>(null);

  // Releasing the mouse outside the canvas still ends a drag.
  useEffect(() => {
    const stop = () => (painting.current = null);
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, []);

  // Height of whatever stands on each tile (walls, doors, raised ground), cached per design.
  const heights = useRef<{ design: unknown; at: (x: number, y: number) => number } | null>(null);
  const heightAt = (x: number, y: number) => {
    const design = useStore.getState().design;
    if (heights.current?.design !== design) {
      const grid = buildGrid(level, design);
      const terrain = terrainOf(level, design);
      heights.current = {
        design,
        at: (tx, ty) => {
          const cell = getCell(grid, tx, ty);
          return Math.max(cell === 'wall' || cell === 'door' ? WALL_H : 0, surfaceY(terrain, tx, ty));
        },
      };
    }
    return heights.current.at(x, y);
  };

  /**
   * The tile under the mouse. The camera looks down at an angle, so the floor point behind a wall is not the
   * wall: walk down the ray from the top and take the first tile whose wall, door or ground reaches that height.
   * Clicking the top or face of a wall (or a door) then picks that wall tile, not the floor behind it.
   */
  const tileOf = (e: ThreeEvent<PointerEvent>): [number, number] | null => {
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
    const { origin, direction } = e.ray;
    if (direction.y < -1e-6) {
      for (let hy = WALL_H + 3; hy > 0.02; hy -= 0.05) {
        const t = (hy - origin.y) / direction.y;
        const x = Math.floor(origin.x + direction.x * t + w / 2);
        const y = Math.floor(origin.z + direction.z * t + h / 2);
        if (inside(x, y) && heightAt(x, y) >= hy) return [x, y];
      }
    }
    const x = Math.floor(e.point.x + w / 2);
    const y = Math.floor(e.point.z + h / 2);
    return inside(x, y) ? [x, y] : null;
  };

  const act = (mode: 'build' | 'erase', x: number, y: number) => {
    const s = useStore.getState();
    if (s.mode !== 'design') return;
    const before = s.design.items.length;
    if (mode === 'erase' || s.tool === 'eraser') s.eraseAt(x, y);
    else s.placeAt(x, y);
    const after = useStore.getState().design.items.length;
    if (after > before) sfx(s.tool !== 'eraser' && TOOL_INFO[s.tool].hinged ? 'creak' : 'place');
    else if (after < before) sfx('erase');
  };

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.001, 0]}
      onPointerMove={(e) => {
        const t = tileOf(e);
        const s = useStore.getState();
        if (s.mode !== 'design') return;
        const prev = s.hover;
        if (t?.[0] === prev?.[0] && t?.[1] === prev?.[1]) return;
        s.setHover(t);
        // Drag-paint walls, rails, ramps, handrails and erasing; doors, stations, stairs and landings are one per click.
        const paints = s.tool === 'wall' || s.tool === 'rail' || s.tool === 'ramp' || s.tool === 'handrail' || s.tool === 'eraser';
        if (t && painting.current && paints) act(painting.current, ...t);
      }}
      onPointerLeave={() => useStore.getState().setHover(null)}
      onPointerDown={(e) => {
        const t = tileOf(e);
        if (e.button === 2) rightDown.current = { x: e.clientX, y: e.clientY };
        if (e.button !== 0 || !t) return;
        painting.current = 'build';
        useStore.getState().startDrag();
        act('build', ...t);
      }}
      onPointerUp={(e) => {
        painting.current = null;
        const start = rightDown.current;
        rightDown.current = null;
        // A right click that didn't drag (pan) erases.
        if (e.button === 2 && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) {
          const t = tileOf(e);
          if (t) act('erase', ...t);
        }
      }}
    >
      <planeGeometry args={[w + 8, h + 8]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
