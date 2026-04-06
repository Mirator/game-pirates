# Spec 08: Stylized Ocean Rendering Upgrade

## Title

Stylized Ocean Rendering Upgrade for Pirate Game

## Objective

Create a water system that feels visually rich, readable, and dynamic while
remaining performant in a browser-based Three.js game. The water must
communicate motion, scale, speed, and atmosphere.

## Problem Statement

The old water implementation reads as flat and static, lacks depth cues, has
limited movement richness, and does not show gameplay interactions like wake.
This weakens scene quality and makes the world feel unfinished.

## Design Goals

- Make the sea the strongest visual element in the scene.
- Keep an intentionally stylized look (not physically realistic ocean sim).
- Maintain visible movement even at low ship speed.
- Preserve gameplay readability for navigation and aiming.
- Keep the solution feasible in Three.js and scalable via quality tiers.

## Visual Pillars

The ocean must present:

- Broad, slow primary swells.
- Smaller, faster secondary detail.
- Stronger light response at glancing camera angles.
- Clear deep/shallow color variation.
- Readable interaction around player ship.
- Strong silhouette contrast near islands and horizon.

## Functional Requirements

### 1) Surface Motion

- Drive water movement primarily in shader logic.
- Use directional Gerstner-style displacement with layered components.
- Required: at least 2 wave sets; target 3 to 4 in higher quality tiers.
- Optional tertiary micro motion may be normal-only.

### 2) Shading

- Use custom shader material (ShaderMaterial).
- Include Fresnel term for grazing-angle highlight lift.
- Include directional sun response and specular breakup.
- Blend deep and shallow colors for shape and depth cues.

### 3) Normal Detail

- Use dual scrolling normal detail layers with different directions/speeds.
- Keep detail independent from mesh displacement.
- Minimize visible tiling via different scales/scroll vectors.

### 4) Depth/Shoreline Response

- MVP shoreline response uses island proximity masks (island center/radius based).
- Shoreline regions must blend toward shallow-water color.
- Future optional path: depth-texture shoreline refinement.

### 5) Ship Interaction

- Required:
  - Visible wake trail behind player ship while moving.
  - Brighter/foam disturbance near hull while moving.
  - Stronger wake response during boost (`burst.active`).
- Optional future:
  - Turn-asymmetric wake, cannonball splashes, collision splashes.

### 6) Camera Readability

- Ship silhouette remains readable against water.
- Highlights and foam must not hide gameplay-critical elements.
- Wave aggression must stay within readability bounds.

## Technical Requirements

### Engine / Rendering

- Three.js with perspective third-person gameplay camera.
- Compatible with current simulation/render separation and interpolation flow.

### Mesh / Horizon

- Water mesh must have enough subdivision for displacement.
- Water plane is camera-centered to avoid visible world-edge endings.
- Quality tiers control subdivision density.

### Performance Constraints

The system must:

- Maintain stable framerate on mid-range desktop hardware.
- Avoid excessive fragment complexity.
- Provide graceful feature reduction by tier.

Optimization levers:

- Fewer Gerstner components.
- Lower mesh subdivision.
- Disable shoreline response at low quality.
- Reduce wake intensity/extent.

## Art Direction Requirements

Water style must be:

- Stylized.
- Slightly exaggerated.
- Clean and readable.
- Non-photoreal.

Avoid:

- Muddy gray palette bias.
- Physically accurate but visually dull outcomes.
- Generic noisy stock-water appearance.

## Quality Tiers (Shipping Default = High)

### Low

- 1 primary wave component.
- 1 normal detail direction (second map effectively mirrored).
- No shoreline mask response.
- Minimal wake.

### Medium

- 3 wave components.
- Dual scrolling normal detail.
- Fresnel shading and wake trail.
- Reduced shoreline and spec response.

### High (Default)

- 4-component Gerstner stack.
- Dual normal detail with strongest breakup.
- Shoreline coloration via island masks.
- Enhanced wake, foam response, and specular highlights.

## Public Interfaces

Render-facing APIs and config contracts:

- `WaterQualityLevel = "low" | "medium" | "high"` with default `"high"`.
- `WaterRenderConfig` and `WaterTuningControls` in render config path.
- Per-tier `WATER_QUALITY_PRESETS` for wave/material behavior.
- Environment sync context includes interpolated player pose and camera position.

## Debug-Exposed Tunables

Expose and support runtime updates for:

- `waveAmplitude`
- `wavelength`
- `waveSpeed`
- `normalScrollSpeedA`
- `normalScrollSpeedB`
- `deepColor`
- `shallowColor`
- `fresnelStrength`
- `wakeIntensity`
- `foamThreshold`

## Acceptance Criteria

### Visual

- Ocean no longer appears flat when camera is static.
- Motion remains visible at low ship speed.
- Angle-dependent highlights are visible.
- Shoreline areas are clearly differentiated from deep water.
- Ship movement produces visible wake/disturbance.

### Technical

- Water remains stable across camera movement.
- No major shader artifacts at horizon.
- No obvious normal-map tiling during typical play.
- Performance remains acceptable on target hardware.

## Notes for Engineering

- Keep water visual-only: no gameplay simulation changes.
- Preserve interpolation contract by using render-time inputs for water animation.
- Maintain storm blending compatibility with existing fog/background storm logic.
