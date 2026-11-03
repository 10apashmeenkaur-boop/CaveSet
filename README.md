# Design Lab

**Design for how a thing is used, not just what it holds.**

Design Lab is a browser simulation game about everyday engineering. You design a doorway, a corridor, a queue, a ramp or a utensil rack for a community kitchen, then press Simulate and watch real-feeling people (and water) use it. When the design is wrong, the simulation breaks in a way you can see, and an incident card explains why, with the real engineering principle behind it.

The idea came from a wire-mesh utensil rack at a gurdwara: a solid box would hold the dishes, but only a mesh lets them drain and dry. The game is built around that "oh, that's why it's made like that" moment: **fail first, learn after.**

## Levels

| | Level | What it teaches |
|---|---|---|
| 1 | The Doorway | Doors must fit the load, not just the person; separate the in and out flows (one-way signs). |
| 2 | The Service Corridor | Front of house, back of house: keep service routes away from people eating. |
| 3 | Langar Queue | The slowest station sets the speed of the whole line. |
| 4 | Ramp to the Roof | 1:12 ramps need space: a switchback with landings, and handrails for elderly visitors. |
| Object 1 | The Utensil Rack | Drying is mostly evaporation: open area, airflow, plate spacing, frame material and where the water goes. |

Every level has a fixed seed, so the same design always gives the same result, and at least two different designs pass. Stars reward passing, finishing on time and staying within a cost target.

## Features

- Isometric 3D world built with React Three Fiber; simulation logic on a 2D grid.
- Crowd-aware pathfinding, door swing blocking, one-way signs, queues, ramps and stairs with real slopes.
- Incident cards with evidence, the principle and a hint; a Master Builder who nudges after repeated failures.
- Design Notebook: insight pages unlocked by failing and then passing a level.
- Real-world scale (1 tile = 0.6 m, walking speeds from m/s, 1:12 ramps, plate and material data), all in `src/sim/constants.ts`.
- Personal-best ghost run, heatmap of where people waited, results panel you can hide to look at the scene.

## Tech

Vite · React 18 · TypeScript · @react-three/fiber + drei · zustand · Vitest

The simulation in `src/sim/` is pure TypeScript with no React or Three imports. It is deterministic (10 ticks per second, seeded RNG) and covered by unit tests. Levels are JSON files in `src/levels/`.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # simulation tests
npm run build    # production build in dist/
```

## Project notes

- `CLAUDE.md`: the agreed rules and design decisions.
- `ROADMAP.md` and `PLAN.md`: the build plan and upcoming levels (shoe room, fire drill, festival crowd, pulley, wash basin).
