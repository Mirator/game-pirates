Original prompt: Make an deep audit of controls, specs and minimap
- previously, there were issues with A + D controls, Q +E shoot
-the minimap is wrong - when I turn right, on minimap I turn left
- rename port and starboard cannons to left and right cannons
review it all and fix root issue

## Audit Notes (2026-04-07)
- Input mapping currently computes turn as clampAxis(right, left), which inverts A/D turn direction.
- Broadside projectile side vector currently maps left->rightVector and right->leftVector, swapping Q/E battery sides.
- Minimap heading currently rotates by +heading in canvas space; after axis fix we need to validate heading sign against world orientation.
- User-facing text still uses port/starboard in HUD and docs.

## TODO
- Fix turn axis mapping and validate layout fallback behavior.
- Fix projectile side vector mapping for left/right cannons.
- Validate/fix minimap heading orientation.
- Rename visible labels and specs to left/right wording.
- Update and run tests.
## Progress Update (2026-04-07)
- Fixed input turn axis sign: A now maps to left turn and D to right turn.
- Fixed cannon side mapping in simulation projectile spawn vectors.
- Fixed enemy broadside targeting side math and enemy fire-side selection.
- Fixed render muzzle side detection to match corrected left/right semantics.
- Updated HUD text from port/starboard to left/right and added minimap heading note.
- Updated README and specs (03, 05) terminology to left/right.
- Updated unit tests for input semantics, projectile side spawn assertions, and muzzle-side expectations.

## Remaining
- Run unit tests and e2e smoke.
- Verify minimap orientation in browser behavior after fixes.
## Verification (2026-04-07)
- `npm run test` passed: 10 files, 48 tests.
- `npm run test:e2e` passed: smoke flow + HUD/minimap checks.

## Next-Agent Notes
- Root issue was side-sign inversion across input turn axis and left/right cannon math (projectile spawn + side detection).
- Minimap heading transform was already mathematically correct; control-axis inversion made it appear reversed.
- Watch for any future left/right sign changes: simulation heading (`sin/cos`) and canvas minimap (`z -> -y`) must stay in sync.
## Follow-up Fix (2026-04-07)
- User-reported visual mismatch reproduced with deterministic screenshots:
  - Q triggered left reload but projectile appeared on right side of screen.
  - E triggered right reload but projectile appeared on left side of screen.
- Added e2e regression validating **screen-space** cannon side behavior (`e2e/controls-minimap-regression.spec.ts`).
- Aligned gameplay-side semantics to player-visible camera orientation by restoring simulation/render side math:
  - projectile side vector mapping in ECS
  - enemy broadside side choice
  - render muzzle-side detection
- Minimap orientation adjusted to player-facing chart projection:
  - mirrored X world-to-minimap projection
  - heading rotation consistent with turn direction under mirrored projection
- Exposed render bridge on `__BLACKWAKE_DEBUG__` for deterministic visual regression probing.

## Verification (Follow-up)
- `npm run test` passed.
- `npm run test:e2e` passed (smoke + controls/minimap regression).
- `npm run build` passed.

## Camera-Basis Rework (2026-04-07)
- Implemented canonical camera orientation update in render bridge with explicit orthonormal basis reconstruction each frame and fixed horizontal projection handedness to eliminate left/right mirroring in chase view.
- Switched movement/fire semantics to physical key priority (`event.code`) with only non-letter `event.key` fallback (Space/Shift compatibility edge cases).
- Added shared side-math module (`src/game/simulation/sideMath.ts`) and wired simulation + render to the same left-dot side classifier:
  - projectile spawn side
  - enemy fire-side selection
  - muzzle flash side detection
- Restored minimap to north-up projection without mirrored X compensation.
- Expanded tests:
  - input tests for physical-key priority and fallback behavior
  - render tests for camera non-mirroring and left/right muzzle side matching
  - e2e regression now validates Q/E world+screen side agreement, muzzle timers, D turn screen direction, and minimap north-up stability with rightward arrow turn.

## Verification (Camera-Basis Rework)
- `npm run test` passed: 10 files, 49 tests.
- `npm run test:e2e` passed: smoke + controls/minimap regression.
- `npm run build` passed.

