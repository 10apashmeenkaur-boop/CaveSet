import { useEffect, useState } from 'react';
import {
  DEFAULT_RACK,
  gapCost,
  RACK_BASES,
  RACK_CUPS,
  RACK_GAPS,
  RACK_MATERIALS,
  RACK_NAMES,
  RACK_PRICES,
  type RackDesign,
} from '../sim/rack';
import { useStore } from '../store';
import { BASE_INFO, CUP_INFO, GAP_INFO, MATERIAL_INFO, PLATES_INFO, UNDER_INFO } from './rackText';
import { inr } from './Toolbar';

type Choice = { label: string; cost: number; on: boolean; pick: () => void };
type Part = { key: string; icon: string; title: string; current: string; cost: number; info: string; choices: Choice[] };

const CUP_LABEL = { none: 'On the base', solid: 'Solid cup', perforated: 'Perforated cup' } as const;
/** The parts in bar order (keys 1–6). */
const PART_KEYS = ['base', 'gap', 'material', 'plates', 'under', 'cup'];

/** The six parts of the rack, each with its choices, the current choice, its price and what it does. */
function partsOf(r: RackDesign, set: (c: Partial<RackDesign>) => void): Part[] {
  return [
    {
      key: 'base',
      icon: '🧺',
      title: 'Base surface',
      current: RACK_NAMES.base[r.base],
      cost: RACK_PRICES.base[r.base],
      info: BASE_INFO[r.base],
      choices: RACK_BASES.map((b) => ({ label: RACK_NAMES.base[b], cost: RACK_PRICES.base[b], on: r.base === b, pick: () => set({ base: b }) })),
    },
    {
      key: 'gap',
      icon: '↔️',
      title: 'Opening size',
      current: `${r.gap} mm`,
      cost: gapCost(r),
      info:
        r.base === 'tray'
          ? `A solid tray has no openings, so this costs nothing. It still sets how far apart plates stand in dividers (${r.gap} mm).`
          : GAP_INFO[r.gap],
      choices: RACK_GAPS.map((g) => ({
        label: `${g} mm`,
        cost: r.base === 'tray' ? 0 : RACK_PRICES.gap[g],
        on: r.gap === g,
        pick: () => set({ gap: g }),
      })),
    },
    {
      key: 'material',
      icon: '🔩',
      title: 'Frame material',
      current: RACK_NAMES.material[r.material],
      cost: RACK_PRICES.material[r.material],
      info: MATERIAL_INFO[r.material],
      choices: RACK_MATERIALS.map((m) => ({ label: RACK_NAMES.material[m], cost: RACK_PRICES.material[m], on: r.material === m, pick: () => set({ material: m }) })),
    },
    {
      key: 'plates',
      icon: '🍽️',
      title: 'Plates',
      current: r.dividers ? 'Upright' : 'Lying flat',
      cost: r.dividers ? RACK_PRICES.dividers : 0,
      info: r.dividers ? PLATES_INFO.upright : PLATES_INFO.flat,
      choices: [
        { label: 'Lying flat', cost: 0, on: !r.dividers, pick: () => set({ dividers: false }) },
        { label: 'Upright in dividers', cost: RACK_PRICES.dividers, on: r.dividers, pick: () => set({ dividers: true }) },
      ],
    },
    {
      key: 'under',
      icon: '💧',
      title: 'Under the rack',
      current: r.dripTray ? 'Drip tray' : 'Nothing',
      cost: r.dripTray ? RACK_PRICES.dripTray : 0,
      info: r.dripTray ? UNDER_INFO.tray : UNDER_INFO.none,
      choices: [
        { label: 'Nothing', cost: 0, on: !r.dripTray, pick: () => set({ dripTray: false }) },
        { label: 'Drip tray', cost: RACK_PRICES.dripTray, on: r.dripTray, pick: () => set({ dripTray: true }) },
      ],
    },
    {
      key: 'cup',
      icon: '🥄',
      title: 'Spoons',
      current: CUP_LABEL[r.cup],
      cost: RACK_PRICES.cup[r.cup],
      info: CUP_INFO[r.cup],
      choices: RACK_CUPS.map((c) => ({ label: CUP_LABEL[c], cost: RACK_PRICES.cup[c], on: r.cup === c, pick: () => set({ cup: c }) })),
    },
  ];
}

/**
 * The Utensil Rack's build bar, in the same place and style as every level's toolbar. Each button is one part of
 * the rack showing its current choice and price; clicking it opens that part's options just above the bar (one at a
 * time, click again or ✕ to close), with a plain line saying what the chosen option does.
 */
export function RackBar() {
  const r = useStore((s) => s.design.rack ?? DEFAULT_RACK);
  const setRack = useStore((s) => s.setRack);
  const clearDesign = useStore((s) => s.clearDesign);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const parts = partsOf(r, setRack);
  const open = parts.find((p) => p.key === openKey);
  const isDefault = JSON.stringify(r) === JSON.stringify(DEFAULT_RACK);

  // Keys 1–6 open a part; Esc closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') return setOpenKey(null);
      const n = Number(e.key);
      if (n >= 1 && n <= PART_KEYS.length) setOpenKey((k) => (k === PART_KEYS[n - 1] ? null : PART_KEYS[n - 1]));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="hud bottom-center">
      {open && (
        <div className="rack-drawer blueprint">
          <div className="rack-drawer-head">
            <span className="rack-drawer-title">
              {open.icon} {open.title}
            </span>
            <button className="results-close" onClick={() => setOpenKey(null)} aria-label="Close" title="Close (Esc)">
              ✕
            </button>
          </div>
          <div className="rack-drawer-choices" role="radiogroup" aria-label={open.title}>
            {open.choices.map((c) => (
              <button key={c.label} role="radio" aria-checked={c.on} className={`choice ${c.on ? 'on' : ''}`} onClick={c.pick}>
                <span>{c.label}</span>
                <span className="choice-cost">{inr(c.cost)}</span>
              </button>
            ))}
          </div>
          <p className="part-info">{open.info}</p>
        </div>
      )}

      <div className="toolbar blueprint">
        {parts.map((p, i) => (
          <button
            key={p.key}
            className={`tool rack-tool ${openKey === p.key ? 'active' : ''}`}
            onClick={() => setOpenKey(openKey === p.key ? null : p.key)}
            title={`${p.title}: click to see the options (shortcut: ${i + 1})`}
          >
            <span className="tool-icon">{p.icon}</span>
            <span className="rack-tool-part">{p.title}</span>
            <span className="tool-name">{p.current}</span>
            <span className="tool-cost">{inr(p.cost)}</span>
          </button>
        ))}
        <div className="tool-side grid">
          <button className="btn ghost small" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            ↶ Undo
          </button>
          <button className="btn ghost small" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
            ↷ Redo
          </button>
          <button className="btn ghost small span-2" onClick={clearDesign} disabled={isDefault}>
            Reset rack
          </button>
        </div>
      </div>
      <div className="controls-hint">Click a part to see its options · 1–6: parts · Ctrl+Z: undo · right drag: pan · scroll: zoom</div>
    </div>
  );
}
