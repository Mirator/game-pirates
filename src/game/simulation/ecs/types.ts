import type { EnemyState, LootState, ProjectileState, ShipState, WorldState } from "../types";

export interface EcsState {
  playerEntityId: number;
  shipTable: Map<number, ShipState>;
  enemyTable: Map<number, EnemyState>;
  projectileTable: Map<number, ProjectileState>;
  lootTable: Map<number, LootState>;
}

export interface WorldWithEcs extends WorldState {
  __ecs?: EcsState;
}
