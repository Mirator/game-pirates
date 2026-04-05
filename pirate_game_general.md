# Pirate Game — Game Design Document

## 1. High Concept

**Working title:** Blackwake Isles  
**Genre:** Arcade naval action / exploration / light progression  
**Platform:** Web browser  
**Engine / stack:** Three.js, JavaScript or TypeScript  
**Planned development approach:** singleplayer first, multiplayer-ready later

### Vision
Create a stylized pirate game where the player sails between islands, fights enemy ships, collects loot, upgrades their vessel, and gradually becomes a feared captain. The first version should be playable quickly and feel fun within the first few minutes.

### Design pillars
1. **Immediate fun** — sailing and cannon combat should feel good almost instantly.
2. **Readable systems** — simple resources, simple upgrades, simple enemies.
3. **Strong pirate fantasy** — treasure maps, ports, storms, cannons, loot.
4. **Expandable architecture** — systems should be clean enough to support multiplayer later.

## 2. Product Goal

Build a focused pirate game prototype that proves three things:
- naval movement feels satisfying
- combat is readable and replayable
- the codebase can later support multiplayer without a full rewrite

## 3. Player Fantasy

The player should feel like:
- captain of a small but growing pirate ship
- explorer of dangerous waters
- hunter of merchant vessels and rival pirates
- treasure seeker balancing greed and risk

## 4. Core Gameplay Loop

### Moment-to-moment loop
- steer ship
- manage speed and angle
- line up left or right broadside
- fire cannons
- avoid incoming shots
- collect floating loot

### Mid-session loop
- travel to island, encounter, or event
- win a fight or complete a treasure objective
- collect rewards
- return to port
- repair and upgrade ship

### Long-term loop
- unlock stronger upgrades
- enter more dangerous waters
- defeat tougher enemy ships
- increase wealth and reputation

## 5. MVP Scope

The MVP should include:
- one player-controlled pirate ship
- open sea map
- 3–5 islands
- 2–3 enemy ship types
- cannon combat
- loot drops
- one port with upgrades
- simple progression loop

### MVP success criteria
The MVP is successful if:
- sailing feels responsive and enjoyable
- cannon combat is easy to understand
- there is a clear reason to keep playing for at least 15–30 minutes
- the code structure separates game state from rendering and UI

## 6. Core Systems

### 6.1 Sailing

#### Controls
- **W / S** — accelerate / decelerate
- **A / D** — turn left / right
- **Q / E** — fire left / right cannons
- **R** — repair ship
- **Space** — interact / dock / collect nearby loot
- **Shift** — temporary speed burst or sail boost

#### Sailing model
Keep it arcade-oriented rather than realistic:
- clear forward momentum
- wide turning circle
- light drift when turning
- waves mostly affect visuals rather than true physics
- optional light wind bonus or penalty

#### Reasoning
A vibecoded Three.js game benefits from a simple and controllable sailing model. Realistic simulation adds complexity early and is unlikely to improve the first version.

### 6.2 Combat

#### MVP combat rules
- the ship has cannons on the left and right side
- each side has its own reload timer
- cannonballs travel as visible projectiles
- enemy hits damage hull health
- when HP reaches zero, the ship sinks and drops loot

#### Early combat depth
- positioning matters
- angle matters
- reload timing matters
- range affects hit reliability

#### Damage model
For MVP, use only:
- **Hull HP**

Possible later additions:
- sail damage
- crew damage
- special ammo
- critical hit zones

### 6.3 Loot and Economy

#### Loot types
Keep the economy compact:
- **Gold** — main currency
- **Cargo** — sold at port for extra income
- **Repair materials** — used for ship repair
- **Treasure maps** — optional objectives leading to buried treasure

#### Loot sources
- sunk enemy ships
- floating wreckage
- island chests
- event rewards

#### Economy role
The economy should support progression, not become a simulation. The player should quickly understand what loot is for.

### 6.4 Islands and Exploration

#### Island types
- **Port island** — repairs, upgrades, shop
- **Treasure island** — hidden chest or map objective
- **Hostile island** — guarded location or ambush zone
- **Scenic island** — visual variety, future expansion hook

#### On-foot gameplay
Recommendation for MVP:
- no full on-foot gameplay
- docking triggers an interaction menu
- treasure collection can happen via a simple interaction point

This keeps the scope controlled. Full character exploration would multiply complexity.

### 6.5 Progression

#### Ship stats
- max HP
- movement speed
- turn rate
- cannon damage
- reload speed
- cargo capacity

#### Upgrade categories
- hull reinforcement
- sail improvement
- cannon upgrades
- storage upgrades
- repair efficiency

#### Longer-term progression
Possible later systems:
- captain reputation
- unlockable ship classes
- cosmetics
- faction standing

### 6.6 Enemies

#### MVP enemy types
**Merchant ship**
- weak defenses
- avoids combat
- drops good cargo

**Pirate raider**
- balanced enemy
- attacks directly
- most common opponent

**Navy ship**
- stronger hull and weapons
- more dangerous AI behavior
- higher reward

