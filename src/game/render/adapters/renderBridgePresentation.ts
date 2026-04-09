import { MOVEMENT_MAX_SPEED, MOVEMENT_MAX_TURN_RATE, SINK_DURATION, type ShipState } from "../../simulation";
import type { ShipVisual } from "../objects/createShipMesh";

const DEG_TO_RAD = Math.PI / 180;
const ROLL_MAX = 10 * DEG_TO_RAD;
const PITCH_MAX = 4 * DEG_TO_RAD;
const ROLL_DAMPING = 10;
const PITCH_DAMPING = 9;
const PITCH_ACCEL_REFERENCE = 36;
const BOB_BASE_AMPLITUDE = 0.012;
const BOB_SPEED_AMPLITUDE = 0.006;
const IDLE_ROLL_NOISE_MAX = 0.5 * DEG_TO_RAD;
const IDLE_PITCH_NOISE_MAX = 0.35 * DEG_TO_RAD;
const SAIL_TENSION_DAMPING = 7.5;
const SAIL_SWAY_DAMPING = 4.4;
const SAIL_FLUTTER_DAMPING = 8.6;
const SAIL_SWAY_MAX = 5 * DEG_TO_RAD;
const SAIL_SWAY_NOISE_MAX = 1.2 * DEG_TO_RAD;
const SAIL_FLUTTER_BASE = 0.6 * DEG_TO_RAD;
const SAIL_FLUTTER_MAX = 1.5 * DEG_TO_RAD;
const CONTACT_DAMPING = 8.2;

export interface ShipPresentationRuntimeState {
  smoothedRoll: number;
  smoothedPitch: number;
  bobOffset: number;
  previousForwardSpeed: number;
  sailTension: number;
  sailSway: number;
  sailFlutter: number;
  speedBlend: number;
  contactScale: number;
  contactShadowOpacity: number;
  contactPatchOpacity: number;
  bobPhase: number;
  noisePhase: number;
  flutterPhase: number;
}

