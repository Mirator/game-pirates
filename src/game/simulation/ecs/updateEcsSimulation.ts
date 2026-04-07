import {
  CANNON_DAMAGE,
  CANNON_FIRING_CONE_DOT,
  CANNON_LIFETIME,
  CANNON_RELOAD_TIME,
  CANNON_SPEED,
  CARGO_SALE_VALUE,
  ENEMY_ACCELERATION,
  ENEMY_BROADSIDE_RANGE,
  ENEMY_DETECTION_RANGE,
  ENEMY_DRAG,
  ENEMY_HARD_CAP,
  ENEMY_DRIFT_DAMPING,
  ENEMY_DRIFT_GAIN,
  ENEMY_MAX_FORWARD_SPEED,
  ENEMY_MAX_REVERSE_SPEED,
  ENEMY_SPAWN_POINTS,
  ENEMY_TURN_RATE,
  EVENT_CONVOY_DURATION,
  EVENT_NAVY_DURATION,
  EVENT_STORM_DURATION,
  EVENT_TREASURE_DURATION,
  LOOT_LIFETIME,
  LOOT_PICKUP_RADIUS,
  PLAYER_ACCELERATION,
  PLAYER_BRAKE_ACCELERATION,
  PLAYER_BURST_COOLDOWN,
  PLAYER_BURST_DURATION,
  PLAYER_BURST_SPEED_MULTIPLIER,
  PLAYER_DRAG,
  PLAYER_DRIFT_DAMPING,
  PLAYER_DRIFT_GAIN,
  PLAYER_MAX_FORWARD_SPEED,
  PLAYER_MAX_REVERSE_SPEED,
  PLAYER_REPAIR_AMOUNT,
  PLAYER_REPAIR_COOLDOWN,
  PLAYER_RESPAWN,
  PLAYER_TURN_RATE,
  SINK_DURATION,
  STORM_INTENSITY_MAX,
  STORM_RADIUS,
  STORM_SPEED_MULTIPLIER,
  TREASURE_INTERACT_RADIUS,
  TREASURE_REWARD_BASE,
  TREASURE_REWARD_STEP,
  UPGRADE_HULL_COST_STEP,
  UPGRADE_HULL_HP_BONUS
} from "../constants";
import type {
  CannonSide,
  EnemyArchetype,
  EnemyState,
  InputState,
  LootKind,
  LootState,
  ShipState,
  SimulationEvent,
  WorldEventKind
} from "../types";
import {
  calculateForwardVector as calculateForward,
  calculateLeftVector as calculateLeft,
  classifySideFromLeftDot,
  getBroadsideVector,
  sideDotAgainstShipLeft
} from "../sideMath";
import { ensureEcsState, syncEcsFromWorldView, syncWorldViewFromEcs } from "./createEcsState";
import { clamp, distanceSquared, normalizeAngle, steeringTowardHeading } from "./math";
import type { EcsEnemyIntent, EcsState, WorldWithEcs } from "./types";

interface MovementTuning {
  acceleration: number;
  brakeAcceleration?: number;
  maxForwardSpeed: number;
  maxReverseSpeed: number;
  drag: number;
  turnRate: number;
  driftGain: number;
  driftDamping: number;
}

interface EnemyProfile {
  maxHp: number;
  detectionRange: number;
  broadsideRange: number;
  reloadDuration: number;
  movement: MovementTuning;
  fleeThreshold: number;
  lootGoldBase: number;
  lootMaterialBase: number;
  lootCargoBase: number;
  mapDropEvery: number;
}

const EVENT_CYCLE: WorldEventKind[] = ["treasure_marker", "enemy_convoy", "storm", "navy_patrol"];

const PLAYER_TUNING: MovementTuning = {
  acceleration: PLAYER_ACCELERATION,
  brakeAcceleration: PLAYER_BRAKE_ACCELERATION,
  maxForwardSpeed: PLAYER_MAX_FORWARD_SPEED,
  maxReverseSpeed: PLAYER_MAX_REVERSE_SPEED,
  drag: PLAYER_DRAG,
  turnRate: PLAYER_TURN_RATE,
  driftGain: PLAYER_DRIFT_GAIN,
  driftDamping: PLAYER_DRIFT_DAMPING
};

const ENEMY_PROFILES: Record<EnemyArchetype, EnemyProfile> = {
  merchant: {
    maxHp: 68,
    detectionRange: 54,
    broadsideRange: 13,
    reloadDuration: 2.45,
    movement: {
      acceleration: ENEMY_ACCELERATION * 0.8,
      maxForwardSpeed: ENEMY_MAX_FORWARD_SPEED * 0.94,
      maxReverseSpeed: ENEMY_MAX_REVERSE_SPEED * 0.7,
      drag: ENEMY_DRAG * 1.05,
      turnRate: ENEMY_TURN_RATE * 0.88,
      driftGain: ENEMY_DRIFT_GAIN * 0.82,
      driftDamping: ENEMY_DRIFT_DAMPING
    },
    fleeThreshold: 0.75,
    lootGoldBase: 58,
    lootMaterialBase: 1,
    lootCargoBase: 3,
    mapDropEvery: 6
  },
  raider: {
    maxHp: 100,
    detectionRange: ENEMY_DETECTION_RANGE,
    broadsideRange: ENEMY_BROADSIDE_RANGE,
    reloadDuration: 1.7,
    movement: {
      acceleration: ENEMY_ACCELERATION,
      maxForwardSpeed: ENEMY_MAX_FORWARD_SPEED,
      maxReverseSpeed: ENEMY_MAX_REVERSE_SPEED,
      drag: ENEMY_DRAG,
      turnRate: ENEMY_TURN_RATE,
      driftGain: ENEMY_DRIFT_GAIN,
      driftDamping: ENEMY_DRIFT_DAMPING
    },
    fleeThreshold: 0.25,
    lootGoldBase: 36,
    lootMaterialBase: 2,
    lootCargoBase: 2,
    mapDropEvery: 8
  },
  navy: {
    maxHp: 150,
    detectionRange: 80,
    broadsideRange: 24,
    reloadDuration: 1.35,
    movement: {
      acceleration: ENEMY_ACCELERATION * 0.92,
      maxForwardSpeed: ENEMY_MAX_FORWARD_SPEED * 0.88,
      maxReverseSpeed: ENEMY_MAX_REVERSE_SPEED * 0.92,
      drag: ENEMY_DRAG * 1.04,
      turnRate: ENEMY_TURN_RATE * 0.82,
      driftGain: ENEMY_DRIFT_GAIN * 0.72,
      driftDamping: ENEMY_DRIFT_DAMPING * 1.08
    },
    fleeThreshold: 0,
    lootGoldBase: 82,
    lootMaterialBase: 3,
    lootCargoBase: 4,
    mapDropEvery: 4
  }
};

