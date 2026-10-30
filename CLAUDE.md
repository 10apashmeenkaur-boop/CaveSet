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
