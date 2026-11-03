import {
  RACK_ALUMINIUM_LIMIT_G,
  RACK_COUNTER_INCIDENT_ML,
  RACK_CUP_POOL_WETS_ML,
  RACK_CUP_POOL_INCIDENT_ML,
  RACK_DRAIN_PER_MIN,
  RACK_DRY_ML,
  RACK_EVAP_ML_PER_MIN,
  RACK_FILM_ML,
  RACK_OPEN_AREA,
  RACK_PASS_THROUGH,
  RACK_PLATE_SPACING,
  RACK_POOL_EVAP_ML_PER_MIN,
  RACK_CUP_POOL_EVAP_ML_PER_MIN,
  RACK_POOL_INCIDENT_ML,
  RACK_POOL_WETS_ML,
  RACK_SEC_PER_TICK,
  RACK_SPOON_FALL_MM,
  RACK_WATER_ML,
  RACK_WEIGHT_G,
  RACK_MATERIAL_DATA,
  RACK_PLATE_FACE_M2,
  RACK_PLATE_PILES,
} from './constants';
import { PRINCIPLES, type Incident, type IncidentCode } from './failures';
import type { Level } from './types';

/**
 * The Utensil Rack: a deterministic drying model. Each tick water runs off every utensil down to the base; what
 * the base lets through lands in the drip tray (or on the counter); what it doesn't, pools. The film left behind
 * dries by evaporation, faster with more air moving around it. Anything sitting in standing water stays wet.
 */

export type RackBase = 'tray' | 'perforated' | 'mesh';
export type RackGap = 5 | 10 | 20 | 35;
export type RackMaterial = 'plastic' | 'aluminium' | 'stainless' | 'mildSteel';
export type RackCup = 'none' | 'solid' | 'perforated';

/** What the player chose. Gap = the size of the base's openings and the space between plate dividers. */
export type RackDesign = { base: RackBase; gap: RackGap; material: RackMaterial; dividers: boolean; dripTray: boolean; cup: RackCup };

export const DEFAULT_RACK: RackDesign = { base: 'tray', gap: 10, material: 'plastic', dividers: false, dripTray: false, cup: 'none' };

export const RACK_BASES: RackBase[] = ['tray', 'perforated', 'mesh'];
export const RACK_GAPS: RackGap[] = [5, 10, 20, 35];
export const RACK_MATERIALS: RackMaterial[] = ['plastic', 'aluminium', 'stainless', 'mildSteel'];
export const RACK_CUPS: RackCup[] = ['none', 'solid', 'perforated'];

export const RACK_NAMES = {
  base: { tray: 'Solid tray', perforated: 'Perforated sheet', mesh: 'Wire mesh' },
  material: { plastic: 'Plastic', aluminium: 'Aluminium', stainless: 'Stainless steel', mildSteel: 'Mild steel' },
  cup: { none: 'No cutlery cup', solid: 'Solid cutlery cup', perforated: 'Perforated cutlery cup' },
} as const;

export const RACK_PRICES = {
  base: { tray: 300, perforated: 600, mesh: 500 },
  dividers: 200,
  dripTray: 200,
  cup: { none: 0, solid: 100, perforated: 150 },
} as const;

export function rackCost(r: RackDesign): number {
  return RACK_PRICES.base[r.base] + (r.dividers ? RACK_PRICES.dividers : 0) + (r.dripTray ? RACK_PRICES.dripTray : 0) + RACK_PRICES.cup[r.cup];
}

export type UtensilKind = 'plate' | 'bowl' | 'spoon';
/** divider: a plate standing up between dividers. stack: plates lying in a pile. bowl: upside down on the base. cup / base: a spoon. */
export type Place = 'divider' | 'stack' | 'bowl' | 'cup' | 'base';
export type Utensil = { kind: UtensilKind; place: Place; water: number; fallen: boolean };

export type RackState = {
  items: Utensil[];
  /** Standing water (mL): on the base, in the cutlery cup, in the drip tray, on the counter. */
  pool: number;
  cupPool: number;
  tray: number;
  counter: number;
};

const placeOf = (kind: UtensilKind, r: RackDesign): Place =>
  kind === 'plate' ? (r.dividers ? 'divider' : 'stack') : kind === 'bowl' ? 'bowl' : r.cup === 'none' ? 'base' : 'cup';

