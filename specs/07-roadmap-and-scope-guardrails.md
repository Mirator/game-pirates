# Spec 07: Roadmap and Scope Guardrails

## Purpose

Protect delivery momentum by keeping physics and gameplay upgrades phased and
test-gated.

Cross-spec dependency:

- Spec 11 defines the gravity/buoyancy physics foundation rollout.
- Spec 12 defines the ship handling rollout and feel targets.

## Scope Traps To Avoid

- full realistic sailing simulation.
- full fluid simulation.
- rope/rigging realism.
- per-plank destruction.
- early multiplayer shared world complexity.

## Delivery Phases

### Phase 1: Physics Foundation

Goal: establish coherent core physical behavior.

Deliverables:

- fixed-step gravity-based simulation.
- ship gravity/buoyancy foundation with buoyancy probes.
- arcade-weighted planar handling layer (throttle/turn/boost) for control-first feel.
- ballistic cannon projectiles with water/world collisions.
- floating loot gravity-to-water lifecycle.
- baseline collision layers and simplified colliders.

### Phase 2: Combat Weight and Feedback

Goal: strengthen physical feedback and readability.

Deliverables:

- cannon recoil impulses.
- tuned collision and hit impulses.
- improved sinking progression.
- improved water-entry damping and splash timing.

### Phase 3: Depth and Cleanup

Goal: finalize differentiated ship feel and long-tail physics quality.

Deliverables:

- damage-based buoyancy degradation.
- differentiated ship class mass/inertia behavior.
- improved debris/wreck handling.
- expanded wave-sampling influence where enabled.
- contract cleanup for finalized gravity-foundation + handling-controller pathways.

## Build-First Checklist

- player ship remains controllable.
- cannon arcs remain readable.
- collisions feel consequential without pinball behavior.
- floating pickups remain collectible and stable.
- simulation remains stable under normal gameplay load.
