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
- Look: soft pastel cartoon world + UI style A "Blueprint Studio" (chosen from `mockups/`): grid-paper panels, navy ink, Caveat handwritten headings/bubbles/quotes, Inter body, IBM Plex Mono labels and prices, 10px corners, offset hard shadows, coral `--alert` for incidents, pale-yellow active state. Tokens live in `:root` in `src/styles.css`.
- All text is formal English everywhere (bubbles, quotes, hints, incident cards, notebook, briefs). No Hindi/Hinglish; people are "volunteers" and "visitors". "Langar" stays only in proper names (level 3 title).
- Complaint quotes (`src/ui/quotes.ts`): short (<8 words), plain, polite. Each belongs to a failure code; speech bubbles reuse them. Shown on the journal page and as the in-level card fallback. Level select has no quote banner.
- Dining hall is a soft no-walk: walkable at extra A* cost (DINING_COST), never hard-blocked. Stepping in raises DINING_DISTURBED and diners complain ("Excuse me, we are eating.").
- Level 2 has fixed walls: kitchen/washing walls plus a brick ring around the dining hall with sangat entrances. Players cut doors (and may brick up entrances).
- Level 1 budget is ₹7,500 (plan said ₹6,000, which made separate in/out flows unaffordable).
- Head-on stand-offs (after SQUEEZE_TICKS): two empty-handed people squeeze past; if a crate is involved one carrier backs out of the doorway (the one in it, else the higher id) and holds YIELD_HOLD_TICKS. On a mutual block only the higher-id agent detours.
- Level 1 time limit is 60s. Invariants (tested): one shared double door FAILS on time; two double doors with opposite one-way signs PASS with no jams.
- All numbers live in `src/sim/constants.ts` (1 tile = 0.6 m; speeds in tiles/s from real m/s). No magic numbers in sim code.
- Routing is crowd-aware (occupied + recent-wait costs) so people spread over doors.
- UI: keep the pre-P6 game UI (brief card top-left; budget + quote cards top-right; toolbar with names + prices; Simulate button + sim bar). The user rejected the compact P6 HUD. Ask before changing the UI layout.
- Speech (`src/render/Speech.tsx`, render only): stuck/kept-waiting people say formal lines (`STUCK_LINES`: "I’m stuck.", "I can’t get through.", "There’s no way out."); complaints and disturbed diners use the failure quotes. Each bubble shows 4 real seconds then fades over 1 s; max 3 bubbles, nearby ones stack; max 3 "?!" markers (most stuck, no bubble).
- Level 3 waiting lines are display only (`queueLines` in `src/sim/lines.ts`, drawn by `LineDirector`): people waiting near a station are drawn single file on spots behind it (straight back, following rails, bending at walls; never splitting the floor). The sim keeps its own positions, so results are unchanged. (A sim-side version was tried and changed pass/fail, so it was dropped.)
- Playback: 1x plays the sim at half rate (`PLAYBACK_RATE` in Agents.tsx) to match the original pace; sim constants and timings unchanged. Placement drop is tiny (0.15, 0.16 s).
- Sound: the "Soft wood" set, always on at a fixed low volume (no toggle, slider or any sound UI). Soft: sine tones, smooth attack/release, low pitch, short. No crowd murmur, no slow-mo, no evening lighting. Items drop in with a bounce.
- Onboarding: only a soft pulsing outline on buildable walls. No route arrows, hint bubbles or route label pills.
- Every zone has a painted signboard on the wall behind its far edge (or on a post if there's none), always facing the camera. Speech bubbles are only for what people say, never place names.
- Eraser: one click (or right-click, or drag) on any tile of an object removes the whole object: door + its sign, its swing area, a station + its standing spot, a rail. Hover shows everything that will go in red.
- Stars (ROADMAP 8.2 with a per-level `starCost`): 1 = pass, 2 = also within `targetSec`, 3 = also cost ≤ `starCost`. L1 starCost ₹7,500; L2 ₹9,500 (cheapest clean design is ₹9,000).
- Each level has a fixed `seed` in its JSON, so the same design always gives the same result.
- Level 3 "Langar Queue" (21×12): sangat visits shoe stand (4s) → tap (6s) → head-cover basket (2s) → seat; 5 waves of 10 every 20s; seats fill from the back. A previous pangat of 16 sits nearest the exit and leaves in groups of 4; the hall opening is at the top, so without a low exit door they walk out through the line (CROSS_FLOW). Two fixed baskets (players can't build baskets, so one would be an unfixable bottleneck). A station's standing spot can't touch another's (otherwise people get boxed in). Budget ₹12,000, 3 min, targetSec 150, starCost ₹9,500 (cheapest clean: 3 shoe stands + 3 taps + hinged exit door = ₹9,000). Twist tested: one shoe stand + more taps still fails.
- Mistri Ji (P5; shown to players as "the Master Builder") speaks only through the game's existing quote card: his 1-line English brief (`mistri.brief` in level JSON), and after 2 failed runs in a row a "Master Builder's advice" nudge picked by what failed (`mistri.hints[code]`, else `default`). Hints nudge, never give the answer. No popups.
- The journal is the "Design Notebook": one insight page per level (`insight` in level JSON: title, principle, real-world example, a real number, Mistri Ji quote), unlocked by failing then passing that level. The failure principle cards stay below it.
- Personal-best ghost: the best passing design is saved and replayed (deterministic) beside the run as faint people. Off by default; "👻 Best run" toggle in the sim bar.
- Sim bar progress text comes from `goalLabel` in level JSON (e.g. "🍽 {n}/{total} seated").
- Dev builds: press U on level select to unlock/relock all levels.
- Level 4 "Ramp to the Roof" (20×12): get 6 sack carriers, 2 trolleys, a wheelchair user and an elderly visitor from the yard to roof storage, a raised deck 1.2 m up (`rise` in level JSON). Heights live in `src/sim/terrain.ts` (mm): ramps/stairs join the ground or roof only if their whole width meets it; landings take the height of the ramp they touch. Ramp pieces are 2 tiles wide (1.2 m) × 1 long, ₹600; R cycles slope 1:6 / 1:8 / 1:12; dragging paints uphill (direction = drag direction, a click continues an adjacent ramp). Stairs ₹4,000 (8×15 cm, 2×4 tiles, R turns them). Landing 3×3 ₹1,200 with a small height tag (the only height numbers shown). Handrail ₹200/tile on a ramp/stairs tile (one rail serves the piece's full width); erasing a ramp takes its handrails. The elderly visitor needs a handrail on every ramp/stairs tile: without one they move at a quarter speed and raise NO_HANDRAIL (a fail).
- L4 movement: on foot a 15 cm lip is fine; wheels need edges to meet exactly and never take stairs. Wheelchair: ≤1:12, turns only on a level 3×3 spot. (No rest-landing rule: no flight on this site can exceed 15 tiles, so it was removed.) Trolley: ≤1:12; on a steeper ramp it climbs 3 tiles and rolls back. If there's no proper route, wheels try the way a user would and stop where the design fails them (RAMP_TOO_STEEP, TROLLEY_ROLLBACK, TIGHT_TURN); with no step-free way up they stop at the stairs foot (NO_ACCESSIBLE_ROUTE). Longest straight run to the roof is 14–15 tiles, so 1:12 needs a switchback; one landing is too small to turn on (TIGHT_TURN), two pass. Budget ₹24,000 (raised from ₹20,000 so handrails fit), 90 s, targetSec 65, starCost ₹22,000 (cheapest clean: 24 ramp pieces + 2 landings + 24 handrails = ₹21,600).