function emitEvent(worldState: WorldWithEcs, event: SimulationEvent): void {
  worldState.events.push(event);
}

function togglePortMenu(worldState: WorldWithEcs, open: boolean): void {
  if (worldState.port.menuOpen === open) {
    return;
  }

  worldState.port.menuOpen = open;
  if (open && worldState.burst.active) {
    worldState.burst.active = false;
    worldState.burst.remaining = 0;
    worldState.burst.cooldown = Math.max(worldState.burst.cooldown, PLAYER_BURST_COOLDOWN);
  }

  emitEvent(worldState, { type: open ? "dock_open" : "dock_close" });
}

function updatePortRange(worldState: WorldWithEcs): void {
  const player = worldState.player;
  const port = worldState.port;
  const dockRangeSq = port.radius * port.radius;
  const promptRangeSq = port.promptRadius * port.promptRadius;

  port.playerInRange = distanceSquared(player.position.x, player.position.z, port.position.x, port.position.z) <= dockRangeSq;
  port.playerNearPort =
    distanceSquared(player.position.x, player.position.z, port.position.x, port.position.z) <= promptRangeSq;

  if (!port.playerInRange && port.menuOpen) {
    togglePortMenu(worldState, false);
  }
}

function decreaseReloadTimers(ship: ShipState, dt: number): void {
  ship.reload.left = Math.max(0, ship.reload.left - dt);
  ship.reload.right = Math.max(0, ship.reload.right - dt);
  ship.repairCooldown = Math.max(0, ship.repairCooldown - dt);
}

function moveShip(ship: ShipState, throttleInput: number, turnInput: number, dt: number, tuning: MovementTuning): void {
  if (ship.status !== "alive") {
    return;
  }

  const changingDirection = ship.speed !== 0 && Math.sign(throttleInput) !== Math.sign(ship.speed);
  const acceleration = changingDirection ? (tuning.brakeAcceleration ?? tuning.acceleration) : tuning.acceleration;

  ship.speed += throttleInput * acceleration * dt;
  ship.speed *= Math.exp(-tuning.drag * dt);
  ship.speed = clamp(ship.speed, tuning.maxReverseSpeed, tuning.maxForwardSpeed);

  const speedFactor = clamp(Math.abs(ship.speed) / tuning.maxForwardSpeed, 0.2, 1);
  const reverseDirection = ship.speed < -0.15 ? -1 : 1;
  ship.heading = normalizeAngle(ship.heading + turnInput * tuning.turnRate * speedFactor * dt * reverseDirection);

  ship.drift += turnInput * ship.speed * tuning.driftGain * dt;
  ship.drift *= Math.exp(-tuning.driftDamping * dt);

  const forward = calculateForward(ship.heading);
  const left = calculateLeft(ship.heading);
  ship.position.x += forward.x * ship.speed * dt + left.x * ship.drift * dt;
  ship.position.z += forward.z * ship.speed * dt + left.z * ship.drift * dt;
  ship.throttle = throttleInput;
}

function applyStormPenalty(worldState: WorldWithEcs, ship: ShipState, dt: number): void {
  if (!worldState.storm.active || ship.status !== "alive") {
    return;
  }
  const storm = worldState.storm;
  if (distanceSquared(ship.position.x, ship.position.z, storm.center.x, storm.center.z) > storm.radius * storm.radius) {
    return;
  }

  const damping = clamp(1 - (1 - STORM_SPEED_MULTIPLIER) * 2.2 * dt, 0.45, 1);
  ship.speed *= damping;
  ship.drift *= clamp(1 - storm.intensity * 1.1 * dt, 0.6, 1);
}

function keepShipInBoundsHard(ship: ShipState, boundsRadius: number): void {
  const distSq = ship.position.x * ship.position.x + ship.position.z * ship.position.z;
  if (distSq <= boundsRadius * boundsRadius) {
    return;
  }
  const distance = Math.sqrt(distSq);
  const scale = boundsRadius / distance;
  ship.position.x *= scale;
  ship.position.z *= scale;
  ship.speed *= 0.45;
  ship.drift *= 0.3;
  ship.heading = normalizeAngle(Math.atan2(-ship.position.x, -ship.position.z));
}

function keepPlayerInBoundsSoft(ship: ShipState, boundsRadius: number): void {
  const distSq = ship.position.x * ship.position.x + ship.position.z * ship.position.z;
  if (distSq <= boundsRadius * boundsRadius) {
    return;
  }

  const distance = Math.sqrt(distSq);
  if (distance < 0.0001) {
    return;
  }

  const normalX = ship.position.x / distance;
  const normalZ = ship.position.z / distance;
  const clampedDistance = Math.max(0, boundsRadius - 0.001);
  ship.position.x = normalX * clampedDistance;
  ship.position.z = normalZ * clampedDistance;

  const forward = calculateForward(ship.heading);
  const left = calculateLeft(ship.heading);
  const velocityX = forward.x * ship.speed + left.x * ship.drift;
  const velocityZ = forward.z * ship.speed + left.z * ship.drift;
  const outwardVelocity = velocityX * normalX + velocityZ * normalZ;
  if (outwardVelocity <= 0) {
    ship.speed *= 0.92;
    ship.drift *= 0.8;
    return;
  }

  const forwardDotNormal = forward.x * normalX + forward.z * normalZ;
  const reflectedForwardX = forward.x - 2 * forwardDotNormal * normalX;
  const reflectedForwardZ = forward.z - 2 * forwardDotNormal * normalZ;
  const reflectedLength = Math.hypot(reflectedForwardX, reflectedForwardZ);
  if (reflectedLength > 0.0001) {
    ship.heading = normalizeAngle(Math.atan2(reflectedForwardX / reflectedLength, reflectedForwardZ / reflectedLength));
  }

  ship.speed *= 0.55;
  ship.drift *= 0.45;
}

