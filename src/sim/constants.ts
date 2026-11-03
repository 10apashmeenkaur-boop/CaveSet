/**
 * Every number the simulation runs on, in one place.
 *
 * Part 1 is the real-world scale (ROADMAP.md §2). Values are approximate, from Indian NBC, the Harmonised
 * Accessibility Guidelines and pedestrian-flow research; in-game they're labelled "approximate real-world values".
 * Part 2 is game tuning: how patient people are, how routes are scored, when detectors fire.
 */

// ─── 1. Real-world scale ────────────────────────────────────────────────────────────────

/** One grid tile in metres: about one person's shoulder width plus clearance. */
export const TILE_M = 0.6;

const mps = (metresPerSecond: number) => metresPerSecond / TILE_M; // → tiles per second

/** Person, empty-handed: shoulder width ~0.45–0.5 m fits one tile. */
export const PERSON_TILES = 1;
/** Crate carrier: person + crate held in front ~0.9 m needs margin, so 2 tiles (1.2 m). */
export const CRATE_CARRIER_TILES = 2;
/** Wheelchair: ~0.7 m chair + elbows, 2 tiles wide; needs a 3×3 tile area (~1.5 m circle) to turn. */
export const WHEELCHAIR_TILES = 2;
export const WHEELCHAIR_TURN_TILES = 3;

/** Single hinged door: 1 tile = 0.6 m. Too narrow on purpose; real accessible doors are ~0.9 m clear. */
export const SINGLE_DOOR_TILES = 1;
/** Double door / wide slider: 2 tiles = 1.2 m, comfortable for loads and for passing. */
export const DOUBLE_DOOR_TILES = 2;
/** Comfortable public corridor: ~1.2–1.5 m in Indian accessibility guidelines, so 2 tiles. */
export const CORRIDOR_TILES = 2;

/** Typical adult walking speed ~1.2–1.4 m/s. */
export const WALK_SPEED = mps(1.2);
/** Loaded walking (crate held in front) is slower: ~0.8 m/s. */
export const CRATE_SPEED = mps(0.8);
/** Carrying a tray of hot food, walking carefully: ~0.95 m/s (game estimate between loaded and free walking). */
export const TRAY_SPEED = mps(0.95);
/** Elderly walking speed: ~0.65 m/s. */
export const ELDERLY_SPEED = mps(0.65);
/** Wheelchair on the flat: ~0.9 m/s (slower on slopes). */
export const WHEELCHAIR_SPEED = mps(0.9);

/** Doorway flow capacity: ~1.3 people per second per metre of clear width (SFPE / Fruin). */
export const DOOR_FLOW_PER_M = 1.3;
/** Steepest ramp a wheelchair user can manage: 1:12 (8.3%), so 1 m of rise needs 12 m of ramp. */
export const RAMP_MAX_SLOPE = 1 / 12;
/** Rest landing at least every ~9 m of ramp. */
export const RAMP_LANDING_EVERY_M = 9;
/** Public stairs: riser ≤ 15 cm, tread ≥ 30 cm; steeper means falls and slow elderly. */
export const STAIR_MAX_RISER_M = 0.15;
export const STAIR_MIN_TREAD_M = 0.3;
/** Comfortable standing-work counter height ~85–90 cm. */
export const COUNTER_HEIGHT_M = 0.88;

/** Langar line service times (seconds per person, one person per unit at a time). Game estimates from watching seva. */
export const SERVICE_SEC = {
  /** Take shoes off, hand them over, get a token: ~4 s. */
  shoe: 4,
  /** Wash hands properly at one tap: ~6 s. */
  tap: 6,
  /** Pick a head cover from the basket and tie it: ~2 s. */
  basket: 2,
} as const;

// ─── 2. Game tuning ─────────────────────────────────────────────────────────────────────

/** Fixed simulation timestep. */
export const TICKS_PER_SEC = 10;

/** Waiting this long: look for another route around whoever is in the way. */
export const REPATH_TICKS = 15;
/**
 * A head-on stand-off this long gets resolved: two empty-handed people squeeze past each other;
 * if a crate is involved one carrier backs out of the way instead.
 */
export const SQUEEZE_TICKS = 35;
/** Two visitors going the same way in a langar line shuffle past each other much sooner. */
export const LINE_SQUEEZE_TICKS = 10;
/** Waiting this long: step aside to let the other person through (and every SIDESTEP_EVERY after). */
export const SIDESTEP_TICKS = 40;
export const SIDESTEP_EVERY = 20;
/** Waiting this long counts as stuck (but keeps trying). */
export const STUCK_TICKS = 60;
/** How long someone who backed off waits before trying again. */
export const YIELD_HOLD_TICKS = 20;
/** If the one who should back off is boxed in this long after the stand-off, the other one tries. */
export const YIELD_FALLBACK_TICKS = SQUEEZE_TICKS + 20;
/** How far (in steps) someone searches for a spot to back off to, and how much of the other's route they keep clear of. */
export const BACKOFF_SEARCH_STEPS = 6;
export const BACKOFF_CLEAR_STEPS = 8;

