# Spec 03: Sailing and Combat

## Purpose

Define player-facing handling and combat rules using the gravity-based physics
model from Spec 11.

## Authority

This spec is authoritative for player-facing sailing controls and combat
interaction rules.

## Dependencies

- Spec 11 is the canonical authority for gravity/buoyancy/collision foundations.
- Spec 12 is the canonical authority for ship handling feel (throttle/turn/boost).

## Controls

- W/S or Arrow Up/Down: forward / weak reverse + braking input.
- A/D or Arrow Left/Right: steering input.
- Q or E: fire left or right broadside.
- R: repair ship.
- Space: interact, dock, or collect nearby loot.
- Shift: hold-to-boost burst (duration + cooldown).
- Hold right mouse button and drag: orbit chase camera around ship (render-only yaw + clamped pitch).

## Sailing Model

Handling requirements:

- Planar ship handling follows Spec 12 (arcade-weighted movement controller).
- Gravity and buoyancy behavior follows Spec 11.
- Render presentation feedback (tilt/sail/contact grounding) follows Spec 09 and
  is non-authoritative.
- Buoyancy probes still generate bob, pitch, and roll response.
- Water damping and assistance layers keep movement stable and readable.
- Standing-still turning is intentionally very weak; players must move to aim.
- Player control remains responsive with believable momentum.

### Motion Smoothness Requirements

- Gameplay simulation runs on fixed timestep.
- Render interpolation smooths between fixed snapshots.
- Ship/projectile/loot visuals must not stutter under variable framerate.

### Camera Stability Requirements

- Camera follow prioritizes readability over aggressive cinematic behavior.
- Right-mouse orbit rotates around ship while preserving an upright basis and bounded pitch range.
- Orbit camera state is render-only and must never mutate gameplay simulation state.
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
- Broadside alignment requires movement and speed management, not rotate-in-place.
- Visual tilt/sail cues improve readability but do not grant aiming authority by
  themselves.
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

## Acceptance Criteria

- Controls listed in this spec work with the documented key mappings.
- Combat loop supports broadside positioning, firing, and sinking feedback.
- Damage states transition correctly and remain readable in HUD/feedback.
