import { Group, PerspectiveCamera, Scene, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { createInitialWorldState, type EnemyState, type WorldState } from "../../simulation";
import {
  syncRenderFromSimulation,
  type RenderBridgeState,
  type RenderInterpolationContext,
  type RenderPreviousSnapshot
} from "./renderBridge";

function createEnemyState(id: number, x: number, z: number, heading = 0): EnemyState {
  return {
    id,
    archetype: "raider",
    owner: "enemy",
    position: { x, z },
    heading,
    speed: 0,
    drift: 0,
    throttle: 0,
    hp: 100,
    maxHp: 100,
    radius: 2.1,
    reload: { left: 0, right: 0 },
    status: "alive",
    sinkTimer: 0,
    repairCooldown: 0,
    aiState: "patrol",
    patrolAngle: 0,
    lootDropped: false,
    aiStateTimer: 0,
    detectProgress: 0,
    pendingFireSide: null
  };
}

function createBridge(environmentSync = vi.fn()): RenderBridgeState {
  const scene = new Scene();
  const camera = new PerspectiveCamera(58, 16 / 9, 0.1, 400);
  camera.position.set(0, 8, -18);

  return {
    scene,
    camera,
    playerMesh: new Group(),
    enemyRoot: new Group(),
    enemyMeshes: new Map(),
    environment: {
      root: new Group(),
      syncFromWorld: environmentSync,
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
      drift: 0
    },
    enemyPoseScratch: {
      x: 0,
      z: 0,
      heading: 0,
      speed: 0,
      drift: 0
    }
  };
}

function createInterpolationContext(worldState: WorldState, alpha = 0.5): RenderInterpolationContext {
  const previousSnapshot: RenderPreviousSnapshot = {
    player: {
      x: worldState.player.position.x,
      z: worldState.player.position.z,
      heading: worldState.player.heading,
      speed: worldState.player.speed,
      drift: worldState.player.drift
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

describe("syncRenderFromSimulation interpolation", () => {
  it("interpolates midpoint transforms for ships, projectiles, and loot", () => {
    const worldState = createInitialWorldState();
    worldState.player.position.x = 10;
    worldState.player.position.z = 20;
    worldState.player.heading = 0.6;
    worldState.player.speed = 8;
    worldState.player.drift = 2;

    const enemy = createEnemyState(1, 14, -6, 0.9);
    enemy.speed = 6;
    enemy.drift = 1.1;
    worldState.enemies.push(enemy);

    worldState.projectiles.push({
      id: 1,
      owner: "player",
      position: { x: 16, z: 4 },
      velocity: { x: 0, z: 0 },
      lifetime: 2,
      active: true
    });

    worldState.loot.push({
      id: 1,
      kind: "gold",
      amount: 10,
      position: { x: 8, z: -4 },
      driftVelocity: { x: 0, z: 0 },
      lifetime: 10,
      pickupRadius: 3,
      active: true
    });

    const interpolation = createInterpolationContext(worldState, 0.5);
    interpolation.previousSnapshot.player = {
      x: 0,
      z: 0,
      heading: 0,
      speed: 0,
      drift: 0
    };
    interpolation.previousSnapshot.enemies.set(enemy.id, {
      x: 2,
      z: -2,
      heading: 0.1,
      speed: 0,
      drift: 0
    });
    interpolation.previousSnapshot.projectiles.set(1, { x: 2, z: 0 });
    interpolation.previousSnapshot.loot.set(1, { x: 0, z: -2 });

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
    const yAtAlpha0 = bridge.playerMesh.position.y;
    syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolationAlpha1);
    const yAtAlpha1 = bridge.playerMesh.position.y;

    expect(environmentSync).toHaveBeenCalledTimes(2);
    const firstCall = environmentSync.mock.calls[0];
    const secondCall = environmentSync.mock.calls[1];

    expect(firstCall?.[1]?.renderTime).toBeCloseTo(worldState.time - 1 / 60, 6);
    expect(secondCall?.[1]?.renderTime).toBeCloseTo(worldState.time, 6);
    expect(secondCall?.[1]?.playerPose?.x).toBeCloseTo(worldState.player.position.x, 6);
    expect(secondCall?.[1]?.cameraPosition).toBeDefined();
    expect(Math.abs(yAtAlpha1 - yAtAlpha0)).toBeGreaterThan(0.0001);
  });

  it("dampens camera heading jitter around deadzone oscillations", () => {
    const worldState = createInitialWorldState();
    const interpolation = createInterpolationContext(worldState, 1);
    const bridge = createBridge();

    const smoothedSamples: number[] = [];
    let previousHeading = 0;

    for (let i = 0; i < 16; i += 1) {
      const heading = i % 2 === 0 ? -0.02 : 0.02;
      interpolation.previousSnapshot.player.heading = previousHeading;
      worldState.player.heading = heading;
      syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
      smoothedSamples.push(bridge.cameraSmoothedHeading);
      previousHeading = heading;
    }

    const maxAbsSmoothed = Math.max(...smoothedSamples.map((value) => Math.abs(value)));
    let maxFrameDelta = 0;
    for (let i = 1; i < smoothedSamples.length; i += 1) {
      maxFrameDelta = Math.max(maxFrameDelta, Math.abs(smoothedSamples[i]! - smoothedSamples[i - 1]!));
    }

    expect(maxAbsSmoothed).toBeLessThan(0.015);
    expect(maxFrameDelta).toBeLessThan(0.015);
  });

  it("keeps camera heading step bounded during sustained turning", () => {
    const worldState = createInitialWorldState();
    const interpolation = createInterpolationContext(worldState, 1);
    const bridge = createBridge();

    let previousHeading = 0;
    const deltas: number[] = [];

    for (let i = 0; i < 12; i += 1) {
      worldState.player.heading = previousHeading + 0.14;
      interpolation.previousSnapshot.player.heading = previousHeading;

      const smoothedBefore = bridge.cameraSmoothedHeading;
      syncRenderFromSimulation(worldState, bridge, 1 / 60, interpolation);
      const smoothedAfter = bridge.cameraSmoothedHeading;

      if (i > 0) {
        deltas.push(Math.abs(normalizeAngle(smoothedAfter - smoothedBefore)));
      }

      previousHeading = worldState.player.heading;
    }

    expect(deltas.length).toBeGreaterThan(0);
    expect(Math.max(...deltas)).toBeLessThan(0.09);
  });
});
