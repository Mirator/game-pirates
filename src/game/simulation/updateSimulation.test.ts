import { describe, expect, it } from "vitest";
import {
  CANNON_RELOAD_TIME,
  ENEMY_INITIAL_SPAWN_DELAY,
  ENEMY_SPAWN_POINTS,
  ENEMY_STAGGER_SPAWN_DELAY,
  FIXED_TIME_STEP,
  PORT_POSITION,
  SHIP_SAFE_SUBMERGE_DEPTH,
  SHIP_SPAWN_FREEBOARD,
  SINK_DURATION,
  createInitialWorldState,
  drainSimulationEvents,
  tryPurchaseHullUpgrade,
  trySellCargo,
  updateSimulation,
  type InputState,
  type LootState,
  type ProjectileState,
  type WorldState
} from ".";
import { DEFAULT_WATER_SURFACE_TUNING, DEFAULT_WATER_SURFACE_WAVES } from "../physics/waterProfile";
import { sampleWaterHeight } from "../physics/waterSurface";

const neutralInput: InputState = {
  throttle: 0,
  turn: 0,
  fireLeft: false,
  fireRight: false,
  interact: false,
  repair: false,
  burst: false
};

function step(worldState: WorldState, inputState: InputState, steps: number): void {
  for (let i = 0; i < steps; i += 1) {
    updateSimulation(worldState, inputState, FIXED_TIME_STEP);
  }
}

function stepUntil(worldState: WorldState, predicate: () => boolean, maxSteps: number): void {
  for (let i = 0; i < maxSteps; i += 1) {
    if (predicate()) {
      return;
    }
    updateSimulation(worldState, neutralInput, FIXED_TIME_STEP);
  }
}

