# Spec 08: Stylized Ocean, Lighting, and Atmospheric Rendering Upgrade

## Title

Lighting, Sky, Atmosphere, and Ocean Rendering Upgrade for Pirate Game

## Objective

Introduce a professional-looking rendering model that adds depth, mood, and
visual cohesion to the world while preserving the existing stylized ocean
upgrade goals.

## Problem Statement

The scene currently reads too uniformly lit, which causes:

- Poor depth perception.
- Flat geometry and weak material response.
- Weak mood and environmental identity.

The world can read as unlit geometry rather than a composed scene.

## Design Goals

- Create strong depth and separation between foreground, midground, and
  background.
- Support a stylized maritime atmosphere with clear visual identity.
- Improve readability of islands, ship, and horizon.
- Preserve gameplay readability under varied camera angles.
- Keep rendering practical for real-time browser gameplay.

## Authority

This spec is authoritative for lighting, sky, atmosphere, and ocean rendering
behavior.

## Dependencies

- Spec 05 for art-direction alignment.
- Spec 11 for simulation-owned water/physics authority boundaries.

## Rendering Scope and Ownership

- This spec is the canonical render contract for scene lighting, sky,
  atmosphere, and ocean response.
- Gameplay physics authority (gravity, buoyancy, projectile motion, collision)
  remains in Spec 11 and simulation systems.
- High-level visual style remains aligned with Spec 05 (art direction), while
  concrete rendering behavior lives here.
- Rendering upgrades must remain visual-only and must not change gameplay
  authority or simulation rules.

## Layered Lighting Model Overview

The scene should use a layered lighting model composed of:

- Primary directional sunlight.
- Ambient or environment fill.
- Sky contribution.
- Distance fog / atmospheric perspective.
- Optional subtle post-processing polish.

## Scene Lighting and Atmosphere Requirements

### 1) Primary Sun Light

- Use a directional light as the main illumination source.
- Sun direction can be fixed for MVP or driven by a future time-of-day system.
- Sunlight should create visible highlights on ship, islands, and waves.
- Use slightly angled lighting; avoid flat overhead noon lighting.

Recommended MVP defaults:

- Warm sunlight color.
- Moderate intensity with tunable exposure.

### 2) Shadows

Required shadow casters:

- Player ship.
- Islands / terrain masses.
- Major gameplay-near props.

Required shadow receivers:

- Islands.
- Ship surfaces where relevant.

Notes:

- Water does not require fully realistic shadowing for MVP.
- Standard shadow maps are acceptable for MVP; cascaded shadows are optional.
- Tune bias and normal bias to avoid acne and peter-panning.
- Ships must also include a stable, cheap under-hull contact shadow/contact patch
  cue (blob/decal/projection style) so hulls read as grounded on water even
  under simple lighting. This layer is presentation-only and independent from
  gameplay physics authority.

### 3) Ambient / Environment Lighting

- Include non-directional fill light (hemisphere or image-based lighting).
- Sky-facing and downward-facing surfaces must read differently.
- Shadows should remain readable and not crush to black.

Preferred MVP approach:

- Hemisphere light with tuned sky and ground colors.

Future optional path:

- HDRI sky and environment map.

### 4) Sky Rendering

MVP requirement:

- Replace flat background with procedural sky and controlled horizon gradient.

Sky must provide:

- Strong horizon separation.
- Color context and mood.
- Consistent integration with fog and sunlight direction.

### 5) Fog / Atmospheric Perspective

- Include distance fog so distant geometry fades naturally.
- Fog color must match active sky and atmosphere state.
- Fog should support depth and scale, not only hide draw distance.

Preferred model:

- Exponential fog for MVP.

### 6) Tone Mapping and Color Management

Renderer must use a modern color pipeline:

- `renderer.toneMapping = THREE.ACESFilmicToneMapping`
- `renderer.outputColorSpace = THREE.SRGBColorSpace`
- Consistent, tunable exposure control.

Purpose:

- Avoid washed-out colors.
- Improve highlight rolloff.
- Keep a cohesive cinematic stylized look.

### 7) Material Response Compatibility

- Use physically-based materials where practical.
- Wood, sand, rock, cloth, and water should respond differently to light.
- Roughness and normal detail should read under directional sunlight.