function chooseSpawnArchetype(worldState: WorldWithEcs): EnemyArchetype {
  const threat = worldState.flags.enemiesSunk + Math.floor(worldState.time / 45);
  const selector = (worldState.nextEnemyId + threat) % 10;

  if (worldState.time < 90) {
    return selector <= 2 ? "merchant" : "raider";
  }
  if (worldState.time < 180) {
    if (selector <= 1) return "merchant";
    if (selector >= 8) return "navy";
    return "raider";
  }
  if (selector <= 1) return "merchant";
  if (selector >= 6) return "navy";
  return "raider";
}

function chooseSpawnPoint(worldState: WorldWithEcs): { x: number; z: number; heading: number } {
  let bestPoint = ENEMY_SPAWN_POINTS[0]!;
  let bestScore = -Infinity;

  for (let i = 0; i < ENEMY_SPAWN_POINTS.length; i += 1) {
    const candidate = ENEMY_SPAWN_POINTS[i];
    if (!candidate) continue;

    const distToPlayer = Math.sqrt(
      distanceSquared(candidate.x, candidate.z, worldState.player.position.x, worldState.player.position.z)
    );
    const distToPort = Math.sqrt(distanceSquared(candidate.x, candidate.z, worldState.port.position.x, worldState.port.position.z));
    if (distToPort < worldState.port.safeRadius) continue;

    const churnBias = ((worldState.nextEnemyId + i) % ENEMY_SPAWN_POINTS.length) * 0.01;
    const score = distToPlayer + churnBias;
    if (score > bestScore) {
      bestScore = score;
      bestPoint = candidate;
    }
  }
  return bestPoint;
}

function spawnEnemy(worldState: WorldWithEcs, ecs: EcsState, archetype: EnemyArchetype, spawn = chooseSpawnPoint(worldState)): void {
  if (ecs.enemyTable.size >= ENEMY_HARD_CAP) {
    return;
  }
  const profile = ENEMY_PROFILES[archetype];
  const id = worldState.nextEnemyId++;
  const enemy: EnemyState = {
    id,
    archetype,
    owner: "enemy",
    position: { x: spawn.x, z: spawn.z },
    heading: spawn.heading,
    speed: 0,
    drift: 0,
    throttle: 0,
    hp: profile.maxHp,
    maxHp: profile.maxHp,
    radius: archetype === "navy" ? 2.5 : 2.1,
    reload: { left: 0, right: 0 },
    status: "alive",
    sinkTimer: 0,
    aiState: "patrol",
    patrolAngle: (id % 8) * 0.3,
    lootDropped: false,
    repairCooldown: 0,
    aiStateTimer: 0,
    detectProgress: 0,
    pendingFireSide: null
  };

  ecs.enemyTable.set(id, enemy);
  ecs.shipTable.set(id, enemy);
}

function spawnEnemyIfNeeded(worldState: WorldWithEcs, ecs: EcsState): void {
  while (ecs.enemyTable.size < worldState.spawnDirector.maxActive && worldState.spawnDirector.timer <= 0) {
    spawnEnemy(worldState, ecs, chooseSpawnArchetype(worldState));
    worldState.spawnDirector.timer += worldState.spawnDirector.staggerDelay;
  }
}

function addProjectile(worldState: WorldWithEcs, ecs: EcsState, ship: ShipState, side: CannonSide): void {
  const forward = calculateForward(ship.heading);
  const sideVector = getBroadsideVector(ship.heading, side);

  const directionX = sideVector.x * 0.96 + forward.x * 0.14;
  const directionZ = sideVector.z * 0.96 + forward.z * 0.14;
  const length = Math.hypot(directionX, directionZ);
  if (length < 0.0001) {
    return;
  }

  const projectile = {
    id: worldState.nextProjectileId++,
    owner: ship.owner,
    position: {
      x: ship.position.x + sideVector.x * (ship.radius + 1.4) + forward.x * 0.8,
      z: ship.position.z + sideVector.z * (ship.radius + 1.4) + forward.z * 0.8
    },
    velocity: {
      x: (directionX / length) * CANNON_SPEED,
      z: (directionZ / length) * CANNON_SPEED
    },
    lifetime: CANNON_LIFETIME,
    active: true
  };

  ecs.projectileTable.set(projectile.id, projectile);
}

function getReloadDuration(ship: ShipState, enemy?: EnemyState): number {
  if (ship.owner === "player") {
    return CANNON_RELOAD_TIME;
  }
  return ENEMY_PROFILES[(enemy ?? (ship as EnemyState)).archetype].reloadDuration;
}

function tryFire(ship: ShipState, side: CannonSide, worldState: WorldWithEcs, ecs: EcsState, enemy?: EnemyState): boolean {
  if (ship.status !== "alive") return false;
  if (ship.reload[side] > 0) return false;

  ship.reload[side] = getReloadDuration(ship, enemy);
  addProjectile(worldState, ecs, ship, side);
  emitEvent(worldState, { type: "cannon_fire", owner: ship.owner });
  return true;
}

