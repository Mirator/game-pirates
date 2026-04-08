# Spec 09: Ship Visual and Gameplay Representation Upgrade

## Title

Ship Visual and Gameplay Representation Upgrade

## Objective

Define a clear, scalable standard for player and enemy ships so they look
intentional, readable, and gameplay-relevant rather than placeholder objects.

Cross-spec dependencies:
- Spec 03: Sailing and Combat (combat readability and broadside understanding).
- Spec 05: Progression UX Art Audio (stylized art direction consistency).
- Spec 06: Technical Architecture (render-only ownership for visual feedback).
- Spec 08: Stylized Ocean Rendering (lighting/water compatibility).
- Spec 10: Stylized Ship Wake Rendering System (wake architecture and tuning).
- Spec 11: Gravity-Based Physics System (authoritative ship/projectile physics).
- Spec 12: Player and Ship Movement System (authoritative handling outputs that
  drive visual cues).

V1 scope note:
- Ship rendering uses procedural meshes for now.
- Data contracts are GLTF-preferred and asset-pipeline ready for later swap-in.

## 1. Purpose

Ships are the most important moving objects in the game. They must:
- look recognizable from gameplay camera distance.
- communicate faction and threat level.
- feel alive through motion and feedback.
- support future extension into combat, upgrades, cargo, and multiplayer.

## 2. Design Goals

- Strong silhouette.
- Clear readability at medium distance.
- Stylized visual consistency with the world.
- Distinct player vs enemy presentation.
- Lightweight enough for browser rendering.

## 3. Core Requirements

### 3.1 Common Ship Structure

Each ship must contain these visible parts:
- hull.
- mast.
- sail or flag.
- deck surface.
- bow and stern shaping.
- side cannon positions or implied weapon mounts.

Ships must no longer be simple boxes or primitives without identifiable
nautical form.

### 3.2 Visual Readability

Ships must remain readable from the default gameplay camera.

Required:
- clear front/back orientation.
- visible width and length proportions.
- silhouette that remains recognizable against water and islands.

Avoid:
- overly thin geometry.
- visual clutter.
- identical shapes for all ship types.

### 3.3 Player Ship

The player ship must look:
- slightly more heroic.
- cleaner.
- easier to read.
- visually central.

Recommended traits:
- brighter sail or accent color.
- slightly stronger detail density.
- more polished shape language.

The player should identify their ship instantly without relying only on UI.

### 3.4 Enemy Ships

Enemy ships must be readable as threats immediately.

Required differences from player ship:
- distinct silhouette, sail shape, or color treatment.
- clearer hostile identity.
- readable at medium-to-long distance.

Examples:
- darker sail palette.
- sharper hull shape.
- faction flag.
- red-accent visual markers if needed.

Enemy ships should not rely only on minimap dots to be recognized.

## 4. Motion Requirements

Ships must feel alive even when moving slowly.

Required motion behaviors:
- vertical bobbing on water.
- slight roll/pitch response.
- visible turning lean or directional response.
- forward motion feedback.

Ships should not appear rigidly attached to the world.

Motion source contract:

- Ship visual pose should consume simulation-authoritative physics state
  (position, heading, pitch, roll, velocity-derived cues), not independent fake
  locomotion.
- Added tilt/sail/contact effects must be applied on render presentation nodes
  only and must not write into gameplay authority.

### 4.1 Tilt (Roll + Pitch)

Ship tilt is a visual feedback layer that must communicate momentum without
hurting readability.

Required behavior:
- roll is driven primarily by actual yaw turn rate (preferred) or normalized
  turn input.
- left turn leans hull slightly to the right, right turn leans slightly to the
  left.
- pitch is driven by longitudinal acceleration: accelerating lifts bow slightly,
  decelerating lowers bow slightly.
- apply smoothing (`lerp`/damp/spring) to avoid snapping and jitter.
- include very small idle bob/noise so ship never feels perfectly rigid.

MVP recommended bounds:
- roll clamp: up to `8-12°` (default `10°`).
- pitch clamp: up to `3-5°` (default `4°`).

Authority boundary:
- tilt is presentation-only in MVP.
- tilt must not modify cannon logic, collision response, navigation, or
  simulation state.

### 4.2 Sail Behavior

Sails must communicate speed and heading change even without wind simulation.

Required behavior:
- drive sail state from `speedFactor = currentSpeed / maxSpeed`.
- low speed: looser/resting sail pose.
- high speed: more open/tensioned sail pose.
- turning adds subtle delayed sail sway.
- add low-amplitude flutter/oscillation to avoid static presentation.
- smooth all sail transitions to prevent popping on rapid speed changes.

Recommended runtime driver values:
- `speedBlend`
- `tension`
- `swayAngle`
- `flutterOffset`

Future-compat requirement:
- multiple sails may share common driver values with slight per-sail phase
  offsets.

Authority boundary:
- sail behavior is presentation-only in MVP.
- sail animation must not alter thrust, drag, wind direction, or combat balance.

### 4.3 Shadow + Contact Grounding

Ships must read as physically grounded on water from gameplay camera distance.

Required behavior:
- stable blob/projection contact shadow under hull.
- soft radial falloff; darkest near hull center.
- subtle under-hull darkening/contact patch to reinforce water intersection.
- contact layer follows ship and stays readable in all MVP lighting states.
- opacity must be controllable independently from scene-light intensity.
- solution should stay cheap (textured quad/decal/projected circle), not complex
  dynamic shadowing.

Tuning notes:
- optional subtle scale modulation from tilt/bob is allowed.
- modulation must remain stable and non-cartoonish.

Authority boundary:
- contact shadow/darkening are presentation-only.
- no dependency on advanced water simulation or physical lighting models.

## 5. Interaction Feedback

Ships must visually react to gameplay events.

Required for player and enemy:
- wake while moving.
- hit feedback when damaged.
- cannon fire feedback when attacking.

Optional later:
- sail damage.
- smoke when low HP.
- mast or hull state variation.

## 6. Combat Readability

Ships must support combat clarity.

Required:
- broadside direction should be understandable.
- cannon side placement should be visually implied.
- player should roughly understand where attacks come from.

Enemy ships should not feel like abstract damage sources.

## 7. Scaling and Classing

Ship architecture must support multiple classes later.

Minimum future-compatible class set:
- small ship.
- medium ship.
- heavy ship.

These should differ in:
- size.
- silhouette.
- number of visible cannon positions.
- speed/weight impression.

Even if only one or two models exist initially, the spec must not block future
class expansion.

## 8. Technical Requirements

- Use low-poly or stylized optimized meshes.
- Prefer GLTF workflow.
- Materials should support directional light and shadows.
- Ships should work with current water and lighting systems.
- Enemy variants should reuse a common base where possible for efficiency.

## 9. Acceptance Criteria

### Visual

- Player ship no longer looks like a placeholder block.
- Enemy ship is visually distinguishable from player ship.
- Ship orientation is readable without UI help.
- Ships fit the stylized art direction of the world.

### Gameplay

- Ships visibly react to movement and turning.
- Ships visibly show bounded tilt and sail response without visual snapping.
- Ships appear grounded to water with stable under-hull contact cue.
- Ships provide clear visual combat feedback.
- Player can identify threats at distance.
