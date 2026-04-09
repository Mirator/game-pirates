# Blackwake Isles Browser Prototype

Current browser prototype for the pirate game design:
- stylized sea map with port marker and enemy spawns
- gravity-based ship buoyancy physics with arcade-weighted handling, follow camera, and broadside cannon combat
- GLB-first ship visuals (`player_v2`, `enemy_raider_v2`, `enemy_navy_v2`) with procedural fallback safety
- ballistic cannonballs and floating loot object water interaction
- enemy spawn director (mixed merchant/raider/navy archetypes with staggered pressure and active enemy caps)
- loot drops (gold, cargo, and repair materials)
- dock interaction + upgrade menu (Hull Reinforcement)
- HUD with minimap, resources, reload timers, and contextual prompts
- synthesized WebAudio SFX for combat, loot, docking, repair, and upgrade

## Controls

- `W` / `S` or `Arrow Up` / `Arrow Down`: accelerate / weak reverse + braking
- `A` / `D` or `Arrow Left` / `Arrow Right`: turn left / right
- `Q` / `E`: fire left / right batteries
- `Space`: collect loot / dock / undock
- `R`: consume repair material to repair hull (cooldown applies)
- `Shift`: hold for temporary speed burst (release ends burst, cooldown applies)
- `Right Mouse Button` + drag: orbit camera around ship (yaw + clamped pitch, angle persists on release)
- `Esc`: close dock menu
- `F3`: toggle debug overlay

## Scripts

- `npm run dev`: start local dev server
- `npm run assets:ships`: regenerate GLB ship assets in `public/assets/ships`
- `npm run build`: type-check and production build
- `npm run test`: run simulation unit tests
- `npm run test:e2e`: run Playwright browser smoke tests (CPU-capped, single worker by default)
- `npm run test:e2e:fast`: run Playwright tests with a single worker (CPU-safe)

For custom caps you can set `E2E_WORKERS`, for example:
- PowerShell: `$env:E2E_WORKERS=2; npm run test:e2e`

E2E low-power defaults can be overridden when needed:
- `VITE_MAX_RENDER_FPS` (default `8`) limits loop/render frequency.
- `VITE_SKIP_3D_RENDER` (default `1`) disables WebGL draw calls during E2E while keeping simulation/debug state updates.
- `VITE_RENDER_LOW_POWER` (default `1`) lowers renderer quality for test mode.
- `VITE_RENDER_PIXEL_RATIO_CAP` (default `1`) caps render pixel ratio.
- `VITE_PHYSICS_TICK_HZ` (default `30`) controls fixed-step simulation rate for E2E.

## Specs Source Of Truth

- The canonical specs live in `specs/`.
- Do not rely on archived zip snapshots for authoritative requirements.