function maybeAddLoot(
  worldState: WorldWithEcs,
  ecs: EcsState,
  enemy: EnemyState,
  kind: LootKind,
  amount: number,
  angleOffset: number,
  speed: number
): void {
  if (amount <= 0) {
    return;
  }
  const angle = enemy.id * 0.71 + angleOffset;
  const loot: LootState = {
    id: worldState.nextLootId++,
    kind,
    amount,
    position: {
      x: enemy.position.x + Math.cos(angle) * 1.8,
      z: enemy.position.z + Math.sin(angle) * 1.8
    },
    driftVelocity: {
      x: Math.cos(angle) * speed,
      z: Math.sin(angle) * speed
    },
    lifetime: LOOT_LIFETIME,
    pickupRadius: LOOT_PICKUP_RADIUS,
    active: true
  };
  ecs.lootTable.set(loot.id, loot);
}

function spawnLoot(worldState: WorldWithEcs, ecs: EcsState, enemy: EnemyState): void {
  const profile = ENEMY_PROFILES[enemy.archetype];
  const goldAmount = profile.lootGoldBase + (enemy.id % 4) * 5;
  const materialAmount = profile.lootMaterialBase + (enemy.id % 2);
  const cargoAmount = profile.lootCargoBase + (enemy.id % 3);
  const mapAmount = enemy.id % profile.mapDropEvery === 0 ? 1 : 0;

  maybeAddLoot(worldState, ecs, enemy, "gold", goldAmount, 0.2, 2.3);
  maybeAddLoot(worldState, ecs, enemy, "repair_material", materialAmount, -0.32, 1.5);
  maybeAddLoot(worldState, ecs, enemy, "cargo", cargoAmount, 0.92, 1.8);
  maybeAddLoot(worldState, ecs, enemy, "treasure_map", mapAmount, -0.82, 1.2);
}

function beginShipSinking(worldState: WorldWithEcs, ship: ShipState): void {
  if (ship.status !== "alive") return;
  ship.status = "sinking";
  ship.sinkTimer = SINK_DURATION;
  ship.speed = 0;
  ship.drift = 0;
  emitEvent(worldState, { type: "ship_sunk", owner: ship.owner });
}

function beginEnemySinking(worldState: WorldWithEcs, ecs: EcsState, enemy: EnemyState): void {
  if (enemy.status !== "alive") return;
  beginShipSinking(worldState, enemy);
  if (!enemy.lootDropped) {
    spawnLoot(worldState, ecs, enemy);
    enemy.lootDropped = true;
    worldState.flags.enemiesSunk += 1;
  }
}

function updatePlayerRespawnSystem(worldState: WorldWithEcs, dt: number): void {
  const player = worldState.player;
  if (player.status !== "sinking") return;

  worldState.burst.active = false;
  worldState.burst.remaining = 0;

  player.sinkTimer = Math.max(0, player.sinkTimer - dt);
  player.speed *= 0.88;
  player.drift *= 0.86;
  if (player.sinkTimer > 0) return;

  player.position.x = PLAYER_RESPAWN.x;
  player.position.z = PLAYER_RESPAWN.z;
  player.heading = PLAYER_RESPAWN.heading;
  player.speed = 0;
  player.drift = 0;
  player.throttle = 0;
  player.hp = player.maxHp;
  player.reload.left = 0;
  player.reload.right = 0;
  player.status = "alive";
  player.sinkTimer = 0;
  player.repairCooldown = 0;
  worldState.flags.playerRespawns += 1;
}

function updateEnemySinkingSystem(ecs: EcsState, dt: number): void {
  for (const enemy of ecs.enemyTable.values()) {
    if (enemy.status !== "sinking") {
      continue;
    }
    enemy.sinkTimer = Math.max(0, enemy.sinkTimer - dt);
    enemy.speed *= 0.88;
    enemy.drift *= 0.86;
    if (enemy.sinkTimer > 0) {
      continue;
    }
    ecs.enemyTable.delete(enemy.id);
    ecs.shipTable.delete(enemy.id);
  }
}

function inflictDamageToPlayer(worldState: WorldWithEcs, damage: number): void {
  const player = worldState.player;
  if (player.status !== "alive") return;
  player.hp = Math.max(0, player.hp - damage);
  emitEvent(worldState, { type: "ship_hit", target: "player" });
  if (player.hp <= 0) {
    beginShipSinking(worldState, player);
  }
}

function inflictDamageToEnemy(worldState: WorldWithEcs, ecs: EcsState, enemy: EnemyState, damage: number): void {
  if (enemy.status !== "alive") return;
  enemy.hp = Math.max(0, enemy.hp - damage);
  emitEvent(worldState, { type: "ship_hit", target: "enemy" });
  if (enemy.hp <= 0) {
    beginEnemySinking(worldState, ecs, enemy);
  }
}

function projectileMotionSystem(worldState: WorldWithEcs, ecs: EcsState, dt: number): void {
  for (const projectile of ecs.projectileTable.values()) {
    if (!projectile.active) continue;

    projectile.position.x += projectile.velocity.x * dt;
    projectile.position.z += projectile.velocity.z * dt;
    projectile.lifetime -= dt;

    const outOfBounds = projectile.position.x ** 2 + projectile.position.z ** 2 > (worldState.boundsRadius * 1.3) ** 2;
    if (projectile.lifetime <= 0 || outOfBounds) {
      projectile.active = false;
      continue;
    }

    if (projectile.owner === "enemy") {
      const player = worldState.player;
      if (player.status !== "alive") continue;
      if (distanceSquared(projectile.position.x, projectile.position.z, player.position.x, player.position.z) <= player.radius ** 2) {
        projectile.active = false;
        inflictDamageToPlayer(worldState, CANNON_DAMAGE);
      }
      continue;
    }

    for (const enemy of ecs.enemyTable.values()) {
      if (enemy.status !== "alive") continue;
      if (distanceSquared(projectile.position.x, projectile.position.z, enemy.position.x, enemy.position.z) <= enemy.radius ** 2) {
        projectile.active = false;
        inflictDamageToEnemy(worldState, ecs, enemy, CANNON_DAMAGE);
        break;
      }
    }
  }
}