Minimum expectation:

- Use `MeshStandardMaterial` for most world assets.

### 8) Atmosphere States

Base MVP state:

- Clear daytime ocean scene (`clearDay`).

Future-ready states:

- `goldenHour`
- `overcast`
- `dusk`
- `storm`

Architecture requirement:

- Use data-driven preset profiles and avoid hardcoded assumptions that block
  future weather/time-of-day expansion.

### 9) Post-Processing (Optional)

- Keep post-processing subtle and optional.
- Acceptable future effects: very light bloom, mild color grading, restrained
  vignette.
- Not acceptable: aggressive bloom halos, strong blur, heavy chromatic
  aberration.

MVP default:

- No post stack beyond tone mapping and exposure.

## Visual Direction Requirements

Desired mood:

- Adventurous.
- Open.
- Slightly romanticized.
- Clean stylization with strong depth cues.

Avoid:

- Flat midday lighting with little contrast.
- Over-dark shadow floors.
- Undisciplined oversaturated fantasy palette.
- Heavy bloom or post effects that reduce gameplay readability.

## Suggested Three.js Baseline

- `DirectionalLight` as sun with shadows enabled on key casters.
- `HemisphereLight` as MVP ambient fill (future optional HDRI environment map).
- `FogExp2` for atmospheric perspective.
- `renderer.toneMapping = THREE.ACESFilmicToneMapping`
- `renderer.outputColorSpace = THREE.SRGBColorSpace`
- `renderer.shadowMap.enabled = true` with soft shadow filtering.

## Water Subsystem Requirements (Canonical Existing Scope)

The following ocean requirements remain canonical and additive within this
broader rendering spec.

### Water Design Goals

- Make the sea the strongest visual element in the scene.
- Keep an intentionally stylized look (not physically realistic ocean sim).
- Maintain visible movement even at low ship speed.
- Preserve gameplay readability for navigation and aiming.
- Keep the solution feasible in Three.js and scalable via quality tiers.

### Water Perception Stack (MVP Required Order)

The water render path must be implemented and tuned in this order for shipping
MVP:

1. Fresnel reflection blend (`mix(waterColor, skyColor, fresnel)` style
   behavior).
2. Camera-distance depth color gradient (near darker/saturated, far
   lighter/desaturated).
3. Dual-layer normals (macro wave normal + scrolling micro detail normal).
4. Directional specular glint from sun direction, amplified by Fresnel.
5. Crest/energy foam from slope or curvature signal.
6. Ship interaction cues (under-hull darkening + trailing foam/disturbance
   mask).
7. Horizon/fog-to-sky blending so horizon reads brighter and more reflective
   than near water.

### Boat-Centric Motion Readability Stack (All Ships Required)

The following readability stack is required for player and enemy ships (render
only):

1. Layered wake perception from three wake bands (core stern turbulence, main
   trail, outer disturbance).
2. Local hull interaction zones per ship (bow/hull/side disturbance masks with
   smooth falloff).
3. Near-field detail weighting (camera-relative and ship-relative) so nearby
   water carries most motion readability.
4. Disturbed-vs-calm lighting contrast (disturbed regions get stronger
   specular/breakup than calm water).
5. Subtle directional streaking aligned with primary wave/wind direction.
6. Camera inertia coupling for readability (position lag, heading swing lag,
   mild vertical lag) with strict control-safe bounds.

Render authority rule:

- All readability effects consume simulation-derived movement inputs
  (`speed/accel/turn/throttle/heading/position`) and do not write gameplay
  state.

MVP non-goal:

- No full screen-space reflections (SSR).

Optional enhancement:

- SSR-lite style approximation (sky-color/blurred reflection cue) may be added
  later but is not required for MVP acceptance.

### Water Visual Pillars

The ocean must present:

- Broad, slow primary swells.
- Smaller, faster secondary detail.
- Directional wave travel that is readable from gameplay camera.
- Visible horizon-line motion, not random undirected wobble.
- Stronger light response at glancing camera angles.
- Clear deep/shallow color variation.
- Strong near-vs-far value and saturation separation.
- Readable interaction around player ship.
- Strong silhouette contrast near islands and horizon.

### Water Functional Requirements

