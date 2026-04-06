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
