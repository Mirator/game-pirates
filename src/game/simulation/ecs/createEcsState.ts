import type { EnemyState, WorldState } from "../types";
import type { EcsState, WorldWithEcs } from "./types";

const PLAYER_ENTITY_ID = 0;

function logEntityIdCollision(enemyId: number, playerEntityId: number): void {
  console.error(
    `[ECS] Enemy entity id ${enemyId} collides with reserved player entity id ${playerEntityId}; ignoring enemy entry.`
  );
}

export function createEcsState(worldState: WorldState): EcsState {
  const shipTable = new Map<number, WorldState["player"]>();
  shipTable.set(PLAYER_ENTITY_ID, worldState.player);

  const enemyTable = new Map<number, EnemyState>();
  for (const enemy of worldState.enemies) {
    if (enemy.id === PLAYER_ENTITY_ID) {
      logEntityIdCollision(enemy.id, PLAYER_ENTITY_ID);
      continue;
    }
    enemyTable.set(enemy.id, enemy);
    shipTable.set(enemy.id, enemy);
  }

  const projectileTable = new Map<number, (typeof worldState.projectiles)[number]>();
  for (const projectile of worldState.projectiles) {
    projectileTable.set(projectile.id, projectile);
  }

  const lootTable = new Map<number, (typeof worldState.loot)[number]>();
  for (const loot of worldState.loot) {
    lootTable.set(loot.id, loot);
  }

  return {
    playerEntityId: PLAYER_ENTITY_ID,
    shipTable,
    enemyTable,
    projectileTable,
    lootTable,
    enemyIntentScratch: new Map()
  };
}

export function ensureEcsState(worldState: WorldWithEcs): EcsState {
  if (!worldState.__ecs) {
    worldState.__ecs = createEcsState(worldState);
  }
  return worldState.__ecs;
}

export function syncEcsFromWorldView(worldState: WorldWithEcs, ecs: EcsState): void {
  ecs.shipTable.set(ecs.playerEntityId, worldState.player);

  const worldEnemyIds = new Set<number>();
  for (const enemy of worldState.enemies) {
    if (enemy.id === ecs.playerEntityId) {
      logEntityIdCollision(enemy.id, ecs.playerEntityId);
      continue;
    }
    worldEnemyIds.add(enemy.id);
    ecs.enemyTable.set(enemy.id, enemy);
    ecs.shipTable.set(enemy.id, enemy);
  }

  for (const enemyId of ecs.enemyTable.keys()) {
    if (!worldEnemyIds.has(enemyId)) {
      ecs.enemyTable.delete(enemyId);
      ecs.shipTable.delete(enemyId);
    }
  }

  const worldProjectileIds = new Set<number>();
  for (const projectile of worldState.projectiles) {
    worldProjectileIds.add(projectile.id);
    ecs.projectileTable.set(projectile.id, projectile);
  }
  for (const projectileId of ecs.projectileTable.keys()) {
    if (!worldProjectileIds.has(projectileId)) {
      ecs.projectileTable.delete(projectileId);
    }
  }

  const worldLootIds = new Set<number>();
  for (const loot of worldState.loot) {
    worldLootIds.add(loot.id);
    ecs.lootTable.set(loot.id, loot);
  }
  for (const lootId of ecs.lootTable.keys()) {
    if (!worldLootIds.has(lootId)) {
      ecs.lootTable.delete(lootId);
    }
  }
}

export function syncWorldViewFromEcs(worldState: WorldWithEcs, ecs: EcsState): void {
  worldState.player = ecs.shipTable.get(ecs.playerEntityId) ?? worldState.player;
  worldState.enemies = [...ecs.enemyTable.values()];
  worldState.projectiles = [...ecs.projectileTable.values()];
  worldState.loot = [...ecs.lootTable.values()];
}
