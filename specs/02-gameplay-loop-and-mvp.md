# Spec 02: Gameplay Loop and MVP

## Purpose

Define the gameplay loops and the minimum feature set for a successful MVP.

## Authority

This spec is authoritative for MVP loop shape and minimum deliverable feature
set.

## Dependencies

- Spec 01 for product vision and fantasy alignment.
- Spec 03 and Spec 04 for concrete combat/world implementation details.

## Core Gameplay Loop

### Moment To Moment

- Steer ship.
- Manage speed and heading.
- Line up broadside angle.
- Fire cannons.
- Avoid incoming shots.
- Collect floating loot.

### Mid Session

- Travel to island, encounter, or world event.
- Win combat encounters.
- Collect rewards.
- Return to port.
- Repair and upgrade ship.

### Long Term

- Unlock stronger upgrades.
- Enter more dangerous waters.
- Defeat tougher enemies.
- Increase wealth and reputation.

## MVP Scope

The MVP includes:
- One player ship.
- Open sea map.
- 3 to 5 islands.
- 2 to 3 enemy ship types.
- Broadside cannon combat.
- Loot drops and collection.
- One port with repair and upgrades.
- Simple progression loop.

## MVP Success Criteria

The MVP is successful when:
- Sailing is responsive and enjoyable.
- Combat is easy to understand.
- Players have a reason to keep playing for 15 to 30 minutes.
- Code structure clearly separates game state from rendering and UI.
- Movement and camera feel smooth during sustained steering and throttle,
  without visible fixed-tick freeze-jump jitter.
- Frame pacing remains stable during active sailing/combat, including with HUD
  and minimap visible.

## Example First 10 Minutes

1. Player spawns near starting port.
2. HUD prompts reinforce movement and cannon controls.
3. Player sails into contested water.
4. A weak merchant ship appears.
5. Player lines up broadside and sinks it.
6. Loot floats and is collected.
7. Player returns to port.
8. Player buys first upgrade.
9. A more dangerous event appears farther from safety.
10. Player chooses whether to push forward or cash out.

## Acceptance Criteria

- The shipped MVP includes every item in this spec's MVP scope list.
- The first-10-minutes flow is playable end-to-end without missing systems.
- Loop prompts and UI guidance are sufficient for a new player to complete one
  dock-upgrade cycle.