#### 1) Surface Motion

- Drive water movement primarily in shader logic.
- Use directional Gerstner-style displacement with layered components.
- Required hierarchy for shipping tiers:
  - 1 dominant long swell (slow, largest amplitude),
  - 2 to 3 secondary directional waves (medium scale),
  - 1 subtle fast detail layer.
- Required: at least 2 wave sets; target 3 to 4 in higher quality tiers.
- Optional tertiary micro motion may be normal-only.

#### 2) Shading

- Use custom shader material (`ShaderMaterial`).
- Include Fresnel term for grazing-angle highlight lift.
- Include directional sun response and specular breakup.
- Blend deep and shallow colors for shape and depth cues.
- Include camera-distance depth gradient coloring (near/far response).
- Fresnel must actively blend toward sky/horizon response, not only boost white
  highlights.
- Add near-hull water darkening driven by player/ship proximity.
- Add foam response from local wave curvature (crest/curvature signal), not only
  wake masks.
- Add subtle wave-peak highlight cues near ship for motion readability.

#### 3) Normal Detail

- Use dual scrolling normal detail layers with different directions/speeds.
- Keep detail independent from mesh displacement.
- Minimize visible tiling via different scales/scroll vectors.

#### 4) Depth/Shoreline Response

- MVP shoreline response uses island proximity masks (island center/radius
  based).
- Shoreline regions must blend toward shallow-water color.
- Water-height sampling used by rendering must stay compatible with the
  simulation water sampler contract from Spec 11.
- Future optional path: depth-texture shoreline refinement.

#### 5) Ship Interaction

Required:

- Visible wake trail behind player ship while moving.
- Visible wake trail behind enemy ships while moving (quality-tier fallback
  allowed).
- Brighter/foam disturbance near hull while moving.
- Stronger wake response during boost (`burst.active`).
- Turn intensity must affect wake width/foam intensity and permit side-biased
  disturbance during hard turns.
- Local hull interaction zone must weight bow > sides > stern and scale by
  speed, acceleration, and turn intensity.
- Interaction blending must avoid circular aura artifacts and must transition
  smoothly into base water.

Optional future:

- Cannonball splashes.
- Collision splashes.

#### 6) Camera Readability

- Ship silhouette remains readable against water.
- Highlights and foam must not hide gameplay-critical elements.
- Wave aggression must stay within readability bounds.
- Follow camera should include:
  - position smoothing,
  - slight rotational heading lag,
  - small speed-based FOV increase (`~58 -> ~63`),
  - optional minor vertical lag to emphasize wave motion.

### Water Technical Requirements

#### Engine / Rendering

- Three.js with perspective third-person gameplay camera.
- Compatible with current simulation/render separation and interpolation flow.

#### Mesh / Horizon

- Water mesh must have enough subdivision for displacement.
- Water plane is camera-centered to avoid visible world-edge endings.
- Camera-centered mesh rendering must remain world-phase locked: moving the
  camera may reposition the mesh, but it must not change wave phase at fixed
  world coordinates.
- Quality tiers control subdivision density.

### Water Art Direction Requirements

Water style must be:

- Stylized.
- Slightly exaggerated.
- Clean and readable.
- Non-photoreal.

Palette requirement:

- Use at least 3 intentional water tones:
  - deep water: dark blue with slight green bias,
  - mid water: saturated readable blue,
  - highlights/reflection: pale blue-white.

Avoid:

- Muddy gray palette bias.
- Single-tone pure-blue water across all distances/angles.
- Physically accurate but visually dull outcomes.
- Generic noisy stock-water appearance.

### Readability Exaggeration Allowance (Render-Only)

- Visual displacement may be slightly amplified for readability (`~1.1x` target
  range).
- Normal intensity may be slightly amplified for readability (`~1.2x` target
  range).
- These adjustments are render-only and must not alter simulation authority.

### Water Quality Tiers (Shipping Default = High)

#### Low

- 1 primary wave component.
- 1 normal detail direction (second map effectively mirrored).
- No shoreline mask response.
- Minimal wake.

#### Medium

- 3 wave components.
- Dual scrolling normal detail.
- Fresnel shading and wake trail.
- Reduced shoreline and spec response.

#### High (Default)

