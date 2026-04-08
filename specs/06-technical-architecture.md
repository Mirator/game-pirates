# Spec 06: Technical Architecture

## Purpose

Define architecture constraints for deterministic gameplay simulation,
render-simulation separation, and multiplayer-ready data flow.

Cross-spec dependencies:

- Spec 11 (physics authority).
- Spec 12 (ship handling authority).
- Spec 08/10 (render-only water/wake presentation consuming simulation state).

## Core Principle

Keep simulation authoritative, serializable, and deterministic under fixed-step
updates.

## Key Entities

- Ship.
- Projectile.
- Loot/Floating object.
- Island.
- Encounter/Event state.
- PlayerState.

## Key Systems

- Input and interaction system.
- Movement handling controller (throttle/turn/boost, speed states, stabilization).
- Physics integration system (gravity, buoyancy, drag, vertical damping).
- Collision and impulse system.
- Combat fire + projectile system.
- Damage/sinking/respawn system.
- Loot lifecycle and pickup system.
- Event, spawn, and AI systems.
- UI projection and render bridge systems.

## Architecture Rules

- Keep simulation state separate from rendering state.
- Do not put gameplay authority in camera, HUD, or DOM code.
- Run gameplay on fixed timestep; render may interpolate.
- Preserve ECS-style entity tables with stable IDs.
- Reserve entity `0` for player and reject enemy collisions with that ID.
- Keep atmosphere/water/wake as render-owned visual systems only.
- Simulation owns physical values used by render (position, heading, pitch/roll,
  velocities, damage/sink state).
- Water-height sampling contract must stay compatible between simulation and
  rendering paths.

## Fixed-Step and Interpolation Contract

- Capture previous render snapshot before each fixed simulation tick.
- Compute interpolation alpha as `accumulator / fixedStep`.
- Interpolate ship/enemy/projectile/loot transforms for render only.
- Handle spawn/despawn edges by safely falling back to current simulation state.

## ECS System Order

Simulation tick order:

1. Input capture and interaction intent.
2. Event timers and world-event lifecycle.
3. AI intent generation.
4. Ship planar handling update (Spec 12) + buoyancy/gravity update (Spec 11).
5. Bounds correction and collision/impulse resolution.
6. Combat fire and recoil application.
7. Projectile ballistic integration and hit resolution.
8. Sinking/respawn progression.
9. Floating loot physics and pickup.
10. Port/menu/upgrade interactions.
11. Cleanup and world-view projection for render/UI.

## Collision and Layering Contract

- Use simplified colliders, not render meshes, for gameplay collisions.
- Required layers:
  - world static
  - ships
  - projectiles
  - pickups/debris
  - VFX non-colliding

## Multiplayer Future-Proofing

Systems that must stay clean and serializable:

- Ship physical state (including velocity/rotation state).
- Projectile spawn + hit handling.
- Loot ownership and pickup.
- Enemy target selection and events.
- Port interaction and upgrade outcomes.

Future networking direction:

- Server-authoritative simulation.
- Client interpolation/prediction as needed.
- Replicable input and world-state deltas.
