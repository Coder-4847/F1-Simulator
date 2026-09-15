# APEX Formula Simulator — Project Handoff

Last updated: 2026-09-15

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
- `tests/simulation.test.mjs` — 39 engine/regression tests.
- `tests/browser.html` and `tests/browser.js` — 52 isolated end-to-end browser checks and visual scene controls.
- `scripts/export-model.mjs` — regenerates the default OBJ/MTL assets.
- `server.mjs` — dependency-free local static server.
- `.github/workflows/ci.yml` — runs the simulation tests on pushes and pull requests.

## Persistence schema

- Normal app storage key: `apex-formula-v1`.
- Browser-test storage key: `apex-formula-test`.
- State includes `tracks`, `selectedTrack`, `car`, per-driver `cars`, `race`, `season`, `seasonId`, `seasonLibrary`, and `records`.
- Saved ghosts contain timestamped distance, offset, world X/Z, and heading samples. Legacy distance/offset-only ghosts remain supported.
- Changing a track's control points or width clears that track's old lap record.
- Recovery invalidates the current lap so teleporting cannot create a false record.

## Validation baseline

At this handoff:

- All **39** Node simulation tests pass.
- All **52** browser integration checks pass.
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

GitHub Pages deploys the static project from the `main` branch and repository root. The separate `Simulator Tests` workflow runs `npm test` on pushes and pull requests.

When resuming work, read this file and `README.md`, run both test suites, and preserve the `apex-formula-v1` schema unless a migration is added.

## Driving update (2026-09-15)

- Brake overrides simultaneous throttle; S, Down and Space remain brake bindings.
- Gravel resistance scales from zero at rest so throttle can get the car moving; turning at speed adds decaying yaw slip for oversteer.
- R immediately recenters/services the car, adds five seconds, invalidates the lap and clears pit holds/requests. A planned stop for the current lap is marked serviced to avoid a new hold immediately after reset.
- Every driving mode renders a dashed green/yellow/red racing guide, with upcoming-corner braking distances, weather, wear and tire grip affecting its colors.
- AI difficulty spans 0–100, with controls in Grand Prix setup, championship strategy and the live race pause menu. Live changes persist.
- Validation: 27 simulation checks and 31 browser checks; dry and heavy-rain scenes visually checked with WebGL error 0.

## Follow-up driving update (2026-09-15)

- Planned stops apply only to races, once per configured lap. Pit timers clamp to zero after service so later planned stops work. Re-entry on the same lap is blocked. Practice/time trial explain manual-only service; HUD names the next pit lap.
- S/Down brakes forward motion and then reverses to a maximum 8 m/s. W brakes reverse motion before driving forward; Space is brake-only. Speed is now signed in simulation, absolute in HUD, fuel and wear; reverse displays R.
- Steering uses exponential input smoothing (7/s), lower steering authority (1.12 base versus 1.55), and correct reverse steering.
- Gravel drive traction is independent from lateral grip. Speed-dependent resistance permits a healthy car to exceed 50 km/h from rest while retaining loose handling.
- src/handling.js shares steering limits and grip between player physics and racing guidance, and provides the component damage diagram. Front wing/rear wing/suspension/engine/chassis have distinct HUD colors and damage percentages. Collision direction selects the affected component; impact speed sets severity.
- src/racing-line.js caches a bounded smoothed circuit path and computes braking guidance from actual steering authority instead of the old arbitrary corner-speed formula.
- Verification: 34 simulation checks; 35 browser checks including reverse, damage HUD and AI settings. Dry and wet scenes inspected.

## Local split screen (2026-09-15)

- Grand Prix setup has a Players / screen layout selector: solo, side by side, top/bottom. Stored as race.splitScreen (solo/side/stacked). Existing saves default to solo. Championship launches explicitly force solo; practice/time trial remain solo.
- Two humans are car IDs 0 and 1, with eight AI opponents. P1 uses WASD/Space/B/R; P2 uses arrows/Enter/P/Backspace. Escape pauses both. Solo input aliases remain unchanged.
- Race physics is still stepped once. playerState(r,id) returns the timing/steering/pit state for each human (r for P1; r.player2 for P2). In split mode recovery increments the individual's penalty instead of advancing the shared clock. The race ends only when both human cars finish or retire.
- src/split-screen.js owns split markup, per-player HUDs, two stable renderer views, pause strategy controls, and results. Each canvas follows its viewPlayer; both cameras render the shared cars. Per-player racing-line colors use that driver's condition and speed.
- Split pause has independent tire/fuel controls, AI difficulty, orientation, resume/end; pit requests are keyboard-only. Orientation may be changed without restarting.
- Split best laps stay in the session; solo persisted records/ghosts are not replaced. P2 uses the second garage car's setup/livery.
- 39 simulation checks pass, including an entire two-human lap, independent input/service/reset, shared pause and independent finish/retirement.

- Split-screen validation: 52 browser checks pass, including both orientations, independent keyboard input/pit requests/reset penalties, separate service settings, replay, and restoration of the solo pause menu. Both orientations visually inspected.
