import { describe, expect, it } from "vitest";
import {
  CANNON_RELOAD_TIME,
  ENEMY_INITIAL_SPAWN_DELAY,
  ENEMY_STAGGER_SPAWN_DELAY,
  FIXED_TIME_STEP,
  PORT_POSITION,
  SINK_DURATION,
  createInitialWorldState,
  tryPurchaseHullUpgrade,
  updateSimulation,
  type InputState,
  type WorldState
} from ".";

const neutralInput: InputState = {
  throttle: 0,
  turn: 0,
  fireLeft: false,
  fireRight: false,
  interact: false,
  repair: false
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

function quietWorld(worldState: WorldState): void {
  worldState.spawnDirector.maxActive = 0;
  worldState.spawnDirector.timer = 999;
  worldState.eventDirector.timer = 999;
  worldState.eventDirector.activeKind = null;
  worldState.eventDirector.remaining = 0;
  worldState.storm.active = false;
}

describe("updateSimulation phase 3", () => {
  it("integrates movement and preserves reload gating", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    const startHeading = worldState.player.heading;
    const startX = worldState.player.position.x;
    const startZ = worldState.player.position.z;

    step(worldState, { ...neutralInput, throttle: 1, turn: 1 }, 120);
    expect(worldState.player.speed).toBeGreaterThan(2);
    expect(worldState.player.heading).toBeGreaterThan(startHeading + 0.2);
    expect(Math.hypot(worldState.player.position.x - startX, worldState.player.position.z - startZ)).toBeGreaterThan(8);

    updateSimulation(worldState, { ...neutralInput, fireLeft: true }, FIXED_TIME_STEP);
    const projectileAfterFirstShot = worldState.nextProjectileId;
    updateSimulation(worldState, { ...neutralInput, fireLeft: true }, FIXED_TIME_STEP);
    expect(worldState.nextProjectileId).toBe(projectileAfterFirstShot);

    const stepsToReload = Math.ceil(CANNON_RELOAD_TIME / FIXED_TIME_STEP) + 1;
    step(worldState, { ...neutralInput, fireLeft: true }, stepsToReload);
    expect(worldState.nextProjectileId).toBeGreaterThan(projectileAfterFirstShot);
  });

  it("fires from matching cannon side for port and starboard", () => {
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

    expect(worldState.projectiles.length).toBeGreaterThanOrEqual(2);

    const leftShot = worldState.projectiles.find((projectile) => projectile.id === 1);
    const rightShot = worldState.projectiles.find((projectile) => projectile.id === 2);

    expect(leftShot?.position.x ?? 0).toBeGreaterThan(0);
    expect(rightShot?.position.x ?? 0).toBeLessThan(0);
  });

  it("spawns enemies with initial and staggered timing up to cap 3", () => {
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

    step(worldState, neutralInput, Math.floor(staggerSteps / 2));
    expect(worldState.enemies.length).toBeLessThanOrEqual(3);
  });

  it("sinks enemies, drops loot, and removes sunk enemy after timer", () => {
    const worldState = createInitialWorldState();
    worldState.eventDirector.timer = 999;

    step(worldState, neutralInput, Math.ceil(ENEMY_INITIAL_SPAWN_DELAY / FIXED_TIME_STEP) + 1);
    worldState.spawnDirector.maxActive = 0;

    const enemy = worldState.enemies[0];
    expect(enemy).toBeDefined();
    if (!enemy) {
      throw new Error("Expected one spawned enemy.");
    }

    enemy.position.x = -4.1;
    enemy.position.z = 0.85;
    enemy.hp = 5;
    enemy.speed = 0;
    worldState.player.position.x = 0;
    worldState.player.position.z = 0;
    worldState.player.heading = 0;

    updateSimulation(worldState, { ...neutralInput, fireRight: true }, FIXED_TIME_STEP);

    expect(enemy.status).toBe("sinking");
    expect(worldState.loot.length).toBeGreaterThanOrEqual(2);
    expect(worldState.flags.enemiesSunk).toBeGreaterThanOrEqual(1);

    const removeSteps = Math.ceil(SINK_DURATION / FIXED_TIME_STEP) + 2;
    step(worldState, neutralInput, removeSteps);
    expect(worldState.enemies.length).toBe(0);
  });

  it("collects loot with interact before docking when both are possible", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    worldState.player.position.x = PORT_POSITION.x;
    worldState.player.position.z = PORT_POSITION.z;

    worldState.loot.push({
      id: worldState.nextLootId++,
      kind: "gold",
      amount: 20,
      position: { x: PORT_POSITION.x + 1, z: PORT_POSITION.z + 0.6 },
      driftVelocity: { x: 0, z: 0 },
      lifetime: 10,
      pickupRadius: 3,
      active: true
    });

    updateSimulation(worldState, { ...neutralInput, interact: true }, FIXED_TIME_STEP);

    expect(worldState.wallet.gold).toBe(20);
    expect(worldState.loot.length).toBe(0);
    expect(worldState.port.menuOpen).toBe(false);
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

  it("purchases hull upgrade with correct cost scaling and hp increase", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    worldState.port.menuOpen = true;
    worldState.wallet.gold = 200;
    worldState.player.hp = 50;

    const purchased = tryPurchaseHullUpgrade(worldState);
    expect(purchased).toBe(true);
    expect(worldState.upgrade.hullLevel).toBe(1);
    expect(worldState.upgrade.nextCost).toBe(100);
    expect(worldState.wallet.gold).toBe(140);
    expect(worldState.player.maxHp).toBe(120);
    expect(worldState.player.hp).toBe(70);

    worldState.wallet.gold = 20;
    expect(tryPurchaseHullUpgrade(worldState)).toBe(false);
    expect(worldState.upgrade.hullLevel).toBe(1);
  });

  it("opens dock menu by interact when in range and pauses movement", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    worldState.player.position.x = PORT_POSITION.x;
    worldState.player.position.z = PORT_POSITION.z;

    updateSimulation(worldState, { ...neutralInput, interact: true }, FIXED_TIME_STEP);
    expect(worldState.port.menuOpen).toBe(true);

    const xBefore = worldState.player.position.x;
    const zBefore = worldState.player.position.z;
    updateSimulation(worldState, { ...neutralInput, throttle: 1 }, FIXED_TIME_STEP);
    expect(worldState.player.position.x).toBeCloseTo(xBefore, 5);
    expect(worldState.player.position.z).toBeCloseTo(zBefore, 5);
  });

  it("activates treasure event and grants reward on interact at marker", () => {
    const worldState = createInitialWorldState();
    worldState.spawnDirector.maxActive = 0;
    worldState.eventDirector.timer = 0;
    worldState.eventDirector.cycleIndex = 0;

    updateSimulation(worldState, neutralInput, FIXED_TIME_STEP);
    expect(worldState.eventDirector.activeKind).toBe("treasure_marker");
    expect(worldState.treasureObjective.active).toBe(true);

    const reward = worldState.treasureObjective.rewardGold;
    worldState.player.position.x = worldState.treasureObjective.markerPosition.x;
    worldState.player.position.z = worldState.treasureObjective.markerPosition.z;

    updateSimulation(worldState, { ...neutralInput, interact: true }, FIXED_TIME_STEP);

    expect(worldState.treasureObjective.active).toBe(false);
    expect(worldState.wallet.gold).toBe(reward);
    expect(worldState.wallet.repairMaterials).toBe(1);
    expect(worldState.treasureObjective.completedCount).toBe(1);
  });

  it("applies stronger speed penalty when storm is active around player", () => {
    const clearWorld = createInitialWorldState();
    quietWorld(clearWorld);
    clearWorld.player.speed = 10;
    clearWorld.player.drift = 3;

    const stormWorld = createInitialWorldState();
    quietWorld(stormWorld);
    stormWorld.player.speed = 10;
    stormWorld.player.drift = 3;
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
