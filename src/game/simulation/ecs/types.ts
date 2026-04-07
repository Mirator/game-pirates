import type { CannonSide, EnemyState, LootState, ProjectileState, ShipState, WorldState } from "../types";

export interface EcsEnemyIntent {
  throttle: number;
  turn: number;
  fireSide: CannonSide | null;
}

export interface EcsState {
  playerEntityId: number;
  shipTable: Map<number, ShipState>;
  enemyTable: Map<number, EnemyState>;
  projectileTable: Map<number, ProjectileState>;
  lootTable: Map<number, LootState>;
  enemyIntentScratch: Map<number, EcsEnemyIntent>;
}

export interface WorldWithEcs extends WorldState {
  __ecs?: EcsState;
}