export function initRack(level: Level, r: RackDesign): RackState {
  const counts = level.rack!;
  const items: Utensil[] = [];
  for (const kind of ['plate', 'bowl', 'spoon'] as const) {
    const n = kind === 'plate' ? counts.plates : kind === 'bowl' ? counts.bowls : counts.spoons;
    for (let i = 0; i < n; i++) items.push({ kind, place: placeOf(kind, r), water: RACK_WATER_ML[kind], fallen: false });
  }
  return { items, pool: 0, cupPool: 0, tray: 0, counter: 0 };
}

export const isDry = (u: Utensil) => !u.fallen && u.water <= RACK_DRY_ML;

/** How freely air reaches a utensil (0..1): open bases let air up from below; spaced plates let it in between. */
function airflow(u: Utensil, r: RackDesign): number {
  const open = RACK_OPEN_AREA[r.base][r.gap];
  switch (u.place) {
    case 'divider':
      return (0.35 + 0.65 * RACK_PLATE_SPACING[r.gap]) * (0.7 + 0.3 * open);
    case 'stack':
      return 0.12;
    case 'bowl':
      return 0.8 * (0.4 + 0.6 * open);
    case 'cup':
      return 0.75 * (0.7 + 0.3 * open);
    case 'base':
      return 0.7 * (0.4 + 0.6 * open);
  }
}

/** Advance one tick (RACK_SEC_PER_TICK game seconds). Pure. */
export function stepRack(r: RackDesign, prev: RackState, tick: number): RackState {
  const dt = RACK_SEC_PER_TICK / 60;
  const s: RackState = { ...prev, items: prev.items.map((u) => ({ ...u })) };
  const below = (ml: number) => (r.dripTray ? (s.tray += ml) : (s.counter += ml));

  // Spoons lying on a base with wide openings slip straight through on the first tick.
  if (tick === 1 && r.base !== 'tray' && r.gap >= RACK_SPOON_FALL_MM) {
    for (const u of s.items) {
      if (u.place !== 'base') continue;
      u.fallen = true;
      below(u.water);
      u.water = 0;
    }
  }

  let toBase = 0;
  for (const u of s.items) {
    if (u.fallen) continue;
    const film = RACK_FILM_ML[u.place];
    const drained = Math.max(0, u.water - film) * Math.min(1, RACK_DRAIN_PER_MIN[u.place] * dt);
    u.water -= drained;
    if (u.place === 'cup' && r.cup === 'solid') s.cupPool += drained;
    else toBase += drained;
    const soaking = u.place === 'cup' ? r.cup === 'solid' && s.cupPool > RACK_CUP_POOL_WETS_ML : prev.pool > RACK_POOL_WETS_ML;
    // In standing water the film can't dry: it keeps wicking back up.
    u.water = soaking ? Math.max(u.water, film) : Math.max(0, u.water - RACK_EVAP_ML_PER_MIN * airflow(u, r) * dt);
  }
  const through = toBase * RACK_PASS_THROUGH[r.base][r.gap];
  below(through);
  s.pool = Math.max(0, s.pool + toBase - through - RACK_POOL_EVAP_ML_PER_MIN * dt);
  s.cupPool = Math.max(0, s.cupPool - RACK_CUP_POOL_EVAP_ML_PER_MIN * dt);
  return s;
}

