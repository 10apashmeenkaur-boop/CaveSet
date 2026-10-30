# Design Lab — Build Plan (for Claude Code)

> Working title: **Design Lab**. A simulation game where you design everyday things and spaces, then watch real people use them. If the design is wrong, the simulation breaks and shows you *exactly how and why* it went wrong.
>
> Origin: the wire-mesh utensil rack at the Gurdwara. A solid box would hold utensils but never let them dry. The game teaches that kind of thinking: **design for how a thing is used, not just what it holds.**

---

## 0. How to use this file with Claude Code

1. Make an empty folder, put this file in it as `PLAN.md`.
2. Run `claude` in that folder.
3. First prompt: *"Read PLAN.md. Set up the project per Section 2 and build Milestone M0. Stop after M0 and show me how to run it."*
4. Then go milestone by milestone: *"Build M1 from PLAN.md."* Test in the browser after each one before moving on.
5. Commit to git after every working milestone, so you can roll back.

---

## 1. Core rules (put these in CLAUDE.md too)

- **Simulation is pure TypeScript, separate from rendering.** `src/sim/` has zero React/Three imports. It takes a level + design and advances in fixed ticks.
- **Deterministic.** Fixed timestep (10 ticks/sec), seeded RNG. Same design = same result every run. This makes replays and tests possible.
- **Logic is a 2D grid; visuals are 3D.** Every wall, door and person lives on grid tiles. The 3D view just draws that grid.
- **Every failure must explain itself.** No silent fails. Each failure produces an Incident Report (see 4.6).
- **Levels are JSON data**, not code. Adding a level = adding a file.
- Unit-test the simulation with Vitest. Don't test rendering.

---

## 2. Tech stack

| Part | Choice | Why |
|---|---|---|
| App | Vite + React + TypeScript | Fast, you already know React |
| 3D | react-three-fiber + drei | Low-poly isometric look like Little Big Workshop / Software Inc. |
| State | zustand | Simple global store for design + sim state |
| Pathfinding | own A* on the grid (or `pathfinding` npm) | Small and controllable |
| Tests | Vitest | Sim logic only |
| Style | Plain CSS or Tailwind | Keep UI light |

Camera: orthographic, isometric angle (~45° yaw, ~35° pitch), pan + zoom, no free rotation for now.

### Folder structure
```
src/
  sim/            # pure TS: grid, agents, pathfinding, physics, failures
    grid.ts
    agents.ts
    pathfinding.ts
    simulate.ts     # step(state) -> state
    failures.ts     # detectors + incident reports
    scoring.ts
    pulley.ts       # Stage 2
  levels/         # JSON level files
  render/         # R3F components: tiles, walls, doors, people, bubbles
  ui/             # toolbar, budget, brief panel, results, incident cards, replay bar
  store.ts
  App.tsx
```

---

## 3. Game loop (every level)

1. **Brief**: client card with goal, constraints, budget in ₹.
2. **Design mode**: place walls, doors, parts. Live cost counter.
3. **Simulate**: press Play. People arrive and do their tasks.
4. **Watch it go wrong (or right)**: speech bubbles, jams, red highlights.
5. **Results + Incident Reports**: what failed, evidence, the principle, a hint.
6. **Redesign** and retry. Stars for function, cost, time.

---

## 4. STAGE 1 — "The Langar Hall Service Path" (build today)

Theme: Gurdwara community kitchen. Sevadars carry utensil crates and trays between the kitchen and the washing area.

### 4.1 Levels in Stage 1

**Level 1 — The Doorway** (tutorial)
- Map: kitchen zone on the left, washing zone on the right, one fixed wall between them.
- Player's job: place door(s) in that wall.
- Traffic: 12 sevadars. Some carry **dirty crates** kitchen → washing; others carry **clean crates** back. Both directions at once.
- Expected failures the player will discover:
  - One **narrow (1-tile) door** → crate carriers can't fit, get stuck. Bubble: "This crate won't fit through!"
  - One door used **both ways** → head-on jams in the doorway.
  - Hinged door **swinging into the path** → people wait for each other to clear the swing zone.
- Lesson: door width must fit the *load*, not the person; separate in and out flows.

**Level 2 — The Service Corridor**
- Map: kitchen, washing area, and a **dining hall zone in between** where people sit for langar (no-walk zone).
- Player's job: draw walls to build a corridor around the dining hall, plus doors.
- Expected failures: dead ends (no path), corridor too narrow for two-way crate traffic, route too long (misses time limit), over budget.
- Lesson: circulation design, width vs. cost, route length.

**Sandbox**: same tools, no goals.

### 4.2 Build tools (Design mode)

