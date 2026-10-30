# Build-Lab — Roadmap & Engineering Spec (v2)

> Put this file next to PLAN.md in the project folder. Tell Claude Code:
> *"Read PLAN.md and ROADMAP.md. ROADMAP.md takes priority where they differ. Do the next unchecked prompt in Section 9."*

**The game in one line:** you design everyday spaces and things for a Gurdwara (and later a village and town), real people use them, and when your design is wrong the simulation breaks and shows you *why*. Every failure teaches a real engineering principle.

**Design pillars (check every feature against these):**
1. **Fail first, learn after.** Never tell the answer. Let the player build the solid box and watch it fail.
2. **Real numbers, simple maths.** Dimensions and speeds come from real guidelines, but the simulation stays simple and readable.
3. **People make it funny and human.** Failures are shown through people reacting, not error messages.
4. **Every level has a twist.** A trade-off or surprise that a "first obvious answer" misses.
5. **Game, not website.** World fills the screen; UI is a small HUD.

---

## 1. Where we are

**Built:** M0–M5. Level 1 (Doorway), Level 2 (Service Corridor, boxed dining hall + DINING_DISTURBED), Sandbox, build tools, A* agents, collisions, door swing blocking, failure detectors, speech bubbles with Hinglish quotes, heatmap, over-budget block, Design Journal unlock.

**Pending (prompts in Section 9):** crate-carrier squeeze fix, onboarding, congestion-aware pathfinding, one-way arrow signs, game-feel pass, Workshop mode, M6 results screen.

---

## 2. World scale & real-world numbers (the "engineer" layer)

All levels use one consistent scale so lessons transfer to real life.

| Quantity | Game value | Real-world basis (approximate) |
|---|---|---|
| 1 tile | **0.6 m** | Roughly one person's shoulder width + clearance |
| Person (empty-handed) | 1 tile wide | Shoulder width ~0.45–0.5 m |
| Crate carrier | 2 tiles (1.2 m) | Person + crate held in front ~0.9 m, needs margin |
| Wheelchair | 2 tiles wide, needs 3×3 to turn | Turning circle ~1.5 m |
| Single hinged door | 1 tile = 0.6 m | **Too narrow on purpose.** Real accessible doors are ~0.9 m clear |
| Double door / wide slider | 2 tiles = 1.2 m | Comfortable for loads and passing |
| Comfortable corridor | 2 tiles = 1.2 m | Indian accessibility guidelines suggest ~1.2–1.5 m for public corridors |
| Walking speed | 2.0 tiles/s (1.2 m/s) | Typical adult ~1.2–1.4 m/s |
| Crate carrier speed | 1.3 tiles/s (0.8 m/s) | Loaded walking is slower |
| Elderly speed | 1.1 tiles/s (0.65 m/s) | |
| Wheelchair speed | 1.5 tiles/s (0.9 m/s) on flat; slows on slopes | |
| Doorway flow capacity | ~1.3 people per second per metre of width | Pedestrian research (SFPE / Fruin) |
| Ramp slope | max **1:12** (8.3%) for wheelchairs | Accessibility guidelines; 1 m rise needs 12 m of ramp |
| Ramp landing | every ~9 m of ramp | Rest stops for wheelchair users |
| Stair riser / tread | public: riser ≤ 15 cm, tread ≥ 30 cm | Steeper stairs = falls and slow elderly |
| Exit doors | swing **in the direction of escape** | Fire safety rule; a crowd pushing can't pull a door open |
| Counter height | ~85–90 cm | Comfortable for standing work |

> These are approximate references (Indian NBC, Harmonised Accessibility Guidelines, pedestrian-flow research). In-game, label them "approximate real-world values." Show them in insight cards, not as a textbook.

**Rule for Claude Code:** keep these in `src/sim/constants.ts` with a comment for each giving its real-world basis. Levels and detectors read from here; no magic numbers.

---

## 3. Mistri Ji & insight cards (knowledge layer)

**Mistri Ji** is a retired mistri (master builder) who does seva at the Gurdwara. He gives briefs and hints, and reacts to your designs. Short, warm, a bit funny, light Hinglish.

- **Brief:** 1–2 lines from Mistri Ji at level start.
- **Hint system:** after 2 failed runs, a "Mistri Ji ki salaah" button appears with a nudge, never the answer.
- **Insight cards ("Mistri Ji ki diary"):** unlocked by triggering a failure *and* then fixing it. Each card has:

