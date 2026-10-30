import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { buildGrid, doorAt, eraseTarget, itemTiles, objectTiles, serveTile, stationsOf, TOOL_INFO } from '../sim/design';
import { getCell } from '../sim/grid';
import { EMPTY_DESIGN } from '../sim/design';
import type { Level } from '../sim/types';
import { resolveDraft, useStore } from '../store';
import { sfx } from '../audio/sfx';
import { tileToWorld } from './coords';
import { DropIn } from './Feel';
import { DoorItem, RailItem, SignItem, StationItem, WALL_H, WallBlock } from './Items';
import { COLORS } from './palette';

/** Every wall tile (fixed + placed) and every placed door. */
export function DesignLayer({ level }: { level: Level }) {
  const design = useStore((s) => s.design);
  const grid = useMemo(() => buildGrid(level, design), [level, design]);

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
            <DoorItem level={level} item={it} />
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
  const { hover, tool, orientIdx, design } = useStore();
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
              <mesh position={[wx, 0.03, wz]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.96, 0.96]} />
                <meshBasicMaterial color={COLORS.erase} transparent opacity={0.35} depthWrite={false} />
              </mesh>
            </group>
          );
        })}
        {itemTiles(hit).map(([tx, ty]) => {
          const [wx, , wz] = tileToWorld(level, tx, ty);
          const h = hit.tool === 'wall' || TOOL_INFO[hit.tool].door ? WALL_H : 0.9;
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

  const { draft, check, relevant } = resolveDraft(level, design, tool, x, y, orientIdx);
  if (!relevant) return null; // nothing to build here: no ghost, no red
  const ghost = check.ok ? 'ok' : 'bad';
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

  const tileOf = (e: ThreeEvent<PointerEvent>): [number, number] | null => {
    const x = Math.floor(e.point.x + w / 2);
    const y = Math.floor(e.point.z + h / 2);
    return x >= 0 && y >= 0 && x < w && y < h ? [x, y] : null;
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
        // Drag-paint walls, rails and erasing; doors and stations are one per click.
        if (t && painting.current && (s.tool === 'wall' || s.tool === 'rail' || s.tool === 'eraser')) act(painting.current, ...t);
      }}
      onPointerLeave={() => useStore.getState().setHover(null)}
      onPointerDown={(e) => {
        const t = tileOf(e);
        if (e.button === 2) rightDown.current = { x: e.clientX, y: e.clientY };
        if (e.button !== 0 || !t) return;
        painting.current = 'build';
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
