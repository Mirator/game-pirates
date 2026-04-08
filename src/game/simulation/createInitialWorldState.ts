import {
  ENEMY_ANGULAR_DRAG_AIR,
  ENEMY_ANGULAR_DRAG_WATER,
  ENEMY_BUOYANCY_DAMPING,
  ENEMY_BUOYANCY_STRENGTH,
  ENEMY_INITIAL_SPAWN_DELAY,
  ENEMY_LATERAL_DRAG_WATER,
  ENEMY_LINEAR_DRAG_AIR,
  ENEMY_LINEAR_DRAG_WATER,
  ENEMY_LOW_SPEED_TURN_ASSIST,
  ENEMY_MASS_BASE,
  ENEMY_PITCH_DAMPING,
  ENEMY_ROLL_DAMPING,
  ENEMY_SPAWN_MAX_ACTIVE,
  ENEMY_STAGGER_SPAWN_DELAY,
  ENEMY_THRUST_FORCE_BASE,
  ENEMY_TURN_TORQUE_BASE,
  EVENT_INTERVAL,
  ISLAND_LAYOUT,
  PHYSICS_GLOBAL_DRAG_MULTIPLIER,
  PHYSICS_GRAVITY,
  PHYSICS_SEA_LEVEL,
  PHYSICS_WATER_DENSITY_MULTIPLIER,
  PLAYER_ANGULAR_DRAG_AIR,
  PLAYER_ANGULAR_DRAG_WATER,
  PLAYER_BUOYANCY_DAMPING,
  PLAYER_BUOYANCY_STRENGTH,
  PLAYER_LATERAL_DRAG_WATER,
  PLAYER_LINEAR_DRAG_AIR,
  PLAYER_LINEAR_DRAG_WATER,
  PLAYER_LOW_SPEED_TURN_ASSIST,
  PLAYER_MASS,
  PLAYER_PITCH_DAMPING,
  PLAYER_RESPAWN,
  PLAYER_ROLL_DAMPING,
  PLAYER_THRUST_FORCE,
  PLAYER_TURN_TORQUE,
  PORT_POSITION,
  PORT_PROMPT_RADIUS,
  PORT_RADIUS,
  PORT_SAFE_RADIUS,
  SHIP_MAX_HP,
  SHIP_SPAWN_FREEBOARD,
  STORM_INTENSITY_MAX,
  STORM_RADIUS,
  UPGRADE_HULL_COST_START,
  WORLD_BOUNDS_RADIUS
} from "./constants";
import type { BuoyancyProbeState, IslandState, ShipOwner, ShipState, WorldState } from "./types";
import { DEFAULT_WATER_SURFACE_TUNING, DEFAULT_WATER_SURFACE_WAVES } from "../physics/waterProfile";
import { sampleWaterHeight } from "../physics/waterSurface";
import { createShipBuoyancyProbes, getShipColliderProfile } from "../ships/shipProfiles";

