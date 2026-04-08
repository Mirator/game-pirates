# Spec 12: Player and Ship Movement System (Arcade-Weighted Naval Handling)

## Purpose

Define the authoritative handling model for player and enemy ships with a
70% arcade / 30% physics feel, while preserving gravity/buoyancy/collision
authority from Spec 11.

Cross-spec dependencies:

- Spec 03 (Sailing and Combat) for player-facing controls and combat usage.
- Spec 06 (Technical Architecture) for fixed-step simulation order.
- Spec 11 (Gravity-Based Physics System) for gravity, buoyancy, projectiles,
  and collision-force foundations.

## Handling Goals

- responsive and readable for MVP.
- heavy enough to preserve naval fantasy.
- forgiving enough to keep combat fun.
- simple enough to tune quickly.

## Design Principles

1. Control first
- Steering input must feel immediate and reliable.
- Inertia is welcome only where it improves feel.

2. Momentum, not drift chaos
- Ships should carry weight and forward momentum.
- Ships should not feel slippery or disconnected.

3. Readable speed behavior
- Low speed: tighter, easier turning.
- High speed: wider committed arcs.

4. One consistent handling model
- The same movement rules apply to player and enemies.
- Ship classes may tune multipliers later.

5. Fake physics over full simulation
- Use simplified physics-inspired handling plus hidden stabilization.

## Authority Boundaries

- Spec 11 remains canonical for gravity, buoyancy probes, projectile ballistics,
  and collision system foundations.
- This spec is canonical for planar ship handling feel (throttle/turn/boost,
  speed-state response, lateral stabilization, heading assist).

## Camera and Readability Assumptions

Designed for third-person elevated chase camera.

Requirements:

- turning response is stronger than realistic naval simulation.
- lateral drift is heavily controlled.
- acceleration and speed changes are visually legible.

## Input Contract

Required controls:

- `W` / `ArrowUp`: increase throttle / forward.
- `S` / `ArrowDown`: weak reverse plus braking.
- `A` / `ArrowLeft`: turn left.
- `D` / `ArrowRight`: turn right.
- `Shift`: hold-to-boost.

Input behavior rules:

- turning works at low speed.
- controls never require perfect momentum management.
- boost is immediate and clearly useful.

## Core Movement Model

Planar handling uses:

- forward acceleration.
- drag-based deceleration.
- angular-velocity targeting for turn response.
- speed-dependent turn effectiveness.
- artificial lateral stabilization.
- soft heading assist.

The ship should feel primarily forward-moving through water, not sliding.

## Forward Motion

- Forward throttle applies acceleration along ship forward axis.
- Reverse is intentionally weaker than forward.
- Reverse input also provides braking help while moving forward.
- Drag continuously reduces speed.
- Speed is clamped to movement-state limits.

## Turning

- Turning uses angular velocity, not instant heading snaps.
- Steering moves angular velocity toward target turn rate.
- Turn effectiveness is speed-banded:
  - weak at low speed,
  - strongest at medium combat speed,
  - weaker again at high speed.
- Low-speed turning remains usable for adjustment, but not dominant.

## No Turning In Place

- Ships should not effectively rotate while stationary.
- If near-stationary and throttle is minimal, only a very weak fallback turn
  response is allowed.
- Idle angular velocity is capped to prevent rotate-in-place gameplay.

## Speed States

Low speed:

- weak turning authority.
- adjustment-focused control.

Medium speed (combat default):

- strongest turning authority.
- intended broadside-combat handling zone.

High speed / boost:

- faster traversal.
- reduced precision.
- wider arcs and commitment.

## Lateral Stability

- Decompose velocity into forward/lateral components.
- Dampen lateral component aggressively over time.
- Preserve forward momentum more than sideways momentum.
- Stabilization should be invisible to the player.

## Heading Stabilization

- If movement heading and facing diverge too much, apply subtle correction.
- Correction must never snap.
- Purpose is fast recovery from awkward drift states.

## Boost

- Hold `Shift` to boost while duration remains.
- Releasing `Shift` ends boost immediately.
- Cooldown starts when boost ends.
- Boost increases acceleration and max speed.
- Boost reduces turn precision while active.
- Boost is for short chase/escape/reposition moments, not default travel.