| Item | Size | Cost (₹) | Notes |
|---|---|---|---|
| Brick wall | 1 tile | 500 | Blocks movement |
| Single hinged door | 1 tile wide | 2,000 | Needs a free **swing tile** on one side to open |
| Double door | 2 tiles wide | 3,500 | Fits crate carriers, swing zone 2 tiles |
| Sliding door | 1 or 2 tiles | 3,000 / 5,000 | No swing zone, pricier |
| Eraser | — | refunds 100% in design mode | |

Controls: select tool, click/drag to place, right-click or eraser to remove, R to rotate a door / flip swing side. Show the swing arc as a translucent quarter-circle on the floor (like the reference screenshots).

### 4.3 People (agents)

| Type | Width needed | Speed | Notes |
|---|---|---|---|
| Sevadar (empty) | 1 tile | 1.0 | Returning after a drop |
| Crate carrier | **2 tiles** | 0.7 | Can't pass a 1-wide gap or door |
| Tray carrier | 1 tile | 0.8 | Stops if bumped (spill risk, Stage 1.5) |
| Elderly visitor | 1 tile | 0.5 | Level 2 only, walks through service path occasionally |

Each agent has: `id, type, pos, path, task (pickup → dropoff), state (walking / waiting / stuck / done), waitTicks, carrying`.

Tasks: spawn in a zone → walk to pickup point → pick up → walk to dropoff → drop → return or despawn.

### 4.4 Movement rules (keep simple)

- Grid tiles, 4- or 8-direction movement.
- **One agent per tile** (2 tiles for crate carriers: they occupy a tile pair).
- A* finds a path; passable tiles depend on agent width (crate carriers need clearance).
- If the next tile is occupied: wait. After waiting 15 ticks, try a re-path. After 60 ticks, state = **stuck**.
- Hinged doors: a door is "open" only while its swing tile is empty. If someone stands in the swing tile, the door stays closed and others wait.

### 4.5 Failure detectors (`sim/failures.ts`)

Each detector watches the sim and fires an incident:

| Detector | Trigger | Bubble text example |
|---|---|---|
| `NO_PATH` | A* finds no route for an agent | "There's no way through!" |
| `TOO_NARROW` | Crate carrier's only route has a 1-wide gap/door | "This crate won't fit!" |
| `HEAD_ON_JAM` | Two agents facing opposite ways blocked by each other > 30 ticks | "After you… no, after you…" |
| `SWING_BLOCK` | Door can't open because swing tile occupied > 20 ticks | "The door hits me!" |
| `CONGESTION` | Tile with total wait time above threshold | heatmap only |
| `TIME_LIMIT` | Not all tasks done by limit | — |
| `OVER_BUDGET` | Cost > budget (checked before Play) | — |

### 4.6 Incident Report (the "why it went wrong" card)

```ts
type Incident = {
  code: 'TOO_NARROW' | 'HEAD_ON_JAM' | ...;
  tick: number;            // when it happened (for replay jump)
  tiles: [number, number][]; // where (highlighted red)
  agents: string[];        // who
  title: string;           // "Crate carriers got stuck at the door"
  evidence: string;        // "4 of 6 carriers couldn't pass the 1-tile door at (7,3)"
  principle: string;       // "Openings must fit the largest thing passing through, not just the person."
  hint: string;            // "Try a double door or a sliding door."
};
```
Clicking an incident jumps the replay to that tick and highlights the tiles. These cards are the game's "artifacts": real design principles, unlocked by failing.

### 4.7 Scoring

- **Function**: % tasks completed (must be 100% to pass).
- **Time**: finish time vs. target → 1–3 stars.
- **Cost**: under budget = pass; well under = bonus star.
- **Comfort**: number of complaints (bubbles).

### 4.8 Level JSON shape
```json
{
  "id": "l1-doorway",
  "title": "The Doorway",
  "brief": "Sevadars carry crates both ways between kitchen and washing. Make the wall passable. Budget ₹6,000. Finish in 90s.",
  "grid": { "w": 16, "h": 10 },
  "fixedWalls": [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,6],[8,7],[8,8],[8,9]],
  "editableTiles": "wall-x-8-only",
  "zones": {
    "kitchen": { "x": 0, "y": 0, "w": 7, "h": 10 },
    "washing": { "x": 9, "y": 0, "w": 7, "h": 10 }
  },
  "noWalk": [],
  "spawns": [
    { "type": "crate", "from": "kitchen", "to": "washing", "count": 6, "every": 20 },
    { "type": "crate", "from": "washing", "to": "kitchen", "count": 6, "every": 20, "delay": 10 }
  ],
  "budget": 6000,
  "timeLimitSec": 90,
  "allowedTools": ["door1", "door2", "slide1", "slide2"]
}
```

### 4.9 Milestones for today (one Claude Code prompt each)

