import {
  ConeGeometry,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  TorusGeometry,
  Vector3
} from "three";
import { PORT_POSITION } from "../simulation";
import { createCamera } from "./app/createCamera";
import { createRenderConfig, type RenderConfigOverrides } from "./app/renderConfig";
import { createScene } from "./app/createScene";
import { createEnvironment } from "./objects/createEnvironment";
import { createShipDefinition, createShipMesh } from "./objects/createShipMesh";
import { createShipWakeController, createWakeDebugSurface } from "./wake/createShipWakeController";
import {
  createPlayerPresentationRuntimeState,
  type RenderBridgeState
} from "./adapters/renderBridge";

export interface RenderWorldOptions {
  renderConfigOverrides?: RenderConfigOverrides;
  cameraInputTarget?: EventTarget;
  cameraWindowTarget?: Window;
}

export interface RenderWorld {
  scene: Scene;
  camera: PerspectiveCamera;
  bridge: RenderBridgeState;
  dispose: () => void;
}

function disposeGroup(group: Group): void {
  group.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.geometry || !mesh.material) {
      return;
    }

    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) {
        (material as Material).dispose();
      }
    } else {
      (mesh.material as Material).dispose();
    }
  });
}

export function createRenderWorld(options: RenderWorldOptions = {}): RenderWorld {
  const renderConfig = createRenderConfig(options.renderConfigOverrides ?? {});
  const scene = createScene();
  const cameraController = createCamera({
    windowTarget: options.cameraWindowTarget ?? window,
    inputTarget: options.cameraInputTarget
  });
  const { camera } = cameraController;

  const environment = createEnvironment(scene, renderConfig.water, renderConfig.atmosphere);

  const playerVisual = createShipMesh(createShipDefinition("player"));
  const playerMesh = playerVisual.group;
  scene.add(playerMesh);

  const wakeRoot = new Group();
  scene.add(wakeRoot);
  const playerWakeController = createShipWakeController({
    quality: "high",
    sternOffset: playerVisual.wakeSternOffset,
    rootName: "wake-player"
  });
  wakeRoot.add(playerWakeController.getRoot());
  const wakeDebug = createWakeDebugSurface();

  const enemyRoot = new Group();
  scene.add(enemyRoot);

  const projectileRoot = new Group();
  scene.add(projectileRoot);

  const lootRoot = new Group();
  scene.add(lootRoot);

  const portBeacon = new Group();
  const beaconCore = new Mesh(
    new ConeGeometry(1.3, 3.8, 8),
    new MeshStandardMaterial({
      color: "#f0c16f",
      emissive: "#9c6a28",
      emissiveIntensity: 0.18,
      flatShading: true,
      roughness: 0.42
    })
  );
  beaconCore.castShadow = true;
  beaconCore.receiveShadow = true;
  beaconCore.position.y = 2.2;
  portBeacon.add(beaconCore);

  const beaconRing = new Mesh(
    new TorusGeometry(2.1, 0.16, 8, 22),
    new MeshStandardMaterial({
      color: "#f9e2a3",
      roughness: 0.24,
      metalness: 0.2
    })
  );
  beaconRing.castShadow = true;
  beaconRing.receiveShadow = true;
  beaconRing.rotation.x = Math.PI * 0.5;
  beaconRing.position.y = 0.34;
  portBeacon.add(beaconRing);
  portBeacon.position.set(PORT_POSITION.x, 0, PORT_POSITION.z);
  scene.add(portBeacon);

  const bridge: RenderBridgeState = {
    scene,
    camera,
    playerMesh,
    playerVisual,
    wakeRoot,
    wakeDebug,
    playerWakeController,
    enemyWakeControllers: new Map(),
    wakeInfluencesScratch: [],
    enemyRoot,
    enemyMeshes: new Map(),
    enemyVisuals: new Map(),
    environment,
    projectileRoot,
    projectileMeshes: new Map(),
    lootRoot,
    lootMeshes: new Map(),
    seenEnemyIds: new Set(),
    seenProjectileIds: new Set(),
    seenLootIds: new Set(),
    knownProjectileOwners: new Map(),
    knownProjectilePruneScratch: [],
    cameraDesiredPosition: new Vector3(),
    cameraDesiredLookTarget: new Vector3(),
    cameraLookTarget: new Vector3(),
    cameraOrbit: cameraController.orbit,
    cameraSmoothedHeading: 0,
    cameraHeadingInitialized: false,
    cameraLookInitialized: false,
    playerPoseScratch: {
      x: 0,
      y: 0,
      z: 0,
      heading: 0,
      pitch: 0,
      roll: 0,
      speed: 0,
      drift: 0,
      throttle: 0,
      turnRate: 0
    },
    enemyPoseScratch: {
      x: 0,
      y: 0,
      z: 0,
      heading: 0,
      pitch: 0,
      roll: 0,
      speed: 0,
      drift: 0,
      throttle: 0,
      turnRate: 0
    },
    enemyPoseCache: new Map(),
    playerPresentationState: createPlayerPresentationRuntimeState(),
    enemyPresentationStates: new Map(),
    playerFx: {
      hitFlashTimer: 0,
      muzzleLeftTimer: 0,
      muzzleRightTimer: 0
    },
    enemyFx: new Map(),
    playerLastHp: 100,
    enemyLastHp: new Map()
  };
  let disposed = false;

  return {
    scene,
    camera,
    bridge,
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;

      playerWakeController.dispose();
      for (const wakeController of bridge.enemyWakeControllers.values()) {
        wakeController.dispose();
      }
      bridge.enemyWakeControllers.clear();
      bridge.environment.dispose();

      disposeGroup(playerMesh);
      disposeGroup(enemyRoot);
      disposeGroup(projectileRoot);
      disposeGroup(lootRoot);
      disposeGroup(portBeacon);

      scene.remove(playerMesh);
      scene.remove(wakeRoot);
      scene.remove(enemyRoot);
      scene.remove(projectileRoot);
      scene.remove(lootRoot);
      scene.remove(portBeacon);

      bridge.enemyMeshes.clear();
      bridge.enemyVisuals.clear();
      bridge.projectileMeshes.clear();
      bridge.lootMeshes.clear();
      bridge.enemyPoseCache.clear();
      bridge.enemyPresentationStates.clear();
      bridge.enemyFx.clear();
      bridge.enemyLastHp.clear();
      bridge.knownProjectileOwners.clear();

      cameraController.dispose();
    }
  };
}
