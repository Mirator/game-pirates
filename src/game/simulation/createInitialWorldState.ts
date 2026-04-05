import {
  ENEMY_INITIAL_SPAWN_DELAY,
  ENEMY_SPAWN_MAX_ACTIVE,
  ENEMY_STAGGER_SPAWN_DELAY,
  PORT_POSITION,
  PORT_PROMPT_RADIUS,
  PORT_RADIUS,
  PORT_SAFE_RADIUS,
  PLAYER_RESPAWN,
  UPGRADE_HULL_COST_START,
  SHIP_MAX_HP,
  SHIP_RADIUS,
  WORLD_BOUNDS_RADIUS
} from "./constants";
import type { ShipOwner, ShipState, WorldState } from "./types";

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
    sinkTimer: 0,
    repairCooldown: 0
  };
}

export function createInitialWorldState(): WorldState {
  return {
    time: 0,
    phase: "running",
    flags: {
      playerRespawns: 0,
      enemiesSunk: 0,
      lootCollected: 0,
      goldCollected: 0
    },
    boundsRadius: WORLD_BOUNDS_RADIUS,
    nextProjectileId: 1,
    nextEnemyId: 1,
    nextLootId: 1,
    player: createShip("player", PLAYER_RESPAWN),
    enemies: [],
    projectiles: [],
    loot: [],
    wallet: {
      gold: 0,
      repairMaterials: 0
    },
    upgrade: {
      hullLevel: 0,
      nextCost: UPGRADE_HULL_COST_START
    },
    port: {
      position: { x: PORT_POSITION.x, z: PORT_POSITION.z },
      radius: PORT_RADIUS,
      promptRadius: PORT_PROMPT_RADIUS,
      safeRadius: PORT_SAFE_RADIUS,
      menuOpen: false,
      playerInRange: false,
      playerNearPort: false
    },
    spawnDirector: {
      maxActive: ENEMY_SPAWN_MAX_ACTIVE,
      initialSpawnDelay: ENEMY_INITIAL_SPAWN_DELAY,
      staggerDelay: ENEMY_STAGGER_SPAWN_DELAY,
      timer: ENEMY_INITIAL_SPAWN_DELAY
    },
    events: []
  };
}
