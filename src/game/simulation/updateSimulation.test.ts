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
  trySellCargo,
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

function quietWorld(worldState: WorldState): void {
  worldState.spawnDirector.maxActive = 0;
  worldState.spawnDirector.timer = 999;
  worldState.eventDirector.timer = 999;
  worldState.eventDirector.activeKind = null;
  worldState.eventDirector.remaining = 0;
  worldState.storm.active = false;
}

describe("updateSimulation ECS pipeline", () => {
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

  it("fires from matching port and starboard batteries", () => {
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

    const portShot = worldState.projectiles.find((projectile) => projectile.id === 1);
    const starboardShot = worldState.projectiles.find((projectile) => projectile.id === 2);

    expect(portShot?.position.x ?? 0).toBeGreaterThan(0);
    expect(starboardShot?.position.x ?? 0).toBeLessThan(0);
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

    worldState.projectiles.push({
      id: worldState.nextProjectileId++,
      owner: "player",
      position: { x: enemy.position.x, z: enemy.position.z },
      velocity: { x: 0, z: 0 },
      lifetime: 1,
      active: true
    });

    updateSimulation(worldState, neutralInput, FIXED_TIME_STEP);

    expect(enemy.status).toBe("sinking");
    expect(worldState.loot.length).toBeGreaterThanOrEqual(3);
    expect(worldState.flags.enemiesSunk).toBeGreaterThanOrEqual(1);
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

  it("undocks first when docked even if loot is nearby", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    worldState.player.position.x = PORT_POSITION.x;
    worldState.player.position.z = PORT_POSITION.z;

    updateSimulation(worldState, { ...neutralInput, interact: true }, FIXED_TIME_STEP);
    expect(worldState.port.menuOpen).toBe(true);

    worldState.loot.push({
      id: worldState.nextLootId++,
      kind: "cargo",
      amount: 1,
      position: { x: PORT_POSITION.x + 1, z: PORT_POSITION.z + 1 },
      driftVelocity: { x: 0, z: 0 },
      lifetime: 10,
      pickupRadius: 3,
      active: true
    });

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

  it("activates burst, expires it, and enforces cooldown", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    updateSimulation(worldState, { ...neutralInput, burst: true }, FIXED_TIME_STEP);
    expect(worldState.burst.active).toBe(true);

    step(worldState, { ...neutralInput, burst: true, throttle: 1 }, Math.ceil(1.2 / FIXED_TIME_STEP) + 3);
    expect(worldState.burst.active).toBe(false);
    expect(worldState.burst.cooldown).toBeGreaterThan(0);

    step(worldState, { ...neutralInput, burst: true }, Math.ceil(4 / FIXED_TIME_STEP) + 3);
    expect(worldState.burst.active).toBe(true);
  });

  it("collects treasure map loot and consumes map on objective completion", () => {
    const worldState = createInitialWorldState();
    quietWorld(worldState);

    worldState.loot.push({
      id: worldState.nextLootId++,
      kind: "treasure_map",
      amount: 1,
      position: { x: worldState.player.position.x + 1, z: worldState.player.position.z },
      driftVelocity: { x: 0, z: 0 },
      lifetime: 10,
      pickupRadius: 3,
      active: true
    });

    updateSimulation(worldState, { ...neutralInput, interact: true }, FIXED_TIME_STEP);
    expect(worldState.wallet.treasureMaps).toBe(1);
    expect(worldState.treasureObjective.active).toBe(true);
    expect(worldState.treasureObjective.fromMap).toBe(true);

    worldState.player.position.x = worldState.treasureObjective.markerPosition.x;
    worldState.player.position.z = worldState.treasureObjective.markerPosition.z;

    updateSimulation(worldState, { ...neutralInput, interact: true }, FIXED_TIME_STEP);
    expect(worldState.wallet.treasureMaps).toBe(0);
    expect(worldState.treasureObjective.completedCount).toBe(1);
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
