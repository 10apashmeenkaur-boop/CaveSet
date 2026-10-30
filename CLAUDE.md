# Design Lab

Plans: `ROADMAP.md` (takes priority) and `PLAN.md`. Work through ROADMAP §9 prompts in order; commit after each.

## Core rules
- `src/sim/` is pure TypeScript: no React/Three imports. Takes level + design, advances in fixed ticks.
- Deterministic: 10 ticks/sec, seeded RNG. Same design = same result.
- Logic is a 2D grid; visuals are 3D and only draw the grid.
- Every failure produces an Incident Report (PLAN 4.6). No silent fails.
- Levels are JSON in `src/levels/`.
- Vitest for sim logic only; don't test rendering.

## Decisions (agreed with user)
- No login. Progress (stars, unlocked principles) saved in localStorage, wrapped in try/catch.
- Characters: generic cartoon bobble-heads (round body, big head, dot eyes), bouncy walk, no limbs. Shirt color = role. No cultural attire.
- Screens: Level select, Game view, Design Journal. (No title menu, no separate brief screen — brief lives in the game HUD.)
- Look: soft pastel cartoon world + blueprint-style UI panels (grid-paper, navy ink, handwritten accents).
- Every screen shows a complaint quote (`src/ui/quotes.ts`): short (<8 words), casual, light Hinglish, how real sevadars talk. Each quote belongs to a failure code (TOO_NARROW, HEAD_ON_JAM, SWING_BLOCK, NO_PATH, TIME_LIMIT); M5 speech bubbles reuse them.
- Dining hall is a soft no-walk: walkable at extra A* cost (DINING_COST), never hard-blocked. Stepping in raises DINING_DISTURBED and diners complain ("Bhaji, khaana kha rahe hain!").
- Level 2 has fixed walls: kitchen/washing walls plus a brick ring around the dining hall with sangat entrances. Players cut doors (and may brick up entrances).
- Level 1 budget is ₹7,500 (plan said ₹6,000, which made separate in/out flows unaffordable).
- Head-on stand-offs (after SQUEEZE_TICKS): two empty-handed people squeeze past; if a crate is involved one carrier backs out of the doorway (the one in it, else the higher id) and holds YIELD_HOLD_TICKS. On a mutual block only the higher-id agent detours.
- Level 1 time limit is 60s. Invariants (tested): one shared double door FAILS on time; two double doors with opposite one-way signs PASS with no jams.
- All numbers live in `src/sim/constants.ts` (1 tile = 0.6 m; speeds in tiles/s from real m/s). No magic numbers in sim code.
- Routing is crowd-aware (occupied + recent-wait costs) so people spread over doors.
- UI: keep the pre-P6 game UI (brief card top-left; budget + quote cards top-right; toolbar with names + prices; Simulate button + sim bar). The user rejected the compact P6 HUD. Ask before changing the UI layout.
- Sound is off by default (toggle on the level-select screen). No crowd murmur, no slow-mo, no evening lighting. Items drop in with a bounce.
- Onboarding is only a soft pulsing outline on buildable walls (no hint bubbles, no route labels/arrows).
- Stars (ROADMAP 8.2 with a per-level `starCost`): 1 = pass, 2 = also within `targetSec`, 3 = also cost ≤ `starCost`. L1 starCost ₹7,500; L2 ₹9,500 (cheapest clean design is ₹9,000).
- Each level has a fixed `seed` in its JSON, so the same design always gives the same result.