function createProjectile(id: number, owner: "player" | "enemy", x: number, z: number, y = 1.1): ProjectileState {
  return {
    id,
    owner,
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
    lifetime: 1,
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

function createLoot(id: number, kind: LootState["kind"], amount: number, x: number, z: number, y = 0.5): LootState {
  return {
    id,
    kind,
    amount,
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
    yaw: 0,
    angularVelocity: 0,
    mass: kind === "cargo" ? 8.5 : 4.5,
    buoyancyMultiplier: kind === "cargo" ? 0.88 : 1.15,
    waterDrag: 2.9,
    angularDamping: 3.6,
    floats: true,
    waterState: "submerged",
    lifetime: 10,
    pickupRadius: 3,
    active: true,
    collisionLayer: "pickups_debris"
  };
}

function normalizeAngle(angle: number): number {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

function quietWorld(worldState: WorldState): void {
  worldState.spawnDirector.maxActive = 0;
  worldState.spawnDirector.timer = 999;
  worldState.eventDirector.timer = 999;
  worldState.eventDirector.activeKind = null;
  worldState.eventDirector.remaining = 0;
  worldState.storm.active = false;
}

function seaHeightAt(worldState: WorldState, x: number, z: number): number {
  return worldState.physics.seaLevel + sampleWaterHeight(DEFAULT_WATER_SURFACE_WAVES, { x, z }, worldState.time, DEFAULT_WATER_SURFACE_TUNING);
}

function setPlayerVelocityFromLocalAxes(worldState: WorldState, forwardSpeed: number, driftSpeed: number): void {
  const forwardX = Math.sin(worldState.player.heading);
  const forwardZ = Math.cos(worldState.player.heading);
  const leftX = -forwardZ;
  const leftZ = forwardX;
  worldState.player.linearVelocity.x = forwardX * forwardSpeed + leftX * driftSpeed;
  worldState.player.linearVelocity.z = forwardZ * forwardSpeed + leftZ * driftSpeed;
}

function headingVelocityDivergence(worldState: WorldState): number {
  const vx = worldState.player.linearVelocity.x;
  const vz = worldState.player.linearVelocity.z;
  const planarSpeed = Math.hypot(vx, vz);
  if (planarSpeed < 0.2) {
    return 0;
  }
  const moveHeading = Math.atan2(vx, vz);
  return Math.abs(normalizeAngle(moveHeading - worldState.player.heading));
}

describe("updateSimulation ECS pipeline", () => {
  it("starts player spawn above local waterline freeboard", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    const waterAtSpawn = seaHeightAt(worldState, worldState.player.position.x, worldState.player.position.z);
    expect(worldState.player.position.y).toBeGreaterThanOrEqual(waterAtSpawn + SHIP_SPAWN_FREEBOARD - 1e-6);
  });

  it("integrates movement and preserves reload gating", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    const startHeading = worldState.player.heading;
    const startX = worldState.player.position.x;
    const startZ = worldState.player.position.z;

    step(worldState, { ...neutralInput, throttle: 1, turn: 1 }, 120);
    expect(worldState.player.speed).toBeGreaterThan(2);
    expect(Math.abs(normalizeAngle(worldState.player.heading - startHeading))).toBeGreaterThan(0.2);
    expect(Math.hypot(worldState.player.position.x - startX, worldState.player.position.z - startZ)).toBeGreaterThan(2.5);

    updateSimulation(worldState, { ...neutralInput, fireLeft: true }, FIXED_TIME_STEP);
    const projectileAfterFirstShot = worldState.nextProjectileId;
    updateSimulation(worldState, { ...neutralInput, fireLeft: true }, FIXED_TIME_STEP);
    expect(worldState.nextProjectileId).toBe(projectileAfterFirstShot);

    const stepsToReload = Math.ceil(CANNON_RELOAD_TIME / FIXED_TIME_STEP) + 1;
    step(worldState, { ...neutralInput, fireLeft: true }, stepsToReload);
    expect(worldState.nextProjectileId).toBeGreaterThan(projectileAfterFirstShot);
  });

  it("keeps rotate-in-place very weak when stationary", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    worldState.player.heading = 0;
    worldState.player.linearVelocity.x = 0;
    worldState.player.linearVelocity.z = 0;
    const startHeading = worldState.player.heading;

    step(worldState, { ...neutralInput, turn: 1 }, 60);
    const turnDelta = Math.abs(normalizeAngle(worldState.player.heading - startHeading));
    expect(turnDelta).toBeLessThan(0.18);
  });

  it("peaks initial turn authority at medium speed and weakens at low/high speed", () => {
    const lowSpeedWorld = createInitialWorldState();
    const mediumSpeedWorld = createInitialWorldState();
    const highSpeedWorld = createInitialWorldState();
    quietWorld(lowSpeedWorld);
    quietWorld(mediumSpeedWorld);
    quietWorld(highSpeedWorld);

    lowSpeedWorld.player.heading = 0;
    mediumSpeedWorld.player.heading = 0;
    highSpeedWorld.player.heading = 0;

    setPlayerVelocityFromLocalAxes(lowSpeedWorld, 3, 0);
    setPlayerVelocityFromLocalAxes(mediumSpeedWorld, 20, 0);
    setPlayerVelocityFromLocalAxes(highSpeedWorld, 36, 0);

    step(lowSpeedWorld, { ...neutralInput, turn: 1 }, 1);
    step(mediumSpeedWorld, { ...neutralInput, turn: 1 }, 1);
    step(highSpeedWorld, { ...neutralInput, turn: 1 }, 1);

    const lowTurnRate = Math.abs(lowSpeedWorld.player.angularVelocity);
    const mediumTurnRate = Math.abs(mediumSpeedWorld.player.angularVelocity);
    const highTurnRate = Math.abs(highSpeedWorld.player.angularVelocity);

    expect(lowTurnRate).toBeGreaterThan(0.006);
    expect(mediumTurnRate).toBeGreaterThan(lowTurnRate);
    expect(mediumTurnRate).toBeGreaterThan(highTurnRate);
  });

  it("ramps acceleration across initial throttle-up frames instead of instant full force", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    step(worldState, { ...neutralInput, throttle: 1 }, 1);
    const firstFrameSpeed = Math.abs(worldState.player.speed);
    step(worldState, { ...neutralInput, throttle: 1 }, 6);
    const followupSpeed = Math.abs(worldState.player.speed);

    expect(firstFrameSpeed).toBeGreaterThan(0);
    expect(followupSpeed).toBeGreaterThan(firstFrameSpeed);
    expect(firstFrameSpeed).toBeLessThan(followupSpeed * 0.55);
  });

  it("applies boost turning tradeoff at matched speed", () => {
    const normalWorld = createInitialWorldState();
    const boostWorld = createInitialWorldState();
    quietWorld(normalWorld);
    quietWorld(boostWorld);

    normalWorld.player.heading = 0;
    boostWorld.player.heading = 0;
    setPlayerVelocityFromLocalAxes(normalWorld, 20, 0);
    setPlayerVelocityFromLocalAxes(boostWorld, 20, 0);

    step(normalWorld, { ...neutralInput, turn: 1 }, 20);
    step(boostWorld, { ...neutralInput, turn: 1, burst: true }, 20);

    const normalTurn = Math.abs(normalizeAngle(normalWorld.player.heading));
    const boostTurn = Math.abs(normalizeAngle(boostWorld.player.heading));
    expect(boostTurn).toBeLessThan(normalTurn);
  });

  it("damps lateral drift faster than forward momentum", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    worldState.player.heading = 0;
    setPlayerVelocityFromLocalAxes(worldState, 8, 4);
    const startForward = Math.abs(worldState.player.speed || 8);
    const startDrift = Math.abs(worldState.player.drift || 4);

    step(worldState, neutralInput, 10);

    expect(Math.abs(worldState.player.drift)).toBeLessThan(startDrift * 0.25);
    expect(Math.abs(worldState.player.speed)).toBeGreaterThan(startForward * 0.3);
  });

  it("uses heading assist to reduce velocity-facing divergence", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    worldState.player.heading = 0;
    setPlayerVelocityFromLocalAxes(worldState, 1.5, -8.5);
    const divergenceBefore = headingVelocityDivergence(worldState);

    step(worldState, neutralInput, 20);

    const divergenceAfter = headingVelocityDivergence(worldState);
    expect(divergenceAfter).toBeLessThan(divergenceBefore);
  });

  it("keeps reverse speed meaningfully weaker than forward speed", () => {
    const forwardWorld = createInitialWorldState();
    const reverseWorld = createInitialWorldState();
    quietWorld(forwardWorld);
    quietWorld(reverseWorld);

    step(forwardWorld, { ...neutralInput, throttle: 1 }, 24);
    step(reverseWorld, { ...neutralInput, throttle: -1 }, 24);

    expect(Math.abs(reverseWorld.player.speed)).toBeLessThan(Math.abs(forwardWorld.player.speed) * 0.6);
  });

  it("fires from matching left and right batteries", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    worldState.player.position.x = 0;
    worldState.player.position.z = 0;
    worldState.player.heading = 0;

    updateSimulation(worldState, { ...neutralInput, fireLeft: true }, FIXED_TIME_STEP);
    expect(worldState.player.reload.left).toBeGreaterThan(0);
    expect(worldState.player.reload.right).toBe(0);

    worldState.player.reload.right = 0;
    updateSimulation(worldState, { ...neutralInput, fireRight: true }, FIXED_TIME_STEP);
    expect(worldState.player.reload.right).toBeGreaterThan(0);

    const leftShot = worldState.projectiles.find((projectile) => projectile.id === 1);
    const rightShot = worldState.projectiles.find((projectile) => projectile.id === 2);

    expect(leftShot?.position.x ?? 0).toBeGreaterThan(0);
    expect(rightShot?.position.x ?? 0).toBeLessThan(0);
  });

  it("spawns enemies with initial and staggered timing up to cap", () => {
    const worldState = createInitialWorldState();
    worldState.eventDirector.timer = 999;

    const firstSpawnSteps = Math.ceil(ENEMY_INITIAL_SPAWN_DELAY / FIXED_TIME_STEP);
    step(worldState, neutralInput, firstSpawnSteps - 1);
    expect(worldState.enemies.length).toBe(0);

    stepUntil(worldState, () => worldState.enemies.length === 1, 3);
    expect(worldState.enemies.length).toBe(1);

    const staggerSteps = Math.ceil(ENEMY_STAGGER_SPAWN_DELAY / FIXED_TIME_STEP);
    step(worldState, neutralInput, Math.floor(staggerSteps / 2));
    expect(worldState.enemies.length).toBe(1);

    stepUntil(worldState, () => worldState.enemies.length === 2, staggerSteps);
    expect(worldState.enemies.length).toBe(2);

    stepUntil(worldState, () => worldState.enemies.length === 3, staggerSteps + 2);
    expect(worldState.enemies.length).toBe(3);
  });

  it("keeps player entity separate from enemies after first spawn", () => {
    const worldState = createInitialWorldState();
    worldState.eventDirector.timer = 999;

    step(worldState, neutralInput, Math.ceil(ENEMY_INITIAL_SPAWN_DELAY / FIXED_TIME_STEP) + 2);

    expect(worldState.enemies.length).toBeGreaterThan(0);
    expect(worldState.player.owner).toBe("player");
    expect(worldState.enemies.includes(worldState.player as unknown as (typeof worldState.enemies)[number])).toBe(false);
  });

  it("does not relocate player to enemy spawn points on neutral input", () => {
    const worldState = createInitialWorldState();
    worldState.eventDirector.timer = 999;
    worldState.storm.active = false;

    const startX = worldState.player.position.x;
    const startZ = worldState.player.position.z;
    step(worldState, neutralInput, Math.ceil(ENEMY_INITIAL_SPAWN_DELAY / FIXED_TIME_STEP) + 6);

    expect(worldState.enemies.length).toBeGreaterThan(0);
    expect(Math.hypot(worldState.player.position.x - startX, worldState.player.position.z - startZ)).toBeLessThan(0.01);

    for (const spawn of ENEMY_SPAWN_POINTS) {
      const distanceToSpawn = Math.hypot(worldState.player.position.x - spawn.x, worldState.player.position.z - spawn.z);
      expect(distanceToSpawn).toBeGreaterThan(8);
    }
  });

  it("soft-bounces the player at world bounds without hard-snapping heading", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    const outsideBoundsDistance = worldState.boundsRadius + 2;
    const outsideBoundsAngle = 0.72;
    worldState.player.position.x = Math.sin(outsideBoundsAngle) * outsideBoundsDistance;
    worldState.player.position.z = Math.cos(outsideBoundsAngle) * outsideBoundsDistance;
    worldState.player.heading = 0.2;
    worldState.player.speed = 14;
    worldState.player.drift = 2;
    {
      const forwardX = Math.sin(worldState.player.heading);
      const forwardZ = Math.cos(worldState.player.heading);
      const leftX = -forwardZ;
      const leftZ = forwardX;
      worldState.player.linearVelocity.x = forwardX * worldState.player.speed + leftX * worldState.player.drift;
      worldState.player.linearVelocity.z = forwardZ * worldState.player.speed + leftZ * worldState.player.drift;
    }
    const initialDistance = Math.hypot(worldState.player.position.x, worldState.player.position.z);
    const initialNormalX = worldState.player.position.x / initialDistance;
    const initialNormalZ = worldState.player.position.z / initialDistance;
    const initialOutwardVelocity = worldState.player.linearVelocity.x * initialNormalX + worldState.player.linearVelocity.z * initialNormalZ;

    updateSimulation(worldState, neutralInput, FIXED_TIME_STEP);

    const player = worldState.player;
    const distanceFromCenter = Math.hypot(player.position.x, player.position.z);
    expect(distanceFromCenter).toBeLessThanOrEqual(worldState.boundsRadius + 1e-6);
    expect(Math.abs(player.speed)).toBeLessThan(14);
    expect(Math.abs(player.drift)).toBeLessThan(2);

    const headingToCenter = Math.atan2(-player.position.x, -player.position.z);
    const snapDelta = Math.abs(normalizeAngle(player.heading - headingToCenter));
    expect(snapDelta).toBeGreaterThan(0.1);

    const normalX = player.position.x / distanceFromCenter;
    const normalZ = player.position.z / distanceFromCenter;
    const forwardX = Math.sin(player.heading);
    const forwardZ = Math.cos(player.heading);
    const leftX = -forwardZ;
    const leftZ = forwardX;
    const velocityX = forwardX * player.speed + leftX * player.drift;
    const velocityZ = forwardZ * player.speed + leftZ * player.drift;
    const outwardVelocity = velocityX * normalX + velocityZ * normalZ;
    expect(outwardVelocity).toBeLessThan(initialOutwardVelocity);
  });

  it("sinks enemies, drops expanded loot, and removes sunk enemy after timer", () => {
    const worldState = createInitialWorldState();
    worldState.eventDirector.timer = 999;

    step(worldState, neutralInput, Math.ceil(ENEMY_INITIAL_SPAWN_DELAY / FIXED_TIME_STEP) + 1);
    worldState.spawnDirector.maxActive = 0;

    const enemy = worldState.enemies[0];
    expect(enemy).toBeDefined();
    if (!enemy) {
      throw new Error("Expected one spawned enemy.");
    }

    enemy.position.x = -3.5;
    enemy.position.z = 0.8;
    enemy.hp = 5;
    enemy.speed = 0;
    worldState.player.position.x = 0;
    worldState.player.position.z = 0;
    worldState.player.heading = 0;

    worldState.projectiles.push(
      createProjectile(worldState.nextProjectileId++, "player", enemy.position.x, enemy.position.z, enemy.position.y + 1)
    );

    updateSimulation(worldState, neutralInput, FIXED_TIME_STEP);

    expect(enemy.status).toBe("sinking");
    expect(worldState.loot.length).toBeGreaterThanOrEqual(3);
    expect(worldState.flags.enemiesSunk).toBeGreaterThanOrEqual(1);
  });

  it("decrements sink timer once per fixed tick while player is sinking", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    worldState.player.status = "sinking";
    worldState.player.sinkTimer = SINK_DURATION;
    worldState.player.speed = 6;
    worldState.player.drift = 2.5;
    worldState.player.linearVelocity.x = -2.5;
    worldState.player.linearVelocity.z = 6;

    updateSimulation(worldState, neutralInput, FIXED_TIME_STEP);
    expect(worldState.player.sinkTimer).toBeCloseTo(SINK_DURATION - FIXED_TIME_STEP, 6);

    updateSimulation(worldState, neutralInput, FIXED_TIME_STEP);
    expect(worldState.player.sinkTimer).toBeCloseTo(SINK_DURATION - FIXED_TIME_STEP * 2, 6);
  });

  it("respawns only after full sink duration elapses", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    worldState.player.status = "sinking";
    worldState.player.sinkTimer = SINK_DURATION;
    worldState.player.hp = 0;

    const stepsToRespawn = Math.ceil(SINK_DURATION / FIXED_TIME_STEP);
    step(worldState, neutralInput, stepsToRespawn - 1);
    expect(worldState.player.status).toBe("sinking");
    expect(worldState.flags.playerRespawns).toBe(0);

    let elapsed = (stepsToRespawn - 1) * FIXED_TIME_STEP;
    let guard = 0;
    while (worldState.player.status === "sinking" && guard < 4) {
      updateSimulation(worldState, neutralInput, FIXED_TIME_STEP);
      elapsed += FIXED_TIME_STEP;
      guard += 1;
    }

    expect(worldState.player.status).toBe("alive");
    expect(worldState.flags.playerRespawns).toBe(1);
    expect(worldState.player.hp).toBe(worldState.player.maxHp);
    const waterAtRespawn = seaHeightAt(worldState, worldState.player.position.x, worldState.player.position.z);
    expect(worldState.player.position.y).toBeGreaterThanOrEqual(waterAtRespawn + SHIP_SPAWN_FREEBOARD - 1e-6);
    expect(elapsed).toBeGreaterThanOrEqual(SINK_DURATION);
    expect(elapsed - SINK_DURATION).toBeLessThanOrEqual(FIXED_TIME_STEP + 1e-6);
  });

  it("keeps alive ships from remaining deeply submerged after spawn", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    const waterAtPlayer = seaHeightAt(worldState, worldState.player.position.x, worldState.player.position.z);
    worldState.player.position.y = waterAtPlayer - 5;
    worldState.player.linearVelocity.y = -3;

    updateSimulation(worldState, neutralInput, FIXED_TIME_STEP);

    const waterAfterStep = seaHeightAt(worldState, worldState.player.position.x, worldState.player.position.z);
    expect(worldState.player.position.y).toBeGreaterThanOrEqual(waterAfterStep - SHIP_SAFE_SUBMERGE_DEPTH - 1e-6);
    expect(worldState.player.linearVelocity.y).toBeGreaterThanOrEqual(-0.35 - 1e-6);
  });

  it("biases early buoyancy pitch response toward the bow while keeping overshoot stable", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    const waterAtPlayer = seaHeightAt(worldState, worldState.player.position.x, worldState.player.position.z);
    worldState.player.position.y = waterAtPlayer - 0.34;
    worldState.player.pitch = 0;
    worldState.player.pitchVelocity = 0;

    updateSimulation(worldState, neutralInput, FIXED_TIME_STEP);
    expect(worldState.player.pitchVelocity).toBeGreaterThan(0);

    step(worldState, neutralInput, 90);
    expect(Math.abs(worldState.player.pitch)).toBeLessThan(0.2);
  });

  it("collects loot with interact before docking when both are possible", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    worldState.player.position.x = PORT_POSITION.x;
    worldState.player.position.z = PORT_POSITION.z;

    worldState.loot.push(createLoot(worldState.nextLootId++, "gold", 20, PORT_POSITION.x + 1, PORT_POSITION.z + 0.6));

    updateSimulation(worldState, { ...neutralInput, interact: true }, FIXED_TIME_STEP);

    expect(worldState.wallet.gold).toBe(20);
    expect(worldState.loot.length).toBe(0);
    expect(worldState.port.menuOpen).toBe(false);
  });

  it("undocks first when docked even if loot is nearby", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    worldState.player.position.x = PORT_POSITION.x;
    worldState.player.position.z = PORT_POSITION.z;

    updateSimulation(worldState, { ...neutralInput, interact: true }, FIXED_TIME_STEP);
    expect(worldState.port.menuOpen).toBe(true);

    worldState.loot.push(createLoot(worldState.nextLootId++, "cargo", 1, PORT_POSITION.x + 1, PORT_POSITION.z + 1));

    updateSimulation(worldState, { ...neutralInput, interact: true }, FIXED_TIME_STEP);
    expect(worldState.port.menuOpen).toBe(false);
    expect(worldState.loot.length).toBe(1);
  });

  it("consumes repair materials with cooldown and hp cap", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    worldState.wallet.repairMaterials = 2;
    worldState.player.hp = 40;

    updateSimulation(worldState, { ...neutralInput, repair: true }, FIXED_TIME_STEP);
    expect(worldState.player.hp).toBe(70);
    expect(worldState.wallet.repairMaterials).toBe(1);
    expect(worldState.player.repairCooldown).toBeGreaterThan(5.9);

    updateSimulation(worldState, { ...neutralInput, repair: true }, FIXED_TIME_STEP);
    expect(worldState.wallet.repairMaterials).toBe(1);
    expect(worldState.player.hp).toBe(70);
  });

  it("supports hull upgrade purchase and cargo sale", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    worldState.port.menuOpen = true;
    worldState.wallet.gold = 200;
    worldState.wallet.cargo = 3;
    worldState.player.hp = 50;

    const purchased = tryPurchaseHullUpgrade(worldState);
    expect(purchased).toBe(true);
    expect(worldState.upgrade.hullLevel).toBe(1);
    expect(worldState.upgrade.nextCost).toBe(100);
    expect(worldState.wallet.gold).toBe(140);
    expect(worldState.player.maxHp).toBe(120);
    expect(worldState.player.hp).toBe(70);

    const sold = trySellCargo(worldState);
    expect(sold).toBe(true);
    expect(worldState.wallet.cargo).toBe(0);
    expect(worldState.wallet.gold).toBe(224);
  });

  it("activates burst while held, ends on release, and enforces cooldown", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    updateSimulation(worldState, { ...neutralInput, burst: true }, FIXED_TIME_STEP);
    expect(worldState.burst.active).toBe(true);

    step(worldState, { ...neutralInput, burst: true, throttle: 1 }, 12);
    updateSimulation(worldState, { ...neutralInput, burst: false, throttle: 1 }, FIXED_TIME_STEP);
    expect(worldState.burst.active).toBe(false);
    const cooldownAfterRelease = worldState.burst.cooldown;
    expect(cooldownAfterRelease).toBeGreaterThan(0);

    step(worldState, { ...neutralInput, burst: true }, Math.ceil(cooldownAfterRelease / FIXED_TIME_STEP) + 3);
    expect(worldState.burst.active).toBe(true);
  });

  it("caps angular kick from ship collisions for stable recovery", () => {
    const worldState = createInitialWorldState();
    worldState.eventDirector.timer = 999;

    step(worldState, neutralInput, Math.ceil(ENEMY_INITIAL_SPAWN_DELAY / FIXED_TIME_STEP) + 1);
    worldState.spawnDirector.maxActive = 0;

    const enemy = worldState.enemies[0];
    expect(enemy).toBeDefined();
    if (!enemy) {
      throw new Error("Expected one spawned enemy.");
    }

    worldState.player.position.x = 0;
    worldState.player.position.z = 0;
    worldState.player.heading = 0;
    worldState.player.angularVelocity = 0;
    setPlayerVelocityFromLocalAxes(worldState, 3, 10);

    enemy.position.x = 0.6;
    enemy.position.z = 0;
    enemy.heading = 0;
    enemy.angularVelocity = 0;
    enemy.linearVelocity.x = 10;
    enemy.linearVelocity.z = 2;

    updateSimulation(worldState, neutralInput, FIXED_TIME_STEP);

    expect(Math.abs(worldState.player.angularVelocity)).toBeLessThan(0.45);
    expect(Math.abs(enemy.angularVelocity)).toBeLessThan(0.45);
  });

  it("drops only supported loot kinds when enemies sink", () => {
    const worldState = createInitialWorldState();
    worldState.eventDirector.timer = 999;

    stepUntil(worldState, () => worldState.enemies.length > 0, Math.ceil((ENEMY_INITIAL_SPAWN_DELAY + 2) / FIXED_TIME_STEP));
    worldState.spawnDirector.maxActive = 0;
    const enemy = worldState.enemies[0];
    expect(enemy).toBeDefined();
    if (!enemy) {
      throw new Error("Expected at least one enemy spawn.");
    }

    enemy.hp = 1;
    worldState.projectiles.push(createProjectile(worldState.nextProjectileId++, "player", enemy.position.x, enemy.position.z, enemy.position.y));

    updateSimulation(worldState, neutralInput, FIXED_TIME_STEP);
    const unsupportedLoot = worldState.loot.find((loot) => (loot as { kind: string }).kind === "treasure_map");
    expect(unsupportedLoot).toBeUndefined();
  });

  it("rotates world events through convoy, storm, and navy only", () => {
    const worldState = createInitialWorldState();
    worldState.spawnDirector.maxActive = 0;
    worldState.spawnDirector.timer = 999;
    worldState.eventDirector.activeKind = null;
    worldState.eventDirector.remaining = 0;

    const seenKinds: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      worldState.eventDirector.timer = 0;
      updateSimulation(worldState, neutralInput, FIXED_TIME_STEP);
      const activeKind = worldState.eventDirector.activeKind;
      expect(activeKind).not.toBeNull();
      if (!activeKind) {
        throw new Error("Expected active event kind.");
      }

      seenKinds.push(activeKind);
      const startedEvents = drainSimulationEvents(worldState).filter((event) => event.type === "world_event_started");
      expect(startedEvents.length).toBeGreaterThan(0);
      expect(startedEvents[0]).toEqual({ type: "world_event_started", kind: activeKind });

      worldState.eventDirector.remaining = 0;
      updateSimulation(worldState, neutralInput, FIXED_TIME_STEP);
      drainSimulationEvents(worldState);
    }

    expect(seenKinds).toEqual(["enemy_convoy", "storm", "navy_patrol", "enemy_convoy", "storm", "navy_patrol"]);
  });

  it("uses explicit enemy AI states including flee and line-up states", () => {
    const worldState = createInitialWorldState();
    worldState.eventDirector.timer = 999;

    step(worldState, neutralInput, Math.ceil(ENEMY_INITIAL_SPAWN_DELAY / FIXED_TIME_STEP) + 1);
    worldState.spawnDirector.maxActive = 0;

    const enemy = worldState.enemies[0];
    expect(enemy).toBeDefined();
    if (!enemy) {
      throw new Error("Expected one spawned enemy.");
    }

    enemy.archetype = "merchant";
    enemy.position.x = worldState.player.position.x + 4;
    enemy.position.z = worldState.player.position.z + 2;

    updateSimulation(worldState, neutralInput, FIXED_TIME_STEP);
    expect(enemy.aiState).toBe("flee");

    enemy.archetype = "raider";
    enemy.hp = enemy.maxHp;
    enemy.position.x = worldState.player.position.x + 40;
    enemy.position.z = worldState.player.position.z + 8;
    step(worldState, neutralInput, 4);
    expect(["detect", "chase", "line_up_broadside", "fire", "flee", "patrol"]).toContain(enemy.aiState);
  });

  it("applies stronger speed penalty when storm is active around player", () => {
    const clearWorld = createInitialWorldState();
    quietWorld(clearWorld);
    clearWorld.player.speed = 10;
    clearWorld.player.drift = 3;
    clearWorld.player.linearVelocity.x = -3;
    clearWorld.player.linearVelocity.z = 10;

    const stormWorld = createInitialWorldState();
    quietWorld(stormWorld);
    stormWorld.player.speed = 10;
    stormWorld.player.drift = 3;
    stormWorld.player.linearVelocity.x = -3;
    stormWorld.player.linearVelocity.z = 10;
    stormWorld.storm.active = true;
    stormWorld.storm.center.x = stormWorld.player.position.x;
    stormWorld.storm.center.z = stormWorld.player.position.z;
    stormWorld.storm.radius = 26;
    stormWorld.storm.intensity = 0.55;

    updateSimulation(clearWorld, neutralInput, FIXED_TIME_STEP);
    updateSimulation(stormWorld, neutralInput, FIXED_TIME_STEP);

    expect(stormWorld.player.speed).toBeLessThan(clearWorld.player.speed);
    expect(Math.abs(stormWorld.player.drift)).toBeLessThan(Math.abs(clearWorld.player.drift));
  });
});
