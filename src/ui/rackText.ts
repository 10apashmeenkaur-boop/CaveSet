import type { RackBase, RackCup, RackGap, RackMaterial } from '../sim/rack';

/**
 * Plain-English facts for every choice on the Utensil Rack. Each line says what the part is and what it does
 * physically, so players learn while they build. Facts, not verdicts: the run shows the consequences.
 */
export const BASE_INFO: Record<RackBase, string> = {
  tray: 'A flat sheet with no holes. Water running off the dishes collects on it.',
  perforated: 'A metal sheet punched with round holes. Part of the surface is open, so some water and air pass through.',
  mesh: 'Crossed wires with square gaps. Most of the surface is open, so water drops through and air rises from below.',
};

export const GAP_INFO: Record<RackGap, string> = {
  5: 'Very small openings. Water can bridge holes this small (surface tension), so some stays on top. Plates in dividers almost touch.',
  10: 'Small openings. Water passes; small items stay on top. Plates in dividers sit 10 mm apart.',
  20: 'Medium openings. Water and air pass easily. Anything narrower than 20 mm can slip through. Plates sit 20 mm apart.',
  35: 'Large openings. The most water and air pass through. Anything narrower than 35 mm can slip through. Plates sit 35 mm apart.',
};

export const MATERIAL_INFO: Record<RackMaterial, string> = {
  plastic: 'Polypropylene, moulded with thick ribs. Light and never rusts; the thick shape keeps it fairly stiff.',
  aluminium: 'A light metal that does not rust. Bent into thin wire, it is the least stiff frame here.',
  stainless: 'Steel with chromium added. Stiff, and does not rust even when it stays wet.',
  mildSteel: 'Plain carbon steel with paint. Stiff and cheap, but bare steel rusts when water sits on it.',
};

export const PLATES_INFO = {
  flat: 'Plates lie in piles. Only the top plate of each pile meets the air, and water is trapped between plates.',
  upright: 'Plates stand on edge between divider rods. Both faces are in moving air, and water runs off the bottom edge.',
};

export const UNDER_INFO = {
  none: 'Nothing under the rack. Water that gets through the base lands on the counter.',
  tray: 'A shallow tray under the rack catches the water that gets through the base.',
};

export const CUP_INFO: Record<RackCup, string> = {
  none: 'Spoons lie on the base with the other dishes.',
  solid: 'A closed cup holds the spoons upright. Water running off them collects at the bottom of the cup.',
  perforated: 'A cup with holes holds the spoons upright. Water runs out through the bottom.',
};

/** The Dictionary: technical words used on this level, in plain English. */
export const GLOSSARY: { term: string; meaning: string }[] = [
  { term: 'Open area', meaning: 'The share of a surface that is holes. 75% open means three quarters of it lets water and air through.' },
  { term: 'Perforated', meaning: 'Punched with a pattern of holes. A perforated sheet is solid metal with round holes in it.' },
  { term: 'Mesh', meaning: 'A surface made of crossed wires with gaps between them. Usually far more open than a perforated sheet.' },
  { term: 'Opening size (aperture)', meaning: 'The width of one hole or gap, in mm. It decides what can pass through.' },
  { term: 'Surface tension', meaning: 'Water clings to itself like a thin skin. It can stretch across very small holes instead of dripping through.' },
  { term: 'Drainage', meaning: 'Water running off and away under gravity. It removes the drips, but leaves a thin film behind.' },
  { term: 'Evaporation', meaning: 'Water turning into vapour and leaving into the air. It removes the last thin film, and it is how things actually get dry.' },
  { term: 'Airflow', meaning: 'Moving air around a surface. More airflow carries vapour away, so evaporation is faster.' },
  { term: 'Surface area', meaning: 'How much surface is exposed, in m². Evaporation happens at surfaces, so more exposed area dries faster.' },
  { term: 'Pooling', meaning: 'Water collecting in a puddle because it has no way down. Anything standing in it stays wet.' },
  { term: 'Drip tray', meaning: 'A tray under a rack that catches water draining through, so it does not reach the counter.' },
  { term: 'Load', meaning: 'The weight a structure has to carry. A wet load includes the water on the dishes.' },
  { term: 'Stiffness', meaning: 'How much a part resists bending. It depends on the material and on its shape (thick ribs vs thin wire).' },
  { term: "Young's modulus (E)", meaning: 'How stiff a material is, in GPa. Steel is about 200, aluminium 69, polypropylene about 1.5.' },
  { term: 'Sag (deflection)', meaning: 'How far a part bends down under load. Too much sag and the rack tilts, spills or breaks.' },
  { term: 'Corrosion (rust)', meaning: 'Metal slowly eaten away by water and air. Plain steel rusts; stainless steel and aluminium resist it.' },
  { term: 'Density', meaning: 'Mass per volume, in g/cm³. It tells you how heavy a material is for its size.' },
];

/** What happens in each experiment: things worth trying to see a principle clearly. */
export const EXPERIMENTS: string[] = [
  'Run the solid tray, then the same rack with wire mesh. Watch where the water goes.',
  'Keep everything the same and switch plates from flat to upright. Compare how many dry.',
  'Try each opening size from 5 mm to 35 mm. Watch the base and the spoons.',
  'Run with and without the drip tray. Check the counter reading.',
  'Try each frame material and look at the frame after the run.',
];
