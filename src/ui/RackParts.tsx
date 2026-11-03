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
import { BASE_INFO, CUP_INFO, GAP_INFO, MATERIAL_INFO, PLATES_INFO, UNDER_INFO } from './rackText';
import { inr } from './Toolbar';

type Choice<T> = { value: T; label: string; cost?: number };

/** One part of the rack: a row of choices, and a line saying what the chosen one does. */
function Part<T>({
  n,
  title,
  choices,
  value,
  onPick,
  info,
}: {
  n: number;
  title: string;
  choices: Choice<T>[];
  value: T;
  onPick: (v: T) => void;
  info: string;
}) {
  return (
    <div className="part">
      <div className="part-title">
        <span className="part-n">{n}</span> {title}
      </div>
      <div className="part-choices" role="radiogroup" aria-label={title}>
        {choices.map((c) => (
          <button
            key={String(c.value)}
            role="radio"
            aria-checked={c.value === value}
            className={`choice ${c.value === value ? 'on' : ''}`}
            onClick={() => onPick(c.value)}
          >
            <span>{c.label}</span>
            {c.cost !== undefined && <span className="choice-cost">{c.cost ? inr(c.cost) : 'free'}</span>}
          </button>
        ))}
      </div>
      <p className="part-info">{info}</p>
    </div>
  );
}

/**
 * The Utensil Rack's build panel: every option visible at once, grouped by part, each with a plain line saying what
 * it does. Replaces the cycling toolbar so nothing is hidden behind clicks.
 */
export function RackParts() {
  const r = useStore((s) => s.design.rack ?? DEFAULT_RACK);
  const setRack = useStore((s) => s.setRack);
  const clearDesign = useStore((s) => s.clearDesign);
  const undo = useStore((s) => s.undo);
  const canUndo = useStore((s) => s.past.length > 0);
  const set = (c: Partial<RackDesign>) => setRack(c);
  const isDefault = JSON.stringify(r) === JSON.stringify(DEFAULT_RACK);

  return (
    <div className="rack-parts">
      <div className="rack-parts-head">
        <h3>Build your rack</h3>
        <span className="rack-parts-actions">
          <button className="btn ghost small" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            ↶ Undo
          </button>
          <button className="btn ghost small" onClick={clearDesign} disabled={isDefault}>
            Reset
          </button>
        </span>
      </div>

      <Part
        n={1}
        title="Base surface"
        value={r.base}
        onPick={(base) => set({ base })}
        choices={RACK_BASES.map((b) => ({ value: b, label: RACK_NAMES.base[b], cost: RACK_PRICES.base[b] }))}
        info={BASE_INFO[r.base]}
      />
      <Part
        n={2}
        title="Opening size"
        value={r.gap}
        onPick={(gap) => set({ gap })}
        choices={RACK_GAPS.map((g) => ({ value: g, label: `${g} mm` }))}
        info={
          r.base === 'tray'
            ? `A solid tray has no openings. This size still sets how far apart plates stand in dividers (${r.gap} mm).`
            : GAP_INFO[r.gap]
        }
      />
      <Part
        n={3}
        title="Frame material"
        value={r.material}
        onPick={(material) => set({ material })}
        choices={RACK_MATERIALS.map((m) => ({ value: m, label: RACK_NAMES.material[m] }))}
        info={MATERIAL_INFO[r.material]}
      />
      <Part
        n={4}
        title="Plates"
        value={r.dividers}
        onPick={(dividers) => set({ dividers })}
        choices={[
          { value: false, label: 'Lying flat', cost: 0 },
          { value: true, label: 'Upright in dividers', cost: RACK_PRICES.dividers },
        ]}
        info={r.dividers ? PLATES_INFO.upright : PLATES_INFO.flat}
      />
      <Part
        n={5}
        title="Under the rack"
        value={r.dripTray}
        onPick={(dripTray) => set({ dripTray })}
        choices={[
          { value: false, label: 'Nothing', cost: 0 },
          { value: true, label: 'Drip tray', cost: RACK_PRICES.dripTray },
        ]}
        info={r.dripTray ? UNDER_INFO.tray : UNDER_INFO.none}
      />
      <Part
        n={6}
        title="Spoons"
        value={r.cup}
        onPick={(cup) => set({ cup })}
        choices={RACK_CUPS.map((c) => ({
          value: c,
          label: c === 'none' ? 'On the base' : c === 'solid' ? 'Solid cup' : 'Perforated cup',
          cost: RACK_PRICES.cup[c],
        }))}
        info={CUP_INFO[r.cup]}
      />
    </div>
  );
}