- 4-component Gerstner stack.
- Dual normal detail with strongest breakup.
- Shoreline coloration via island masks.
- Enhanced wake, foam response, and specular highlights.

## Public Interfaces

Render-facing APIs and config contracts:

- `WaterQualityLevel = "low" | "medium" | "high"` with default `"high"`.
- `WaterRenderConfig` and `WaterTuningControls` in render config path.
- `WaterTuningControls` must support at minimum:
  - `reflectionBlendStrength`
  - `depthGradientDistanceMax`
  - `farColorDesaturation`
  - `horizonLiftStrength`
  - `microNormalScale`
  - `microNormalWeight`
  - `specularGlintExponent`
  - `specularGlintStrength`
  - `crestFoamStrength`
  - `crestFoamThreshold`
  - plus existing interaction tunables (`nearHull...`, wake/foam controls).
- Per-tier `WATER_QUALITY_PRESETS` for wave/material behavior.
- `AtmospherePresetId = "clearDay" | "goldenHour" | "overcast" | "dusk" | "storm"`.
- `AtmosphereRenderConfig` and `AtmosphereTuningControls` in render config path.
- Environment sync context includes interpolated player pose and camera
  position and player-influence data used by water shading (near-hull response).
- Environment sync context must also support per-ship influence inputs for
  water readability (`shipInfluences`: world pos, forward dir, speed/accel/turn/
  throttle normalized values, hull extents).
- Atmosphere profile system supports base preset + blendable storm influence.
- `EnvironmentObjects` exposes `water` and `lighting` control surfaces.
- `lighting` surface supports `getConfig()`, `setPreset(id)`, and
  `updateTuning(patch)` for non-authoritative runtime tuning.
- Runtime debug bridge exposes both `window.__BLACKWAKE_DEBUG__.water` and
  `window.__BLACKWAKE_DEBUG__.lighting`.

## Debug-Exposed Tunables

### Lighting / Atmosphere

Expose and support runtime updates for:

- `sunAzimuthDeg`
- `sunElevationDeg`
- `sunIntensity`
- `ambientIntensity`
- `fogDensity`
- `fogColor`
- `exposure`
- `shadowMapResolution`
- `shadowCameraBounds`

### Water

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
- `nearHullDarkeningStrength`
- `nearHullDarkeningRadius`
- `curvatureFoamStrength`
- `wavePeakHighlightStrength`
- `reflectionBlendStrength`
- `depthGradientDistanceMax`
- `farColorDesaturation`
- `horizonLiftStrength`
- `microNormalScale`
- `microNormalWeight`
- `specularGlintExponent`
- `specularGlintStrength`
- `crestFoamStrength`
- `crestFoamThreshold`
- `localInteractionRadius`
- `localInteractionLength`
- `bowInteractionStrength`
- `hullInteractionStrength`
- `interactionNormalBoost`
- `bowRippleFrequency`
- `bowRippleStrength`
- `nearFieldRadius`
- `nearFieldNormalBoost`
- `nearFieldDetailBoost`
- `nearFieldContrastBoost`
- `directionalStreakStrength`
- `directionalStreakScale`
- `directionalStreakAnisotropy`
- `disturbedSpecularBoost`
- `disturbedHighlightFlicker`
- `disturbedContrastBoost`

Recommended clamp bands (MVP safety):

- `reflectionBlendStrength`: `0.0..2.0`
- `depthGradientDistanceMax`: `20..400`
- `farColorDesaturation`: `0.0..1.0`
- `horizonLiftStrength`: `0.0..1.5`
- `microNormalScale`: `0.25..12.0`
- `microNormalWeight`: `0.0..1.5`
- `specularGlintExponent`: `8..256`
- `specularGlintStrength`: `0.0..3.0`
- `crestFoamStrength`: `0.0..2.5`
- `crestFoamThreshold`: `0.0..1.0`
- `localInteractionRadius`: `3.0..24.0`
- `localInteractionLength`: `4.0..30.0`
- `bowInteractionStrength`: `0.0..2.0`
- `hullInteractionStrength`: `0.0..2.0`
- `interactionNormalBoost`: `0.0..2.0`
- `bowRippleFrequency`: `1.0..24.0`
- `bowRippleStrength`: `0.0..2.0`
- `nearFieldRadius`: `8.0..120.0`
- `nearFieldNormalBoost`: `0.0..2.0`
- `nearFieldDetailBoost`: `0.0..2.0`
- `nearFieldContrastBoost`: `0.0..1.5`
- `directionalStreakStrength`: `0.0..1.5`
- `directionalStreakScale`: `0.001..0.2`
- `directionalStreakAnisotropy`: `0.0..1.0`
- `disturbedSpecularBoost`: `0.0..2.5`
- `disturbedHighlightFlicker`: `0.0..1.5`
- `disturbedContrastBoost`: `0.0..1.5`

