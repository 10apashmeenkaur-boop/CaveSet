# Design Lab

Full plan: `PLAN.md`. Build milestone by milestone; commit after each working one.

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
- Level 1 time limit is 60s. Invariant (tested): one shared double door FAILS on time, two double doors PASS.