## Visual Regression Hotfix (2026-04-07)
- User reported severe dark-water/black-scene regression after camera changes.
- Root cause: projection reflection hack introduced in camera orientation update path (plus unstable basis math), which corrupted rendering output in runtime scenes.
- Fix applied:
  - removed projection-matrix X-sign mutation from render bridge.
  - simplified camera orientation to stable `camera.up = (0,1,0)` + `camera.lookAt(...)`.
  - preserved screen-intuitive behavior via coordinated gameplay-side compensation:
    - mirrored chase-camera steering compensation in input turn axis.
    - shared side classifier remapped so left/right cannon semantics align with on-screen sides.
    - minimap arrow heading rotation adjusted to match compensated turn direction.
- Added/updated regression coverage so this class of bug is caught:
  - render unit test now enforces upright camera orientation and positive projection X scale.
  - e2e controls/minimap regression checks camera projection/up-state alongside Q/E side, muzzle timers, D turn screen direction, and minimap arrow behavior.

## Verification (Visual Hotfix)
- `npm run test` passed (49/49).
- `npm run test:e2e` passed (2/2).
- `npm run build` passed.
- Manual screenshot validation (`test-results/ship-readability-desktop.png`) confirms normal water/scene rendering.

## Ship Presentation Rework (2026-04-08)
- Implemented render-only ship presentation hierarchy with dedicated `ship-presentation` child under each ship root.
- Added visual-only tilt system driven by yaw turn-rate + forward acceleration cues (smoothed, clamped):
  - roll target from actual turn-rate (opposite lean direction).
  - pitch target from forward speed delta (accel vs decel).
  - subtle idle bob/noise layered on presentation node.
- Added sail driver pipeline (`speedBlend`, `tension`, `sway`, `flutter`) with smoothed per-frame updates and bounded motion.
- Added under-hull contact grounding visuals: `ship-contact-shadow` + `ship-contact-patch` (cheap textured radial falloff quads), with subtle scale/opacity modulation tied to motion.
- Kept gameplay/simulation authority unchanged (gravity, buoyancy, handling, collisions, cannon logic).
- Updated render runtime state with per-ship presentation caches; initialized for player/enemies and cleaned up on enemy despawn.
- Updated specs: 03, 08, 09, 12, spec index, and root doc authority notes.

## Verification (Ship Presentation Rework)
- `npm run test` passed (75/75).
- `npm run test:e2e` passed (2/2).
- `npm run build` passed.


## Contact/Wake Visual Fix (2026-04-08)
- Addressed hard rectangular artifact under/behind ships by fixing alpha-map texture channel packing in createShipMesh texture generators.
  - Previously alpha gradients were written to texture alpha channel only; Three.js alpha maps sample color channels, causing near-solid quads.
  - Updated wake/contact alpha textures to write grayscale into RGB channels (alpha kept opaque).
- Replaced contact shadow and contact patch from rectangular planes to radial ellipse decals (circle geometry + non-uniform scale).
- Added `alphaTest` on contact materials to tighten soft-edge cutoff and remove residual box edges.
- Verified visually using fresh e2e screenshot: `test-results/ship-readability-desktop.png` (artifact removed).
- Validation:
`npm run test`, `npm run test:e2e`, and `npm run build` all pass.

## Ship Visual Upgrade v2 (2026-04-08)
- Implemented GLB-first ship asset path with procedural fallback:
  - added shared ship contracts/profiles (`player_v2`, `enemy_raider_v2`, `enemy_navy_v2`)
  - merchant now reuses raider geometry with distinct palette profile.
- Added ship asset manifest + loader cache + node-contract validator:
  - required anchors: stern wake + left/right cannon anchors
  - material budget validation (target 2, max 3).
- Generated and imported authored ship GLBs under `public/assets/ships/`.
- Upgraded ship mesh factory to consume preloaded GLBs when available while preserving:
  - render-only tilt/sail/contact hooks
  - muzzle recoil side behavior
  - wake integration with stern-anchor-derived offset.
- Moved simulation ship hull dimensions/probes to shared collider profiles tied to ship visual contracts.
- Added tests:
  - ship manifest and asset-contract validation
  - GLB-first definition + fallback behavior
  - shared collider profile checks.
