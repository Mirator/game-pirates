import {
  CANNON_COLLISION_RADIUS,
  CANNON_DAMAGE,
  CANNON_DRAG_AIR,
  CANNON_DRAG_WATER,
  CANNON_FIRING_CONE_DOT,
  CANNON_GRAVITY_SCALE,
  CANNON_IMPACT_IMPULSE,
  CANNON_INHERIT_SHIP_VELOCITY,
  CANNON_LIFETIME,
  CANNON_MASS,
  CANNON_MUZZLE_VELOCITY,
  CANNON_RECOIL_IMPULSE,
  CANNON_RECOIL_ROLL,
  CANNON_RECOIL_YAW,
  CANNON_RELOAD_TIME,
  CANNON_TERMINATE_ON_WATER_IMPACT,
  CANNON_VERTICAL_MUZZLE_VELOCITY,
  PLAYER_COLLISION_DAMAGE_MULTIPLIER,
  PLAYER_COLLISION_DAMAGE_THRESHOLD,
  PROJECTILE_HIT_ANGULAR_IMPULSE
} from "../../constants";
import type { CannonSide, EnemyState, ProjectileState, ShipState, SimulationEvent } from "../../types";
import { classifySideFromLeftDot, getBroadsideVector, sideDotAgainstShipLeft } from "../../sideMath";
import { DEFAULT_WATER_SURFACE_TUNING, DEFAULT_WATER_SURFACE_WAVES } from "../../../physics/waterProfile";
import { sampleWaterHeight } from "../../../physics/waterSurface";
import { clamp, distanceSquared } from "../math";
import type { EcsState, WorldWithEcs } from "../types";

const PROJ_HEIGHT_HIT = 2.6;

function seaHeight(worldState: WorldWithEcs, x: number, z: number): number {
  return (
    worldState.physics.seaLevel +
    sampleWaterHeight(DEFAULT_WATER_SURFACE_WAVES, { x, z }, worldState.time, DEFAULT_WATER_SURFACE_TUNING)
  );
}

export function decReload(ship: ShipState, dt: number): void {
  ship.reload.left = Math.max(0, ship.reload.left - dt);
  ship.reload.right = Math.max(0, ship.reload.right - dt);
  ship.repairCooldown = Math.max(0, ship.repairCooldown - dt);
}

function addProjectile(worldState: WorldWithEcs, ecs: EcsState, ship: ShipState, side: CannonSide): void {
  const broadsideVector = getBroadsideVector(ship.heading, side);
  const sideSign = side === "left" ? -1 : 1;
  const muzzleOffsetX = broadsideVector.x * ship.radius * 0.9 + sideSign * 0.4;
  const muzzleOffsetZ = broadsideVector.z * ship.radius * 0.9 + sideSign * 0.4;
  const sourceX = ship.position.x + muzzleOffsetX;
  const sourceZ = ship.position.z + muzzleOffsetZ;
  const leftDot = sideDotAgainstShipLeft(ship.heading, broadsideVector.x, broadsideVector.z);
  const inferredSide = classifySideFromLeftDot(leftDot);
  const sideAlignment =
    inferredSide === side ? 1 : Math.max(CANNON_FIRING_CONE_DOT, Math.abs(leftDot) / Math.max(1e-5, Math.abs(leftDot)));
  const normalizedX = broadsideVector.x / Math.max(1e-5, Math.hypot(broadsideVector.x, broadsideVector.z));
  const normalizedZ = broadsideVector.z / Math.max(1e-5, Math.hypot(broadsideVector.x, broadsideVector.z));
  const shotVelocity = CANNON_MUZZLE_VELOCITY * sideAlignment;
  const inheritedVelocityX = ship.linearVelocity.x * CANNON_INHERIT_SHIP_VELOCITY;
  const inheritedVelocityZ = ship.linearVelocity.z * CANNON_INHERIT_SHIP_VELOCITY;

  const projectile: ProjectileState = {
    id: worldState.nextProjectileId++,
    owner: ship.owner,
    position: {
      x: sourceX,
      y: ship.position.y + 0.9,
      z: sourceZ
    },
    velocity: {
      x: normalizedX * shotVelocity + inheritedVelocityX,
      y: CANNON_VERTICAL_MUZZLE_VELOCITY,
      z: normalizedZ * shotVelocity + inheritedVelocityZ
    },
    lifetime: CANNON_LIFETIME,
    active: true,
    mass: CANNON_MASS,
    gravityScale: CANNON_GRAVITY_SCALE,
    dragAir: CANNON_DRAG_AIR,
    dragWater: CANNON_DRAG_WATER,
    collisionRadius: CANNON_COLLISION_RADIUS,
    impactImpulse: CANNON_IMPACT_IMPULSE,
    terminateOnWaterImpact: CANNON_TERMINATE_ON_WATER_IMPACT,
    waterState: "airborne",
    collisionLayer: "projectiles"
  };
  ecs.projectileTable.set(projectile.id, projectile);
  const invMass = 1 / Math.max(1, ship.mass);
  ship.linearVelocity.x += -(broadsideVector.x * CANNON_RECOIL_IMPULSE + normalizedX * CANNON_RECOIL_IMPULSE * 0.2) * invMass;
  ship.linearVelocity.z += -(broadsideVector.z * CANNON_RECOIL_IMPULSE + normalizedZ * CANNON_RECOIL_IMPULSE * 0.2) * invMass;
  ship.angularVelocity += (side === "left" ? CANNON_RECOIL_YAW : -CANNON_RECOIL_YAW) * invMass;
  ship.rollVelocity += (side === "left" ? CANNON_RECOIL_ROLL : -CANNON_RECOIL_ROLL) * invMass;
}

