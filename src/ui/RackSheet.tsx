import { DEFAULT_RACK, rackSheet } from '../sim/rack';
import type { Level } from '../sim/types';
import { useStore } from '../store';

function Bar({ value }: { value: number }) {
  return (
    <span className="sheet-bar" aria-hidden>
      <span style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </span>
  );
}

/**
 * The Utensil Rack's design sheet: the real numbers behind the parts you picked (open area, plate surface in the
 * air, frame material, wet load, where the water goes). It states facts about the design; the run shows what they do.
 */
export function RackSheetCard({ level }: { level: Level }) {
  const rack = useStore((s) => s.design.rack ?? DEFAULT_RACK);
  const s = rackSheet(level, rack);
  const m = s.material;
  return (
    <section className="sheet blueprint" aria-label="Design sheet">
      <h3>Design sheet</h3>
      <dl>
        <dt>Surface</dt>
        <dd>
          {s.surface} · {s.opening}
          <span className="sheet-sub">
            Open area {Math.round(s.openArea * 100)}% <Bar value={s.openArea} />
          </span>
        </dd>

        <dt>Plates</dt>
        <dd>
          {s.plates}
          <span className="sheet-sub">
            {s.plateAirM2.toFixed(2)} of {s.plateTotalM2.toFixed(2)} m² in the air <Bar value={s.plateAirM2 / s.plateTotalM2} />
          </span>
        </dd>

        <dt>Frame</dt>
        <dd>
          {m.label} · {m.form}
          <span className="sheet-sub">
            Stiffness {m.frameStiffness} · Rust resistance {m.rustResistance}
          </span>
          <span className="sheet-sub muted">
            E = {m.modulusGPa} GPa · {m.densityGcm3} g/cm³
          </span>
        </dd>

        <dt>Wet load</dt>
        <dd>≈ {s.wetLoadKg.toFixed(1)} kg</dd>

        <dt>Water</dt>
        <dd>{s.waterPath}</dd>
      </dl>
    </section>
  );
}
