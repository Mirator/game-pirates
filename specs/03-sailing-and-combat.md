# Spec 03: Sailing and Combat

## Purpose

Define core ship handling and combat rules for the first playable game.

## Controls

- W or S: accelerate or decelerate.
- A or D: turn port or starboard.
- Q or E: fire port or starboard broadside.
- R: repair ship.
- Space: interact, dock, or collect nearby loot.
- Shift: temporary speed burst (1.35x speed cap, 1.2s active, 4.0s cooldown).

## Sailing Model

Arcade-first handling requirements:
- Clear forward momentum.
- Wide turning circle.
- Light drift while turning.
- Waves primarily visual, not heavy physics simulation.
- Optional light wind modifier.

### Motion Smoothness Requirements

- Sailing and turning must not exhibit visible freeze-jump stepping ("earthquake"
  jitter) on common 60 Hz to 165 Hz displays.
- Visual ship, projectile, and loot motion should remain continuous between
  simulation ticks through render interpolation.
- Wave and buoyancy visual motion should advance on render-time, not only
  fixed simulation ticks.

### Camera Stability Requirements

- Camera follow should prioritize combat readability over cinematic whip.
- Rapid heading micro-oscillation from steering should be damped so the camera
  does not jitter frame-to-frame.
- Speed-based camera offsets may exist, but should be restrained to avoid
  disorienting swings at high speed.

### World Boundary Behavior

- The playable sea is bounded by a circular world radius.
- Player ship uses a soft bounce at the boundary:
  clamp position to the boundary, reflect heading only when moving outward,
  and damp speed and drift.
- Enemy ships may keep a simpler inward correction to preserve AI stability.

Reasoning: realistic sailing simulation is high complexity and low leverage for
MVP fun.

## Combat Rules

- Cannons are split by port and starboard side.
- Each side has an independent reload timer.
- Cannonballs are visible projectiles.
- Enemy hits damage hull HP.
- Ships sink at zero HP and drop loot.

## Combat Depth For MVP

- Positioning matters.
- Broadside angle matters.
- Reload timing matters.
- Range affects hit reliability.

## Damage Model

MVP:
- Hull HP only.

Future optional extensions:
- Sail damage.
- Crew damage.
- Special ammo.
- Critical hit zones.
