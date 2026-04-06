import {
  ENEMY_INITIAL_SPAWN_DELAY,
  ENEMY_SPAWN_MAX_ACTIVE,
  ENEMY_STAGGER_SPAWN_DELAY,
  EVENT_INTERVAL,
  ISLAND_LAYOUT,
  PORT_POSITION,
  PORT_PROMPT_RADIUS,
  PORT_RADIUS,
  PORT_SAFE_RADIUS,
  PLAYER_RESPAWN,
  SHIP_MAX_HP,
  SHIP_RADIUS,
  STORM_INTENSITY_MAX,
  STORM_RADIUS,
  TREASURE_REWARD_BASE,
  UPGRADE_HULL_COST_START,
  WORLD_BOUNDS_RADIUS
} from "./constants";
import type { IslandState, ShipOwner, ShipState, WorldState } from "./types";

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

function createIslands(): IslandState[] {
  return ISLAND_LAYOUT.map((island) => ({
    id: island.id,
    kind: island.kind,
    label: island.label,
    position: { x: island.x, z: island.z },
    radius: island.radius
  }));
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
    islands: createIslands(),
    enemies: [],
    projectiles: [],
    loot: [],
    wallet: {
      gold: 0,
      repairMaterials: 0,
      cargo: 0,
      treasureMaps: 0
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
    burst: {
      active: false,
      remaining: 0,
      cooldown: 0
    },
    spawnDirector: {
      maxActive: ENEMY_SPAWN_MAX_ACTIVE,
      initialSpawnDelay: ENEMY_INITIAL_SPAWN_DELAY,
      staggerDelay: ENEMY_STAGGER_SPAWN_DELAY,
      timer: ENEMY_INITIAL_SPAWN_DELAY
    },
    treasureObjective: {
      active: false,
      markerPosition: { x: -58, z: 22 },
      targetIslandId: null,
      rewardGold: TREASURE_REWARD_BASE,
      completedCount: 0,
      fromMap: false,
      queuedMaps: 0
    },
    storm: {
      active: false,
      center: { x: 34, z: -18 },
      radius: STORM_RADIUS,
      remaining: 0,
      intensity: STORM_INTENSITY_MAX
    },
    eventDirector: {
      timer: EVENT_INTERVAL * 0.6,
      interval: EVENT_INTERVAL,
      cycleIndex: 0,
      activeKind: null,
      remaining: 0,
      statusText: "Sail into contested waters and watch for events."
    },
    combatIntensity: 0,
    events: []
  };
}
