import { PerspectiveCamera } from "three";

const DEFAULT_YAW_SENSITIVITY = 0.005;
const DEFAULT_PITCH_SENSITIVITY = 0.0035;
const DEFAULT_MIN_PITCH = -0.35;
const DEFAULT_MAX_PITCH = 0.45;

export interface CameraOrbitState {
  yawOffset: number;
  pitchOffset: number;
  dragging: boolean;
}

export interface CameraOrbitConfig {
  yawSensitivity: number;
  pitchSensitivity: number;
  minPitch: number;
  maxPitch: number;
}

export interface CreateCameraOptions {
  windowTarget?: Window;
  inputTarget?: EventTarget;
  orbitConfig?: Partial<CameraOrbitConfig>;
}

export interface CameraController {
  camera: PerspectiveCamera;
  orbit: CameraOrbitState;
  orbitConfig: CameraOrbitConfig;
  dispose: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(angle: number): number {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

export function createCamera(options: CreateCameraOptions = {}): CameraController {
  const target = options.windowTarget ?? window;
  const inputTarget = options.inputTarget ?? target;
  const orbitConfig: CameraOrbitConfig = {
    yawSensitivity: options.orbitConfig?.yawSensitivity ?? DEFAULT_YAW_SENSITIVITY,
    pitchSensitivity: options.orbitConfig?.pitchSensitivity ?? DEFAULT_PITCH_SENSITIVITY,
    minPitch: options.orbitConfig?.minPitch ?? DEFAULT_MIN_PITCH,
    maxPitch: options.orbitConfig?.maxPitch ?? DEFAULT_MAX_PITCH
  };

  const camera = new PerspectiveCamera(58, target.innerWidth / target.innerHeight, 0.1, 400);
  camera.position.set(0, 8, -18);
  const orbit: CameraOrbitState = {
    yawOffset: 0,
    pitchOffset: 0,
    dragging: false
  };

  let previousPointerX = 0;
  let previousPointerY = 0;

  const onResize = (): void => {
    camera.aspect = target.innerWidth / target.innerHeight;
    camera.updateProjectionMatrix();
  };

  const onMouseDown = (event: MouseEvent): void => {
    if (event.button !== 2) {
      return;
    }

    orbit.dragging = true;
    previousPointerX = event.clientX;
    previousPointerY = event.clientY;
    event.preventDefault();
  };

  const onMouseMove = (event: MouseEvent): void => {
    if (!orbit.dragging) {
      return;
    }

    const deltaX = event.clientX - previousPointerX;
    const deltaY = event.clientY - previousPointerY;
    previousPointerX = event.clientX;
    previousPointerY = event.clientY;

    orbit.yawOffset = normalizeAngle(orbit.yawOffset - deltaX * orbitConfig.yawSensitivity);
    orbit.pitchOffset = clamp(
      orbit.pitchOffset - deltaY * orbitConfig.pitchSensitivity,
      orbitConfig.minPitch,
      orbitConfig.maxPitch
    );
    event.preventDefault();
  };

  const onMouseUp = (event: MouseEvent): void => {
    if (!orbit.dragging) {
      return;
    }

    orbit.dragging = false;
    if (event.button === 2) {
      event.preventDefault();
    }
  };

  const onBlur = (): void => {
    orbit.dragging = false;
  };

  const onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  target.addEventListener("resize", onResize);
  target.addEventListener("mousemove", onMouseMove);
  target.addEventListener("mouseup", onMouseUp);
  target.addEventListener("blur", onBlur);
  inputTarget.addEventListener("mousedown", onMouseDown as EventListener);
  inputTarget.addEventListener("contextmenu", onContextMenu as EventListener);

  return {
    camera,
    orbit,
    orbitConfig,
    dispose: () => {
      target.removeEventListener("resize", onResize);
      target.removeEventListener("mousemove", onMouseMove);
      target.removeEventListener("mouseup", onMouseUp);
      target.removeEventListener("blur", onBlur);
      inputTarget.removeEventListener("mousedown", onMouseDown as EventListener);
      inputTarget.removeEventListener("contextmenu", onContextMenu as EventListener);
    }
  };
}