## Collision Stability Requirements

- Collisions should push ships and cost speed.
- Collisions must not create chaotic spins or launches.
- Angular collision impulse is capped.
- Ship should recover quickly into stable handling.

## Combat Handling Requirements

Movement must support combat first:

- line up broadsides without fighting controls.
- predictable arcs for circling, pursuit, disengage, reposition.
- boost remains combat-useful with explicit handling tradeoff.

## MVP Default Tuning Values

```txt
MAX_SPEED = 40.5
ACCELERATION = 60.75
DRAG = 0.92

MAX_TURN_RATE = 2.2          // radians per second
TURN_ACCEL = 6.0
TURN_LOW_SPEED_MULT = 0.12
TURN_MID_SPEED_START = 0.35
TURN_MID_SPEED_END = 0.65
TURN_HIGH_SPEED_MULT = 0.55
TURN_IDLE_SPEED_THRESHOLD = 0.06
TURN_IDLE_INPUT_MULT = 0.40
TURN_IDLE_ANGULAR_CAP = 0.22

LATERAL_DAMPING = 0.18
HEADING_ASSIST = 0.08

BOOST_SPEED_MULT = 1.6
BOOST_ACCEL_MULT = 1.25
BOOST_DURATION = 1.5
BOOST_COOLDOWN = 3.0
```

Additional MVP constraints:

- reverse acceleration and reverse top speed are limited.
- boost turn precision multiplier is reduced from normal state.

## Fixed-Tick Update Flow (Planar + Vertical)

1. Read input (throttle, steer, boost).
2. Apply planar acceleration (forward/weak reverse + brake assist).
3. Apply drag and speed clamp.
4. Compute speed-banded turn factor and target turn rate.
5. If near-stationary and throttle is minimal, apply idle turn scale and idle
   angular cap.
6. Apply lateral damping.
7. Apply heading assist.
8. Apply vertical physics from Spec 11 (gravity + buoyancy + damping).
9. Apply boost modifiers (if active).
10. Resolve collisions and cap angular collision impulse.
11. Integrate transform and update derived speed/drift state.

## Reference Pseudocode

```ts
speedNorm = clamp(abs(forwardSpeed) / maxSpeed, 0, 1)

if (speedNorm < TURN_MID_SPEED_START) {
  turnFactor = lerp(TURN_LOW_SPEED_MULT, 1.0, speedNorm / TURN_MID_SPEED_START)
} else if (speedNorm <= TURN_MID_SPEED_END) {
  turnFactor = 1.0
} else {
  turnFactor = lerp(1.0, TURN_HIGH_SPEED_MULT, (speedNorm - TURN_MID_SPEED_END) / (1 - TURN_MID_SPEED_END))
}

idleTurn = speedNorm < TURN_IDLE_SPEED_THRESHOLD && abs(throttleInput) < 0.1
idleInputScale = idleTurn ? TURN_IDLE_INPUT_MULT : 1.0
targetTurnRate = turnInput * MAX_TURN_RATE * turnFactor * idleInputScale

angularVelocity = lerp(angularVelocity, targetTurnRate, TURN_ACCEL * dt)
if (idleTurn) {
  angularVelocity = clamp(angularVelocity, -TURN_IDLE_ANGULAR_CAP, TURN_IDLE_ANGULAR_CAP)
}
```

## Acceptance Criteria

Handling:

- low-speed turning is intentional and not frustrating.
- arcs are readable and predictable.
- ship does not feel like uncontrolled sideways drift.
- standing-still turning is very weak; player must move to aim.

Speed:

- normal and boost speed feel clearly different.
- high speed visibly reduces precision.
- reverse remains weaker than forward.

Stability:

- post-turn and post-collision recovery is quick and stable.
- motion never feels buggy, floaty, or random.

Combat readiness:

- broadside positioning is reliable.
- circling and pursuit work without control fighting.

## Final MVP Direction

Prioritize:

- satisfying control.
- readability.
- combat usability.

Over:

- realism.
- simulation depth.
- physically perfect water behavior.
