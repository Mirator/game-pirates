import type { PerspectiveCamera, Vector3 } from "three";
import type { CameraOrbitState } from "../app/createCamera";

interface CameraPlayerPose {
  x: number;
  y?: number;
  z: number;
  heading: number;
  speed: number;
  turnRate: number;
  acceleration: number;
}

export interface CameraBridgeState {
  camera: PerspectiveCamera;
  cameraDesiredPosition: Vector3;
  cameraDesiredLookTarget: Vector3;
  cameraLookTarget: Vector3;
  cameraOrbit: CameraOrbitState;
  cameraSmoothedHeading: number;
  cameraHeadingInitialized: boolean;
  cameraLookInitialized: boolean;
  cameraAccelLag: number;
  cameraTurnSwing: number;
  cameraVerticalLag: number;
}

const CAMERA_WORLD_UP = { x: 0, y: 1, z: 0 } as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

function normalizeAngle(angle: number): number {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

function shortestAngleLerp(from: number, to: number, alpha: number): number {
  const delta = normalizeAngle(to - from);
  return normalizeAngle(from + delta * alpha);
}

function orientCameraWithCanonicalBasis(camera: PerspectiveCamera, lookTarget: Vector3): void {
  camera.up.set(CAMERA_WORLD_UP.x, CAMERA_WORLD_UP.y, CAMERA_WORLD_UP.z);
  camera.lookAt(lookTarget);
  camera.updateMatrixWorld();
}

export function syncFollowCamera(
  bridge: CameraBridgeState,
  playerPose: CameraPlayerPose,
  frameDt: number
): void {
  if (!bridge.cameraHeadingInitialized) {
    bridge.cameraSmoothedHeading = playerPose.heading;
    bridge.cameraHeadingInitialized = true;
  } else {
    const headingFollowStrength = 1 - Math.exp(-10.5 * frameDt);
    bridge.cameraSmoothedHeading = shortestAngleLerp(
      bridge.cameraSmoothedHeading,
      playerPose.heading,
      headingFollowStrength
    );
  }

  const speedAbs = Math.abs(playerPose.speed);
  const accelNorm = clamp(playerPose.acceleration / 18, -1, 1);
  const turnNorm = clamp(playerPose.turnRate / 2.4, -1, 1);

  const accelLagTarget = clamp(accelNorm * 1.25, -0.65, 1.55);
  const accelLagFollow = accelLagTarget > bridge.cameraAccelLag ? 1 - Math.exp(-4.8 * frameDt) : 1 - Math.exp(-2.8 * frameDt);
  bridge.cameraAccelLag = lerp(bridge.cameraAccelLag, accelLagTarget, accelLagFollow);

  const turnSwingTarget = clamp(turnNorm * 0.28, -0.34, 0.34);
  const turnSwingFollow = 1 - Math.exp(-4.2 * frameDt);
  bridge.cameraTurnSwing = lerp(bridge.cameraTurnSwing, turnSwingTarget, turnSwingFollow);

  const heaveInput = clamp((playerPose.y ?? 0) * 0.55, -0.38, 0.55);
  const verticalLagFollow = 1 - Math.exp(-2.15 * frameDt);
  bridge.cameraVerticalLag = lerp(bridge.cameraVerticalLag, heaveInput, verticalLagFollow);

  const cameraForwardX = Math.sin(bridge.cameraSmoothedHeading);
  const cameraForwardZ = Math.cos(bridge.cameraSmoothedHeading);
  const orbitHeading = bridge.cameraSmoothedHeading + bridge.cameraOrbit.yawOffset - bridge.cameraTurnSwing;
  const orbitForwardX = Math.sin(orbitHeading);
  const orbitForwardZ = Math.cos(orbitHeading);
  const followDistance = 12 + clamp(speedAbs * 0.3, 0, 2.4) + bridge.cameraAccelLag;
  const orbitPlanarDistance = followDistance * Math.cos(bridge.cameraOrbit.pitchOffset);
  const orbitHeightOffset = Math.sin(bridge.cameraOrbit.pitchOffset) * followDistance;
  const desiredHeight = 6.7 + clamp(speedAbs * 0.11, 0, 1.0) + bridge.cameraVerticalLag;

  bridge.cameraDesiredPosition.set(
    playerPose.x - orbitForwardX * orbitPlanarDistance,
    desiredHeight + orbitHeightOffset,
    playerPose.z - orbitForwardZ * orbitPlanarDistance
  );

  const desiredLookAhead = 1.15 + clamp(speedAbs * 0.03, 0, 0.24) - bridge.cameraAccelLag * 0.08;
  bridge.cameraDesiredLookTarget.set(
    playerPose.x + cameraForwardX * desiredLookAhead,
    1.5 + clamp(speedAbs * 0.035, 0, 0.25) + bridge.cameraVerticalLag * 0.32,
    playerPose.z + cameraForwardZ * desiredLookAhead
  );

  if (!bridge.cameraLookInitialized) {
    bridge.camera.position.copy(bridge.cameraDesiredPosition);
    bridge.cameraLookTarget.copy(bridge.cameraDesiredLookTarget);
    bridge.cameraLookInitialized = true;
  }

  const accelLagDamp = 1 - clamp(Math.max(0, accelNorm) * 0.2, 0, 0.2);
  const positionFollowStrength = (1 - Math.exp(-5.2 * frameDt)) * accelLagDamp;
  const verticalFollowStrength = 1 - Math.exp(-2.1 * frameDt);
  const lookFollowStrength = 1 - Math.exp(-3.4 * frameDt);

  bridge.camera.position.x = lerp(bridge.camera.position.x, bridge.cameraDesiredPosition.x, positionFollowStrength);
  bridge.camera.position.z = lerp(bridge.camera.position.z, bridge.cameraDesiredPosition.z, positionFollowStrength);
  bridge.camera.position.y = lerp(bridge.camera.position.y, bridge.cameraDesiredPosition.y, verticalFollowStrength);
  bridge.cameraLookTarget.lerp(bridge.cameraDesiredLookTarget, lookFollowStrength);

  const targetFov = 58 + clamp(speedAbs * 0.25, 0, 5);
  const fovFollowStrength = 1 - Math.exp(-4.6 * frameDt);
  const nextFov = lerp(bridge.camera.fov, targetFov, fovFollowStrength);
  if (Math.abs(nextFov - bridge.camera.fov) > 1e-4) {
    bridge.camera.fov = nextFov;
    bridge.camera.updateProjectionMatrix();
  }

  orientCameraWithCanonicalBasis(bridge.camera, bridge.cameraLookTarget);
}