/** Walking through people eating is allowed but avoided: each dining tile costs this many steps. */
export const DINING_COST = 2;
/** Extra route cost for a tile someone is standing on: worth a few steps' detour, not a wall. */
export const OCCUPIED_COST = 4;
/** Extra cost per unit of recent waiting on a tile, capped so a busy door is avoided but never forbidden. */
export const RECENT_WEIGHT = 0.5;
export const RECENT_CAP = 8;
/** Per tick, recent waiting fades by this factor (about a 2 s half-life). */
export const RECENT_DECAY = 0.97;
/** How long (ticks) diners keep complaining about someone walking through. */
export const DISTURBANCE_TICKS = 30;

/** Detectors: a head-on stand-off / blocked door swing becomes an incident after this many ticks. */
export const HEAD_ON_TICKS = 30;
export const SWING_TICKS = 20;
/** A tile where people waited this many ticks in total counts as congested. */
export const CONGESTION_TICKS = 150;

/** Someone waiting this long inside the entrance means the queue has spilled out the door. */
export const QUEUE_SPILL_TICKS = 80;
/** Someone going in blocked by someone going out (or the reverse) this long: a cross-flow incident. */
export const CROSS_FLOW_TICKS = 20;
/** The hall counts as underused if fewer than this share of its seats are filled when time runs out. */
export const UNDERUSED_SHARE = 0.5;
/** Most waiting spots drawn in one station's line (display only); anyone beyond them is drawn where they stand. */
export const LINE_SLOTS = 10;
/** With no free seat, wait this long at the last station before looking again. */
export const SEAT_RETRY_TICKS = 10;
/** The busiest-station marker only shows once this many people are heading for or waiting at one unit. */
export const BUSY_MARKER_MIN = 3;

// ─── 3. Ramp to the roof (Level 4) ──────────────────────────────────────────────────────

/** Walking with a ~25 kg sack on the shoulder: ~0.9 m/s. */
export const SACK_SPEED = mps(0.9);
/** Pushing a loaded sack trolley on the flat: ~0.8 m/s. */
export const TROLLEY_SPEED = mps(0.8);
/** Ramp slopes on offer, as 1:n. Rise per tile = TILE_M / n: 1:12 rises 5 cm per tile, so 1.2 m takes 24 tiles. */
export const RAMP_SLOPES = [6, 8, 12] as const;
/** Stairs: 8 risers of 15 cm on 30 cm treads = 1.2 m up over 2.4 m (4 tiles), 2 tiles (1.2 m) wide. */
export const STAIR_STEPS = 8;
export const STAIR_TILES = 4;
/** A ramp is 1.2 m wide (2 tiles): the minimum for a wheelchair in Indian accessibility guidelines. */
export const RAMP_WIDTH_TILES = 2;
/** Landings are 3×3 tiles (1.8 m square), enough for a wheelchair to turn (needs ~1.5 m). */
export const LANDING_TILES = WHEELCHAIR_TURN_TILES;
/** Someone on foot can step up or down a lip this high; wheels need the edges to meet exactly. */
export const STEP_UP_MAX_M = STAIR_MAX_RISER_M;

/**
 * Speed on slopes, as a share of flat-ground speed (game estimates from watching people climb).
 * An elderly visitor needs a handrail on any ramp or stairs: with one they walk a ramp at full speed (stairs still
 * tire them); without one they creep along at a quarter speed.
 */
export const SLOPE_SPEED = {
  ramp: { walk: 0.85, wheel: 0.7, elderlyRail: 1 },
  stairs: { walk: 0.5, elderlyRail: 0.4 },
  elderlyNoRail: 0.25,
} as const;
/** Elderly visitors avoid stairs when they can: each stair tile counts as this many steps when they choose a route. */
export const ELDERLY_STAIRS_COST = 12;
/** A wheelchair route turning costs this much extra, so routes run straight where they can. */
export const TURN_COST = 0.4;
/** A trolley pushed up a too-steep ramp makes it this many tiles before it rolls back down, at this speed. */
export const ROLLBACK_AFTER_TILES = 3;
export const ROLLBACK_SPEED = mps(1.5);

// ─── 4. The Utensil Rack (Objects) ─────────────────────────────────────────────────────
// Game estimates, rounded from simple kitchen measurements: how much water a washed utensil carries, how much
// clings on as a film after it has drained, and how fast a thin film evaporates indoors in moving air.