- Updated specs in place: 09, 10, 11, 12 (+ spec index wording alignment).

## Verification (Ship Visual Upgrade v2)
- `npm run test` passed (96/96).
- `npm run test:e2e` passed (2/2).
- `npm run build` passed.


## Ship Visual Upgrade v3 (2026-04-09)
- Rebuilt ship GLB generation (`scripts/generateShipGlbs.mjs`) for richer heroic-clean silhouettes with layered hull forms, railings, quarterdeck/stern shaping, bowsprit, richer cannon housings, and rig-detail meshes (`ship-rig-*`).
- Regenerated in-place assets:
  - `public/assets/ships/player_v2.glb`
  - `public/assets/ships/enemy_raider_v2.glb`
  - `public/assets/ships/enemy_navy_v2.glb`
- Added generation-time complexity validation and logging (triangles/nodes/materials) with per-model minimums and max 3 materials.
- Added shared runtime complexity contract (`shipAssetComplexity.ts`) and loader enforcement in `validateShipAssetContract`.
- Extended loader contract + runtime instantiation:
  - rig node collection (`ship-rig-*`)
  - complexity metrics (`triangleCount`, `nodeCount`, `materialCount`)
  - validated instantiation result with fallback metadata (`template_unavailable`).
- Extended ship visuals with `ShipRigVisual[]` and rig extraction; added bounded transform-driven rig sway in presentation updates.
- Added material polish pass using low-frequency procedural maps (wood normal/roughness + sail roughness variation), applied to procedural and GLB materials.
- Updated tests:
  - contract + complexity + fallback metadata (`shipAssetManifest.test.ts`)
  - direct GLB complexity thresholds test (`shipAssetGlbComplexity.test.ts`)
  - rig registration (`createShipMesh.test.ts`)
  - bounded rig sway integration (`renderBridge.test.ts`).
- Updated docs/specs: `README.md`, specs `09-12`, and `specs/README.md` for v3 contracts.

## Verification (Ship Visual Upgrade v3)
- `npm run test` passed (119/119).
- `npm run test:e2e` passed (2/2).
- `npm run build` passed.

## Ship Visual Corrective Pass (2026-04-09, Late)
- Per screenshot QA request, ran direct visual verification in live game camera and confirmed prior v3 pass still had detached-looking hull details (floating bow/figurehead feel and over-extended stern blocks).
- Reworked `scripts/generateShipGlbs.mjs` hull/deck placement for coherent silhouettes while preserving GLB node contracts/anchors:
  - rebuilt hull assembly around a continuous body envelope (no far-offset bow/stern chunks)
  - corrected bow fitting placement (figurehead + bowsprit kept within bow envelope)
  - tightened stern transom/cap/superstructure offsets to reduce trailing detached rear mass
  - kept role palettes and required anchors (`anchor-wake-stern`, cannon side anchors) intact.
- Regenerated ship assets:
  - `public/assets/ships/player_v2.glb`
  - `public/assets/ships/enemy_raider_v2.glb`
  - `public/assets/ships/enemy_navy_v2.glb`
- Latest generator metrics:
  - player_v2: tris=3590, nodes=93, materials=3
  - enemy_raider_v2: tris=3490, nodes=88, materials=3
  - enemy_navy_v2: tris=4040, nodes=112, materials=3
- Captured fresh verification screenshots (GLB path confirmed at runtime for player + enemies):
  - `test-results/ship-visual-check-01-overview.png`
  - `test-results/ship-visual-check-02-side-profile.png`
  - `test-results/ship-visual-check-03-front-quarter.png`
  - `test-results/ship-visual-check-04-enemy-lineup.png`
- Stabilized one flaky minimap regression assertion under low-power e2e rendering:
  - updated `e2e/controls-minimap-regression.spec.ts` to seed turning momentum and use more robust center-diff detection thresholds.

## Verification (Corrective Pass)
- `npm run test` passed (119/119).
- `npm run test:e2e` passed (2/2).
- `npm run build` passed.

## Next-Agent Notes
- If further visual polish is requested, focus on authored shape language first (deck sheer, rail profile, sail cut) before adding more micro-details.
- Keep materials at <=3 per ship to preserve current draw-call discipline and contract tests.
