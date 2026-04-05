import {
  CANNON_DAMAGE,
  CANNON_FIRING_CONE_DOT,
  CANNON_LIFETIME,
  CANNON_RELOAD_TIME,
  CANNON_SPEED,
  ENEMY_ACCELERATION,
  ENEMY_BROADSIDE_RANGE,
  ENEMY_DETECTION_RANGE,
  ENEMY_DRAG,
  ENEMY_DRIFT_DAMPING,
  ENEMY_DRIFT_GAIN,
  ENEMY_MAX_FORWARD_SPEED,
  ENEMY_MAX_REVERSE_SPEED,
  ENEMY_SPAWN_POINTS,
  ENEMY_TURN_RATE,
  LOOT_LIFETIME,
  LOOT_PICKUP_RADIUS,
  PLAYER_ACCELERATION,
  PLAYER_BRAKE_ACCELERATION,
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
  UPGRADE_HULL_COST_STEP,
  UPGRADE_HULL_HP_BONUS
} from "./constants";
import type {
  CannonSide,
  EnemyState,
  InputState,
  LootState,
  ShipOwner,
  ShipState,
  SimulationEvent,
  WorldState
} from "./types";

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

const ENEMY_TUNING: MovementTuning = {
  acceleration: ENEMY_ACCELERATION,
  maxForwardSpeed: ENEMY_MAX_FORWARD_SPEED,
  maxReverseSpeed: ENEMY_MAX_REVERSE_SPEED,
  drag: ENEMY_DRAG,
  turnRate: ENEMY_TURN_RATE,
  driftGain: ENEMY_DRIFT_GAIN,
  driftDamping: ENEMY_DRIFT_DAMPING
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(angle: number): number {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

function calculateForward(heading: number): { x: number; z: number } {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

function calculateLeft(heading: number): { x: number; z: number } {
  const forward = calculateForward(heading);
  return { x: -forward.z, z: forward.x };
}

function distanceSquared(ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  return dx * dx + dz * dz;
}

function emitEvent(worldState: WorldState, event: SimulationEvent): void {
  worldState.events.push(event);
}

function togglePortMenu(worldState: WorldState, open: boolean): void {
  if (worldState.port.menuOpen === open) {
    return;
  }

  worldState.port.menuOpen = open;
  emitEvent(worldState, { type: open ? "dock_open" : "dock_close" });
}

function updatePortRange(worldState: WorldState): void {
  const player = worldState.player;
  const port = worldState.port;
  const rangeSq = port.radius * port.radius;
  port.playerInRange =
    distanceSquared(player.position.x, player.position.z, port.position.x, port.position.z) <= rangeSq;

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

function keepShipInBounds(ship: ShipState, boundsRadius: number): void {
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

function createEnemy(worldState: WorldState, spawn: { x: number; z: number; heading: number }): EnemyState {
  const id = worldState.nextEnemyId++;
  return {
    id,
    archetype: "raider",
    owner: "enemy",
    position: { x: spawn.x, z: spawn.z },
    heading: spawn.heading,
    speed: 0,
    drift: 0,
    throttle: 0,
    hp: 100,
    maxHp: 100,
    radius: 2.1,
    reload: { left: 0, right: 0 },
    status: "alive",
    sinkTimer: 0,
    aiState: "patrol",
    patrolAngle: (id % 8) * 0.3,
    lootDropped: false,
    repairCooldown: 0
  };
}

function chooseSpawnPoint(worldState: WorldState): { x: number; z: number; heading: number } {
  let bestPoint = ENEMY_SPAWN_POINTS[0];
  let bestScore = -Infinity;

  for (let i = 0; i < ENEMY_SPAWN_POINTS.length; i += 1) {
    const candidate = ENEMY_SPAWN_POINTS[i];
    if (!candidate) {
      continue;
    }

    const distToPlayer = Math.sqrt(
      distanceSquared(candidate.x, candidate.z, worldState.player.position.x, worldState.player.position.z)
    );
    const distToPort = Math.sqrt(
      distanceSquared(candidate.x, candidate.z, worldState.port.position.x, worldState.port.position.z)
    );

    if (distToPort < worldState.port.safeRadius) {
      continue;
    }

    const churnBias = ((worldState.nextEnemyId + i) % ENEMY_SPAWN_POINTS.length) * 0.01;
    const score = distToPlayer + churnBias;
    if (score > bestScore) {
      bestScore = score;
      bestPoint = candidate;
    }
  }

  return bestPoint ?? ENEMY_SPAWN_POINTS[0]!;
}

function spawnEnemyIfNeeded(worldState: WorldState): void {
  while (worldState.enemies.length < worldState.spawnDirector.maxActive && worldState.spawnDirector.timer <= 0) {
    const spawn = chooseSpawnPoint(worldState);
    worldState.enemies.push(createEnemy(worldState, spawn));
    worldState.spawnDirector.timer += worldState.spawnDirector.staggerDelay;
  }
}

function addProjectile(worldState: WorldState, ship: ShipState, side: CannonSide): void {
  const forward = calculateForward(ship.heading);
  const leftVector = calculateLeft(ship.heading);
  const rightVector = { x: -leftVector.x, z: -leftVector.z };
  const sideVector = side === "left" ? rightVector : leftVector;

  const directionX = sideVector.x * 0.96 + forward.x * 0.14;
  const directionZ = sideVector.z * 0.96 + forward.z * 0.14;
  const length = Math.hypot(directionX, directionZ);
  if (length < 0.0001) {
    return;
  }

  worldState.projectiles.push({
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
  });
}

function tryFire(ship: ShipState, side: CannonSide, worldState: WorldState): void {
  if (ship.status !== "alive") {
    return;
  }
  if (ship.reload[side] > 0) {
    return;
  }

  ship.reload[side] = CANNON_RELOAD_TIME;
  addProjectile(worldState, ship, side);
  emitEvent(worldState, { type: "cannon_fire", owner: ship.owner });
}

function spawnLoot(worldState: WorldState, baseX: number, baseZ: number, enemyId: number): void {
  const goldAmount = 28 + (enemyId % 3) * 6;
  const materialAmount = 1 + (enemyId % 2);
  const bundles: Array<{ kind: LootState["kind"]; amount: number; angleOffset: number; speed: number }> = [
    { kind: "gold", amount: goldAmount, angleOffset: 0.25, speed: 2.3 },
    { kind: "repair_material", amount: materialAmount, angleOffset: -0.28, speed: 1.6 }
  ];

  for (const bundle of bundles) {
    const angle = enemyId * 0.71 + bundle.angleOffset;
    worldState.loot.push({
      id: worldState.nextLootId++,
      kind: bundle.kind,
      amount: bundle.amount,
      position: {
        x: baseX + Math.cos(angle) * 1.8,
        z: baseZ + Math.sin(angle) * 1.8
      },
      driftVelocity: {
        x: Math.cos(angle) * bundle.speed,
        z: Math.sin(angle) * bundle.speed
      },
      lifetime: LOOT_LIFETIME,
      pickupRadius: LOOT_PICKUP_RADIUS,
      active: true
    });
  }
}

function beginShipSinking(worldState: WorldState, ship: ShipState): void {
  if (ship.status !== "alive") {
    return;
  }

  ship.status = "sinking";
  ship.sinkTimer = SINK_DURATION;
  ship.speed = 0;
  ship.drift = 0;
  emitEvent(worldState, { type: "ship_sunk", owner: ship.owner });
}

function beginEnemySinking(worldState: WorldState, enemy: EnemyState): void {
  if (enemy.status !== "alive") {
    return;
  }

  beginShipSinking(worldState, enemy);
  if (!enemy.lootDropped) {
    spawnLoot(worldState, enemy.position.x, enemy.position.z, enemy.id);
    enemy.lootDropped = true;
    worldState.flags.enemiesSunk += 1;
  }
}

function updatePlayerSinking(worldState: WorldState, dt: number): void {
  const player = worldState.player;
  if (player.status !== "sinking") {
    return;
  }

  player.sinkTimer = Math.max(0, player.sinkTimer - dt);
  player.speed *= 0.88;
  player.drift *= 0.86;

  if (player.sinkTimer > 0) {
    return;
  }

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

function updateEnemySinking(enemy: EnemyState, dt: number): boolean {
  if (enemy.status !== "sinking") {
    return false;
  }

  enemy.sinkTimer = Math.max(0, enemy.sinkTimer - dt);
  enemy.speed *= 0.88;
  enemy.drift *= 0.86;
  return enemy.sinkTimer <= 0;
}

function inflictDamageToPlayer(worldState: WorldState, damage: number): void {
  const player = worldState.player;
  if (player.status !== "alive") {
    return;
  }
  player.hp = Math.max(0, player.hp - damage);
  emitEvent(worldState, { type: "ship_hit", target: "player" });
  if (player.hp <= 0) {
    beginShipSinking(worldState, player);
  }
}

function inflictDamageToEnemy(worldState: WorldState, enemy: EnemyState, damage: number): void {
  if (enemy.status !== "alive") {
    return;
  }
  enemy.hp = Math.max(0, enemy.hp - damage);
  emitEvent(worldState, { type: "ship_hit", target: "enemy" });
  if (enemy.hp <= 0) {
    beginEnemySinking(worldState, enemy);
  }
}

function updateProjectiles(worldState: WorldState, dt: number): void {
  for (const projectile of worldState.projectiles) {
    if (!projectile.active) {
      continue;
    }

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
      if (player.status !== "alive") {
        continue;
      }
      if (distanceSquared(projectile.position.x, projectile.position.z, player.position.x, player.position.z) <= player.radius ** 2) {
        projectile.active = false;
        inflictDamageToPlayer(worldState, CANNON_DAMAGE);
      }
      continue;
    }

    for (const enemy of worldState.enemies) {
      if (enemy.status !== "alive") {
        continue;
      }
      if (distanceSquared(projectile.position.x, projectile.position.z, enemy.position.x, enemy.position.z) <= enemy.radius ** 2) {
        projectile.active = false;
        inflictDamageToEnemy(worldState, enemy, CANNON_DAMAGE);
        break;
      }
    }
  }

  worldState.projectiles = worldState.projectiles.filter((projectile) => projectile.active);
}

function steeringTowardHeading(shipHeading: number, targetHeading: number): number {
  const delta = normalizeAngle(targetHeading - shipHeading);
  return clamp(delta / 0.65, -1, 1);
}

function updateEnemyAi(worldState: WorldState, enemy: EnemyState, dt: number): void {
  const player = worldState.player;
  if (enemy.status !== "alive") {
    return;
  }

  const dx = player.position.x - enemy.position.x;
  const dz = player.position.z - enemy.position.z;
  const distance = Math.hypot(dx, dz);

  if (player.status !== "alive" || distance > ENEMY_DETECTION_RANGE) {
    enemy.aiState = "patrol";
  } else if (distance > ENEMY_BROADSIDE_RANGE * 1.2) {
    enemy.aiState = "chase";
  } else {
    enemy.aiState = "broadside";
  }

  let throttle = 0;
  let turn = 0;

  if (enemy.aiState === "patrol") {
    enemy.patrolAngle += dt * 0.35;
    const patrolRadius = 36 + (enemy.id % 3) * 5;
    const targetX = Math.cos(enemy.patrolAngle) * patrolRadius;
    const targetZ = Math.sin(enemy.patrolAngle) * patrolRadius;
    const targetHeading = Math.atan2(targetX - enemy.position.x, targetZ - enemy.position.z);
    throttle = 0.56;
    turn = steeringTowardHeading(enemy.heading, targetHeading);
  } else if (enemy.aiState === "chase") {
    const targetHeading = Math.atan2(dx, dz);
    throttle = 0.9;
    turn = steeringTowardHeading(enemy.heading, targetHeading);
  } else {
    const angleToPlayer = Math.atan2(dx, dz);
    const broadsideLeft = normalizeAngle(angleToPlayer - Math.PI * 0.5);
    const broadsideRight = normalizeAngle(angleToPlayer + Math.PI * 0.5);

    const leftDelta = Math.abs(normalizeAngle(broadsideLeft - enemy.heading));
    const rightDelta = Math.abs(normalizeAngle(broadsideRight - enemy.heading));
    const targetHeading = leftDelta < rightDelta ? broadsideLeft : broadsideRight;

    if (distance > ENEMY_BROADSIDE_RANGE * 1.1) {
      throttle = 0.5;
    } else if (distance < ENEMY_BROADSIDE_RANGE * 0.72) {
      throttle = -0.3;
    } else {
      throttle = 0.08;
    }

    turn = steeringTowardHeading(enemy.heading, targetHeading);
  }

  moveShip(enemy, throttle, turn, dt, ENEMY_TUNING);
  keepShipInBounds(enemy, worldState.boundsRadius);

  if (player.status !== "alive") {
    return;
  }

  const toPlayerX = player.position.x - enemy.position.x;
  const toPlayerZ = player.position.z - enemy.position.z;
  const toPlayerLength = Math.hypot(toPlayerX, toPlayerZ);
  if (toPlayerLength < 0.0001) {
    return;
  }

  const normalizedToPlayerX = toPlayerX / toPlayerLength;
  const normalizedToPlayerZ = toPlayerZ / toPlayerLength;
  const forward = calculateForward(enemy.heading);
  const dot = forward.x * normalizedToPlayerX + forward.z * normalizedToPlayerZ;
  const cross = forward.x * normalizedToPlayerZ - forward.z * normalizedToPlayerX;

  const canFire =
    enemy.aiState !== "patrol" &&
    Math.abs(dot) <= CANNON_FIRING_CONE_DOT &&
    toPlayerLength <= ENEMY_BROADSIDE_RANGE * 1.35;

  if (canFire) {
    tryFire(enemy, cross > 0 ? "right" : "left", worldState);
  }
}

function updateEnemies(worldState: WorldState, dt: number): void {
  const survivors: EnemyState[] = [];
  for (const enemy of worldState.enemies) {
    decreaseReloadTimers(enemy, dt);

    if (updateEnemySinking(enemy, dt)) {
      continue;
    }

    updateEnemyAi(worldState, enemy, dt);
    survivors.push(enemy);
  }

  worldState.enemies = survivors;
}

function updateLoot(worldState: WorldState, dt: number): void {
  for (const loot of worldState.loot) {
    if (!loot.active) {
      continue;
    }

    loot.position.x += loot.driftVelocity.x * dt;
    loot.position.z += loot.driftVelocity.z * dt;
    loot.driftVelocity.x *= Math.exp(-1.7 * dt);
    loot.driftVelocity.z *= Math.exp(-1.7 * dt);
    loot.lifetime -= dt;
    if (loot.lifetime <= 0) {
      loot.active = false;
    }
  }

  worldState.loot = worldState.loot.filter((loot) => loot.active);
}

function tryCollectNearbyLoot(worldState: WorldState): boolean {
  const player = worldState.player;
  let collected = false;

  for (const loot of worldState.loot) {
    if (!loot.active) {
      continue;
    }
    const pickupRange = loot.pickupRadius + player.radius * 0.75;
    if (distanceSquared(player.position.x, player.position.z, loot.position.x, loot.position.z) > pickupRange * pickupRange) {
      continue;
    }

    loot.active = false;
    collected = true;
    worldState.flags.lootCollected += 1;

    if (loot.kind === "gold") {
      worldState.wallet.gold += loot.amount;
      worldState.flags.goldCollected += loot.amount;
    } else {
      worldState.wallet.repairMaterials += loot.amount;
    }

    emitEvent(worldState, { type: "loot_pickup", kind: loot.kind, amount: loot.amount });
  }

  if (collected) {
    worldState.loot = worldState.loot.filter((loot) => loot.active);
  }

  return collected;
}

function tryRepair(worldState: WorldState): void {
  const player = worldState.player;
  if (player.status !== "alive") {
    return;
  }
  if (player.repairCooldown > 0) {
    return;
  }
  if (player.hp >= player.maxHp) {
    return;
  }
  if (worldState.wallet.repairMaterials <= 0) {
    return;
  }

  worldState.wallet.repairMaterials -= 1;
  player.hp = Math.min(player.maxHp, player.hp + PLAYER_REPAIR_AMOUNT);
  player.repairCooldown = PLAYER_REPAIR_COOLDOWN;
  emitEvent(worldState, { type: "repair_used" });
}

function handleInteract(worldState: WorldState): void {
  if (tryCollectNearbyLoot(worldState)) {
    return;
  }

  updatePortRange(worldState);
  if (!worldState.port.playerInRange) {
    return;
  }

  togglePortMenu(worldState, !worldState.port.menuOpen);
}

export function closePortMenu(worldState: WorldState): void {
  togglePortMenu(worldState, false);
}

export function tryPurchaseHullUpgrade(worldState: WorldState): boolean {
  if (!worldState.port.menuOpen) {
    return false;
  }
  if (worldState.wallet.gold < worldState.upgrade.nextCost) {
    return false;
  }

  worldState.wallet.gold -= worldState.upgrade.nextCost;
  worldState.upgrade.hullLevel += 1;
  worldState.upgrade.nextCost += UPGRADE_HULL_COST_STEP;

  worldState.player.maxHp += UPGRADE_HULL_HP_BONUS;
  worldState.player.hp = Math.min(worldState.player.maxHp, worldState.player.hp + UPGRADE_HULL_HP_BONUS);

  emitEvent(worldState, { type: "upgrade_purchased", level: worldState.upgrade.hullLevel });
  return true;
}

export function drainSimulationEvents(worldState: WorldState): SimulationEvent[] {
  const drained = [...worldState.events];
  worldState.events.length = 0;
  return drained;
}

export function updateSimulation(worldState: WorldState, inputState: InputState, dt: number): void {
  if (dt <= 0) {
    return;
  }

  updatePortRange(worldState);

  if (inputState.interact) {
    handleInteract(worldState);
  }

  if (worldState.port.menuOpen) {
    return;
  }

  worldState.time += dt;

  decreaseReloadTimers(worldState.player, dt);
  updatePlayerSinking(worldState, dt);

  if (worldState.player.status === "alive") {
    if (inputState.repair) {
      tryRepair(worldState);
    }

    moveShip(worldState.player, inputState.throttle, inputState.turn, dt, PLAYER_TUNING);
    keepShipInBounds(worldState.player, worldState.boundsRadius);

    if (inputState.fireLeft) {
      tryFire(worldState.player, "left", worldState);
    }
    if (inputState.fireRight) {
      tryFire(worldState.player, "right", worldState);
    }
  }

  worldState.spawnDirector.timer -= dt;
  spawnEnemyIfNeeded(worldState);

  updateEnemies(worldState, dt);
  updateProjectiles(worldState, dt);
  updateLoot(worldState, dt);
  updatePortRange(worldState);
}
