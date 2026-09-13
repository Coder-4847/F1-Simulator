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
| S / Down / Space | Brake |
| A / D or Left / Right | Steer the car directly |
| B | Request a pit stop at the next eligible start/finish entry |
| R | Recover with an eight-second time penalty and service delay |
| Escape | Pause and edit the next pit service |

Touch buttons are available on narrow screens. Planned pit entry opens at the start of lap 2 onward. Tires, repairs and fuel are serviced while stopped alongside the track.

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

`npm test` runs 23 regression checks, including a complete two-lap race, AI finishes on all three presets in clear/heavy-rain conditions, high-speed collisions around both walls, gravel effects, tire/fuel/pit behavior, retirement, and ghost/recovery handling.

Open `http://localhost:5173/tests/browser.html` and choose **Run UI checks** for 26 repeatable browser integration checks, including keyboard driving, custom tracks, all ten car setups, model export, season strategies, ghosts, and backup/import. They use the isolated `apex-formula-test` save, preserving your normal paddock. The same page provides visual scene checks by circuit, sector, weather, and ghost visibility. Custom self-intersecting circuits remain unsupported; keep the racing corridor clear of itself.