/** One rack tick is this many game seconds; the run lasts the level's timeLimitSec (30 game minutes). */
export const RACK_SEC_PER_TICK = 10;
/** Water on a utensil straight out of the wash (mL). */
export const RACK_WATER_ML = { plate: 15, bowl: 12, spoon: 2 } as const;
/** Water that clings on as a film once the rest has run off (mL), by how the utensil sits. */
export const RACK_FILM_ML = { divider: 2.5, stack: 8, bowl: 1.5, cup: 0.6, base: 0.6 } as const;
/** Share of the not-yet-drained water that runs off per minute: upright plates shed water fast, stacked plates barely. */
export const RACK_DRAIN_PER_MIN = { divider: 1.5, stack: 0.15, bowl: 0.8, cup: 1, base: 0.5 } as const;
/** A utensil counts as dry below this much water (mL). */
export const RACK_DRY_ML = 0.3;
/** Evaporation of a thin film in good airflow (mL per minute). Most of the drying is this, not draining. */
export const RACK_EVAP_ML_PER_MIN = 0.13;
/** Open area of the base (share of its surface), by base and opening size in mm. A solid tray has none. */
export const RACK_OPEN_AREA: Record<'tray' | 'perforated' | 'mesh', Record<number, number>> = {
  tray: { 5: 0, 10: 0, 20: 0, 35: 0 },
  perforated: { 5: 0.2, 10: 0.3, 20: 0.4, 35: 0.5 },
  mesh: { 5: 0.5, 10: 0.6, 20: 0.75, 35: 0.85 },
};
/** Share of the water reaching the base that runs straight through. Water bridges holes of ~5 mm (surface tension). */
export const RACK_PASS_THROUGH: Record<'tray' | 'perforated' | 'mesh', Record<number, number>> = {
  tray: { 5: 0, 10: 0, 20: 0, 35: 0 },
  perforated: { 5: 0.3, 10: 0.9, 20: 1, 35: 1 },
  mesh: { 5: 0.8, 10: 1, 20: 1, 35: 1 },
};
/** How freely air moves between upright plates, by the gap between them (mm). Touching plates barely dry. */
export const RACK_PLATE_SPACING: Record<number, number> = { 5: 0.2, 10: 0.45, 20: 0.8, 35: 1 };
/** Spoons slip through openings this wide or wider (a dessert spoon's handle is ~12-18 mm). */
export const RACK_SPOON_FALL_MM = 20;
/** Standing water deeper than this keeps whatever sits in it wet (mL). */
export const RACK_POOL_WETS_ML = 20;
/** The bottom of a cutlery cup is small: this much water there already keeps the spoons wet (mL). */
export const RACK_CUP_POOL_WETS_ML = 2;
/** Incidents: water pooled on the base (or in the cutlery cup), and water on the counter (mL). */
export const RACK_POOL_INCIDENT_ML = 30;
export const RACK_CUP_POOL_INCIDENT_ML = 5;
export const RACK_COUNTER_INCIDENT_ML = 20;
/** Standing water evaporates slowly (mL per minute, across the whole pool). */
export const RACK_POOL_EVAP_ML_PER_MIN = 0.5;
export const RACK_CUP_POOL_EVAP_ML_PER_MIN = 0.05;
/** Dry weights (g) and what a thin aluminium frame can carry before it bends (g). */
export const RACK_WEIGHT_G = { plate: 180, bowl: 120, spoon: 25 } as const;
export const RACK_ALUMINIUM_LIMIT_G = 3500;

// ---- Utensil Rack design sheet (shown to the player while building; the sim doesn't read these) ----

/** A dinner plate is ~210 mm across: one face is π × 0.105² ≈ 0.035 m². */
export const RACK_PLATE_FACE_M2 = Math.PI * 0.105 * 0.105;
/** Plates lying flat sit in this many piles; only the top face of each pile meets the air. */
export const RACK_PLATE_PILES = 4;
/**
 * Frame materials, approximate handbook values. Young's modulus (GPa) is how stiff the material itself is;
 * a frame's stiffness also depends on its shape: plastic racks are moulded with thick ribs, metal racks are bent
 * from thin wire, so a thin aluminium wire frame ends up the floppiest.
 */
export const RACK_MATERIAL_DATA = {
  plastic: { label: 'Polypropylene', modulusGPa: 1.5, densityGcm3: 0.9, form: 'Moulded, thick ribs', frameStiffness: 'Medium', rustResistance: 'Does not rust' },
  aluminium: { label: 'Aluminium', modulusGPa: 69, densityGcm3: 2.7, form: 'Thin wire, 4 mm', frameStiffness: 'Low', rustResistance: 'Good' },
  stainless: { label: 'Stainless steel (304)', modulusGPa: 193, densityGcm3: 8.0, form: 'Thin wire, 4 mm', frameStiffness: 'High', rustResistance: 'Excellent' },
  mildSteel: { label: 'Mild steel, painted', modulusGPa: 200, densityGcm3: 7.85, form: 'Thin wire, 4 mm', frameStiffness: 'High', rustResistance: 'Low' },
} as const;
