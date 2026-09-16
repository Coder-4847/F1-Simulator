# APEX Formula Motorsport

A self-contained, playable browser racing prototype with a procedural 3D open-wheel car. No build step or npm dependencies are required. Node.js 20+ is recommended.

## Run

```sh
npm start
```

Open **http://localhost:5173**. Run the simulation checks with `npm test`.

## Included

- **Track studio:** create, name, reshape, add/remove nodes, undo and save smooth closed circuits; set road width and test immediately. Three fictional tracks are included.
- **Garage:** individual primary, secondary, accent and wheel colors, four livery patterns and numbers for every car. Rotate the 3D preview and export its colored OBJ/MTL geometry.
- **Performance:** tune maximum speed, aerodynamic grip/drag, braking and suspension. Each car has its own performance settings and livery.
- **Grand Prix:** player plus nine AI drivers, five fictional constructors, configurable laps and AI difficulty, position leaderboard and third-person HUD.
- **Free practice / time trial:** unlimited laps, automatic best-lap recording, and an interpolated ghost of the best saved trajectory and heading. Recovery invalidates the current lap; editing circuit geometry or width clears its old record.
- **Runoff and barriers:** swept collision probes cover the wheels and wings, even with damage disabled. Gravel reduces grip and speed, retains lateral slip and increases tire wear; the HUD displays the current surface.
- **Conditions:** clear, overcast, light rain and heavy rain; soft, medium, hard, intermediate and wet tires with different grip and wear.
- **Strategy:** fuel mass and consumption, planned and requested pit stops, compound changes, refueling and repairs.
- **Championship:** multiple saved seasons with up to 24 custom rounds each, per-round laps, fuel, tires and fixed weather forecasts, randomized forecasts, multiple pit stops and saved driver points.
- **Persistence:** automatic browser-local saves plus JSON export/import.

## Controls

| Control | Action |
| --- | --- |
| W / Up | Throttle |
| S / Down | Brake, then reverse when stopped |
| Space | Brake without reversing |
| A / D or Left / Right | Steer the car directly |
| B | Request a pit stop at the next eligible start/finish entry |
| R | Recover with a five-second time penalty and immediate driving |
| Escape | Pause and edit AI difficulty or the next pit service |

Touch buttons are available on narrow screens. Planned stops apply to Grand Prix and championship races only, once on each specified lap from lap 2 onward. Practice and time trial have manual pit requests only. The HUD shows the next planned pit lap or NO PLANNED STOP. Tires, repairs and fuel are serviced while stopped alongside the track.

## Scope

This is an arcade prototype, not a Codemasters-equivalent physics simulation. The player controls world-space heading, throttle and brake; steering does not follow the track automatically. Physics runs in small substeps. Damage models front wing, engine and suspension performance and terminal retirement; severe damage removes the front wing visually. There is no soft-body deformation, detached debris, licensed content, online multiplayer or audio yet. Forecasts are fixed for each race. AI cars still racing are classified by progress when the player finishes. Best laps are not separated by weather or setup.

The race renderer uses native WebGL with a depth buffer, procedural asphalt/grass/gravel textures, continuous barriers, trees, grandstands, flags, tents and distant hills. WebGL support is required. Garage and maps use Canvas 2D. The car model is defined in `src/render.js` in meters, with Y up and +Z forward. Saved data lives under `apex-formula-v1` in browser local storage. Keep exported OBJ and MTL files in the same directory. A ready-to-use default model is also included in `assets/apex-v26.obj` and `assets/apex-v26.mtl`; regenerate it with `node scripts/export-model.mjs`.

## Files

- `src/core.js` — circuit interpolation, series definitions and defaults
- `src/race.js` — deterministic frame-step simulation
- `src/render.js` — car geometry, garage view and circuit maps
- `src/scene.js` — depth-tested race renderer and procedural scenery
- `src/world.js` — shared runoff geometry, swept barriers and ghost interpolation
- `src/app.js` — screens, input, persistence and orchestration
- `style.css` — responsive paddock interface and race HUD
- `tests/simulation.test.mjs` — simulation regression checks

