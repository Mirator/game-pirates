# Spec 03: Sailing and Combat

## Purpose

Define player-facing handling and combat rules using the gravity-based physics
model from Spec 11.

Cross-spec dependency:

- Spec 11 is the canonical authority for simulation-side force/buoyancy/collision
  behavior.

## Controls

- W or S: forward/reverse thrust input.
- A or D: turn torque input.
- Q or E: fire left or right broadside.
- R: repair ship.
- Space: interact, dock, or collect nearby loot.
- Shift: temporary burst.

## Sailing Model

Physics-first handling requirements:

- Ship motion is force-driven with inertia.
- Turning is torque-driven and should produce arc motion.
- Buoyancy probes generate bob, pitch, and roll response.
- Water drag and damping stabilize motion and prevent perpetual oscillation.
- Player control remains responsive despite inertia.

### Motion Smoothness Requirements

- Gameplay simulation runs on fixed timestep.
- Render interpolation smooths between fixed snapshots.
- Ship/projectile/loot visuals must not stutter under variable framerate.

### Camera Stability Requirements

- Camera follow prioritizes readability over aggressive cinematic behavior.
- Heading jitter from steering must not create frame-to-frame camera shake.
- Speed-based camera offsets remain bounded.

### World Boundary Behavior

- Playable sea is bounded by circular world radius.
- Player boundary interaction uses soft physical correction with momentum damping.
- Enemy ships may use stricter inward correction for AI stability.

## Combat Rules

- Cannons are split by left and right side with independent reload timers.
- Cannonballs are ballistic projectiles with visible arcs.
- Hits damage hull HP and may apply impulse feedback.
- Ships sink at zero HP and transition through sinking physics.

## Combat Depth for MVP

- Positioning and broadside angle matter.
- Reload timing matters.
- Range affects impact reliability due to ballistic drop.

## Damage Model

Core states:

- healthy
- damaged
- critical
- sunk

MVP still uses hull HP as the main health resource, with sinking and buoyancy
loss handled by the physics system.
