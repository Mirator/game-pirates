import {
  ENEMY_RESPAWN,
  PLAYER_RESPAWN,
  SHIP_MAX_HP,
  SHIP_RADIUS,
  WORLD_BOUNDS_RADIUS
} from "./constants";
import type { EnemyState, ShipOwner, ShipState, WorldState } from "./types";

function createShip(owner: ShipOwner, spawn: { x: number; z: number; heading: number }): ShipState {
  return {
    owner,
    position: { x: spawn.x, z: spawn.z },
    heading: spawn.heading,
    speed: 0,
    drift: 0,
    throttle: 0,
    hp: SHIP_MAX_HP,
    maxHp: SHIP_MAX_HP,
    radius: SHIP_RADIUS,
    reload: { left: 0, right: 0 },
    status: "alive",
    sinkTimer: 0
  };
}

function createEnemy(): EnemyState {
  return {
    ...createShip("enemy", ENEMY_RESPAWN),
    aiState: "patrol",
    patrolAngle: Math.PI * 0.25
  };
}

export function createInitialWorldState(): WorldState {
  return {
    time: 0,
    phase: "running",
    flags: {
      playerRespawns: 0,
      enemyRespawns: 0
    },
    boundsRadius: WORLD_BOUNDS_RADIUS,
    nextProjectileId: 1,
    player: createShip("player", PLAYER_RESPAWN),
    enemy: createEnemy(),
    projectiles: []
  };
}