function createShip(owner: ShipOwner, spawn: { x: number; y: number; z: number; heading: number }): ShipState {
  const colliderProfile = owner === "player"
    ? getShipColliderProfile("player_v2")
    : getShipColliderProfile("enemy_raider_v2");
  const mass = owner === "player" ? PLAYER_MASS : ENEMY_MASS_BASE;
  return {
    owner,
    position: { x: spawn.x, y: spawn.y, z: spawn.z },
    heading: spawn.heading,
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
    hp: SHIP_MAX_HP,
    maxHp: SHIP_MAX_HP,
    radius: colliderProfile.radius,
    mass,
    centerOfMass: { x: 0, y: colliderProfile.centerOfMassY, z: 0 },
    buoyancyProbes: createShipBuoyancyProbes(colliderProfile) as BuoyancyProbeState[],
    buoyancyStrength: owner === "player" ? PLAYER_BUOYANCY_STRENGTH : ENEMY_BUOYANCY_STRENGTH,
    buoyancyDamping: owner === "player" ? PLAYER_BUOYANCY_DAMPING : ENEMY_BUOYANCY_DAMPING,
    buoyancyLoss: 0,
    hull: {
      kind: "compound_hull",
      length: colliderProfile.length,
      width: colliderProfile.width,
      draft: colliderProfile.draft
    },
    drag: {
      linearAir: owner === "player" ? PLAYER_LINEAR_DRAG_AIR : ENEMY_LINEAR_DRAG_AIR,
      linearWater: owner === "player" ? PLAYER_LINEAR_DRAG_WATER : ENEMY_LINEAR_DRAG_WATER,
      lateralWater: owner === "player" ? PLAYER_LATERAL_DRAG_WATER : ENEMY_LATERAL_DRAG_WATER,
      angularAir: owner === "player" ? PLAYER_ANGULAR_DRAG_AIR : ENEMY_ANGULAR_DRAG_AIR,
      angularWater: owner === "player" ? PLAYER_ANGULAR_DRAG_WATER : ENEMY_ANGULAR_DRAG_WATER,
      rollDamping: owner === "player" ? PLAYER_ROLL_DAMPING : ENEMY_ROLL_DAMPING,
      pitchDamping: owner === "player" ? PLAYER_PITCH_DAMPING : ENEMY_PITCH_DAMPING
    },
    thrustForce: owner === "player" ? PLAYER_THRUST_FORCE : ENEMY_THRUST_FORCE_BASE,
    turnTorque: owner === "player" ? PLAYER_TURN_TORQUE : ENEMY_TURN_TORQUE_BASE,
    lowSpeedTurnAssist: owner === "player" ? PLAYER_LOW_SPEED_TURN_ASSIST : ENEMY_LOW_SPEED_TURN_ASSIST,
    reload: { left: 0, right: 0 },
    status: "alive",
    damageState: "healthy",
    sinkTimer: 0,
    repairCooldown: 0,
    collisionLayer: "ships",
    waterState: "submerged"
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

function resolveSpawnHeight(x: number, z: number, fallbackY: number): number {
  const waterHeight = PHYSICS_SEA_LEVEL + sampleWaterHeight(DEFAULT_WATER_SURFACE_WAVES, { x, z }, 0, DEFAULT_WATER_SURFACE_TUNING);
  return Math.max(fallbackY, waterHeight + SHIP_SPAWN_FREEBOARD);
}

export function createInitialWorldState(): WorldState {
  const islands = createIslands();
  const stormCenterIsland =
    islands.find((island) => island.kind === "hostile" || island.kind === "scenic") ?? islands[0];

  const stormCenterPosition = stormCenterIsland
    ? { x: stormCenterIsland.position.x, z: stormCenterIsland.position.z }
    : { x: PORT_POSITION.x, z: PORT_POSITION.z };
  const playerSpawn = {
    ...PLAYER_RESPAWN,
    y: resolveSpawnHeight(PLAYER_RESPAWN.x, PLAYER_RESPAWN.z, PLAYER_RESPAWN.y)
  };

  return {
    time: 0,
    phase: "running",
    flags: {
      playerRespawns: 0,
      enemiesSunk: 0,
      lootCollected: 0,
      goldCollected: 0
    },
    physics: {
      tickRateHz: 60,
      gravity: PHYSICS_GRAVITY,
      waterDensityMultiplier: PHYSICS_WATER_DENSITY_MULTIPLIER,
      globalDragMultiplier: PHYSICS_GLOBAL_DRAG_MULTIPLIER,
      seaLevel: PHYSICS_SEA_LEVEL
    },
    boundsRadius: WORLD_BOUNDS_RADIUS,
    nextProjectileId: 1,
    nextEnemyId: 1,
    nextLootId: 1,
    player: createShip("player", playerSpawn),
    islands,
    enemies: [],
    projectiles: [],
    loot: [],
    wallet: {
      gold: 0,
      repairMaterials: 0,
      cargo: 0
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
    storm: {
      active: false,
      center: stormCenterPosition,
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
