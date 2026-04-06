import { PerspectiveCamera } from "three";

export interface CameraController {
  camera: PerspectiveCamera;
  dispose: () => void;
}

export function createCamera(target: Window = window): CameraController {
  const camera = new PerspectiveCamera(58, target.innerWidth / target.innerHeight, 0.1, 400);
  camera.position.set(0, 8, -18);

  const onResize = (): void => {
    camera.aspect = target.innerWidth / target.innerHeight;
    camera.updateProjectionMatrix();
  };

  target.addEventListener("resize", onResize);
  return {
    camera,
    dispose: () => {
      target.removeEventListener("resize", onResize);
    }
  };
}