function cleanupEcsTables(ecs: EcsState): void {
  for (const projectile of ecs.projectileTable.values()) {
    if (!projectile.active) {
      ecs.projectileTable.delete(projectile.id);
    }
  }
  for (const loot of ecs.lootTable.values()) {
    if (!loot.active) {
      ecs.lootTable.delete(loot.id);
    }
  }
}

function setEnemyState(enemy: EnemyState, nextState: EnemyState["aiState"]): void {
  if (enemy.aiState === nextState) {
    return;
  }
  enemy.aiState = nextState;
  enemy.aiStateTimer = 0;
}

function enemyAiIntentSystem(worldState: WorldWithEcs, enemy: EnemyState, dt: number): EcsEnemyIntent {
  const player = worldState.player;
  const profile = ENEMY_PROFILES[enemy.archetype];
  enemy.aiStateTimer += dt;

  if (enemy.status !== "alive") {
    enemy.pendingFireSide = null;
    return { throttle: 0, turn: 0, fireSide: null };
  }

  const dx = player.position.x - enemy.position.x;
  const dz = player.position.z - enemy.position.z;
  const distance = Math.hypot(dx, dz);
  const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;

  const shouldFlee =
    enemy.archetype === "merchant" &&
    player.status === "alive" &&
    (distance < profile.broadsideRange * 1.6 || hpRatio < profile.fleeThreshold);

  if (shouldFlee) {
    setEnemyState(enemy, "flee");
  } else if (player.status !== "alive" || distance > profile.detectionRange) {
    setEnemyState(enemy, "patrol");
  } else if (enemy.aiState === "patrol") {
    setEnemyState(enemy, "detect");
  }

  if (enemy.aiState === "detect" && enemy.aiStateTimer >= 0.45) {
    setEnemyState(enemy, "chase");
  }

  if (
    enemy.aiState === "chase" &&
    distance <= profile.broadsideRange * 1.2 &&
    enemy.aiStateTimer >= 0.3
  ) {
    setEnemyState(enemy, "line_up_broadside");
  }

  let throttle = 0;
  let turn = 0;
  let fireSide: CannonSide | null = null;

  if (enemy.aiState === "flee") {
    const awayHeading = Math.atan2(-dx, -dz);
    throttle = 1;
    turn = steeringTowardHeading(enemy.heading, awayHeading);
  } else if (enemy.aiState === "patrol") {
    enemy.patrolAngle += dt * (enemy.archetype === "merchant" ? 0.55 : 0.35);
    const patrolRadius = 33 + (enemy.id % 4) * 5;
    const targetX = Math.cos(enemy.patrolAngle) * patrolRadius;
    const targetZ = Math.sin(enemy.patrolAngle) * patrolRadius;
    const targetHeading = Math.atan2(targetX - enemy.position.x, targetZ - enemy.position.z);
    throttle = enemy.archetype === "navy" ? 0.44 : 0.58;
    turn = steeringTowardHeading(enemy.heading, targetHeading);
  } else if (enemy.aiState === "detect") {
    const targetHeading = Math.atan2(dx, dz);
    throttle = 0.35;
    turn = steeringTowardHeading(enemy.heading, targetHeading);
  } else {
    const angleToPlayer = Math.atan2(dx, dz);
    const broadsideLeft = normalizeAngle(angleToPlayer + Math.PI * 0.5);
    const broadsideRight = normalizeAngle(angleToPlayer - Math.PI * 0.5);
    const leftDelta = Math.abs(normalizeAngle(broadsideLeft - enemy.heading));
    const rightDelta = Math.abs(normalizeAngle(broadsideRight - enemy.heading));
    const targetHeading = leftDelta < rightDelta ? broadsideLeft : broadsideRight;

    if (enemy.aiState === "chase") {
      throttle = enemy.archetype === "navy" ? 0.98 : 0.9;
      turn = steeringTowardHeading(enemy.heading, Math.atan2(dx, dz));
    } else {
      if (distance > profile.broadsideRange * 1.1) {
        throttle = 0.52;
      } else if (distance < profile.broadsideRange * 0.72) {
        throttle = -0.28;
      } else {
        throttle = 0.08;
      }
      turn = steeringTowardHeading(enemy.heading, targetHeading);

      const toPlayerLength = Math.hypot(dx, dz);
      if (toPlayerLength > 0.0001) {
        const normalizedToPlayerX = dx / toPlayerLength;
        const normalizedToPlayerZ = dz / toPlayerLength;
        const forward = calculateForward(enemy.heading);
        const dot = forward.x * normalizedToPlayerX + forward.z * normalizedToPlayerZ;
        const sideDot = sideDotAgainstShipLeft(enemy.heading, normalizedToPlayerX, normalizedToPlayerZ);

        const fireDotLimit = enemy.archetype === "navy" ? CANNON_FIRING_CONE_DOT + 0.12 : CANNON_FIRING_CONE_DOT;
        const canFire =
          Math.abs(dot) <= fireDotLimit &&
          toPlayerLength <= profile.broadsideRange * 1.35 &&
          (enemy.archetype !== "merchant" || toPlayerLength <= profile.broadsideRange * 0.85);

        if (canFire && enemy.aiStateTimer >= 0.18) {
          fireSide = classifySideFromLeftDot(sideDot);
          setEnemyState(enemy, "fire");
        } else {
          setEnemyState(enemy, "line_up_broadside");
        }
      }
    }
  }

  if (enemy.aiState === "fire" && enemy.aiStateTimer > 0.22) {
    setEnemyState(enemy, "line_up_broadside");
  }

  enemy.pendingFireSide = fireSide;
  return { throttle, turn, fireSide };
}

function updateLootPhysicsSystem(ecs: EcsState, dt: number): void {
  for (const loot of ecs.lootTable.values()) {
    if (!loot.active) continue;
    loot.position.x += loot.driftVelocity.x * dt;
    loot.position.z += loot.driftVelocity.z * dt;
    loot.driftVelocity.x *= Math.exp(-1.7 * dt);
    loot.driftVelocity.z *= Math.exp(-1.7 * dt);
    loot.lifetime -= dt;
    if (loot.lifetime <= 0) {
      loot.active = false;
    }
  }
}