```ts
type InsightCard = {
  id: string;
  title: string;          // "Separate the flows"
  principle: string;      // one sentence
  realWorld: string;      // where real engineers use this
  number?: string;        // a real figure, e.g. "≈1.3 people/s per metre of door"
  mistriQuote: string;    // "Beta, raasta ek, log do taraf? Jhagda pakka."
  unlockedBy: { fail: FailureCode; thenPass: string }; // level id
};
```

The diary is the "collection" players fill up, like a Pokédex of engineering principles.

---

## 4. Chapter 1 — "Langar Seva" (the Gurdwara)

Seven levels. Each one: brief → build → simulate → twist → insight.

### L1 — The Doorway *(built)*
- **Goal:** crates both ways between kitchen and washing. ₹7,500, 60 s.
- **Twist:** one big door seems enough, but two-way crate traffic jams it. Two separated doors (or one door + arrow signs, if they fit) win.
- **Insight: "Separate dirty and clean flows."** Real commercial kitchens and hospitals use one-way flows so dirty dishes never cross clean food paths (food-safety practice).
- **Mistri Ji:** "Ek raasta, do taraf log? Jhagda pakka."

### L2 — The Service Corridor *(built)*
- **Goal:** route crates around a boxed-in dining hall.
- **Twist:** the shortcut through the hall is open, but it disturbs the sangat eating.
- **Insight: "Front of house, back of house."** Restaurants, hotels and theatres hide service routes from guests.