## Verification

`npm test` runs 47 regression checks, including a complete two-lap race, AI finishes on all three presets in clear/heavy-rain conditions, high-speed collisions around both walls, gravel effects, tire/fuel/pit behavior, retirement, and ghost/recovery handling.

Open `http://localhost:5173/tests/browser.html` and choose **Run UI checks** for 58 repeatable browser integration checks, including keyboard driving, custom tracks, all ten car setups, model export, season strategies, ghosts, and backup/import. They use the isolated `apex-formula-test` save, preserving your normal paddock. The same page provides visual scene checks by circuit, sector, weather, and ghost visibility. Custom self-intersecting circuits remain unsupported; keep the racing corridor clear of itself.

## Driving assists and AI

Braking overrides held throttle. Hold S / Down to brake to a stop and then reverse (up to 29 km/h). W stops reverse motion before accelerating forward; Space brakes without reversing. Steering sensitivity is reduced and input ramps in and recenters smoothly. A healthy car can accelerate past 50 km/h on gravel from rest; steering at speed induces oversteer and sliding. R services and recenters the car immediately, adds five seconds, and invalidates the current lap.

A dynamic racing line appears in every driving mode: green to accelerate, yellow to lift, red to brake. The path smooths corner apexes and exits within the available road width; speed guidance uses actual steering authority, braking distance, tire grip, wear, weather and component damage. AI difficulty spans 0 (easy) to 100 (hard), available in Grand Prix setup, championship strategy, and the race pause menu; changes save for later sessions.

### Component damage

The HUD car diagram colors the front wing, rear wing, chassis, engine and suspension separately: green (intact), yellow (under 25%), dark yellow (25–49%), orange (50–74%), red (75%+). Percentages indicate damage, not remaining health. Front impacts damage the front wing; rear impacts damage the rear wing and engine; side impacts damage suspension. Impact speed controls severity. Wing damage reduces turning grip, suspension damage reduces steering response, and engine/chassis damage reduces top speed. Repairs and recovery update the diagram immediately.

## Local split screen

In **Grand Prix → Players / screen layout**, select **Two players · side by side** or **Two players · top and bottom**. Two humans share the track with eight AI rivals. Each viewport has its own chase camera, racing line, speed, position, lap timing, damage, tire/fuel display and minimap.

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Accelerate | W | Up arrow |
| Brake, then reverse | S | Down arrow |
| Steer | A / D | Left / Right arrows |
| Brake only | Space | Enter |
| Request pit stop | B | P |
| Recover (+5 seconds) | R | Backspace |
| Pause both players | Escape | Escape |

The split-screen pause menu has individually labeled tire/refuel settings and no pit-request button: request service using the assigned key while driving. Screen orientation can also be changed while paused. Reset penalties apply only to the player resetting; one player finishing or retiring does not end the other's race. Results show both players. Split-screen lap bests are session-only and do not replace saved solo ghosts. Single-player bindings and its pause menu remain available when **One player** is selected. Championships, practice and time trial remain single-player.

## Scenery, builder and AI update (2026-09-16)

- Scenery placement checks every section of the circuit, including an object's full footprint. Trees, tents and grandstands stay outside roads and runoff, including on Costa Azure.
- Track Studio inserts nodes along the rendered curve, restores canceled drags, and avoids empty undo entries. Saving rejects crossing tracks, duplicate neighbors and sections too close for their roads and barriers.
- Car contacts use oriented body shapes and relative impact speed. Contact forces follow the collision direction with gradual overlap correction; AI overtaking holds a lane briefly and slows behind nearby traffic.
- AI requests extra service for worn tires, significant component damage or low fuel. Tire choice follows weather and remaining race distance; repairs and refueling support longer races. Same-lap repeat stops remain blocked.
- Validation includes scenery clearance across all presets and widths, builder editing and persistence, contact behavior, and a ten-lap AI race with an unplanned tire stop.
