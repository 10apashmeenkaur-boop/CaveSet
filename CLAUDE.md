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
- Characters: generic cartoon bobble-heads (rounded torso, big head, dot eyes, small legs and feet), gentle bob (not bouncy balls). Shirt color = role. No cultural attire.
- Screens: Level select, Game view, Design Journal. (No title menu, no separate brief screen — brief lives in the game HUD.)
- Look: soft pastel cartoon world + blueprint-style UI panels (grid-paper, navy ink, handwritten accents).
- Every screen shows a complaint quote (`src/ui/quotes.ts`); in a level that card is Mistri Ji instead: short (<8 words), casual, light Hinglish, how real sevadars talk. Each quote belongs to a failure code (TOO_NARROW, HEAD_ON_JAM, SWING_BLOCK, NO_PATH, TIME_LIMIT); M5 speech bubbles reuse them.
- Dining hall is a soft no-walk: walkable at extra A* cost (DINING_COST), never hard-blocked. Stepping in raises DINING_DISTURBED and diners complain ("Bhaji, khaana kha rahe hain!").
- Level 2 has fixed walls: kitchen/washing walls plus a brick ring around the dining hall with sangat entrances. Players cut doors (and may brick up entrances).
- Level 1 budget is ₹7,500 (plan said ₹6,000, which made separate in/out flows unaffordable).
- Head-on stand-offs (after SQUEEZE_TICKS): two empty-handed people squeeze past; if a crate is involved one carrier backs out of the doorway (the one in it, else the higher id) and holds YIELD_HOLD_TICKS. On a mutual block only the higher-id agent detours.
- Level 1 time limit is 60s. Invariants (tested): one shared double door FAILS on time; two double doors with opposite one-way signs PASS with no jams.
- All numbers live in `src/sim/constants.ts` (1 tile = 0.6 m; speeds in tiles/s from real m/s). No magic numbers in sim code.
- Routing is crowd-aware (occupied + recent-wait costs) so people spread over doors.
- UI: keep the pre-P6 game UI (brief card top-left; budget + quote cards top-right; toolbar with names + prices; Simulate button + sim bar). The user rejected the compact P6 HUD. Ask before changing the UI layout.
- Sound is off by default (toggle on the level-select screen) and soft: sine tones, smooth attack/release, low pitch, short. Volume slider next to the toggle (default 40%). One sound set ("Soft wood"); the temporary picker and Sound test were removed. No crowd murmur, no slow-mo, no evening lighting. Items drop in with a bounce.
- Onboarding: a soft pulsing outline on buildable walls, plus dotted moving route arrows along the real routes (design mode only; they fade when the sim starts). No hint bubbles, no route label pills.
- Every zone has a painted signboard on the wall behind its far edge (or on a post if there's none), always facing the camera. Speech bubbles are only for what people say, never place names.
- Eraser: one click (or right-click, or drag) on any tile of an object removes the whole object: door + its sign, its swing area, a station + its standing spot, a rail. Hover shows everything that will go in red.
- Stars (ROADMAP 8.2 with a per-level `starCost`): 1 = pass, 2 = also within `targetSec`, 3 = also cost ≤ `starCost`. L1 starCost ₹7,500; L2 ₹9,500 (cheapest clean design is ₹9,000).
- Each level has a fixed `seed` in its JSON, so the same design always gives the same result.
- Level 3 "Langar Queue" (21×12): sangat visits shoe stand (4s) → tap (6s) → head-cover basket (2s) → seat; 5 waves of 10 every 20s; seats fill from the back. A previous pangat of 16 sits nearest the exit and leaves in groups of 4; the hall opening is at the top, so without a low exit door they walk out through the line (CROSS_FLOW). Two fixed baskets (players can't build baskets, so one would be an unfixable bottleneck). A station's standing spot can't touch another's (otherwise people get boxed in). Budget ₹12,000, 3 min, targetSec 150, starCost ₹9,500 (cheapest clean: 3 shoe stands + 3 taps + hinged exit door = ₹9,000). Twist tested: one shoe stand + more taps still fails.
- Mistri Ji (P5) speaks only through the game's existing quote card: his 1-line Hinglish brief (`mistri.brief` in level JSON), and after 2 failed runs in a row a "Mistri Ji ki salaah" nudge picked by what failed (`mistri.hints[code]`, else `default`). Hints nudge, never give the answer. No popups.
- The journal is "Mistri Ji ki diary": one insight page per level (`insight` in level JSON: title, principle, real-world example, a real number, Mistri Ji quote), unlocked by failing then passing that level. The failure principle cards stay below it.
- Personal-best ghost: the best passing design is saved and replayed (deterministic) beside the run as faint people. Off by default; "👻 Best run" toggle in the sim bar.
- Sim bar progress text comes from `goalLabel` in level JSON (e.g. "🍽 {n}/{total} seated").
- Dev builds: press U on level select to unlock/relock all levels.
- Level 4 "Ramp to the Roof" (20×12): get 6 sack carriers, 2 trolleys, a wheelchair sevadar and an elderly visitor from the yard to roof storage, a raised deck 1.2 m up (`rise` in level JSON). Heights live in `src/sim/terrain.ts` (mm): ramps/stairs join the ground or roof only if their whole width meets it; landings take the height of the ramp they touch. Ramp pieces are 2 tiles wide (1.2 m) × 1 long, ₹600; R cycles slope 1:6 / 1:8 / 1:12; dragging paints uphill (direction = drag direction, a click continues an adjacent ramp). Stairs ₹4,000 (8×15 cm, 2×4 tiles, R turns them). Landing 3×3 ₹1,200 with a small height tag (the only height numbers shown). Handrail ₹200/tile on a ramp/stairs tile (one rail serves the piece's full width); erasing a ramp takes its handrails. The elderly visitor needs a handrail on every ramp/stairs tile: without one they move at a quarter speed and raise NO_HANDRAIL (a fail).
- L4 movement: on foot a 15 cm lip is fine; wheels need edges to meet exactly and never take stairs. Wheelchair: ≤1:12, turns only on a level 3×3 spot. (No rest-landing rule: no flight on this site can exceed 15 tiles, so it was removed.) Trolley: ≤1:12; on a steeper ramp it climbs 3 tiles and rolls back. If there's no proper route, wheels try the way a user would and stop where the design fails them (RAMP_TOO_STEEP, TROLLEY_ROLLBACK, TIGHT_TURN); with no step-free way up they stop at the stairs foot (NO_ACCESSIBLE_ROUTE). Longest straight run to the roof is 14–15 tiles, so 1:12 needs a switchback; one landing is too small to turn on (TIGHT_TURN), two pass. Budget ₹24,000 (raised from ₹20,000 so handrails fit), 90 s, targetSec 65, starCost ₹22,000 (cheapest clean: 24 ramp pieces + 2 landings + 24 handrails = ₹21,600).
