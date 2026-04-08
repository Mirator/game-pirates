# Spec 11: Gravity-Based Physics System

## Title

Gravity-Based Physics System for Ships, Cannonballs, Floating Objects, and World Interaction

## Objective

Create a coherent, gameplay-first physics model where all major moving world objects follow shared gravity, buoyancy, drag, momentum, and collision rules. The target is believable and readable stylized naval action, not full simulation.

Cross-spec dependency:

- Spec 12 is the canonical ship handling authority for throttle/turn/boost feel.

## Core Principle

All major physical entities follow the same base rules:

- gravity pulls objects downward.
- water provides buoyancy and drag.
- momentum matters.
- collisions produce force and damage outcomes.
- heavier objects feel heavier.
- fast objects feel dangerous.

## Authority Boundary

This spec is authoritative for:

- gravity.
- buoyancy/water-medium response.
- ballistic projectile behavior.
- collision-force foundations.

This spec is not authoritative for:

- planar ship handling feel (turn responsiveness, speed-state handling, boost
  control tradeoffs, drift suppression, heading assist). These are owned by
  Spec 12.

## Goals and Non-Goals

### Design Goals

- make the world feel physically coherent.
- ensure cannon fire feels weighty and satisfying.
- make ships feel like floating mass, not hovercrafts.
- support emergent outcomes from impacts, recoil, drift, and sinking.
- keep simulation stable and performant in browser runtime.

### Non-Goals

- full CFD/fluid simulation.
- realistic rope/sail aerodynamics.
- per-plank destruction simulation.

## Global Physics Rules

### Gravity

- A global gravity constant must exist and be applied every fixed physics step.
- Airborne objects follow ballistic motion unless other forces apply.
- Applies to cannonballs, debris, loot crates, dropped cargo, and all unsupported bodies.

### Water as Physical Medium

Water acts as a force field with:

- buoyancy.
- linear drag.
- angular drag.
- entry damping and splash transition.
- optional wave-based vertical displacement.

### Fixed-Step Simulation

- Simulation runs on fixed timestep.
- Default fixed tick: 60 Hz.
- Fallback fixed tick: 30 Hz.
- Rendering may interpolate between snapshots.

## Object Categories

- Static world: islands, rocks, docks, terrain.
- Floating rigid bodies: player ships, enemy ships, debris, cargo, barrels, treasure crates.
- Ballistic bodies: cannonballs and future physical projectiles.
- Kinematic/controlled bodies: scripted/cinematic helpers that still collide.

## Ship Physics

### Representation

Ships are rigid floating bodies with:

- mass and center of mass.
- linear and angular velocity.
- buoyancy probes.
- drag coefficients.
- simplified collision hull metadata.

### Buoyancy Model

- Multiple probes across hull (bow/stern left/right plus optional center).
- Probe submersion below sampled water height creates upward force.
- Uneven support naturally produces pitch and roll.

### Motion and Turning

- Movement uses forces, never per-frame teleport updates.
- Turning is torque-based.
- Ships preserve inertia and arc through turns.
- Optional low-speed yaw assist is allowed for gameplay control.

### Stability and Collisions

- Ships bob/pitch/roll and self-stabilize via damping.
- Ships should not oscillate forever.
- Collision outcomes: velocity response, impulse, and impact damage.
- Bounce remains minimal to keep heavy feel.

## Projectile and Floating Object Physics

### Cannonballs

- Fired with muzzle origin, direction, muzzle speed, and inherited ship velocity fraction.
- Affected immediately by gravity and drag.
- Arc must be visible at short and long range.
- First-impact resolution for MVP: no bounce, no penetration.
- Collide with ships, islands/rocks, and water surface.

### Floating Objects

- Fall under gravity when spawned/dropped.
- Splash into water and switch to buoyancy/drag behavior.
- Drift and settle over time.
- Lighter objects respond faster; heavier objects sit lower.

## Sinking, Recoil, and Impulses

### Damage and Sinking

Required ship damage states:

- healthy
- damaged
- critical
- sunk

Destroyed ships:

- lose buoyancy support over time.
- settle lower and tilt progressively.
- end as respawn (player) or removal/wreckage (enemy/debris rules).

### Recoil and Impact Forces

- Cannon fire applies subtle recoil impulse to firing ship.
- Cannon impacts apply small impulse.
- Ship collisions apply stronger impulse.
- Tuning must avoid pinball behavior.

## Collision and Water Sampling Contracts

### Collision Shapes and Layers

Recommended shapes:

- ships: simplified compound hull.
- cannonballs: sphere.
- floating pickups/debris: box/capsule-like simplified proxy.
- islands: simplified static colliders.

Collision filtering layers:

- world static
- ships
- projectiles
- pickups/debris
- non-colliding VFX

### Water Height Sampling

- Physics and rendering must share compatible water-height sampling.
- Physics queries water height at world position; no mismatched flat-sea fallback when wave displacement is active.

## Tunable Parameters

Expose gameplay-tunable parameters for:

- global gravity, water density multiplier, global drag multiplier.
- ship mass, thrust, turn torque, drag, buoyancy, probe layout, impact thresholds.
- cannon muzzle velocity, gravity scale, drag, lifetime, damage, impulse.
- floating object mass, buoyancy multiplier, drag, damping.

## Phased Delivery

### Phase 1 - Foundation

- fixed-step physics runtime and global gravity.
- ship rigid body with buoyancy probes and force/torque controls.
- ballistic cannonballs with gravity arcs and first-impact resolution.
- floating loot object gravity-to-water lifecycle.
- shared water-height sampler contract and collision layer filtering.

### Phase 2 - Feedback

- cannon recoil on firing ship.
- ship-to-ship and hit impulse tuning.
- improved sinking transition and water-entry damping polish.

### Phase 3 - Depth and Cleanup

- damage-based buoyancy degradation and differentiated ship class inertia.
- improved debris/wreck behavior.
- deeper wave-sampling influence where enabled.
- finalize gravity/buoyancy contracts and remove deprecated legacy pathways.

## Acceptance Criteria

### Ships

- ships float from buoyancy, not fake hover motion.
- acceleration/turning shows inertia.
- visible bob/tilt while retaining control.
- collisions resolve physically with meaningful consequences.

### Cannonballs

- visible gravity-driven arcs.
- impact point depends on angle and distance.
- collisions with ships, terrain, and water are reliable.

### Floating Objects

- dropped objects fall under gravity.
- water entry transitions to float/sink behavior.
- motion settles naturally over time.

### System

- all major dynamic objects follow coherent gravity-based rules.
- simulation remains stable in normal gameplay.
- behavior is consistent across player, enemy, and projectiles.

## Engineering Notes

Preferred implementation style:

- simplified rigid-body logic.
- custom buoyancy forces.
- ballistic projectile physics.
- gameplay-first tuning loops.

Do not begin with:

- full realistic sailing simulation.
- per-vertex boat collision.
- full fluid interaction.
- physically perfect hydrodynamics.