export interface ShipPresentationPose {
  x: number;
  y?: number;
  z: number;
  heading: number;
  pitch?: number;
  roll?: number;
  speed: number;
  turnRate: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

function dampExp(current: number, target: number, damping: number, dt: number): number {
  const alpha = 1 - Math.exp(-damping * Math.max(0, dt));
  return lerp(current, target, alpha);
}

function createShipPresentationRuntimeState(seed: number): ShipPresentationRuntimeState {
  const seedNorm = Math.abs(Math.sin(seed * 17.13));
  return {
    smoothedRoll: 0,
    smoothedPitch: 0,
    bobOffset: 0,
    previousForwardSpeed: 0,
    sailTension: 0.35,
    sailSway: 0,
    sailFlutter: 0,
    speedBlend: 0,
    contactScale: 1,
    contactShadowOpacity: 0.27,
    contactPatchOpacity: 0.16,
    bobPhase: seedNorm * Math.PI * 2,
    noisePhase: Math.abs(Math.cos(seed * 11.9)) * Math.PI * 2,
    flutterPhase: Math.abs(Math.sin(seed * 5.7)) * Math.PI * 2
  };
}

export function createPlayerPresentationRuntimeState(): ShipPresentationRuntimeState {
  return createShipPresentationRuntimeState(1);
}

export function createEnemyPresentationRuntimeState(enemyId: number): ShipPresentationRuntimeState {
  return createShipPresentationRuntimeState(enemyId + 2);
}

export function applyShipPose(
  ship: ShipState,
  pose: ShipPresentationPose,
  visual: ShipVisual,
  presentation: ShipPresentationRuntimeState,
  renderTime: number,
  frameDt: number
): void {
  const sinkProgress = ship.status === "sinking" ? (SINK_DURATION - ship.sinkTimer) / SINK_DURATION : 0;
  const sinkOffset = -Math.max(0, sinkProgress) * 2.2;
  const speedAbs = Math.abs(pose.speed);
  const speedBlendTarget = clamp(speedAbs / Math.max(1e-5, MOVEMENT_MAX_SPEED), 0, 1);
  presentation.speedBlend = dampExp(presentation.speedBlend, speedBlendTarget, 8.4, frameDt);

  const turnNorm = clamp(pose.turnRate / Math.max(1e-5, MOVEMENT_MAX_TURN_RATE), -1, 1);
  const targetRoll = clamp(-turnNorm * ROLL_MAX, -ROLL_MAX, ROLL_MAX);
  presentation.smoothedRoll = dampExp(presentation.smoothedRoll, targetRoll, ROLL_DAMPING, frameDt);

  const forwardAcceleration = (pose.speed - presentation.previousForwardSpeed) / Math.max(frameDt, 1e-5);
  presentation.previousForwardSpeed = pose.speed;
  const targetPitch = clamp(-(forwardAcceleration / PITCH_ACCEL_REFERENCE) * PITCH_MAX, -PITCH_MAX, PITCH_MAX);
  presentation.smoothedPitch = dampExp(presentation.smoothedPitch, targetPitch, PITCH_DAMPING, frameDt);

  const bobPrimary =
    Math.sin(renderTime * 1.85 + presentation.bobPhase + pose.x * 0.02) *
    (BOB_BASE_AMPLITUDE + presentation.speedBlend * BOB_SPEED_AMPLITUDE);
  const bobSecondary = Math.sin(renderTime * 3.1 + presentation.noisePhase + pose.z * 0.015) * 0.004;
  presentation.bobOffset = bobPrimary + bobSecondary;

  const rollNoise = Math.sin(renderTime * 1.42 + presentation.noisePhase) * IDLE_ROLL_NOISE_MAX;
  const pitchNoise = Math.sin(renderTime * 1.26 + presentation.noisePhase * 0.93) * IDLE_PITCH_NOISE_MAX;

  const targetSailTension = lerp(0.34, 1, presentation.speedBlend);
  presentation.sailTension = dampExp(presentation.sailTension, targetSailTension, SAIL_TENSION_DAMPING, frameDt);

  const targetSailSway = clamp(-pose.turnRate * 0.07, -SAIL_SWAY_MAX, SAIL_SWAY_MAX);
  presentation.sailSway = dampExp(presentation.sailSway, targetSailSway, SAIL_SWAY_DAMPING, frameDt);

  const flutterAmplitude = lerp(SAIL_FLUTTER_BASE, SAIL_FLUTTER_MAX, presentation.speedBlend);
  const targetSailFlutter =
    Math.sin(renderTime * (7 + presentation.speedBlend * 4.2) + presentation.flutterPhase) * flutterAmplitude;
  presentation.sailFlutter = dampExp(presentation.sailFlutter, targetSailFlutter, SAIL_FLUTTER_DAMPING, frameDt);

  visual.group.position.set(pose.x, (pose.y ?? ship.position.y) + sinkOffset, pose.z);
  visual.group.rotation.set(0, pose.heading, 0);
  visual.presentation.position.set(0, presentation.bobOffset, 0);
  visual.presentation.rotation.set(
    (pose.pitch ?? ship.pitch) + presentation.smoothedPitch + pitchNoise,
    0,
    (pose.roll ?? ship.roll) + presentation.smoothedRoll + rollNoise + sinkProgress * 0.24
  );

  for (const [index, sail] of visual.sails.entries()) {
    const phase = sail.phaseOffset + index * 0.34 + presentation.bobPhase;
    const swayNoise = Math.sin(renderTime * 2.4 + phase) * SAIL_SWAY_NOISE_MAX;
    const flutterNoise =
      Math.sin(renderTime * 10.2 + phase + presentation.flutterPhase) * (flutterAmplitude * 0.35);
    const sailSway = presentation.sailSway + swayNoise;
    const sailFlutter = presentation.sailFlutter + flutterNoise;

    sail.mesh.position.copy(sail.basePosition);
    sail.mesh.position.x += Math.sin(renderTime * 8.1 + phase) * (0.015 + presentation.speedBlend * 0.016);

    sail.mesh.rotation.x = sail.baseRotation.x + lerp(0.085, 0.02, presentation.sailTension);
    sail.mesh.rotation.y = sail.baseRotation.y + sailSway * 0.2;
    sail.mesh.rotation.z = sail.baseRotation.z + sailSway + sailFlutter;

    sail.mesh.scale.set(
      sail.baseScale.x * lerp(0.92, 1.08, presentation.sailTension),
      sail.baseScale.y * lerp(0.95, 1.05, presentation.sailTension),
      sail.baseScale.z
    );
  }

  const contactTargetScale =
    1 +
    presentation.speedBlend * 0.05 +
    (Math.abs(presentation.smoothedRoll) / Math.max(ROLL_MAX, 1e-5)) * 0.05 +
    Math.abs(presentation.bobOffset) * 1.5;
  presentation.contactScale = dampExp(presentation.contactScale, contactTargetScale, CONTACT_DAMPING, frameDt);

  const contactShadowBaseScaleX = Number(visual.contactShadow.userData.baseScaleX) || 1;
  const contactShadowBaseScaleZ = Number(visual.contactShadow.userData.baseScaleZ) || 1;
  const contactPatchBaseScaleX = Number(visual.contactPatch.userData.baseScaleX) || 1;
  const contactPatchBaseScaleZ = Number(visual.contactPatch.userData.baseScaleZ) || 1;
  visual.contactShadow.scale.set(
    contactShadowBaseScaleX * presentation.contactScale,
    1,
    contactShadowBaseScaleZ * presentation.contactScale
  );
  visual.contactPatch.scale.set(
    contactPatchBaseScaleX * lerp(1, presentation.contactScale, 0.82),
    1,
    contactPatchBaseScaleZ * lerp(1, presentation.contactScale, 0.82)
  );

  const shadowOpacityTarget = lerp(0.23, 0.31, presentation.speedBlend);
  const patchOpacityTarget = lerp(0.12, 0.18, presentation.speedBlend);
  presentation.contactShadowOpacity = dampExp(
    presentation.contactShadowOpacity,
    shadowOpacityTarget,
    CONTACT_DAMPING,
    frameDt
  );
  presentation.contactPatchOpacity = dampExp(
    presentation.contactPatchOpacity,
    patchOpacityTarget,
    CONTACT_DAMPING,
    frameDt
  );
  visual.contactShadowMaterial.opacity = presentation.contactShadowOpacity;
  visual.contactPatchMaterial.opacity = presentation.contactPatchOpacity;
}
