import type { PerspectiveCamera, Vector3 } from "three";
import type { CameraOrbitState } from "../app/createCamera";

interface CameraPlayerPose {
  x: number;
  z: number;
  heading: number;
  speed: number;
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
}

const CAMERA_WORLD_UP = { x: 0, y: 1, z: 0 } as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  bridge.cameraSmoothedHeading = playerPose.heading;
  bridge.cameraHeadingInitialized = true;

  const cameraForwardX = Math.sin(bridge.cameraSmoothedHeading);
  const cameraForwardZ = Math.cos(bridge.cameraSmoothedHeading);
  const orbitHeading = bridge.cameraSmoothedHeading + bridge.cameraOrbit.yawOffset;
  const orbitForwardX = Math.sin(orbitHeading);
  const orbitForwardZ = Math.cos(orbitHeading);
  const speedAbs = Math.abs(playerPose.speed);
  const followDistance = 12 + clamp(speedAbs * 0.3, 0, 2.4);
  const orbitPlanarDistance = followDistance * Math.cos(bridge.cameraOrbit.pitchOffset);
  const orbitHeightOffset = Math.sin(bridge.cameraOrbit.pitchOffset) * followDistance;
  const desiredHeight = 6.7 + clamp(speedAbs * 0.11, 0, 1.0);

  bridge.cameraDesiredPosition.set(
    playerPose.x - orbitForwardX * orbitPlanarDistance,
    desiredHeight + orbitHeightOffset,
    playerPose.z - orbitForwardZ * orbitPlanarDistance
  );

  const desiredLookAhead = 1.15 + clamp(speedAbs * 0.03, 0, 0.24);
  bridge.cameraDesiredLookTarget.set(
    playerPose.x + cameraForwardX * desiredLookAhead,
    1.5 + clamp(speedAbs * 0.035, 0, 0.25),
    playerPose.z + cameraForwardZ * desiredLookAhead
  );

  if (!bridge.cameraLookInitialized) {
    bridge.camera.position.copy(bridge.cameraDesiredPosition);
    bridge.cameraLookTarget.copy(bridge.cameraDesiredLookTarget);
    bridge.cameraLookInitialized = true;
  }

  const positionFollowStrength = 1 - Math.exp(-5.2 * frameDt);
  const lookFollowStrength = 1 - Math.exp(-3.4 * frameDt);

  bridge.camera.position.lerp(bridge.cameraDesiredPosition, positionFollowStrength);
  bridge.cameraLookTarget.lerp(bridge.cameraDesiredLookTarget, lookFollowStrength);
  orientCameraWithCanonicalBasis(bridge.camera, bridge.cameraLookTarget);
}
