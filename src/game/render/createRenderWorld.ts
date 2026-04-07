import { ConeGeometry, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, TorusGeometry, Vector3 } from "three";
import { PORT_POSITION } from "../simulation";
import { createCamera } from "./app/createCamera";
import { createRenderConfig, type RenderConfigOverrides } from "./app/renderConfig";
import { createScene } from "./app/createScene";
import { createEnvironment } from "./objects/createEnvironment";
import { createShipDefinition, createShipMesh } from "./objects/createShipMesh";
import { createShipWakeController, createWakeDebugSurface } from "./wake/createShipWakeController";
import type { RenderBridgeState } from "./adapters/renderBridge";

export interface RenderWorld {
  scene: Scene;
  camera: PerspectiveCamera;
  bridge: RenderBridgeState;
  dispose: () => void;
}

export function createRenderWorld(overrides: RenderConfigOverrides = {}): RenderWorld {
  const renderConfig = createRenderConfig(overrides);
  const scene = createScene();
  const cameraController = createCamera();
  const { camera } = cameraController;

  const environment = createEnvironment(scene, renderConfig.water, renderConfig.atmosphere);

  const playerVisual = createShipMesh(createShipDefinition("player"));
  const playerMesh = playerVisual.group;
  scene.add(playerMesh);

  const wakeRoot = new Group();
  scene.add(wakeRoot);
  const playerWakeController = createShipWakeController({
    quality: "high",
    sternOffset: playerVisual.definition.silhouette.hullLength * 0.5,
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
    cameraDesiredPosition: new Vector3(),
    cameraDesiredLookTarget: new Vector3(),
    cameraLookTarget: new Vector3(),
    cameraSmoothedHeading: 0,
    cameraHeadingInitialized: false,
    cameraLookInitialized: false,
    playerPoseScratch: {
      x: 0,
      z: 0,
      heading: 0,
      speed: 0,
      drift: 0,
      throttle: 0,
      turnRate: 0
    },
    enemyPoseScratch: {
      x: 0,
      z: 0,
      heading: 0,
      speed: 0,
      drift: 0,
      throttle: 0,
      turnRate: 0
    },
    enemyPoseCache: new Map(),
    playerFx: {
      hitFlashTimer: 0,
      muzzleLeftTimer: 0,
      muzzleRightTimer: 0
    },
    enemyFx: new Map(),
    playerLastHp: 100,
    enemyLastHp: new Map()
  };

  return {
    scene,
    camera,
    bridge,
    dispose: () => {
      playerWakeController.dispose();
      for (const wakeController of bridge.enemyWakeControllers.values()) {
        wakeController.dispose();
      }
      bridge.enemyWakeControllers.clear();
      cameraController.dispose();
    }
  };
}
