import {
  LOOT_ANGULAR_DAMPING,
  LOOT_BUOYANCY_MULTIPLIER_HEAVY,
  LOOT_BUOYANCY_MULTIPLIER_LIGHT,
  LOOT_FLOAT_MASS_HEAVY,
  LOOT_FLOAT_MASS_LIGHT,
  LOOT_LIFETIME,
  LOOT_PICKUP_RADIUS,
  LOOT_WATER_DRAG
} from "../../constants";
import type { EnemyState, LootKind, LootState } from "../../types";
import { DEFAULT_WATER_SURFACE_TUNING, DEFAULT_WATER_SURFACE_WAVES } from "../../../physics/waterProfile";
import { sampleWaterHeight } from "../../../physics/waterSurface";
import { distanceSquared, normalizeAngle } from "../math";
import type { EcsState, WorldWithEcs } from "../types";

interface EnemyLootProfile {
  lootGoldBase: number;
  lootMaterialBase: number;
  lootCargoBase: number;
}

function seaHeight(worldState: WorldWithEcs, x: number, z: number): number {
  return (
    worldState.physics.seaLevel +
    sampleWaterHeight(DEFAULT_WATER_SURFACE_WAVES, { x, z }, worldState.time, DEFAULT_WATER_SURFACE_TUNING)
  );
}

function maybeLoot(
  worldState: WorldWithEcs,
  ecs: EcsState,
  enemy: EnemyState,
  kind: LootKind,
  amount: number,
  angleOffset: number,
  speed: number
): void {
  if (amount <= 0) return;
  const angle = enemy.id * 0.71 + angleOffset;
  const heavy = kind === "cargo";
  const loot: LootState = {
    id: worldState.nextLootId++,
    kind,
    amount,
    position: {
      x: enemy.position.x + Math.cos(angle) * 1.8,
      y: enemy.position.y + 1,
      z: enemy.position.z + Math.sin(angle) * 1.8
    },
    velocity: {
      x: Math.cos(angle) * speed + enemy.linearVelocity.x * 0.2,
      y: 1.7,
      z: Math.sin(angle) * speed + enemy.linearVelocity.z * 0.2
    },
    yaw: enemy.heading,
    angularVelocity: (enemy.id % 2 === 0 ? 1 : -1) * 0.75,
    mass: heavy ? LOOT_FLOAT_MASS_HEAVY : LOOT_FLOAT_MASS_LIGHT,
    buoyancyMultiplier: heavy ? LOOT_BUOYANCY_MULTIPLIER_HEAVY : LOOT_BUOYANCY_MULTIPLIER_LIGHT,
    waterDrag: LOOT_WATER_DRAG,
    angularDamping: LOOT_ANGULAR_DAMPING,
    floats: true,
    waterState: "airborne",
    lifetime: LOOT_LIFETIME,
    pickupRadius: LOOT_PICKUP_RADIUS,
    active: true,
    collisionLayer: "pickups_debris"
  };
  ecs.lootTable.set(loot.id, loot);
}

export function spawnLoot(worldState: WorldWithEcs, ecs: EcsState, enemy: EnemyState, profile: EnemyLootProfile): void {
  maybeLoot(worldState, ecs, enemy, "gold", profile.lootGoldBase + (enemy.id % 4) * 5, 0.2, 2.3);
  maybeLoot(worldState, ecs, enemy, "repair_material", profile.lootMaterialBase + (enemy.id % 2), -0.32, 1.5);
  maybeLoot(worldState, ecs, enemy, "cargo", profile.lootCargoBase + (enemy.id % 3), 0.92, 1.8);
}

export function updateLootPhysics(worldState: WorldWithEcs, ecs: EcsState, dt: number): void {
  for (const loot of ecs.lootTable.values()) {
    if (!loot.active) continue;
    const waterHeight = seaHeight(worldState, loot.position.x, loot.position.z);
    let forceY = worldState.physics.gravity * loot.mass;
    const inWater = loot.position.y <= waterHeight + 0.05;
    if (inWater && loot.floats) {
      const submergedDepth = waterHeight - loot.position.y;
      if (submergedDepth > 0) forceY += submergedDepth * loot.mass * 9.5 * loot.buoyancyMultiplier;
      loot.waterState = submergedDepth > 0.02 ? "submerged" : "water_entry";
    } else {
      loot.waterState = "airborne";
    }
    const damp = Math.exp(-(inWater ? loot.waterDrag : 0.32) * dt);
    loot.velocity.y += (forceY / Math.max(1, loot.mass)) * dt;
    loot.velocity.x *= damp;
    loot.velocity.y *= damp;
    loot.velocity.z *= damp;
    loot.position.x += loot.velocity.x * dt;
    loot.position.y += loot.velocity.y * dt;
    loot.position.z += loot.velocity.z * dt;
    loot.angularVelocity *= Math.exp(-loot.angularDamping * dt);
    loot.yaw = normalizeAngle(loot.yaw + loot.angularVelocity * dt);
    loot.lifetime -= dt;
    if (loot.lifetime <= 0) loot.active = false;
  }
}

export function collectLoot(worldState: WorldWithEcs, ecs: EcsState): boolean {
  let collected = false;
  for (const loot of ecs.lootTable.values()) {
    if (!loot.active) continue;
    const range = loot.pickupRadius + worldState.player.radius * 0.75;
    if (
      distanceSquared(worldState.player.position.x, worldState.player.position.z, loot.position.x, loot.position.z) >
      range ** 2
    ) {
      continue;
    }
    loot.active = false;
    collected = true;
    worldState.flags.lootCollected += 1;
    if (loot.kind === "gold") {
      worldState.wallet.gold += loot.amount;
      worldState.flags.goldCollected += loot.amount;
    } else if (loot.kind === "repair_material") {
      worldState.wallet.repairMaterials += loot.amount;
    } else if (loot.kind === "cargo") {
      worldState.wallet.cargo += loot.amount;
    }
    worldState.events.push({ type: "loot_pickup", kind: loot.kind, amount: loot.amount });
  }
  return collected;
}