/** Total weight on the rack while wet (g). */
export function wetLoad(s: RackState): number {
  return s.items.filter((u) => !u.fallen).reduce((g, u) => g + RACK_WEIGHT_G[u.kind] + u.water, 0) + s.pool;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function incident(code: IncidentCode, tick: number, title: string, evidence: string, count = 1): Incident {
  const { principle, hint } = PRINCIPLES[code];
  return { code, tick, tiles: [], agents: [], count, title, evidence, principle, hint };
}

/** Update the rack's incident cards after a tick. `ended`: the run is over, so do the one-month-later check too. */
export function rackIncidents(prev: Incident[], r: RackDesign, s: RackState, tick: number, timeUp: boolean, ended: boolean, limitMin: number): Incident[] {
  const list = prev.map((i) => ({ ...i }));
  const has = (code: IncidentCode) => list.find((i) => i.code === code);
  const set = (inc: Incident) => {
    const old = has(inc.code);
    if (old) Object.assign(old, { title: inc.title, evidence: inc.evidence, count: inc.count });
    else list.push(inc);
  };

  const fallen = s.items.filter((u) => u.fallen).length;
  if (fallen && !has('FELL_THROUGH')) {
    set(incident('FELL_THROUGH', tick, 'Spoons fell through the rack', `${plural(fallen, 'spoon')} slipped through the ${r.gap} mm openings in the ${RACK_NAMES.base[r.base].toLowerCase()}.`, fallen));
  }
  if (s.pool > RACK_POOL_INCIDENT_ML) {
    set(incident('WATER_POOLING', has('WATER_POOLING')?.tick ?? tick, 'Water pooled under the dishes', `${Math.round(s.pool)} mL of water is standing on the ${RACK_NAMES.base[r.base].toLowerCase()}, and everything sitting in it stays wet.`));
  } else if (s.cupPool > RACK_CUP_POOL_INCIDENT_ML) {
    set(incident('WATER_POOLING', has('WATER_POOLING')?.tick ?? tick, 'Water pooled in the cutlery cup', `${Math.round(s.cupPool)} mL of water collected in the bottom of the solid cup, around the spoons.`));
  }
  if (s.counter > RACK_COUNTER_INCIDENT_ML) {
    set(incident('COUNTER_WET', has('COUNTER_WET')?.tick ?? tick, 'Water ran onto the counter', `${Math.round(s.counter)} mL of water dripped out under the rack and across the counter.`));
  }
  if (r.material === 'aluminium' && !has('FRAME_SAG') && wetLoad(s) > RACK_ALUMINIUM_LIMIT_G) {
    set(incident('FRAME_SAG', tick, 'The frame bent', `The thin aluminium frame sagged under ${(wetLoad(s) / 1000).toFixed(1)} kg of wet dishes.`));
  }
  if (timeUp && !has('STILL_WET')) {
    const wet = s.items.filter((u) => !u.fallen && !isDry(u));
    const by = (k: string) => wet.filter((u) => u.kind === k).length;
    const parts = [['plate', by('plate')], ['bowl', by('bowl')], ['spoon', by('spoon')]].filter(([, n]) => n) as [string, number][];
    set(incident('STILL_WET', tick, 'Still wet after half an hour', `After ${limitMin} minutes ${parts.map(([k, n]) => plural(n, k)).join(', ')} ${wet.length === 1 ? 'was' : 'were'} still wet.`, wet.length));
  }
  if (ended && r.material === 'mildSteel' && !has('RUSTED')) {
    set(incident('RUSTED', tick, 'One month later: rust', 'Checked a month later: the mild steel frame has rusted where water sat on it, and stains the plates.'));
  }
  return list;
}

/** The numbers an engineer would look at while choosing parts. Facts about the design, not verdicts. */
export type RackSheet = {
  /** Share of the base that is openings (0..1). */
  openArea: number;
  surface: string;
  opening: string;
  /** How the plates sit, and how much plate surface is open to the air (m²). */
  plates: string;
  plateAirM2: number;
  plateTotalM2: number;
  material: (typeof RACK_MATERIAL_DATA)[RackMaterial];
  /** Everything in the rack, wet, straight out of the wash (kg). */
  wetLoadKg: number;
  /** Where water goes once it leaves the utensils. */
  waterPath: string;
};

export function rackSheet(level: Level, r: RackDesign): RackSheet {
  const counts = level.rack!;
  const openArea = RACK_OPEN_AREA[r.base][r.gap];
  const plateTotalM2 = counts.plates * 2 * RACK_PLATE_FACE_M2;
  const plateAirM2 = r.dividers ? plateTotalM2 : Math.min(counts.plates, RACK_PLATE_PILES) * RACK_PLATE_FACE_M2;
  const wetG =
    counts.plates * (RACK_WEIGHT_G.plate + RACK_WATER_ML.plate) +
    counts.bowls * (RACK_WEIGHT_G.bowl + RACK_WATER_ML.bowl) +
    counts.spoons * (RACK_WEIGHT_G.spoon + RACK_WATER_ML.spoon);
  const below = r.dripTray ? 'drip tray' : 'counter';
  return {
    openArea,
    surface: RACK_NAMES.base[r.base],
    opening: r.base === 'tray' ? 'No openings' : `${r.gap} mm openings`,
    plates: r.dividers ? `Upright, ${r.gap} mm apart` : `Flat, in ${Math.min(counts.plates, RACK_PLATE_PILES)} piles`,
    plateAirM2,
    plateTotalM2,
    material: RACK_MATERIAL_DATA[r.material],
    wetLoadKg: wetG / 1000,
    waterPath: r.base === 'tray' ? 'Utensils → base (no way down)' : `Utensils → base → ${below}`,
  };
}
