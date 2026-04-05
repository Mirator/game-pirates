# Spec 04: World Economy and Encounters

## Purpose

Define the playable world, rewards, enemies, and event structure.

## World Structure

Use a small open map, not mission-only levels.

Map zones:
- Safe port waters (low danger).
- Beginner zone (weak enemies).
- Contested waters (mid-tier encounters).
- Danger zone (high risk, high reward).

## Island Types

- Port island: repairs, upgrades, shop.
- Treasure island: hidden chest or map objective.
- Hostile island: guarded location or ambush zone.
- Scenic island: visual variety and future hooks.

MVP interaction model:
- No full on-foot gameplay.
- Docking opens interaction menu.
- Treasure can be collected through simple interact points.

## Loot and Economy

Loot types:
- Gold: primary currency.
- Cargo: sold at port.
- Repair materials: consumed for repairs.
- Treasure maps: optional objective item.

Loot sources:
- Sunk enemy ships.
- Floating wreckage.
- Island chests.
- Event rewards.

Economy rule:
- Economy supports progression and clarity, not deep simulation.

## Enemy Types

Merchant ship:
- Weak defenses.
- Avoids combat.
- Drops valuable cargo.

Pirate raider:
- Balanced baseline enemy.
- Aggressive pursuit behavior.
- Most common encounter.

Navy ship:
- Stronger hull and weapons.
- More dangerous behavior.
- Higher reward.

## AI Behavior States

- Patrol.
- Detect target.
- Chase.
- Line up broadside.
- Fire.
- Flee at low HP.

## World Events

MVP events:
- Treasure marker appears.
- Enemy convoy crosses the map.
- Storm area reduces visibility.
- Navy patrol enters region.

Future events:
- Sea monster encounter.
- Port raid.
- Faction conflict.
- Bounty hunters targeting player.