- **M0 — Scaffold.** Vite + React + TS, R3F, drei, zustand, Vitest. Isometric orthographic camera showing a 16×10 floor grid. Folder structure from Section 2.
- **M1 — Grid + build mode.** Grid data model, place/erase walls and doors with mouse, door rotation + swing arc preview, live ₹ cost counter, budget bar.
- **M2 — Rendering.** Low-poly walls (brick color), doors, floor zones colored (kitchen, washing, dining). Hover highlight tile.
- **M3 — Agents + pathfinding.** Spawn from level JSON, A* with width rules, walk/pickup/drop loop. Simple capsule people with a box on top when carrying a crate. Play / Pause / Reset / 2× speed.
- **M4 — Collisions + doors.** One-per-tile occupancy, waiting, re-pathing, stuck state, hinged door swing-tile rule.
- **M5 — Failures + bubbles.** All detectors from 4.5, speech bubbles above agents (drei `Html`), red tile highlight, congestion heatmap toggle.
- **M6 — Results + Incident cards + levels.** End screen with stars, incident cards, load Level 1 and Level 2 from JSON, level select.
- **M7 (stretch) — Replay scrubber.** Store a snapshot per tick, timeline slider with incident markers; clicking a marker jumps there.

Realistic for today: **M0–M5**. M6–M7 tomorrow.

### 4.10 Tests to write (Vitest)
- A* returns no path when blocked; crate carrier can't path through 1-wide gap.
- Same seed + design → identical final state.
- Head-on jam detector fires on a 1-wide two-way door.
- Cost calculation matches placed items.

---

## 5. STAGE 2 — "Lifting the Sacks" (pulley system)

Theme: sacks of atta and dal must go up to the roof storage of the Gurdwara kitchen. Sevadars pull them up with a rope and pulley system the player designs.

### 5.1 Design choices
| Part | Options | Effect |
|---|---|---|
| Pulley setup | Single fixed (MA 1), movable (MA 2), block & tackle (MA 3, 4, 6) | Less force, but more rope to pull |
| Rope | Jute (cheap, weak), nylon, steel cable | Breaking strength + cost |
| Anchor beam | Bamboo, wood, steel I-beam | Max load before bending/breaking |
| Pullers | 1–3 sevadars | Each can pull ~300 N steadily |
| Sack weight | Set by level (25 kg, 50 kg, 100 kg) | |

### 5.2 Physics (simple, real)
```
W           = mass * 9.81                     // load weight (N)
MA_ideal    = number of rope segments supporting the load
efficiency  = 0.9 ^ (number of pulleys)       // friction loss
effort      = W / (MA_ideal * efficiency)     // force pullers need
ropeTension = effort                          // in the pulled rope
beamLoad    = W + effort  (fixed pulley) or computed from segments
ropePulled  = liftHeight * MA_ideal           // more MA = more pulling, slower
```

### 5.3 How it fails (and what the player sees)
| Failure | Condition | Visual |
|---|---|---|
| Can't lift | effort > pullers × 300 N | Pullers strain, sack doesn't move, bubble "It's too heavy!" |
| Rope snaps | ropeTension > rope strength | Rope turns red as it nears limit, snaps, sack drops (slow-mo) |
| Beam bends/breaks | beamLoad > beam strength | Beam bends progressively, cracks, collapses |
| Too slow | time > limit (because MA is high) | Timer runs out, "We'll miss langar!" |
| Over budget | cost > budget | Blocked before Play |

Live **tension meter** on the rope and **stress color** on the beam (green → yellow → red) during the sim, so players see failure *coming*, not just happening.

### 5.4 Incident example
- Title: "The jute rope snapped"
- Evidence: "Tension reached 540 N; jute holds ~400 N."
- Principle: "A pulley spreads the load over more rope segments. More segments = less tension in each."
- Hint: "Add a movable pulley, or use nylon rope."

### 5.5 Combine with Stage 1
Later: sevadars carry sacks from the delivery truck through the corridor (Stage 1 sim) to the pulley (Stage 2 sim). A bad corridor *or* a bad pulley breaks the whole chain.

---

## 6. Later stages (don't build yet)
- **Stage 3 — Dish rack & wash basin**: water drip/drain + drying over time-lapse (the original idea). Solid vs. mesh vs. slotted; mesh spacing vs. small spoons falling.
- **Stage 4 — Stairs & ramps**: step height, ramp slope, wheelchair users, elderly.
- **Stage 5 — Full building**: multiple floors, crowd flow at langar time, fire exits.
- **Design Journal**: collection of every principle unlocked through incidents.

---

## 7. Visual style notes
- Low-poly, soft colors, isometric (like Little Big Workshop / Software Inc.).
- Brick walls warm red, floors light grey, zones softly tinted.
- People: simple capsules with a head; crate = brown box carried in front; tray = flat disc.
- Swing arcs, red failure tiles and heatmaps drawn as translucent floor overlays.
- Speech bubbles: white rounded cards above heads, short text.
