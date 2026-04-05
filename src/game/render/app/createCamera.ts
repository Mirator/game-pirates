import { PerspectiveCamera } from "three";

export function createCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 8, -18);

  const onResize = (): void => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };

  window.addEventListener("resize", onResize);
  return camera;
}
