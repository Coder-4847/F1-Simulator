# APEX Formula Simulator — Project Handoff

Last updated: 2026-09-13

## Project identity

- Product: **APEX Formula Motorsport**, a self-contained arcade Formula racing simulator.
- Repository: `https://github.com/Coder-4847/F1-Simulator.git`
- Production site: `https://coder-4847.github.io/F1-Simulator/`
- Runtime: browser-native HTML, CSS, JavaScript, Canvas 2D, and WebGL. There are no npm dependencies or build step.
- Local requirement: Node.js 20 or newer.

## Start and verify

```sh
npm start
npm test
```

Open `http://localhost:5173/` for the app. Open `http://localhost:5173/tests/browser.html` and press **Run UI checks** for the browser integration suite. That page uses the separate `apex-formula-test` local-storage key, so normal player data is not changed.

Before pushing changes, run `npm test`, then manually run the browser checks and inspect at least one dry and one wet racing scene from the same test page.

## Implemented features

- Procedural Formula car with front/rear wings, halo, slick tires, individual liveries, numbers, wheel finishes, four patterns, and OBJ/MTL export.
- Five fictional teams and ten drivers, including the player, with individual appearance and performance setups.
- Track Studio for new circuits: move/add/remove nodes, undo, rename, set width, save, and test immediately. Three preset tracks are included.
- Grand Prix, unlimited Free Practice, and Time Trial with a saved best-lap ghost.
- Direct world-space steering. The track does not steer the player automatically, and physics uses small time substeps to avoid jitter.
- Swept barrier collision probes cover the car body, front/rear wings, and wheels. Barriers stay solid when mechanical damage is disabled.
- Asphalt, curb, grass, and gravel surfaces. Gravel reduces grip, slows the car, retains lateral slip, and increases tire wear fivefold.
- Native WebGL race renderer with depth testing, continuous walls, red/white curbs, textured asphalt/grass/gravel, trees, flags, tents, grandstands, crowds, hills, fog, rain, and gravel dust.
- Clear, overcast, light-rain, and heavy-rain conditions.
- Soft, medium, hard, intermediate, and wet tires with weather-sensitive grip and wear.
- Fuel mass/consumption, planned and requested pit stops, tire changes, refueling, and repairs.
- Front-wing, engine, suspension, collision, and terminal-retirement damage.
- Custom seasons with multiple saved championships, up to 24 rounds, custom tracks, weather forecasts, randomized forecasts, per-round laps/fuel/starting tires, multiple pit stops, results, and points.
- Third-person HUD, minimap, surface indicator, live leaderboard, timing, fuel, tire life, and damage readouts.
- Browser-local persistence and JSON paddock export/import.

## Architecture

- `index.html` — application shell and metadata.
- `style.css` — responsive paddock UI, garage, editor, HUD, and mobile controls.
- `src/core.js` — teams, tires, weather, default state, track generation/interpolation, scoring, and formatting.
- `src/world.js` — shared runoff dimensions, surface definitions, world/track projection, swept barrier collision, footprint clearance, and ghost interpolation.
- `src/race.js` — deterministic race simulation, player/AI movement, pits, fuel, tires, damage, laps, recovery, and standings.
- `src/render.js` — procedural car mesh, garage renderer, minimaps, and race-renderer entry point.
- `src/scene.js` — native WebGL renderer and procedural circuit environment.
- `src/app.js` — navigation, screens, input, state persistence, track editor, garage, race loop, seasons, import/export, and HUD.
- `tests/simulation.test.mjs` — 23 engine/regression tests.
- `tests/browser.html` and `tests/browser.js` — 26 isolated end-to-end browser checks and visual scene controls.
- `scripts/export-model.mjs` — regenerates the default OBJ/MTL assets.
- `server.mjs` — dependency-free local static server.
- `.github/workflows/deploy-pages.yml` — tests and deploys the static project on every push to `main`.

## Persistence schema

- Normal app storage key: `apex-formula-v1`.
- Browser-test storage key: `apex-formula-test`.
- State includes `tracks`, `selectedTrack`, `car`, per-driver `cars`, `race`, `season`, `seasonId`, `seasonLibrary`, and `records`.
- Saved ghosts contain timestamped distance, offset, world X/Z, and heading samples. Legacy distance/offset-only ghosts remain supported.
- Changing a track's control points or width clears that track's old lap record.
- Recovery invalidates the current lap so teleporting cannot create a false record.

## Validation baseline

At this handoff:

- All **23** Node simulation tests pass.
- All **26** browser integration checks pass.
- The AI completes all three preset circuits in clear and heavy-rain conditions.
- Barrier stress tests try 30-meter movements through both walls around every preset circuit.
- Browser checks cover keyboard driving/braking, Track Studio persistence, all ten car setups, OBJ/MTL export, seasons, multi-stop strategy, weather, fuel, backup/import, ghosts, WebGL rendering, and reload persistence.

## Known scope limits

- This is an arcade prototype, not a licensed or full soft-body physics simulation.
- Custom tracks should not cross over themselves; self-intersecting racing corridors are unsupported.
- WebGL support/hardware acceleration is required for the race view. Garage and maps use Canvas 2D.
- There is no sound, online multiplayer, licensed F1 branding, detached debris, or soft-body deformation.
- Forecasts are fixed for each race and best laps are not split by setup/weather class.

## Deployment

GitHub Pages deploys from the `main` branch through the included workflow. The workflow runs `npm test` before uploading the static repository. If deployment is not active, open repository **Settings → Pages** and set **Source** to **GitHub Actions**, then re-run the `Deploy GitHub Pages` workflow.

When resuming work, read this file and `README.md`, run both test suites, and preserve the `apex-formula-v1` schema unless a migration is added.
