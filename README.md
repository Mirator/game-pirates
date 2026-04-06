# Blackwake Isles - Phase 2 First Playable

Phase 2 browser prototype for the pirate game design:
- stylized sea map with port marker and enemy spawns
- player ship movement, follow camera, and broadside cannon combat
- enemy spawn director (up to 2 active raiders with staggered pressure)
- loot drops (gold, cargo, repair materials, and treasure maps)
- dock interaction + upgrade menu (Hull Reinforcement)
- HUD with minimap, resources, reload timers, objective and prompts
- synthesized WebAudio SFX for combat, loot, docking, repair, and upgrade

## Controls

- `W` / `S`: accelerate / decelerate
- `A` / `D`: turn port / starboard
- `Q` / `E`: fire port / starboard batteries
- `Space`: collect loot / dock / undock
- `R`: consume repair material to repair hull (cooldown applies)
- `Shift`: hold for temporary speed burst (cooldown applies)
- `Esc`: close dock menu
- `F3`: toggle debug overlay

## Scripts

- `npm run dev`: start local dev server
- `npm run build`: type-check and production build
- `npm run test`: run simulation unit tests
- `npm run test:e2e`: run Playwright browser smoke tests
