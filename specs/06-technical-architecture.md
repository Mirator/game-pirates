# Spec 06: Technical Architecture

## Purpose

Define the architecture constraints that keep gameplay clean now and
multiplayer-ready later.

## Core Principle

Even in singleplayer, organize systems as if networking will be added later.

## Key Entities

- Ship.
- Projectile.
- Loot.
- Island.
- Encounter.
- PlayerState.

## Key Systems

- Movement system.
- Combat system.
- Projectile system.
- Loot system.
- Spawn system.
- Event system.
- Upgrade system.
- UI system.

## Architecture Rules

- Keep simulation state separate from rendering state.
- Do not place gameplay logic inside camera code.
- Avoid DOM-driven authoritative game state.
- Prefer component and system style organization with ECS-style entity tables.
- Reserve a dedicated ECS player entity ID (`0`) that cannot be used by enemy entities.
- During ECS sync, detect player/enemy entity ID collisions, skip colliding enemy writes, and log an explicit error.
- Run gameplay simulation on a fixed timestep and render on variable framerate.
- Render path must interpolate between previous and current simulation snapshots,
  rather than snapping directly to latest fixed-step state.
- Heading interpolation must use shortest-angle blending across `-pi`/`pi`
  boundaries to avoid rotation flips.

## Render Interpolation Contract

- Before each fixed simulation tick, capture a render snapshot for:
  player, enemies, projectiles, and loot.
- Render receives interpolation alpha in `[0, 1]` as
  `alpha = accumulator / fixedStep`.
- Interpolated render-time is derived as
  `renderTime = worldTime - fixedStep * (1 - alpha)` for smooth visual
  animation of non-authoritative effects (waves, bobbing, beacons, storm VFX).
- Entities missing previous snapshots (spawn/despawn edges) must fall back to
  current simulation state safely.

## ECS System Order

Simulation tick order:
1. Input capture.
2. Event timers.
3. Enemy AI intent.
4. Movement.
5. Storm effects.
6. Combat fire.
7. Projectile motion and hits.
8. Sinking and respawn.
9. Loot lifecycle and pickup.
10. Port/menu/upgrade interactions.
11. Cleanup and projection to render/UI world view.

## Reference Folder Layout

```text
/src
  /game
  /entities
  /systems
  /ui
  /world
  /assets
  /network
```

## Multiplayer Future-Proofing

Preferred model for later:
- Each player controls one ship.

Avoid for now:
- Multiple players sharing one ship with role-based controls.

Systems that must stay clean and serializable:
- Ship movement state.
- Projectile spawn and hit handling.
- Loot ownership and pickup.
- Enemy target selection.
- Event spawning.
- Dock and port interaction rules.

Networking direction for later:
- Server authoritative simulation.
- Client prediction only where needed.
- Replicable input and world state.
