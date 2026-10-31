import { useEffect } from 'react';
import {
  DEFAULT_RACK,
  RACK_BASES,
  RACK_CUPS,
  RACK_GAPS,
  RACK_MATERIALS,
  RACK_NAMES,
  RACK_PRICES,
  type RackDesign,
} from '../sim/rack';
import { useStore } from '../store';
import { inr } from './Toolbar';

const next = <T,>(list: readonly T[], v: T) => list[(list.indexOf(v) + 1) % list.length];

type Part = { key: string; icon: string; name: string; cost: string; on?: boolean; click: (r: RackDesign) => Partial<RackDesign>; title: string };

/** The rack's parts, as toolbar buttons: click one to change it (choices cycle; extras switch on and off). */
function parts(r: RackDesign): Part[] {
  return [
    { key: 'base', icon: '🧺', name: RACK_NAMES.base[r.base], cost: inr(RACK_PRICES.base[r.base]), click: () => ({ base: next(RACK_BASES, r.base) }), title: 'Base: click to change' },
    { key: 'gap', icon: '↔️', name: `Gap ${r.gap} mm`, cost: 'no cost', click: () => ({ gap: next(RACK_GAPS, r.gap) }), title: 'Size of the openings and the space between plates: click to change' },
    { key: 'material', icon: '🔩', name: RACK_NAMES.material[r.material], cost: 'no cost', click: () => ({ material: next(RACK_MATERIALS, r.material) }), title: 'Frame material: click to change' },
    { key: 'dividers', icon: '🍽️', name: 'Plate dividers', cost: inr(RACK_PRICES.dividers), on: r.dividers, click: () => ({ dividers: !r.dividers }), title: 'Click to add or remove' },
    { key: 'dripTray', icon: '💧', name: 'Drip tray', cost: inr(RACK_PRICES.dripTray), on: r.dripTray, click: () => ({ dripTray: !r.dripTray }), title: 'Click to add or remove' },
    {
      key: 'cup',
      icon: '🥄',
      name: r.cup === 'none' ? 'Cutlery cup' : RACK_NAMES.cup[r.cup],
      cost: r.cup === 'none' ? 'none' : inr(RACK_PRICES.cup[r.cup]),
      on: r.cup !== 'none',
      click: () => ({ cup: next(RACK_CUPS, r.cup) }),
      title: 'Cutlery cup: none, solid or perforated. Click to change',
    },
  ];
}

/** The toolbar on the Utensil Rack level: the same labelled buttons with prices, one per part of the rack. */
export function RackToolbar() {
  const rack = useStore((s) => s.design.rack ?? DEFAULT_RACK);
  const setRack = useStore((s) => s.setRack);
  const clearDesign = useStore((s) => s.clearDesign);
  const list = parts(rack);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      const s = useStore.getState();
      if (n >= 1 && n <= list.length && s.mode === 'design') s.setRack(parts(s.design.rack ?? DEFAULT_RACK)[n - 1].click(s.design.rack ?? DEFAULT_RACK));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list.length]);

  const isDefault = JSON.stringify(rack) === JSON.stringify(DEFAULT_RACK);
  return (
    <div className="hud bottom-center">
      <div className="toolbar blueprint">
        {list.map((p, i) => (
          <button key={p.key} className={`tool ${p.on ? 'active' : ''}`} onClick={() => setRack(p.click(rack))} title={`${p.title} (shortcut: ${i + 1})`}>
            <span className="tool-icon">{p.icon}</span>
            <span className="tool-name">{p.name}</span>
            <span className="tool-cost">{p.cost}</span>
          </button>
        ))}
        <div className="tool-side">
          <button className="btn ghost small" onClick={clearDesign} disabled={isDefault}>
            Clear all
          </button>
        </div>
      </div>
      <div className="controls-hint">Click a part to change it · 1–6: shortcuts · right drag: pan · scroll: zoom</div>
    </div>
  );
}