### L3 — The Langar Queue *(new)*
- **Map:** entrance → shoe stand → hand-wash taps → head-cover basket → dining hall → exit.
- **Build tools:** taps (₹1,500 each), queue rails (₹300/tile), arrow signs, walls, doors.
- **Sim:** sangat arrives in waves (every 20 s a group of 8–12). Each person visits stations **in order**; each station has a service time (taps 6 s, shoe stand 4 s).
- **Failures:** queue spills into the entrance (QUEUE_OVERFLOW), people arriving cross people leaving (CROSS_FLOW), too few taps → hall half-empty (UNDERUSED_HALL).
- **Twist:** adding more taps does nothing if the shoe stand is the bottleneck. **Fix the slowest station first.**
- **Insight: "The bottleneck sets the speed."** The slowest step limits the whole line (Theory of Constraints / Little's Law: people in line = arrival rate × wait time).
- **Show:** a live "busiest station" marker so players can find the bottleneck.

### L4 — The Ramp to the Roof *(new)*
- **Goal:** a wheelchair-using sevadar and a sack trolley must reach roof storage 1.2 m up.
- **Build tools:** stairs (cheap), ramp segments with adjustable slope, landings, handrails.
- **Sim:** ramp slope affects speed; above 1:12 the wheelchair can't climb (RAMP_TOO_STEEP) and the trolley rolls back (TROLLEY_ROLLBACK). Elderly on stairs get tired (stair speed penalty).
- **Twist:** 1:12 means **14.4 m of ramp** for 1.2 m rise, and the site isn't that long. Players must discover the **switchback ramp** with landings.
- **Insight: "Accessible design needs space, so plan it first."** Ramps are a layout problem, not an add-on.

### L5 — Jora Ghar (Shoe Room) *(new)*
- **Goal:** store 120 pairs of shoes during langar and return them fast when everyone leaves.
- **Build tools:** shoe racks (capacity 20), counters, token system (numbered racks, ₹), separate drop/pickup windows.
- **Sim:** drop-off is spread out over 10 min, but **everyone leaves at once** at the end.
- **Twist:** a design that's fine on arrival collapses at departure. One shared counter jams.
- **Insight: "Design for the peak, not the average."** Lifts, metro stations and toll booths are sized for rush hour.

### L6 — Fire Drill *(new)*
- **Goal:** everyone out of the hall within 90 s when the alarm rings.
- **Uses:** the player's own previous L1–L3 layouts plus new exits.
- **Failures:** dead-end corridors (DEAD_END), exit door swings inward and the crowd jams it shut (DOOR_SWING_WRONG_WAY), exits too narrow (EXIT_CAPACITY).
- **Twist:** the hinged doors from L1 come back. Inward-swinging doors are deadly under panic.
- **Insight: "Exit doors open outward."** Fire codes require exit doors to swing in the direction of escape, a rule written after real tragedies where crowds were trapped.
- **Number shown:** required exit width ≈ people ÷ (1.3 × seconds allowed).

### L7 — Gurpurab! (Chapter finale, stress test)
- **Goal:** replay L1, L3 and L5 using **your own saved designs**, with 3× the people.
- **Twist:** designs that earned 3 stars on a normal day may collapse.
- **Insight: "Safety factor."** Engineers design for more than the expected load (bridges, lifts, beams), because real days are never average.
- **Reward:** the hub shows the Gurdwara fully running with your designs, sangat flowing.

---

## 5. Chapter 2 — "Mistri Ji ka Workshop" (mechanics)
New simulation types; each is its own small engine in `src/sim/`.
- **Lifting the Sacks (pulley):** spec in PLAN.md §5. Twist: more pulleys = less force but much more rope to pull, so too much mechanical advantage misses the time limit. Insight: "Force × distance doesn't change; you trade one for the other."
- **The Utensil Rack (the original idea):** water drips off 40 utensils. Choose surface (solid / perforated / wire mesh), mesh gap, tilt, drip tray. Twist: big mesh gaps drain best but spoons fall through. Insight: "Mesh lets water drain *and* air flow; drying is evaporation, not just drainage."
- **The Wash Basin:** tap height, basin depth, drain size. Twist: a shallow, wide basin splashes; a tap too high splashes more. Insight: splash grows with fall height.

## 6. Chapter 3 — "Paani" (water)
- **Roof drainage:** slope and pipe size vs. monsoon rain. Twist: flat roofs pool and leak.
- **Rainwater harvesting tank:** size vs. cost vs. overflow.

## 7. Chapter 4 — "Pind" (village)
- **Footbridge over a nala:** load from crowds; bamboo vs. steel; twist: a crowd crossing in step (festival procession) loads it more.
- **Bus stop:** shade, seating, rain cover, sun angle across the day.

---

## 8. Systems spec

### 8.1 Stress-test events (reusable everywhere)
```ts
type StressEvent =
  | { kind: 'crowd'; multiplier: number }          // Gurpurab 3×
  | { kind: 'fireAlarm'; atSec: number }           // all agents → nearest exit
  | { kind: 'rush'; spawnRateMultiplier: number }
  | { kind: 'visitorMix'; elderly: number; wheelchair: number };
```
Levels can include events; Workshop mode has buttons for them.

### 8.2 Scoring
- Pass requires all goals. Stars: ⭐ pass, ⭐⭐ under target time, ⭐⭐⭐ under target time and ≤ 80% budget.
- **Personal best ghost:** show the previous run's people as faint ghosts beside the current run.
- **Attempt chart:** cost vs. time scatter of all your attempts (local only for now).

### 8.3 Agents
Add types: `wheelchair`, `trolley` (pushed, 2×2, rolls back on steep ramps), `child` (fast, unpredictable, wanders). Agents carry a `fatigue` value that rises on stairs/long routes and slows them down.

### 8.4 Game feel
- Sounds with `howler`: place (thud), erase (pop), door creak, crowd murmur that gets louder in jams, success chime, failure "oops."
- Items drop in with a bounce; camera eases to failures with 1 s slow-mo.
- Soft looping background music; mute button.
- Day lighting that warms toward evening over a run.

### 8.5 Hub & progression
- Chapter map: Gurdwara illustration with level spots; finished levels show your design running in miniature.
- Save system in `localStorage` (wrapped in try/catch): stars, best designs, unlocked insights, settings.

### 8.6 Level editor (internal tool)
`/editor` route: paint zones, walls, editable areas, spawns and routes; set budget, time and events; export JSON. Levels should take minutes, not hours.

---

## 9. Prompts for Claude Code (in order; skip any already done)

**P1 — Crate carriers can't squeeze past** *(skip if done)*
```
The squeeze-past rule breaks Level 1's lesson. Empty-handed people can still
squeeze past each other. Two crate carriers can NOT squeeze past in a doorway:
after the standoff, one backs up out of the doorway to let the other through
(costs real time, still raises HEAD_ON_JAM). Lower Level 1 time limit to 60s.
Re-run tests: one shared double door must FAIL on time, two double doors PASS.
Show me the times.
```

**P2 — Onboarding**
```
Playtest feedback: I didn't understand what to do. Make the buildable wall
glow/pulse with an outline in design mode. On first load of Level 1, show a
small arrow + hint on the wall: "Click here to add a door". Green ghost on a
valid spot, red only on invalid. Before the first simulate, briefly show
dotted arrows from the kitchen counter to the sinks and back.
```

**P3 — Crowd-aware pathfinding + one-way arrow signs**
```
Bug: with two doors everyone uses the nearer door and jams. Make A* cost
include a penalty for occupied tiles and recent wait time, and use it when
re-pathing, so blocked people re-route to a less crowded door. Re-run Level 1
with two double doors at opposite ends; show how many people used each door.
New tool: one-way arrow sign (₹200) attached to a door. R flips direction.
People may only pass in the arrow's direction. Must work in any level.
```

**P4 — Real-world scale + constants**
```
Read ROADMAP.md Section 2. Create src/sim/constants.ts with all the values in
that table, each with a comment for its real-world basis. Make tiles = 0.6 m
and set agent speeds from it. Replace magic numbers in sim and levels with
these constants. Keep all tests passing and re-tune Level 1/2 time limits so
their lessons still hold (one shared door fails, two doors pass).
```

**P5 — M6: results, stars, insight cards, Mistri Ji**
```
Build M6 using ROADMAP.md Sections 3 and 8.2: results screen with stars,
full incident cards (evidence, principle, hint), level unlocking, and the
Mistri Ji character (brief at level start, hint button after 2 failed runs).
Turn the Design Journal into "Mistri Ji ki diary" with InsightCard entries
for L1 and L2 (unlocked by failing then passing). Personal-best ghost run.
```

**P6 — Game feel pass**
```
This should feel like a game, not a website. World fills the screen; HUD is
small (top-left level + ₹ + timer, bottom build toolbar with icons, top-right
play/pause/speed). One-line brief popup. Add ROADMAP.md 8.4: sounds (howler),
bouncy placement, camera ease + 1s slow-mo on failure, crowd murmur that
rises in jams, mute button. Keep all sim logic unchanged.
```

**P7 — Workshop mode (replaces Sandbox)**
```
Replace Sandbox with Workshop: paint zones (kitchen, washing, dining, shoe
stand, storage, entrance) and stations; set traffic with route cards
("8 crate carriers: kitchen ↔ washing"); stress-event buttons from ROADMAP 8.1
(Gurpurab 3×, fire alarm, rush); live stats (delivered, avg trip, jams,
busiest tile); save/load designs; "Random challenge" button.
```

**P8 — Level editor**
```
Build the internal /editor route from ROADMAP.md 8.6 so I can make levels
by painting instead of writing JSON. Export/import level JSON.
```

**P9 — L3 Langar Queue**
```
Build Level 3 from ROADMAP.md 4 (L3): ordered station visits with service
times, sangat arriving in waves, taps / queue rails tools, detectors
QUEUE_OVERFLOW, CROSS_FLOW, UNDERUSED_HALL, a live "busiest station" marker,
and its insight card. Verify the twist: adding taps doesn't help when the
shoe stand is the bottleneck.
```

**P10 — L4 Ramp to the Roof** (heights, ramp slope, landings, wheelchair + trolley agents, detectors RAMP_TOO_STEEP, TROLLEY_ROLLBACK). Verify a straight 1:12 ramp doesn't fit and a switchback does.

**P11 — L5 Jora Ghar** (racks, tokens, drop/pickup windows, departure peak). Verify a single counter passes arrival but fails departure.

**P12 — L6 Fire Drill** (fire alarm event, exit capacity, DEAD_END, DOOR_SWING_WRONG_WAY). Verify inward-swinging exits fail.

**P13 — L7 Gurpurab + hub map** (replay saved designs at 3×, chapter map, save system). Chapter 1 complete.

**P14 — Playtest build**: production build, deploy to itch.io (or Netlify), add a feedback link.

Then Chapter 2 (pulley, utensil rack, wash basin).

---

## 10. Order of work & checkpoints
1. **Fix + feel (P1–P4, P6):** Level 1 teaches clearly and feels like a game.
2. **Loop complete (P5, P7, P8):** stars, Mistri Ji, diary, Workshop, editor.
3. **Chapter 1 content (P9–P13):** five new levels with twists.
4. **Playtest (P14):** 5 people play without help. Watch, don't explain. Note every moment of confusion.

**Definition of done for every level:**
- The "obvious first design" fails in a visible, funny way.
- The failure produces an incident card with evidence.
- There are at least two different passing designs (no single right answer).
- The insight card states a real principle with a real-world example.
- A first-time player can pass it within ~5 tries.