function activateTreasureObjective(worldState: WorldWithEcs, fromMap: boolean): void {
  const treasureIslands = worldState.islands.filter((island) => island.kind === "treasure" || island.kind === "scenic");
  if (treasureIslands.length === 0) return;
  const index = worldState.treasureObjective.completedCount % treasureIslands.length;
  const targetIsland = treasureIslands[index]!;
  worldState.treasureObjective.active = true;
  worldState.treasureObjective.fromMap = fromMap;
  worldState.treasureObjective.targetIslandId = targetIsland.id;
  worldState.treasureObjective.markerPosition.x = targetIsland.position.x;
  worldState.treasureObjective.markerPosition.z = targetIsland.position.z;
  worldState.treasureObjective.rewardGold =
    TREASURE_REWARD_BASE + worldState.treasureObjective.completedCount * TREASURE_REWARD_STEP;
}

function queueTreasureMapObjectives(worldState: WorldWithEcs, amount: number): void {
  if (amount <= 0) {
    return;
  }
  worldState.treasureObjective.queuedMaps += amount;
  if (!worldState.treasureObjective.active) {
    activateTreasureObjective(worldState, true);
  }
}

function collectLootSystem(worldState: WorldWithEcs, ecs: EcsState): boolean {
  const player = worldState.player;
  let collected = false;

  for (const loot of ecs.lootTable.values()) {
    if (!loot.active) continue;

    const pickupRange = loot.pickupRadius + player.radius * 0.75;
    if (distanceSquared(player.position.x, player.position.z, loot.position.x, loot.position.z) > pickupRange * pickupRange) {
      continue;
    }

    loot.active = false;
    collected = true;
    worldState.flags.lootCollected += 1;

    switch (loot.kind) {
      case "gold":
        worldState.wallet.gold += loot.amount;
        worldState.flags.goldCollected += loot.amount;
        break;
      case "repair_material":
        worldState.wallet.repairMaterials += loot.amount;
        break;
      case "cargo":
        worldState.wallet.cargo += loot.amount;
        break;
      case "treasure_map":
        worldState.wallet.treasureMaps += loot.amount;
        queueTreasureMapObjectives(worldState, loot.amount);
        break;
    }

    emitEvent(worldState, { type: "loot_pickup", kind: loot.kind, amount: loot.amount });
  }

  return collected;
}

function tryCollectTreasureObjective(worldState: WorldWithEcs): boolean {
  if (!worldState.treasureObjective.active) return false;
  const marker = worldState.treasureObjective.markerPosition;
  const player = worldState.player;
  if (distanceSquared(player.position.x, player.position.z, marker.x, marker.z) > TREASURE_INTERACT_RADIUS ** 2) {
    return false;
  }

  const reward = worldState.treasureObjective.rewardGold;
  worldState.wallet.gold += reward;
  worldState.flags.goldCollected += reward;
  worldState.wallet.repairMaterials += 1;
  worldState.treasureObjective.completedCount += 1;

  if (worldState.treasureObjective.fromMap) {
    worldState.wallet.treasureMaps = Math.max(0, worldState.wallet.treasureMaps - 1);
    worldState.treasureObjective.queuedMaps = Math.max(0, worldState.treasureObjective.queuedMaps - 1);
    emitEvent(worldState, { type: "treasure_map_used" });
  }

  worldState.treasureObjective.active = false;
  worldState.treasureObjective.fromMap = false;
  worldState.treasureObjective.targetIslandId = null;
  worldState.eventDirector.statusText = "Treasure secured! Spend your haul at port.";
  emitEvent(worldState, { type: "treasure_collected", amount: reward });
  emitEvent(worldState, { type: "loot_pickup", kind: "gold", amount: reward });

  if (worldState.eventDirector.activeKind === "treasure_marker") {
    worldState.eventDirector.activeKind = null;
    worldState.eventDirector.remaining = 0;
    worldState.eventDirector.timer = worldState.eventDirector.interval * 0.7;
  }

  if (worldState.treasureObjective.queuedMaps > 0) {
    activateTreasureObjective(worldState, true);
  }

  return true;
}

function tryRepair(worldState: WorldWithEcs): void {
  const player = worldState.player;
  if (player.status !== "alive") return;
  if (player.repairCooldown > 0) return;
  if (player.hp >= player.maxHp) return;
  if (worldState.wallet.repairMaterials <= 0) return;

  worldState.wallet.repairMaterials -= 1;
  player.hp = Math.min(player.maxHp, player.hp + PLAYER_REPAIR_AMOUNT);
  player.repairCooldown = PLAYER_REPAIR_COOLDOWN;
  emitEvent(worldState, { type: "repair_used" });
}

function spawnConvoy(worldState: WorldWithEcs, ecs: EcsState): void {
  const base = chooseSpawnPoint(worldState);
  spawnEnemy(worldState, ecs, "merchant", base);
  spawnEnemy(worldState, ecs, "raider", {
    x: base.x + Math.cos(base.heading + Math.PI * 0.5) * 7,
    z: base.z + Math.sin(base.heading + Math.PI * 0.5) * 7,
    heading: normalizeAngle(base.heading + 0.1)
  });
}

function spawnNavyPatrol(worldState: WorldWithEcs, ecs: EcsState): void {
  const navyAlive = [...ecs.enemyTable.values()].some((enemy) => enemy.status === "alive" && enemy.archetype === "navy");
  if (!navyAlive) {
    spawnEnemy(worldState, ecs, "navy");
  }
}