#### AI behavior states
Keep AI state-machine based:
- patrol
- detect target
- chase
- line up broadside
- fire
- flee when low HP

### 6.7 World Events

#### MVP events
- treasure marker appears in the world
- enemy convoy moves through the map
- storm area reduces visibility
- navy patrol enters a region

#### Later ideas
- sea monster encounter
- port raid
- faction conflict
- bounty hunters targeting the player

## 7. World Structure

### Recommended structure
Use a **small open map** rather than level-based missions.

#### Advantages
- stronger exploration feeling
- easier pirate fantasy
- simpler repeated gameplay loop
- natural fit for future multiplayer

### Suggested map zones
- **Safe port waters** — low danger
- **Beginner zone** — weak enemies
- **Contested waters** — standard mid-tier encounters
- **Danger zone** — high-risk, high-reward enemies and events

## 8. Camera

### Recommendation
Third-person follow camera behind the ship:
- slightly elevated angle
- zooms out modestly at higher speed
- subtle shake on cannon fire or damage
- smooth follow, not fully rigid

### Future additions
- spyglass zoom
- cinematic camera mode
- photo mode

## 9. Art Direction

### Visual style
Use a **stylized low-poly pirate fantasy** approach.

#### Benefits
- easier to build in Three.js
- better browser performance
- easier asset sourcing
- strong readability during combat

### Visual references
- bright tropical palette
- chunky, readable ship shapes
- exaggerated waves
- large cannon smoke puffs
- clear island silhouettes

### UI direction
- parchment-inspired panels
- compass and brass details
- simple readable typography
- minimal clutter on screen

## 10. Audio Direction

### MVP audio needs
- sea ambience
- cannon fire
- ship creaks
- coin pickup sound
- docking sound
- calm exploration music
- more intense combat music

Audio has high leverage in selling the pirate fantasy, even in a simple prototype.

## 11. UX / UI

### HUD
- ship HP bar
- left/right cannon reload indicators
- gold counter
- repair material counter
- minimap or compass
- current objective or event marker

### Menus
- pause menu
- port shop
- upgrade menu
- map / treasure screen

The UI should remain compact and readable. Avoid heavy text.

## 12. Technical Direction

### Core principle
Even in singleplayer, structure the code as if the game may later become networked.

### Important entities
- Ship
- Projectile
- Loot
- Island
- Encounter
- PlayerState

### Important systems
- movement system
- combat system
- projectile system
- loot system
- spawn system
- event system
- upgrade system
- UI system

### Recommended architecture
- separate simulation state from rendering
- do not store gameplay logic inside camera code
- avoid DOM-driven game state
- use component/system-style organization where possible

Example folder structure:

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

## 13. Multiplayer Future-Proofing

### Recommended future multiplayer model
Best future path:
- each player controls their own ship

Avoid for now:
- multiple players sharing one ship with role-based gameplay

That is more original, but much harder to design and network.

### Systems that should already be designed cleanly
- ship movement state
- projectile spawning and hit handling
- loot ownership and pickup
- enemy targeting
- event spawning
- dock / port interaction rules

### General multiplayer approach for later
- server-authoritative simulation
- client prediction only where necessary
- keep ship state serializable
- make player input and world state easy to replicate

## 14. Scope Traps to Avoid

Do **not** put these into the MVP:
- realistic sailing simulation
- on-foot combat and boarding
- large dialogue systems
- survival needs like hunger or thirst
- crafting trees
- procedural world generation everywhere
- open-world RPG quest complexity
- shared multiplayer world too early

These are likely to destroy momentum.

## 15. Suggested Production Phases

### Phase 1 — Prototype
Goal: prove the feel
- water and sky
- player ship movement
- follow camera
- one enemy ship
- cannon firing
- basic HP and sinking

### Phase 2 — First playable
Goal: prove the loop
- loot drops
- simple port interaction
- one upgrade menu
- enemy spawning
- basic HUD
- sound effects

### Phase 3 — Vertical slice
Goal: prove retention
- 3–5 islands
- multiple enemy types
- treasure objectives
- event system
- improved VFX
- music and balancing

## 16. Example First 10 Minutes

1. Player spawns near the starting port.
2. Tutorial prompt explains movement and cannon controls.
3. Player sails toward a marked target area.
4. A weak merchant ship appears.
5. Player lines up broadside and sinks it.
6. Loot floats in water and gets collected.
7. Player returns to port.
8. Player buys first ship upgrade.
9. A more dangerous event appears farther from safety.
10. Player chooses whether to continue or cash out later.

This is enough to validate the concept.

## 17. One-Sentence Pitch

A stylized browser pirate game where you sail a ship, fight enemies, collect treasure, and upgrade your vessel in a compact open sea designed for possible multiplayer expansion later.

## 18. Recommended MVP Summary

If the project is intended to be built quickly and actually finished, the strongest framing is:
- stylized
- ship-focused
- arcade
- singleplayer first
- multiplayer-ready later

### Build first
- one ship
- one enemy
- one island
- one port
- cannon combat
- loot pickup
- one upgrade screen

If this is fun, the rest is worth building. If it is not fun, more features will not solve the core problem.