## Performance Constraints and Defaults

The rendering solution must:

- Maintain stable framerate on mid-range desktop and laptop hardware.
- Avoid excessive fragment and shadow cost spikes.
- Provide graceful feature reduction and tuning levers.

Optimization levers:

- Reduce shadow map resolution.
- Disable shadows for distant or non-critical objects.
- Keep post-processing minimal.
- Reduce water wave components, mesh subdivision, shoreline response, or wake
  extent by quality tier.

## Acceptance Criteria

### Visual

- Scene no longer appears uniformly lit.
- Ship reads clearly from environment under typical camera angles.
- Islands show visible light and shadow separation.
- Horizon reads as intentional, not a hard boundary.
- Distant objects fade naturally into atmospheric fog.
- Ocean no longer appears flat when camera is static.
- Near and far water bands are visibly different in hue/value.
- Horizon reflectivity reads stronger than near-water reflectivity at glancing
  angles.
- Motion remains visible at low ship speed.
- Angle-dependent water highlights are visible.
- Shoreline areas are clearly differentiated from deep water.
- Ship movement produces visible wake and disturbance.
- Ship presence produces visible local water reaction at low and medium speed.
- Near-hull water darkening and curvature foam are visible without overpowering
  readability.
- Turning creates asymmetric side disturbance in wake/foam at higher turn rates.
- Bow/hull disturbance is clearly visible on both player and enemy ships.
- Near-field water around camera/ships is visibly more energetic than far field.
- Directional streaking is visible at glancing angles without reading as
  painted speed lines.
- Disturbed water (hull/wake zones) shows stronger specular contrast than calm
  water.
- Overall scene has a recognizable adventurous maritime mood.

### Technical

- Tone mapping and output color space are configured correctly.
- Lighting remains stable during movement.
- No major shadow acne or peter-panning artifacts during gameplay.
- Water remains stable across camera movement.
- No major shader artifacts at horizon.
- No obvious normal-map tiling during typical play.
- Camera translation must not shift displacement phase at fixed world points.
- Performance remains acceptable on target hardware.
- No mandatory screen-space ray-marching reflection pass is required for MVP.

## Spec Verification Requirements

Required validation coverage for this spec:

- Fresnel reflection blend and depth-gradient uniforms exist, clamp correctly,
  and affect final color.
- Near-vs-far water color difference is measurable in fixed-camera snapshots.
- Micro normal layer contributes non-zero high-frequency shading detail.
- Specular glint responds to sun-direction changes.
- Crest foam activates on steep/curved regions and remains subdued on flat
  regions.
- Ship-proximity darkening and trailing interaction mask appear only within
  expected spatial envelope.
- World-point wave phase remains stable under camera translation (mesh origin
  uniform updates but sampled world displacement remains invariant).
- All-ship interaction uniform plumbing is present, clamped, and stable under
  multi-ship load.
- Disturbed-region specular/contrast boosts stay bounded and do not whiteout.
- Directional streaking remains angle-dependent and low-artifact in fixed
  visual snapshots.
- Deterministic visual scenarios captured for:
  - idle water baseline,
  - moving ship straight,
  - moving ship hard turn,
  - accel/decel pulse,
  - multi-ship crossing wake,
  - horizon-facing camera.

## Notes for Engineering

- Keep rendering upgrades visual-only; do not move gameplay logic into render
  systems.
- Preserve interpolation contract by using render-time inputs for visual
  animation.
- Maintain storm blending compatibility with existing fog/background and water
  storm logic.
- Start with clear daytime defaults and keep architecture ready for future
  atmosphere states.
