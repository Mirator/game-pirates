# Spec 05: Progression UX Art Audio

## Purpose

Define player growth and the presentation layer needed for a strong pirate
fantasy.

## Authority

This spec is authoritative for progression-facing UX surface requirements and
audio/art direction targets.

## Dependencies

- Spec 02 and Spec 04 for loop/economy signals surfaced by HUD and menus.
- Spec 08 and Spec 09 for render-specific implementation constraints.

## Progression

Ship stats:
- Max HP.
- Movement speed.
- Turn rate.
- Cannon damage.
- Reload speed.
- Cargo capacity.

Upgrade categories:
- Hull reinforcement.
- Sail improvement.
- Cannon upgrades.
- Storage upgrades.
- Repair efficiency.

Long-term optional systems:
- Captain reputation.
- Unlockable ship classes.
- Cosmetics.
- Faction standing.

## Camera

Third-person follow camera behind ship:
- Slightly elevated view.
- Modest zoom-out at higher speed.
- Smooth follow behavior.

Future additions:
- Subtle shake on cannon fire or damage.
- Spyglass zoom.
- Cinematic camera mode.
- Photo mode.

## UX and UI

HUD includes:
- Ship HP bar.
- Left and right cannon reload indicators.
- Gold counter.
- Repair material counter.
- Cargo counter.
- Minimap or compass.
- Current interaction/combat prompt.

Menus include:
- Pause menu.
- Port shop.
- Upgrade menu.

Future optional menus:
- Dedicated map screen.

UI rule:
- Keep screens compact and readable with minimal text clutter.

## Art Direction

Visual target: stylized low-poly pirate fantasy.

Visual qualities:
- Bright tropical palette.
- Chunky readable ship silhouettes.
- Exaggerated waves.
- Large cannon smoke puffs.
- Clear island silhouettes.

UI styling:
- Parchment-inspired panels.
- Compass and brass motifs.
- Readable typography.

## Audio Direction

MVP audio set:
- Sea ambience.
- Cannon fire.
- Ship creaks.
- Coin pickup.
- Docking sound.
- Calm exploration music.
- Intense combat music.

Audio is a force multiplier for fantasy and game feel.

## Acceptance Criteria

- HUD contains every listed MVP element and remains readable on desktop/mobile.
- Port and pause menu flows expose required progression actions.
- Art direction remains consistent with stylized pirate-fantasy targets.
- MVP audio events trigger for combat, loot, docking, and exploration states.
