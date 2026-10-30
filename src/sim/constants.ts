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
