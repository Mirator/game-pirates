# Spec 10: Stylized Ship Wake Rendering System

## Title

Stylized Ship Wake Rendering System

## Objective

Implement a performant wake system for player and enemy ships that feels
embedded in the water, scales with speed, and avoids the current
"flat transparent quad" look.

## Authority

This spec is authoritative for wake visual-system behavior and per-ship wake
runtime contracts.

## Dependencies

- Spec 11 provides authoritative ship physics state (position/heading/velocity)
  that wake sampling should consume.

## 1. Scope

This system covers:
- stern turbulence.
- trailing wake.
- optional spray support hooks.
- integration with ship movement and water rendering.

This system does not include:
- full fluid simulation.
- physically accurate wave propagation.
- persistent world-scale water simulation.

The wake is a visual effect system, not a fluid solver.

## 2. Design Goals

- Wake should appear as disturbed water, not a separate overlay object.
- Shape should emerge naturally from ship motion.
- Intensity should scale with movement state.
- Support both player and enemy ships.
- Remain feasible in Three.js on desktop browser targets.

## 3. Visual Breakdown

The wake system is composed of three layers.

### 3.1 Stern Turbulence Layer

Localized foam/disturbance directly behind the ship stern.

Purpose:
- immediate feedback when moving.
- strongest disturbance zone.
- visually anchors wake to hull.

### 3.2 Wake Ribbon Layer

Main trailing wake extending behind the ship.

Purpose:
- communicates speed and heading.
- provides the visible wake body.
- fades naturally over distance/time.

### 3.3 Water Disturbance Layer

Subtle water normal/shading distortion under the wake.

Purpose:
- blend wake into ocean.
- prevent "decal pasted on top" look.
- add richer movement.

## 4. Functional Requirements

### 4.1 Wake Activation

Wake must only appear when ship movement exceeds a minimum threshold.

Requirements:
- no visible long wake at idle.
- minimal stern disturbance at very low speed.
- wake grows progressively with speed.
- wake reduces when ship slows down.

Inputs:
- ship world position.
- ship forward direction.
- ship linear speed.
- optional turn rate.
- optional boost state.

Input ownership rule:

- Wake should derive from simulation-authoritative movement data rather than
  independent render-estimated velocity.

### 4.2 Stern Turbulence

A small localized effect must be rendered at the stern.

Behavior:
- positioned at stern origin.
- follows ship transform each frame.
- strongest opacity near hull.
- fades rapidly within short range.
- stern origin should come from ship visual anchor `anchor-wake-stern` when
  present; fallback to collider/silhouette stern offset only when anchor data is
  unavailable.

Visuals:
- irregular foam patch.
- noisy alpha breakup.
- UV animation or flipbook optional.
- may slightly widen under boost.
- must not expose rectangular quad edges.

Technical options:
- Preferred: small quad/mesh aligned to water surface behind stern.
- Alternative: particle cluster if a particle system already exists.

### 4.3 Wake Ribbon Generation

Wake trail must be generated from recent ship movement history.

Requirements:
- sample ship positions over time.
- maintain a bounded history buffer.
- generate trail geometry from those samples.
- trail width should expand slightly with age/distance.
- trail opacity must fade with age.
- trail should collapse/stop generating when speed is below threshold.

Geometry:
- Recommended: triangle strip/ribbon mesh.

Each trail sample stores at minimum:
- world position.
- ship direction or tangent.
- sample age/lifetime fraction.
- width scalar.
- intensity scalar.

Shape rules:
- narrow near stern.
- broadens gradually behind ship.
- no perfect rectangle or fixed trapezoid.
- small noise variation permitted.

### 4.4 Wake Shading

Wake ribbon must use foam/noise-based shading rather than plain transparency.

Requirements:
- use textured alpha breakup.
- animate texture scrolling along trail.
- opacity fades by age.
- edge softness required.
- center region may be stronger than edges.

Material behavior:
- Wake should visually read as foam, disturbed surface, turbulent water.
- Wake should not read as glass panel, spotlight cone, or UI overlay.
- Wake should not render as a continuous bright column behind the ship.

Recommended material:
- transparent material with depth-aware blending, or
- custom shader for better control.

Recommended texture inputs:
- foam mask.
- noise breakup mask.
- optional flow texture.

### 4.5 Water Disturbance Integration

Wake must affect the water appearance underneath it.

MVP shipping approach:
- Keep a separate wake ribbon mesh for primary visual readability.
- Feed wake influence into the water shader when a custom water shader is
  available, adding altered normal intensity, brightness/foam tint shift, and
  subtle directional distortion.

If direct shader integration is not available:
- Render wake ribbon with shading tuned to match ocean colors/lighting as
  closely as possible.

Desired result:
- Wake should feel embedded in the ocean surface instead of floating above it.

### 4.6 Turn Response

Wake should react to turning.

Requirements:
- curved ship motion produces curved wake trail.
- stronger turn rate may slightly widen stern turbulence.
- optional asymmetry during hard turns.

This should emerge primarily from trail sampling, not handcrafted branch logic.

### 4.7 Speed / State Scaling

Wake must scale with ship state.

Parameters affected by speed:
- stern turbulence opacity.
- wake width.
- wake lifetime.
- wake opacity.
- wake texture scroll speed.
- spray intensity if enabled.