function activateStorm(worldState: WorldWithEcs): void {
  const candidates = worldState.islands.filter((island) => island.kind === "hostile" || island.kind === "scenic");
  const pick = candidates[worldState.eventDirector.cycleIndex % Math.max(1, candidates.length)] ?? worldState.islands[0];
  if (!pick) return;
  worldState.storm.active = true;
  worldState.storm.center.x = pick.position.x;
  worldState.storm.center.z = pick.position.z;
  worldState.storm.radius = STORM_RADIUS;
  worldState.storm.remaining = EVENT_STORM_DURATION;
  worldState.storm.intensity = STORM_INTENSITY_MAX;
}

function startWorldEvent(worldState: WorldWithEcs, ecs: EcsState, kind: WorldEventKind): void {
  worldState.eventDirector.activeKind = kind;
  emitEvent(worldState, { type: "world_event_started", kind });

  switch (kind) {
    case "treasure_marker":
      if (!worldState.treasureObjective.active) {
        activateTreasureObjective(worldState, false);
      }
      worldState.eventDirector.remaining = EVENT_TREASURE_DURATION;
      worldState.eventDirector.statusText = "Treasure marker sighted. Reach the beacon and press Space.";
      break;
    case "enemy_convoy":
      spawnConvoy(worldState, ecs);
      worldState.eventDirector.remaining = EVENT_CONVOY_DURATION;
      worldState.eventDirector.statusText = "Merchant convoy spotted with raider escort.";
      break;
    case "storm":
      activateStorm(worldState);
      worldState.eventDirector.remaining = EVENT_STORM_DURATION;
      worldState.eventDirector.statusText = "Storm front rolling in. Visibility and speed reduced.";
      break;
    case "navy_patrol":
      spawnNavyPatrol(worldState, ecs);
      worldState.eventDirector.remaining = EVENT_NAVY_DURATION;
      worldState.eventDirector.statusText = "Navy patrol has entered contested waters.";
      break;
  }
}

function eventTimerSystem(worldState: WorldWithEcs, ecs: EcsState, dt: number): void {
  const director = worldState.eventDirector;

  if (director.activeKind) {
    director.remaining = Math.max(0, director.remaining - dt);
    if (worldState.storm.active) {
      worldState.storm.remaining = Math.max(0, worldState.storm.remaining - dt);
      if (worldState.storm.remaining <= 0) {
        worldState.storm.active = false;
      }
    }

    if (director.remaining <= 0) {
      director.activeKind = null;
      director.timer = director.interval;
      if (!worldState.treasureObjective.active) {
        director.statusText = "Scanning the horizon for the next encounter.";
      }
      worldState.storm.active = false;
      worldState.storm.remaining = 0;
    }
    return;
  }

  director.timer -= dt;
  if (director.timer > 0) {
    return;
  }

  const kind = EVENT_CYCLE[director.cycleIndex % EVENT_CYCLE.length]!;
  director.cycleIndex += 1;
  startWorldEvent(worldState, ecs, kind);
}

function updateBurstSystem(worldState: WorldWithEcs, inputState: InputState, dt: number): void {
  const burst = worldState.burst;
  const playerAlive = worldState.player.status === "alive";

  const oldCooldown = burst.cooldown;
  burst.cooldown = Math.max(0, burst.cooldown - dt);

  if (oldCooldown > 0 && burst.cooldown === 0) {
    emitEvent(worldState, { type: "burst_ready" });
  }

  if (!playerAlive || worldState.port.menuOpen) {
    burst.active = false;
    burst.remaining = 0;
    return;
  }

  if (burst.active) {
    burst.remaining = Math.max(0, burst.remaining - dt);
    if (burst.remaining <= 0) {
      burst.active = false;
      burst.cooldown = PLAYER_BURST_COOLDOWN;
    }
  }

  if (!burst.active && inputState.burst && burst.cooldown <= 0) {
    burst.active = true;
    burst.remaining = PLAYER_BURST_DURATION;
    emitEvent(worldState, { type: "burst_started" });
  }
}

function getPlayerMovementTuning(worldState: WorldWithEcs): MovementTuning {
  if (!worldState.burst.active) {
    return PLAYER_TUNING;
  }
  return {
    ...PLAYER_TUNING,
    acceleration: PLAYER_TUNING.acceleration * 1.2,
    brakeAcceleration: (PLAYER_TUNING.brakeAcceleration ?? PLAYER_TUNING.acceleration) * 1.1,
    maxForwardSpeed: PLAYER_TUNING.maxForwardSpeed * PLAYER_BURST_SPEED_MULTIPLIER
  };
}

function trySellCargo(worldState: WorldWithEcs): boolean {
  if (!worldState.port.menuOpen) return false;
  if (worldState.wallet.cargo <= 0) return false;

  const amount = worldState.wallet.cargo;
  const goldGained = amount * CARGO_SALE_VALUE;
  worldState.wallet.cargo = 0;
  worldState.wallet.gold += goldGained;
  emitEvent(worldState, { type: "cargo_sold", amount, goldGained });
  return true;
}

function updateCombatIntensity(worldState: WorldWithEcs, ecs: EcsState, dt: number): void {
  if (worldState.port.menuOpen || worldState.player.status !== "alive") {
    worldState.combatIntensity = Math.max(0, worldState.combatIntensity - dt * 1.8);
    return;
  }

  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const enemy of ecs.enemyTable.values()) {
    if (enemy.status !== "alive") continue;
    const distance = Math.sqrt(distanceSquared(worldState.player.position.x, worldState.player.position.z, enemy.position.x, enemy.position.z));
    if (distance < nearestDistance) {
      nearestDistance = distance;
    }
  }

  let target = 0.08;
  if (Number.isFinite(nearestDistance)) {
    if (nearestDistance < 24) target = 1;
    else if (nearestDistance < 40) target = 0.72;
    else if (nearestDistance < 62) target = 0.45;
    else target = 0.22;
  }

  if (ecs.projectileTable.size > 2) {
    target = Math.min(1, target + 0.16);
  }

  if (
    worldState.storm.active &&
    distanceSquared(
      worldState.player.position.x,
      worldState.player.position.z,
      worldState.storm.center.x,
      worldState.storm.center.z
    ) <= worldState.storm.radius ** 2
  ) {
    target = Math.min(1, target + 0.08);
  }

  const lerp = clamp(dt * 2.8, 0, 1);
  worldState.combatIntensity += (target - worldState.combatIntensity) * lerp;
  worldState.combatIntensity = clamp(worldState.combatIntensity, 0, 1);
}

