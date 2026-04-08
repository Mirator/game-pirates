import { Group, PerspectiveCamera, Scene, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { createInitialWorldState, type EnemyState, type LootState, type ProjectileState, type WorldState } from "../../simulation";
import { createShipDefinition, createShipMesh } from "../objects/createShipMesh";
import { createShipWakeController, createWakeDebugSurface } from "../wake/createShipWakeController";
import {
  createPlayerPresentationRuntimeState,
  syncRenderFromSimulation,
  type RenderBridgeState,
  type RenderInterpolationContext,
  type RenderPreviousSnapshot
} from "./renderBridge";

function createEnemyState(id: number, x: number, z: number, heading = 0): EnemyState {
  const base = createInitialWorldState().player;
  return {
    ...base,
    id,
    archetype: "raider",
    owner: "enemy",
    position: { x, y: base.position.y, z },
    heading,
    pitch: 0,
    roll: 0,
    linearVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: 0,
    pitchVelocity: 0,
    rollVelocity: 0,
    speed: 0,
    drift: 0,
    throttle: 0,
    turnInput: 0,
    hp: 100,
    maxHp: 100,
    radius: 2.1,
    mass: base.mass,
    centerOfMass: { ...base.centerOfMass },
    buoyancyProbes: base.buoyancyProbes.map((probe) => ({ ...probe, localOffset: { ...probe.localOffset } })),
    buoyancyStrength: base.buoyancyStrength,
    buoyancyDamping: base.buoyancyDamping,
    buoyancyLoss: 0,
    hull: { ...base.hull },
    drag: { ...base.drag },
    thrustForce: base.thrustForce,
    turnTorque: base.turnTorque,
    lowSpeedTurnAssist: base.lowSpeedTurnAssist,
    reload: { left: 0, right: 0 },
    status: "alive",
    damageState: "healthy",
    sinkTimer: 0,
    repairCooldown: 0,
    collisionLayer: "ships",
    waterState: "submerged",
    aiState: "patrol",
    patrolAngle: 0,
    lootDropped: false,
    aiStateTimer: 0,
    detectProgress: 0,
    pendingFireSide: null
  };
}

function createProjectileState(id: number, owner: "player" | "enemy", x: number, z: number, y = 1.1): ProjectileState {
  return {
    id,
    owner,
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
    lifetime: 2,
    active: true,
    mass: 6.5,
    gravityScale: 1,
    dragAir: 0.2,
    dragWater: 7.5,
    collisionRadius: 0.36,
    impactImpulse: 6.4,
    terminateOnWaterImpact: true,
    waterState: "airborne",
    collisionLayer: "projectiles"
  };
}

function createLootState(id: number, x: number, z: number, y = 0.5): LootState {
  return {
    id,
    kind: "gold",
    amount: 10,
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
    yaw: 0,
    angularVelocity: 0,
    mass: 4.5,
    buoyancyMultiplier: 1.15,
    waterDrag: 2.8,
    angularDamping: 3.6,
    floats: true,
    waterState: "submerged",
    lifetime: 10,
    pickupRadius: 3,
    active: true,
    collisionLayer: "pickups_debris"
  };
}

function createBridge(environmentSync = vi.fn()): RenderBridgeState {
  const scene = new Scene();
  const camera = new PerspectiveCamera(58, 16 / 9, 0.1, 400);
  camera.position.set(0, 8, -18);

  const playerVisual = createShipMesh(createShipDefinition("player"));
  scene.add(playerVisual.group);
  const wakeRoot = new Group();
  scene.add(wakeRoot);
  const playerWakeController = createShipWakeController({
    quality: "high",
    sternOffset: playerVisual.definition.silhouette.hullLength * 0.5,
    rootName: "wake-player-test"
  });
  wakeRoot.add(playerWakeController.getRoot());

  return {
    scene,
    camera,
    playerMesh: playerVisual.group,
    playerVisual,
    wakeRoot,
    wakeDebug: createWakeDebugSurface(),
    playerWakeController,
    enemyWakeControllers: new Map(),
    wakeInfluencesScratch: [],
    enemyRoot: new Group(),
    enemyMeshes: new Map(),
    enemyVisuals: new Map(),
    environment: {
      root: new Group(),
      syncFromWorld: environmentSync,
      dispose: () => {},
      water: {
        getConfig: () => ({
          quality: "high",
          activeWaveCount: 4,
          waveAmplitude: 1,
          wavelength: 1,
          waveSpeed: 1,
          normalScrollSpeedA: 1,
          normalScrollSpeedB: 1,
          deepColor: "#1b5f93",
          shallowColor: "#54b9cc",
          fresnelStrength: 1,
          wakeIntensity: 1,
          foamThreshold: 0.46
        }),
        setQuality: () => {},
        updateTuning: () => {}
      },
      lighting: {
        getConfig: () => ({
          preset: "clearDay",
          sunAzimuthDeg: 54,
          sunElevationDeg: 40,
          sunIntensity: 1.08,
          ambientIntensity: 0.56,
          fogDensity: 0.0021,
          fogColor: "#8fc6e4",
          exposure: 1,
          shadowMapResolution: 1024,
          shadowCameraBounds: 95,
          activeStormBlend: 0,
          effectiveExposure: 1
        }),
        setPreset: () => {},
        updateTuning: () => {},
        getCurrentExposure: () => 1
      }
    },
    projectileRoot: new Group(),
    projectileMeshes: new Map(),
    lootRoot: new Group(),
    lootMeshes: new Map(),
    seenEnemyIds: new Set(),
    seenProjectileIds: new Set(),
    seenLootIds: new Set(),
    knownProjectileOwners: new Map(),
    knownProjectilePruneScratch: [],
    cameraDesiredPosition: new Vector3(),
    cameraDesiredLookTarget: new Vector3(),
    cameraLookTarget: new Vector3(),
    cameraOrbit: {
      yawOffset: 0,
      pitchOffset: 0,
      dragging: false
    },
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
}

function createInterpolationContext(worldState: WorldState, alpha = 0.5): RenderInterpolationContext {
  const previousSnapshot: RenderPreviousSnapshot = {
    player: {
      x: worldState.player.position.x,
      z: worldState.player.position.z,
      heading: worldState.player.heading,
      speed: worldState.player.speed,
      drift: worldState.player.drift,
      throttle: worldState.player.throttle
    },
    enemies: new Map(),
    projectiles: new Map(),
    loot: new Map()
  };
  return {
    alpha,
    fixedStep: 1 / 60,
    previousSnapshot
  };
}

function normalizeAngle(angle: number): number {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

describe("syncRenderFromSimulation interpolation and ship fx", () => {
  it("interpolates midpoint transforms for ships, projectiles, and loot", () => {
    const worldState = createInitialWorldState();
    worldState.player.position.x = 10;
    worldState.player.position.z = 20;
    worldState.player.heading = 0.6;
    worldState.player.speed = 8;
    worldState.player.drift = 2;
    worldState.player.throttle = 1;

    const enemy = createEnemyState(1, 14, -6, 0.9);
    enemy.speed = 6;
    enemy.drift = 1.1;
    enemy.throttle = 0.8;
    worldState.enemies.push(enemy);

    worldState.projectiles.push(createProjectileState(1, "player", 16, 4));
    worldState.loot.push(createLootState(1, 8, -4));

    const interpolation = createInterpolationContext(worldState, 0.5);
    interpolation.previousSnapshot.player = {
      x: 0,
      z: 0,
      heading: 0,
      speed: 0,
      drift: 0,
      throttle: 0
    };
    interpolation.previousSnapshot.enemies.set(enemy.id, {
      x: 2,
      z: -2,
      heading: 0.1,
      speed: 0,
      drift: 0,
      throttle: 0
    });
    interpolation.previousSnapshot.projectiles.set(1, { x: 2, y: 1.1, z: 0 });
    interpolation.previousSnapshot.loot.set(1, { x: 0, y: 0.5, z: -2 });

    const bridge = createBridge();
    syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);

    expect(bridge.playerMesh.position.x).toBeCloseTo(5, 6);
    expect(bridge.playerMesh.position.z).toBeCloseTo(10, 6);

    const enemyMesh = bridge.enemyMeshes.get(1);
    expect(enemyMesh).toBeDefined();
    expect(enemyMesh?.position.x ?? 0).toBeCloseTo(8, 6);
    expect(enemyMesh?.position.z ?? 0).toBeCloseTo(-4, 6);

    const projectileMesh = bridge.projectileMeshes.get(1);
    expect(projectileMesh).toBeDefined();
    expect(projectileMesh?.position.x ?? 0).toBeCloseTo(9, 6);
    expect(projectileMesh?.position.z ?? 0).toBeCloseTo(2, 6);

    const lootMesh = bridge.lootMeshes.get(1);
    expect(lootMesh).toBeDefined();
    expect(lootMesh?.position.x ?? 0).toBeCloseTo(4, 6);
    expect(lootMesh?.position.z ?? 0).toBeCloseTo(-3, 6);
  });

  it("uses shortest-angle interpolation for heading wrap-around", () => {
    const worldState = createInitialWorldState();
    worldState.player.heading = -Math.PI + 0.1;

    const interpolation = createInterpolationContext(worldState, 0.5);
    interpolation.previousSnapshot.player.heading = Math.PI - 0.1;

    const bridge = createBridge();
    syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);

    const wrappedHeading = Math.abs(normalizeAngle(bridge.playerMesh.rotation.y));
    expect(wrappedHeading).toBeGreaterThan(3.0);
  });

  it("passes interpolated renderTime to environment and uses it for animated bob", () => {
    const environmentSync = vi.fn();
    const worldState = createInitialWorldState();
    worldState.time = 10;

    const interpolationAlpha0 = createInterpolationContext(worldState, 0);
    const interpolationAlpha1 = createInterpolationContext(worldState, 1);
    const bridge = createBridge(environmentSync);

    syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolationAlpha0);
    const bobAtAlpha0 = bridge.playerVisual.presentation.position.y;
    syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolationAlpha1);
    const bobAtAlpha1 = bridge.playerVisual.presentation.position.y;

    expect(environmentSync).toHaveBeenCalledTimes(2);
    const firstCall = environmentSync.mock.calls[0];
    const secondCall = environmentSync.mock.calls[1];

    expect(firstCall?.[1]?.renderTime).toBeCloseTo(worldState.time - 1 / 60, 6);
    expect(secondCall?.[1]?.renderTime).toBeCloseTo(worldState.time, 6);
    expect(secondCall?.[1]?.playerPose?.x).toBeCloseTo(worldState.player.position.x, 6);
    expect(secondCall?.[1]?.cameraPosition).toBeDefined();
    expect(Math.abs(bobAtAlpha1 - bobAtAlpha0)).toBeGreaterThan(0.00004);
  });

  it("tracks camera heading directly during small oscillations", () => {
    const worldState = createInitialWorldState();
    const interpolation = createInterpolationContext(worldState, 1);
    const bridge = createBridge();

    let previousHeading = 0;

    for (let i = 0; i < 16; i += 1) {
      const heading = i % 2 === 0 ? -0.02 : 0.02;
      interpolation.previousSnapshot.player.heading = previousHeading;
      worldState.player.heading = heading;
      syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
      expect(Math.abs(normalizeAngle(bridge.cameraSmoothedHeading - heading))).toBeLessThan(1e-6);
      previousHeading = heading;
    }
  });

  it("keeps camera heading in lockstep during sustained turning", () => {
    const worldState = createInitialWorldState();
    const interpolation = createInterpolationContext(worldState, 1);
    const bridge = createBridge();

    let previousHeading = 0;

    for (let i = 0; i < 12; i += 1) {
      worldState.player.heading = previousHeading + 0.14;
      interpolation.previousSnapshot.player.heading = previousHeading;

      syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
      expect(Math.abs(normalizeAngle(bridge.cameraSmoothedHeading - worldState.player.heading))).toBeLessThan(1e-6);

      previousHeading = worldState.player.heading;
    }
  });

  it("keeps default chase-camera offset when orbit offsets are zero", () => {
    const worldState = createInitialWorldState();
    const interpolation = createInterpolationContext(worldState, 1);
    const bridge = createBridge();

    syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);

    const offsetX = bridge.camera.position.x - worldState.player.position.x;
    const offsetZ = bridge.camera.position.z - worldState.player.position.z;
    expect(offsetX).toBeCloseTo(0, 4);
    expect(offsetZ).toBeCloseTo(-12, 4);
    expect(bridge.camera.position.y).toBeCloseTo(6.7, 4);
  });

  it("applies orbit yaw offset by rotating camera azimuth around the ship", () => {
    const worldState = createInitialWorldState();
    const interpolation = createInterpolationContext(worldState, 1);
    const bridge = createBridge();
    bridge.cameraOrbit.yawOffset = Math.PI * 0.5;

    syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);

    const offsetX = bridge.camera.position.x - worldState.player.position.x;
    const offsetZ = bridge.camera.position.z - worldState.player.position.z;
    expect(Math.abs(offsetX)).toBeGreaterThan(10);
    expect(Math.abs(offsetZ)).toBeLessThan(2);
  });

  it("applies orbit pitch offset to camera elevation", () => {
    const worldState = createInitialWorldState();
    const interpolation = createInterpolationContext(worldState, 1);

    const highBridge = createBridge();
    highBridge.cameraOrbit.pitchOffset = 0.45;
    syncRenderFromSimulation(worldState, highBridge, 1 / 60, interpolation);

    const lowBridge = createBridge();
    lowBridge.cameraOrbit.pitchOffset = -0.35;
    syncRenderFromSimulation(worldState, lowBridge, 1 / 60, interpolation);

    expect(highBridge.camera.position.y).toBeGreaterThan(lowBridge.camera.position.y);
    expect(highBridge.camera.position.y).toBeGreaterThan(11);
    expect(lowBridge.camera.position.y).toBeLessThan(3);
  });

  it("keeps an upright camera basis and unflipped projection while turning", () => {
    const worldState = createInitialWorldState();
    const interpolation = createInterpolationContext(worldState, 1);
    const bridge = createBridge();

    const headingSamples = [0, 0.4, 1.1, -0.7];
    let previousHeading = worldState.player.heading;

    for (const heading of headingSamples) {
      worldState.player.heading = heading;
      interpolation.previousSnapshot.player.heading = previousHeading;
      syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);

      const forwardX = Math.sin(heading);
      const forwardZ = Math.cos(heading);
      const rightX = forwardZ;
      const rightZ = -forwardX;

      const depth = 20;
      const sideOffset = 8;
      const baseX = worldState.player.position.x + forwardX * depth;
      const baseZ = worldState.player.position.z + forwardZ * depth;

      const plusX = new Vector3(baseX + rightX * sideOffset, 1.2, baseZ + rightZ * sideOffset).project(bridge.camera).x;
      const minusX = new Vector3(baseX - rightX * sideOffset, 1.2, baseZ - rightZ * sideOffset).project(bridge.camera).x;
      expect(Math.abs(plusX - minusX)).toBeGreaterThan(0.01);

      const cameraUpWorld = new Vector3(0, 1, 0).applyQuaternion(bridge.camera.quaternion);
      expect(cameraUpWorld.y).toBeGreaterThan(0.2);
      expect(bridge.camera.projectionMatrix.elements[0] ?? 0).toBeGreaterThan(0);

      previousHeading = heading;
    }
  });

  it("applies bob, roll, pitch, and wake from movement state", () => {
    const worldState = createInitialWorldState();
    worldState.player.speed = 12;
    worldState.player.drift = 3;
    worldState.player.throttle = 1;
    worldState.player.heading = 0.62;
    {
      const forwardX = Math.sin(worldState.player.heading);
      const forwardZ = Math.cos(worldState.player.heading);
      const leftX = -forwardZ;
      const leftZ = forwardX;
      worldState.player.linearVelocity.x = forwardX * worldState.player.speed + leftX * worldState.player.drift;
      worldState.player.linearVelocity.z = forwardZ * worldState.player.speed + leftZ * worldState.player.drift;
    }

    const interpolation = createInterpolationContext(worldState, 1);
    interpolation.previousSnapshot.player.heading = 0.2;
    interpolation.previousSnapshot.player.throttle = 0;

    const environmentSync = vi.fn();
    const bridge = createBridge(environmentSync);
    syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);

    expect(Math.abs(bridge.playerMesh.rotation.x)).toBeLessThan(1e-6);
    expect(Math.abs(bridge.playerMesh.rotation.z)).toBeLessThan(1e-6);
    expect(Math.abs(bridge.playerVisual.presentation.rotation.x)).toBeGreaterThan(0.01);
    expect(Math.abs(bridge.playerVisual.presentation.rotation.z)).toBeGreaterThan(0.03);
    expect(Math.abs(bridge.playerVisual.presentation.position.y)).toBeGreaterThan(0.001);
    const call = environmentSync.mock.calls.at(-1);
    const wakeInfluences = call?.[1]?.wakeInfluences as Array<{ intensity: number }> | undefined;
    expect((wakeInfluences?.length ?? 0)).toBeGreaterThan(0);
    expect(wakeInfluences?.[0]?.intensity ?? 0).toBeGreaterThan(0.05);
  });

  it("keeps tilt on presentation node and clamps roll range", () => {
    const worldState = createInitialWorldState();
    worldState.player.speed = 30;
    worldState.player.linearVelocity.z = 30;
    worldState.player.heading = 0.8;

    const interpolation = createInterpolationContext(worldState, 1);
    interpolation.previousSnapshot.player.heading = 0.1;

    const bridge = createBridge();
    for (let i = 0; i < 8; i += 1) {
      worldState.time = i * (1 / 60);
      syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
    }

    expect(Math.abs(bridge.playerMesh.rotation.x)).toBeLessThan(1e-6);
    expect(Math.abs(bridge.playerMesh.rotation.z)).toBeLessThan(1e-6);
    expect(Math.abs(bridge.playerVisual.presentation.rotation.z)).toBeLessThan(0.23);
  });

  it("leans opposite to turn direction from actual yaw rate", () => {
    const worldState = createInitialWorldState();
    worldState.player.speed = 22;
    worldState.player.linearVelocity.z = 22;

    const interpolation = createInterpolationContext(worldState, 1);
    const bridge = createBridge();

    for (let i = 0; i < 10; i += 1) {
      worldState.time = i * (1 / 60);
      worldState.player.heading = 0.9;
      interpolation.previousSnapshot.player.heading = 0.2;
      syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
    }
    const positiveTurnRoll = bridge.playerVisual.presentation.rotation.z;

    for (let i = 10; i < 24; i += 1) {
      worldState.time = i * (1 / 60);
      worldState.player.heading = 0.2;
      interpolation.previousSnapshot.player.heading = 0.9;
      syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
    }
    const negativeTurnRoll = bridge.playerVisual.presentation.rotation.z;

    expect(positiveTurnRoll).toBeLessThan(0);
    expect(negativeTurnRoll).toBeGreaterThan(0);
  });

  it("drives pitch from forward acceleration and deceleration", () => {
    const worldState = createInitialWorldState();
    worldState.player.heading = 0;
    worldState.player.speed = 0;
    worldState.player.linearVelocity.x = 0;
    worldState.player.linearVelocity.z = 0;

    const interpolation = createInterpolationContext(worldState, 1);
    const bridge = createBridge();

    for (let i = 0; i < 8; i += 1) {
      worldState.time = i * (1 / 60);
      syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
    }

    worldState.player.speed = 28;
    worldState.player.linearVelocity.z = 28;
    worldState.time += 1 / 60;
    syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
    const accelPitch = bridge.playerVisual.presentation.rotation.x;

    worldState.player.speed = 0;
    worldState.player.linearVelocity.z = 0;
    worldState.time += 1 / 60;
    syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
    const brakePitch = bridge.playerVisual.presentation.rotation.x;

    expect(accelPitch).toBeLessThan(brakePitch);
  });

  it("updates sail tension/sway/flutter from speed and turn without popping", () => {
    const worldState = createInitialWorldState();
    worldState.player.heading = 0;
    worldState.player.speed = 2;
    worldState.player.linearVelocity.z = 2;

    const interpolation = createInterpolationContext(worldState, 1);
    const bridge = createBridge();

    for (let i = 0; i < 10; i += 1) {
      worldState.time = i * (1 / 60);
      interpolation.previousSnapshot.player.heading = 0;
      syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
    }
    const sail = bridge.playerVisual.sails[0];
    expect(sail).toBeDefined();
    if (!sail) {
      return;
    }
    const lowScaleX = sail.mesh.scale.x;
    const lowRotX = sail.mesh.rotation.x;

    worldState.player.speed = 34;
    worldState.player.linearVelocity.z = 34;
    for (let i = 10; i < 40; i += 1) {
      worldState.time = i * (1 / 60);
      worldState.player.heading = 0.8;
      interpolation.previousSnapshot.player.heading = 0.15;
      syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
    }

    const highScaleX = sail.mesh.scale.x;
    const highRotX = sail.mesh.rotation.x;
    const sailZAtHighTurn = sail.mesh.rotation.z;

    worldState.player.heading = 0.8;
    interpolation.previousSnapshot.player.heading = 0.8;
    worldState.time += 1 / 60;
    syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
    const sailZNextFrame = sail.mesh.rotation.z;

    expect(highScaleX).toBeGreaterThan(lowScaleX);
    expect(highRotX).toBeLessThan(lowRotX);
    expect(Math.abs(sailZAtHighTurn)).toBeLessThan(0.35);
    expect(Math.abs(sailZNextFrame - sailZAtHighTurn)).toBeLessThan(0.12);
  });

  it("keeps contact shadow grounded and scales/opacities subtly with motion", () => {
    const worldState = createInitialWorldState();
    worldState.player.heading = 0;
    worldState.player.speed = 0;
    worldState.player.linearVelocity.z = 0;

    const interpolation = createInterpolationContext(worldState, 1);
    const bridge = createBridge();

    for (let i = 0; i < 8; i += 1) {
      worldState.time = i * (1 / 60);
      interpolation.previousSnapshot.player.heading = 0;
      syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
    }
    const lowOpacity = bridge.playerVisual.contactShadowMaterial.opacity;
    const lowScale = bridge.playerVisual.contactShadow.scale.x;

    worldState.player.speed = 36;
    worldState.player.linearVelocity.z = 36;
    for (let i = 8; i < 34; i += 1) {
      worldState.time = i * (1 / 60);
      worldState.player.heading = 0.7;
      interpolation.previousSnapshot.player.heading = 0.1;
      syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
    }

    const highOpacity = bridge.playerVisual.contactShadowMaterial.opacity;
    const highScale = bridge.playerVisual.contactShadow.scale.x;
    expect(bridge.playerVisual.contactShadow.position.y).toBeGreaterThan(0);
    expect(highOpacity).toBeGreaterThan(lowOpacity);
    expect(highScale).toBeGreaterThan(lowScale);
    expect(highScale).toBeLessThan(lowScale * 1.22);
  });

  it("triggers hit flash on hp loss", () => {
    const worldState = createInitialWorldState();
    const interpolation = createInterpolationContext(worldState, 1);
    const bridge = createBridge();

    syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
    worldState.player.hp = 70;
    syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);

    expect(bridge.playerFx.hitFlashTimer).toBeGreaterThan(0);
    const firstChannel = bridge.playerVisual.flashChannels[0];
    expect(firstChannel).toBeDefined();
    if (!firstChannel) {
      return;
    }
    expect(firstChannel.material.emissiveIntensity).toBeGreaterThan(firstChannel.baseEmissiveIntensity);
  });

  it("triggers side-aware cannon muzzle fx from new projectile spawns", () => {
    const worldState = createInitialWorldState();
    worldState.player.position.x = 0;
    worldState.player.position.z = 0;
    worldState.player.heading = 0;

    const enemy = createEnemyState(1, 8, 0, 0);
    worldState.enemies.push(enemy);

    worldState.projectiles.push(
      createProjectileState(1, "player", -2.8, 1.2),
      createProjectileState(2, "player", 2.8, 1.2),
      createProjectileState(3, "enemy", 5.4, 0.8),
      createProjectileState(4, "enemy", 10.6, 0.8)
    );

    const interpolation = createInterpolationContext(worldState, 1);
    const bridge = createBridge();
    syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);

    expect(bridge.playerFx.muzzleLeftTimer).toBeGreaterThan(0);
    expect(bridge.playerFx.muzzleRightTimer).toBeGreaterThan(0);
    expect(bridge.playerVisual.muzzleLeft.group.visible).toBe(true);
    expect(bridge.playerVisual.muzzleRight.group.visible).toBe(true);

    const enemyFx = bridge.enemyFx.get(enemy.id);
    expect(enemyFx).toBeDefined();
    expect(enemyFx?.muzzleLeftTimer ?? 0).toBeGreaterThan(0);
    expect(enemyFx?.muzzleRightTimer ?? 0).toBeGreaterThan(0);
    const enemyVisual = bridge.enemyVisuals.get(enemy.id);
    expect(enemyVisual?.muzzleLeft.group.visible ?? false).toBe(true);
    expect(enemyVisual?.muzzleRight.group.visible ?? false).toBe(true);
  });

  it("routes single-shot muzzle fx to the side that matches projectile spawn position", () => {
    const leftWorld = createInitialWorldState();
    leftWorld.player.position.x = 0;
    leftWorld.player.position.z = 0;
    leftWorld.player.heading = 0;
    leftWorld.projectiles.push(createProjectileState(1, "player", -2.8, 1.2));

    const leftBridge = createBridge();
    syncRenderFromSimulation(leftWorld, leftBridge, 1 / 60, createInterpolationContext(leftWorld, 1));
    expect(leftBridge.playerFx.muzzleLeftTimer).toBeGreaterThan(0);
    expect(leftBridge.playerFx.muzzleRightTimer).toBe(0);

    const rightWorld = createInitialWorldState();
    rightWorld.player.position.x = 0;
    rightWorld.player.position.z = 0;
    rightWorld.player.heading = 0;
    rightWorld.projectiles.push(createProjectileState(1, "player", 2.8, 1.2));

    const rightBridge = createBridge();
    syncRenderFromSimulation(rightWorld, rightBridge, 1 / 60, createInterpolationContext(rightWorld, 1));
    expect(rightBridge.playerFx.muzzleLeftTimer).toBe(0);
    expect(rightBridge.playerFx.muzzleRightTimer).toBeGreaterThan(0);
  });

  it("shows wake for moving enemies and decays when they stop", () => {
    const worldState = createInitialWorldState();
    const enemy = createEnemyState(1, 12, 4, 0.4);
    enemy.speed = 9;
    enemy.linearVelocity.x = Math.sin(enemy.heading) * 9;
    enemy.linearVelocity.z = Math.cos(enemy.heading) * 9;
    worldState.enemies.push(enemy);
    worldState.player.speed = 9;
    worldState.player.linearVelocity.x = 0;
    worldState.player.linearVelocity.z = 9;

    const interpolation = createInterpolationContext(worldState, 1);
    const environmentSync = vi.fn();
    const bridge = createBridge(environmentSync);
    syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);

    const firstCall = environmentSync.mock.calls.at(-1);
    const firstWake = firstCall?.[1]?.wakeInfluences as Array<{ intensity: number }> | undefined;
    expect((firstWake?.length ?? 0)).toBeGreaterThan(1);
    expect((firstWake ?? []).some((wake) => wake.intensity > 0.05)).toBe(true);

    worldState.player.speed = 0;
    enemy.speed = 0;
    worldState.player.linearVelocity.x = 0;
    worldState.player.linearVelocity.z = 0;
    enemy.linearVelocity.x = 0;
    enemy.linearVelocity.z = 0;
    for (let i = 0; i < 130; i += 1) {
      syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
    }

    const lastCall = environmentSync.mock.calls.at(-1);
    const lastWake = lastCall?.[1]?.wakeInfluences as Array<{ intensity: number }> | undefined;
    expect((lastWake?.length ?? 0)).toBeLessThanOrEqual(1);
  });
});
