import { Group, PerspectiveCamera, Scene } from "three";
import { createCamera } from "./app/createCamera";
import { createScene } from "./app/createScene";
import { createEnvironment } from "./objects/createEnvironment";
import { createShipMesh } from "./objects/createShipMesh";
import type { RenderBridgeState } from "./adapters/renderBridge";

export interface RenderWorld {
  scene: Scene;
  camera: PerspectiveCamera;
  bridge: RenderBridgeState;
}

export function createRenderWorld(): RenderWorld {
  const scene = createScene();
  const camera = createCamera();

  const environment = createEnvironment(scene);

  const playerMesh = createShipMesh("#7a3f1f", "#f6ecce");
  const enemyMesh = createShipMesh("#4e2d24", "#d9d0b2");
  scene.add(playerMesh);
  scene.add(enemyMesh);

  const projectileRoot = new Group();
  scene.add(projectileRoot);

  return {
    scene,
    camera,
    bridge: {
      scene,
      camera,
      playerMesh,
      enemyMesh,
      environment,
      projectileRoot,
      projectileMeshes: new Map()
    }
  };
}