export interface CombatFireOptions {
  emitEvent: (event: SimulationEvent) => void;
  getEnemyReloadDuration: (enemy: EnemyState) => number;
}

function reloadDuration(ship: ShipState, options: CombatFireOptions, enemy?: EnemyState): number {
  if (ship.owner === "player") {
    return CANNON_RELOAD_TIME;
  }
  const resolvedEnemy = enemy ?? (ship as EnemyState);
  return options.getEnemyReloadDuration(resolvedEnemy);
}

export function tryFire(
  ship: ShipState,
  side: CannonSide,
  worldState: WorldWithEcs,
  ecs: EcsState,
  options: CombatFireOptions,
  enemy?: EnemyState
): boolean {
  if (ship.status !== "alive" || ship.reload[side] > 0) return false;
  ship.reload[side] = reloadDuration(ship, options, enemy);
  addProjectile(worldState, ecs, ship, side);
  options.emitEvent({ type: "cannon_fire", owner: ship.owner });
  return true;
}

export interface CombatDamageOptions {
  onPlayerDamage: (damage: number) => void;
  onEnemyDamage: (enemy: EnemyState, damage: number) => void;
}

export function applyShipCollisionDamage(
  ship: ShipState,
  speed: number,
  options: CombatDamageOptions
): void {
  if (speed <= PLAYER_COLLISION_DAMAGE_THRESHOLD) return;
  const damage = Math.round((speed - PLAYER_COLLISION_DAMAGE_THRESHOLD) * PLAYER_COLLISION_DAMAGE_MULTIPLIER);
  if (damage <= 0) return;
  if (ship.owner === "player") {
    options.onPlayerDamage(damage);
    return;
  }
  options.onEnemyDamage(ship as EnemyState, Math.max(1, Math.round(damage * (1 / PLAYER_COLLISION_DAMAGE_MULTIPLIER))));
}

export function projectileSystem(
  worldState: WorldWithEcs,
  ecs: EcsState,
  dt: number,
  options: CombatDamageOptions
): void {
  for (const projectile of ecs.projectileTable.values()) {
    if (!projectile.active) continue;
    projectile.velocity.y += worldState.physics.gravity * projectile.gravityScale * dt;
    const drag = projectile.waterState === "submerged" ? projectile.dragWater : projectile.dragAir;
    const damp = Math.exp(-drag * dt);
    projectile.velocity.x *= damp;
    projectile.velocity.y *= damp;
    projectile.velocity.z *= damp;
    projectile.position.x += projectile.velocity.x * dt;
    projectile.position.y += projectile.velocity.y * dt;
    projectile.position.z += projectile.velocity.z * dt;
    projectile.lifetime -= dt;
    if (projectile.lifetime <= 0 || projectile.position.x ** 2 + projectile.position.z ** 2 > (worldState.boundsRadius * 1.3) ** 2) {
      projectile.active = false;
      continue;
    }
    const waterHeight = seaHeight(worldState, projectile.position.x, projectile.position.z);
    if (projectile.position.y <= waterHeight) {
      projectile.waterState = "submerged";
      projectile.velocity.x *= 0.42;
      projectile.velocity.y *= 0.42;
      projectile.velocity.z *= 0.42;
      if (projectile.terminateOnWaterImpact) {
        projectile.active = false;
        continue;
      }
    }
    for (const island of worldState.islands) {
      if (distanceSquared(projectile.position.x, projectile.position.z, island.position.x, island.position.z) <= island.radius ** 2) {
        projectile.active = false;
        break;
      }
    }
    if (!projectile.active) continue;
    if (projectile.owner === "enemy") {
      const ship = worldState.player;
      if (
        ship.status === "alive" &&
        distanceSquared(projectile.position.x, projectile.position.z, ship.position.x, ship.position.z) <=
          (ship.radius + projectile.collisionRadius) ** 2 &&
        Math.abs(projectile.position.y - ship.position.y) <= PROJ_HEIGHT_HIT
      ) {
        projectile.active = false;
        const velocityLength = Math.hypot(projectile.velocity.x, projectile.velocity.y, projectile.velocity.z) || 1;
        const impulse = projectile.impactImpulse / Math.max(1, ship.mass);
        ship.linearVelocity.x += (projectile.velocity.x / velocityLength) * impulse;
        ship.linearVelocity.z += (projectile.velocity.z / velocityLength) * impulse;
        options.onPlayerDamage(CANNON_DAMAGE);
      }
      continue;
    }
    for (const enemy of ecs.enemyTable.values()) {
      if (
        enemy.status === "alive" &&
        distanceSquared(projectile.position.x, projectile.position.z, enemy.position.x, enemy.position.z) <=
          (enemy.radius + projectile.collisionRadius) ** 2 &&
        Math.abs(projectile.position.y - enemy.position.y) <= PROJ_HEIGHT_HIT
      ) {
        projectile.active = false;
        const velocityLength = Math.hypot(projectile.velocity.x, projectile.velocity.y, projectile.velocity.z) || 1;
        const impulse = projectile.impactImpulse / Math.max(1, enemy.mass);
        enemy.linearVelocity.x += (projectile.velocity.x / velocityLength) * impulse;
        enemy.linearVelocity.z += (projectile.velocity.z / velocityLength) * impulse;
        const angularKick = clamp(
          ((projectile.velocity.x * projectile.velocity.z > 0 ? 1 : -1) * PROJECTILE_HIT_ANGULAR_IMPULSE) / Math.max(1, enemy.mass),
          -PROJECTILE_HIT_ANGULAR_IMPULSE,
          PROJECTILE_HIT_ANGULAR_IMPULSE
        );
        enemy.angularVelocity += angularKick;
        options.onEnemyDamage(enemy, CANNON_DAMAGE);
        break;
      }
    }
  }
}