Suggested states:
- idle.
- slow sail.
- cruising.
- boost/burst.

### 4.8 Multi-Ship Support

System must support both player and enemy ships.

Requirements:
- each ship owns its own wake controller/state.
- per-ship wake history must be isolated.
- enemy wakes may use lower quality settings if needed.

## 5. Technical Architecture

### 5.1 Per-Ship Wake Controller

Each ship should have a wake component responsible for:
- collecting movement samples.
- updating stern turbulence.
- generating/updating wake mesh.
- exposing wake intensity to water shader if integrated.
- consuming ship-specific stern offset from the ship visual contract.

Suggested responsibilities:

```ts
interface ShipWakeController {
  update(deltaTime: number): void
  setSpeed(speed: number): void
  setTransform(position: Vector3, forward: Vector3): void
  dispose(): void
}
```

### 5.2 Movement Sampling

Ship positions should not necessarily be recorded every frame. Use controlled
sampling.

Recommended sampling rule:
- Add a new trail sample when either:
- minimum distance traveled is exceeded, or
- minimum sample time interval is exceeded.

Benefits:
- avoids oversampling when framerate is high.
- gives more stable trail geometry.
- controls memory/performance.

Sample data structure:

```ts
type WakeSample = {
  position: Vector3
  forward: Vector3
  age: number
  width: number
  intensity: number
}
```

### 5.3 Ribbon Mesh Construction

Wake mesh should be regenerated or updated from sample list.

For each sample:
- compute lateral vector from ship tangent and up axis.
- offset left/right vertices by width.
- write vertices into strip geometry.
- write UVs based on cumulative trail distance or normalized age.
- write per-vertex alpha/intensity data if shader uses it.

Requirements:
- geometry updates must be stable frame to frame.
- avoid visible popping.
- cap maximum number of samples.

Recommended limits:
- 16-48 samples per ship for MVP.
- tune based on number of active ships.

### 5.4 Material / Shader

Preferred implementation:
- custom ShaderMaterial.

Fallback:
- MeshBasicMaterial/MeshStandardMaterial with alpha map and vertex colors if a
  fast implementation is needed.

Shader inputs may include:
- foam texture.
- noise texture.
- time.
- per-vertex age/intensity.
- global wake opacity multiplier.

Shader behavior:
- blend foam texture with noise.
- soften edges.
- scroll UVs.
- fade alpha with age.
- optional Fresnel-lite term for better angle response.

### 5.5 Render Ordering / Depth

Wake transparency can cause artifacts.

Requirements:
- ensure wake renders after opaque water if separate mesh.
- manage depth write carefully.
- typically depth test enabled, depth write disabled for wake transparency.

Must avoid:
- wake clipping harshly into water.
- wake appearing through ship hull.
- sorting instability when camera rotates.

### 5.6 Water Shader Hook (Recommended)

If using a custom water shader, add wake influence support.

Approach options:
- Option A: local per-ship uniforms.
- Option B: disturbance texture/mask.

Recommendation:
- MVP: separate wake ribbon mesh plus local shader wake influence where
  available.
- Next step: richer local distortion and tuning near stern/trail.
- Advanced: disturbance field texture.

## 6. Performance Requirements

Target:
- stable gameplay framerate on mid-range desktop browser hardware.

Constraints:
- wake generation must not allocate heavily every frame.
- reuse geometry buffers where possible.
- cap trail length and sample count.
- enemy wakes may downgrade quality.

Optimization levers:
- reduce sample count.
- reduce update frequency for enemy ships.
- disable water-shader integration on low settings.
- disable spray on low settings.

## 7. Tuning Parameters

Expose these in debug tools.

Activation:
- min speed threshold.
- min sample distance.
- min sample time.

Stern turbulence:
- stern patch length.
- stern patch width.
- stern opacity.
- stern UV scroll speed.

Ribbon:
- base wake width.
- width by speed multiplier.
- max wake lifetime.
- alpha fade curve.
- edge softness.
- texture scroll speed.

Disturbance:
- normal boost amount.
- foam tint amount.
- distortion length.
- distortion falloff.

## 8. Quality Levels

Low:
- stern patch + short ribbon.
- no shader disturbance.
- no spray.

Medium:
- full ribbon trail.
- stern turbulence.
- animated foam/noise textures.
- basic speed scaling.

High:
- ribbon + stern patch + shader water disturbance.
- optional spray particles.
- better turn response.
- richer breakup and lighting response.

## Acceptance Criteria

Visual:
- wake no longer appears as a single transparent polygon.
- disturbance begins directly at stern.
- wake fades naturally over distance.
- wake shape follows ship path, including turns.
- wake intensity scales with speed.
- wake visually reads as foam/disturbed water.
- wake does not appear as a continuous bright strip or cone.

Technical:
- system supports multiple ships simultaneously.
- no severe transparency sorting artifacts in normal gameplay.
- no major performance spikes from wake updates.
- trail geometry remains stable during movement and turning.

## 10. Recommended MVP Implementation Order

Phase 1:
- stern turbulence mesh.
- movement sampling.
- ribbon mesh trail.
- speed-based width and fade.

Phase 2:
- foam/noise shader.
- better UV scrolling.
- turn tuning.
- enemy support polish.

Phase 3:
- water shader disturbance.
- spray particles during boost/impacts.
- scalability improvements via disturbance texture.
