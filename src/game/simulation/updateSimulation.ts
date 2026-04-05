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
  ENEMY_RESPAWN,
  ENEMY_TURN_RATE,
  PLAYER_ACCELERATION,
  PLAYER_BRAKE_ACCELERATION,
  PLAYER_DRAG,
  PLAYER_DRIFT_DAMPING,
  PLAYER_DRIFT_GAIN,
  PLAYER_MAX_FORWARD_SPEED,
  PLAYER_MAX_REVERSE_SPEED,
  PLAYER_RESPAWN,
  PLAYER_TURN_RATE,
  SINK_DURATION
} from "./constants";
import type { CannonSide, EnemyState, InputState, ShipState, WorldState } from "./types";

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

function decreaseReloadTimers(ship: ShipState, dt: number): void {
  ship.reload.left = Math.max(0, ship.reload.left - dt);
  ship.reload.right = Math.max(0, ship.reload.right - dt);
}

function beginSinking(ship: ShipState): void {
  if (ship.status !== "alive") {
    return;
  }

  ship.status = "sinking";
  ship.sinkTimer = SINK_DURATION;
  ship.speed = 0;
  ship.drift = 0;
}

function respawnShip(ship: ShipState): void {
  const spawn = ship.owner === "player" ? PLAYER_RESPAWN : ENEMY_RESPAWN;

  ship.position.x = spawn.x;
  ship.position.z = spawn.z;
  ship.heading = spawn.heading;
  ship.speed = 0;
  ship.drift = 0;
  ship.throttle = 0;
  ship.hp = ship.maxHp;
  ship.reload.left = 0;
  ship.reload.right = 0;
  ship.status = "alive";
  ship.sinkTimer = 0;

  if (ship.owner === "enemy") {
    const enemy = ship as EnemyState;
    enemy.aiState = "patrol";
    enemy.patrolAngle = 0;
  }
}

function updateSinking(ship: ShipState, dt: number): boolean {
  if (ship.status !== "sinking") {
    return false;
  }

  ship.sinkTimer = Math.max(0, ship.sinkTimer - dt);
  ship.speed *= 0.88;
  ship.drift *= 0.86;

  if (ship.sinkTimer <= 0) {
    respawnShip(ship);
    return true;
  }

  return false;
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
  const distanceSq = ship.position.x ** 2 + ship.position.z ** 2;
  const radiusSq = boundsRadius ** 2;

  if (distanceSq <= radiusSq) {
    return;
  }

  const distance = Math.sqrt(distanceSq);
  const scale = boundsRadius / distance;
  ship.position.x *= scale;
  ship.position.z *= scale;

  ship.speed *= 0.45;
  ship.drift *= 0.3;
  ship.heading = normalizeAngle(Math.atan2(-ship.position.x, -ship.position.z));
}

