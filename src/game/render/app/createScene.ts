import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Scene
} from "three";

export function createScene(): Scene {
  const scene = new Scene();
  scene.background = new Color("#8fd4ff");
  scene.fog = new Fog("#8fd4ff", 70, 190);

  const ambient = new AmbientLight("#b2d9ff", 0.45);
  scene.add(ambient);

  const hemi = new HemisphereLight("#daf5ff", "#2f5a70", 0.55);
  hemi.position.set(0, 25, 0);
  scene.add(hemi);

  const sun = new DirectionalLight("#ffe4a8", 0.95);
  sun.position.set(22, 40, 10);
  scene.add(sun);

  return scene;
}