export function closePortMenuEcs(worldState: WorldWithEcs): void {
  togglePortMenu(worldState, false);
}

export function tryPurchaseHullUpgradeEcs(worldState: WorldWithEcs): boolean {
  if (!worldState.port.menuOpen) return false;
  if (worldState.wallet.gold < worldState.upgrade.nextCost) return false;

  worldState.wallet.gold -= worldState.upgrade.nextCost;
  worldState.upgrade.hullLevel += 1;
  worldState.upgrade.nextCost += UPGRADE_HULL_COST_STEP;
  worldState.player.maxHp += UPGRADE_HULL_HP_BONUS;
  worldState.player.hp = Math.min(worldState.player.maxHp, worldState.player.hp + UPGRADE_HULL_HP_BONUS);
  emitEvent(worldState, { type: "upgrade_purchased", level: worldState.upgrade.hullLevel });
  return true;
}

export function trySellCargoEcs(worldState: WorldWithEcs): boolean {
  return trySellCargo(worldState);
}

export function drainSimulationEventsEcs(worldState: WorldWithEcs): SimulationEvent[] {
  const drained = [...worldState.events];
  worldState.events.length = 0;
  return drained;
}

export function updateEcsSimulation(worldState: WorldWithEcs, inputState: InputState, dt: number): void {
  if (dt <= 0) return;

  const ecs = ensureEcsState(worldState);
  syncEcsFromWorldView(worldState, ecs);
  worldState.time += dt;

  // 1) input capture
  updatePortRange(worldState);
  let interactRequested = false;
  if (inputState.interact) {
    if (worldState.port.menuOpen) {
      togglePortMenu(worldState, false);
    } else {
      interactRequested = true;
    }
  }

  // 10) port/menu/upgrade (menu pauses simulation progression)
  if (worldState.port.menuOpen) {
    if (inputState.repair) {
      tryRepair(worldState);
    }
    updateCombatIntensity(worldState, ecs, dt);
    syncWorldViewFromEcs(worldState, ecs);
    return;
  }

  // 2) event timers
  eventTimerSystem(worldState, ecs, dt);

  // Base ticking for ship combat cooldowns.
  decreaseReloadTimers(worldState.player, dt);
  for (const enemy of ecs.enemyTable.values()) {
    decreaseReloadTimers(enemy, dt);
  }

  // Burst progression
  updateBurstSystem(worldState, inputState, dt);

  // 3) AI intent
  const enemyIntents = ecs.enemyIntentScratch;
  enemyIntents.clear();
  for (const enemy of ecs.enemyTable.values()) {
    enemyIntents.set(enemy.id, enemyAiIntentSystem(worldState, enemy, dt));
  }

  // 4) movement
  if (worldState.player.status === "alive") {
    const playerTuning = getPlayerMovementTuning(worldState);
    moveShip(worldState.player, inputState.throttle, inputState.turn, dt, playerTuning);
    keepPlayerInBoundsSoft(worldState.player, worldState.boundsRadius);
  }

  for (const enemy of ecs.enemyTable.values()) {
    if (enemy.status !== "alive") {
      continue;
    }
    const intent = enemyIntents.get(enemy.id) ?? { throttle: 0, turn: 0, fireSide: null };
    moveShip(enemy, intent.throttle, intent.turn, dt, ENEMY_PROFILES[enemy.archetype].movement);
    keepShipInBoundsHard(enemy, worldState.boundsRadius);
  }

  // 5) storm effects
  applyStormPenalty(worldState, worldState.player, dt);
  for (const enemy of ecs.enemyTable.values()) {
    applyStormPenalty(worldState, enemy, dt);
  }

  // 6) combat fire
  if (worldState.player.status === "alive") {
    if (inputState.fireLeft) {
      tryFire(worldState.player, "left", worldState, ecs);
    }
    if (inputState.fireRight) {
      tryFire(worldState.player, "right", worldState, ecs);
    }
    if (inputState.repair) {
      tryRepair(worldState);
    }
  }

  for (const enemy of ecs.enemyTable.values()) {
    if (enemy.status !== "alive") {
      continue;
    }
    const intent = enemyIntents.get(enemy.id);
    if (enemy.aiState === "fire" && intent?.fireSide) {
      const fired = tryFire(enemy, intent.fireSide, worldState, ecs, enemy);
      if (fired) {
        setEnemyState(enemy, "line_up_broadside");
      }
    }
  }

  // 7) projectile motion/hits
  projectileMotionSystem(worldState, ecs, dt);

  // 8) sinking/respawn
  updatePlayerRespawnSystem(worldState, dt);
  updateEnemySinkingSystem(ecs, dt);

  // 9) loot lifecycle/pickup
  updateLootPhysicsSystem(ecs, dt);
  let interactionConsumed = false;
  if (interactRequested) {
    interactionConsumed = collectLootSystem(worldState, ecs);
    if (!interactionConsumed) {
      interactionConsumed = tryCollectTreasureObjective(worldState);
    }
  }

  // 10) port/menu/upgrade
  updatePortRange(worldState);
  if (interactRequested && !interactionConsumed && worldState.port.playerInRange) {
    togglePortMenu(worldState, true);
  }

  if (!worldState.treasureObjective.active && worldState.treasureObjective.queuedMaps > 0) {
    activateTreasureObjective(worldState, true);
  }

  worldState.spawnDirector.timer -= dt;
  spawnEnemyIfNeeded(worldState, ecs);

  // 11) cleanup/projection
  cleanupEcsTables(ecs);
  updateCombatIntensity(worldState, ecs, dt);
  syncWorldViewFromEcs(worldState, ecs);
}
