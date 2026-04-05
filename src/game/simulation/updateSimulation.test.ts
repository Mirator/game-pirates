import { describe, expect, it } from "vitest";
import {
  CANNON_RELOAD_TIME,
  ENEMY_RESPAWN,
  FIXED_TIME_STEP,
  SINK_DURATION,
  createInitialWorldState,
  updateSimulation,
  type InputState,
  type WorldState
} from ".";

function step(worldState: WorldState, inputState: InputState, steps: number): void {
  for (let i = 0; i < steps; i += 1) {
    updateSimulation(worldState, inputState, FIXED_TIME_STEP);
  }
}

describe("updateSimulation", () => {
  it("integrates player movement and turn behavior", () => {
    const worldState = createInitialWorldState();
    worldState.enemy.status = "sinking";
    worldState.enemy.sinkTimer = 99;

    const startHeading = worldState.player.heading;
    const startX = worldState.player.position.x;
    const startZ = worldState.player.position.z;

    step(worldState, { throttle: 1, turn: 1, fireLeft: false, fireRight: false }, 120);

    expect(worldState.player.speed).toBeGreaterThan(2);
    expect(worldState.player.heading).toBeGreaterThan(startHeading + 0.2);
    const movedDistance = Math.hypot(worldState.player.position.x - startX, worldState.player.position.z - startZ);
    expect(movedDistance).toBeGreaterThan(8);
  });

  it("prevents cannon refire before reload timer completes", () => {
    const worldState = createInitialWorldState();
    worldState.enemy.status = "sinking";
    worldState.enemy.sinkTimer = 99;

    const fireLeft: InputState = { throttle: 0, turn: 0, fireLeft: true, fireRight: false };

    updateSimulation(worldState, fireLeft, FIXED_TIME_STEP);
    expect(worldState.nextProjectileId).toBe(2);

    updateSimulation(worldState, fireLeft, FIXED_TIME_STEP);
    expect(worldState.nextProjectileId).toBe(2);

    const stepsToReload = Math.ceil(CANNON_RELOAD_TIME / FIXED_TIME_STEP) + 1;
    step(worldState, fireLeft, stepsToReload);

    expect(worldState.nextProjectileId).toBeGreaterThanOrEqual(3);
  });

  it("applies projectile hits to hull HP", () => {
    const worldState = createInitialWorldState();
    worldState.player.position.x = 0;
    worldState.player.position.z = 0;
    worldState.player.heading = 0;

    worldState.enemy.position.x = -4.1;
    worldState.enemy.position.z = 0.85;
    worldState.enemy.speed = 0;

    const initialEnemyHp = worldState.enemy.hp;
    updateSimulation(worldState, { throttle: 0, turn: 0, fireLeft: false, fireRight: true }, FIXED_TIME_STEP);

    expect(worldState.enemy.hp).toBeLessThan(initialEnemyHp);
  });

  it("sinks and respawns enemy ship after sink timer", () => {
    const worldState = createInitialWorldState();
    worldState.player.position.x = 0;
    worldState.player.position.z = 0;
    worldState.player.heading = 0;

    worldState.enemy.position.x = -4.1;
    worldState.enemy.position.z = 0.85;
    worldState.enemy.hp = 5;
    worldState.enemy.speed = 0;

    let sunk = false;
    for (let i = 0; i < 8; i += 1) {
      updateSimulation(worldState, { throttle: 0, turn: 0, fireLeft: false, fireRight: true }, FIXED_TIME_STEP);
      if (worldState.enemy.status === "sinking") {
        sunk = true;
        break;
      }
    }

    expect(sunk).toBe(true);
    expect(worldState.enemy.status).toBe("sinking");

    const respawnSteps = Math.ceil(SINK_DURATION / FIXED_TIME_STEP) + 2;
    step(worldState, { throttle: 0, turn: 0, fireLeft: false, fireRight: false }, respawnSteps);

    expect(worldState.enemy.status).toBe("alive");
    expect(worldState.enemy.hp).toBe(worldState.enemy.maxHp);
    expect(worldState.flags.enemyRespawns).toBeGreaterThanOrEqual(1);
    expect(worldState.enemy.position.x).toBeCloseTo(ENEMY_RESPAWN.x, 1);
    expect(worldState.enemy.position.z).toBeCloseTo(ENEMY_RESPAWN.z, 1);
  });
});