function addProjectile(worldState: WorldState, ship: ShipState, side: CannonSide): void {
  const forward = calculateForward(ship.heading);
  const leftVector = calculateLeft(ship.heading);
  const rightVector = { x: -leftVector.x, z: -leftVector.z };
  const sideVector = side === "left" ? rightVector : leftVector;

  const directionX = sideVector.x * 0.96 + forward.x * 0.14;
  const directionZ = sideVector.z * 0.96 + forward.z * 0.14;
  const directionLength = Math.hypot(directionX, directionZ);
  const normalizedX = directionX / directionLength;
  const normalizedZ = directionZ / directionLength;

  worldState.projectiles.push({
    id: worldState.nextProjectileId++,
    owner: ship.owner,
    position: {
      x: ship.position.x + sideVector.x * (ship.radius + 1.4) + forward.x * 0.8,
      z: ship.position.z + sideVector.z * (ship.radius + 1.4) + forward.z * 0.8
    },
    velocity: {
      x: normalizedX * CANNON_SPEED,
      z: normalizedZ * CANNON_SPEED
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
}

function inflictDamage(target: ShipState, damage: number): void {
  target.hp = Math.max(0, target.hp - damage);
  if (target.hp <= 0) {
    beginSinking(target);
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

    const outOfBounds =
      projectile.position.x ** 2 + projectile.position.z ** 2 > (worldState.boundsRadius * 1.25) ** 2;

    if (projectile.lifetime <= 0 || outOfBounds) {
      projectile.active = false;
      continue;
    }

    const target = projectile.owner === "player" ? worldState.enemy : worldState.player;
    if (target.status !== "alive") {
      continue;
    }

    const dx = target.position.x - projectile.position.x;
    const dz = target.position.z - projectile.position.z;

    if (dx ** 2 + dz ** 2 <= target.radius ** 2) {
      projectile.active = false;
      inflictDamage(target, CANNON_DAMAGE);
    }
  }

  worldState.projectiles = worldState.projectiles.filter((projectile) => projectile.active);
}

function steeringTowardHeading(shipHeading: number, targetHeading: number): number {
  const delta = normalizeAngle(targetHeading - shipHeading);
  return clamp(delta / 0.65, -1, 1);
}

function updateEnemyAi(worldState: WorldState, dt: number): void {
  const enemy = worldState.enemy;
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
    const patrolRadius = 30;
    const targetX = Math.cos(enemy.patrolAngle) * patrolRadius;
    const targetZ = Math.sin(enemy.patrolAngle) * patrolRadius;
    const targetHeading = Math.atan2(targetX - enemy.position.x, targetZ - enemy.position.z);

    throttle = 0.58;
    turn = steeringTowardHeading(enemy.heading, targetHeading);
  } else if (enemy.aiState === "chase") {
    const targetHeading = Math.atan2(dx, dz);
    throttle = 0.92;
    turn = steeringTowardHeading(enemy.heading, targetHeading);
  } else {
    const angleToPlayer = Math.atan2(dx, dz);
    const broadsideLeft = normalizeAngle(angleToPlayer - Math.PI * 0.5);
    const broadsideRight = normalizeAngle(angleToPlayer + Math.PI * 0.5);

    const leftDelta = Math.abs(normalizeAngle(broadsideLeft - enemy.heading));
    const rightDelta = Math.abs(normalizeAngle(broadsideRight - enemy.heading));
    const targetHeading = leftDelta < rightDelta ? broadsideLeft : broadsideRight;

    if (distance > ENEMY_BROADSIDE_RANGE * 1.1) {
      throttle = 0.52;
    } else if (distance < ENEMY_BROADSIDE_RANGE * 0.72) {
      throttle = -0.32;
    } else {
      throttle = 0.12;
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

  const canBroadsideFire =
    enemy.aiState !== "patrol" &&
    Math.abs(dot) <= CANNON_FIRING_CONE_DOT &&
    toPlayerLength <= ENEMY_BROADSIDE_RANGE * 1.35;

  if (canBroadsideFire) {
    tryFire(enemy, cross > 0 ? "right" : "left", worldState);
  }
}

export function updateSimulation(worldState: WorldState, inputState: InputState, dt: number): void {
  if (dt <= 0) {
    return;
  }

  worldState.time += dt;

  decreaseReloadTimers(worldState.player, dt);
  decreaseReloadTimers(worldState.enemy, dt);

  const playerRespawned = updateSinking(worldState.player, dt);
  const enemyRespawned = updateSinking(worldState.enemy, dt);
  if (playerRespawned) {
    worldState.flags.playerRespawns += 1;
  }
  if (enemyRespawned) {
    worldState.flags.enemyRespawns += 1;
  }

  moveShip(worldState.player, inputState.throttle, inputState.turn, dt, PLAYER_TUNING);
  keepShipInBounds(worldState.player, worldState.boundsRadius);

  if (inputState.fireLeft) {
    tryFire(worldState.player, "left", worldState);
  }
  if (inputState.fireRight) {
    tryFire(worldState.player, "right", worldState);
  }

  updateEnemyAi(worldState, dt);
  updateProjectiles(worldState, dt);
}
