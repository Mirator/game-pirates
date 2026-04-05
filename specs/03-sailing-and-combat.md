# Spec 03: Sailing and Combat

## Purpose

Define core ship handling and combat rules for the first playable game.

## Controls

- W or S: accelerate or decelerate.
- A or D: turn left or right.
- Q or E: fire left or right broadside.
- R: repair ship.
- Space: interact, dock, or collect nearby loot.
- Shift: temporary speed burst.

## Sailing Model

Arcade-first handling requirements:
- Clear forward momentum.
- Wide turning circle.
- Light drift while turning.
- Waves primarily visual, not heavy physics simulation.
- Optional light wind modifier.

Reasoning: realistic sailing simulation is high complexity and low leverage for
MVP fun.

## Combat Rules

- Cannons are split by left and right side.
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
