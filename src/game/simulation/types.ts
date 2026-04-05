export type ShipOwner = "player" | "enemy";
export type CannonSide = "left" | "right";
export type ShipStatus = "alive" | "sinking";
export type EnemyAiState = "patrol" | "chase" | "broadside";
export type EnemyArchetype = "raider";
export type LootKind = "gold" | "repair_material";

export interface Vector2State {
  x: number;
  z: number;
}

export interface CannonReloadState {
  left: number;
  right: number;
}

export interface ShipState {
  owner: ShipOwner;
  position: Vector2State;
  heading: number;
  speed: number;
  drift: number;
  throttle: number;
  hp: number;
  maxHp: number;
  radius: number;
  reload: CannonReloadState;
  status: ShipStatus;
  sinkTimer: number;
  repairCooldown: number;
}

export interface EnemyState extends ShipState {
  id: number;
  archetype: EnemyArchetype;
  aiState: EnemyAiState;
  patrolAngle: number;
  lootDropped: boolean;
}

export interface ProjectileState {
  id: number;
  owner: ShipOwner;
  position: Vector2State;
  velocity: Vector2State;
  lifetime: number;
  active: boolean;
}

export interface LootState {
  id: number;
  kind: LootKind;
  amount: number;
  position: Vector2State;
  driftVelocity: Vector2State;
  lifetime: number;
  pickupRadius: number;
  active: boolean;
}

export interface WalletState {
  gold: number;
  repairMaterials: number;
}

export interface UpgradeState {
  hullLevel: number;
  nextCost: number;
}

export interface PortState {
  position: Vector2State;
  radius: number;
  promptRadius: number;
  safeRadius: number;
  menuOpen: boolean;
  playerInRange: boolean;
  playerNearPort: boolean;
}

export interface SpawnDirectorState {
  maxActive: number;
  initialSpawnDelay: number;
  staggerDelay: number;
  timer: number;
}

export interface PhaseFlags {
  playerRespawns: number;
  enemiesSunk: number;
  lootCollected: number;
  goldCollected: number;
}

export type SimulationEvent =
  | { type: "cannon_fire"; owner: ShipOwner }
  | { type: "ship_hit"; target: ShipOwner }
  | { type: "ship_sunk"; owner: ShipOwner }
  | { type: "loot_pickup"; kind: LootKind; amount: number }
  | { type: "dock_open" }
  | { type: "dock_close" }
  | { type: "repair_used" }
  | { type: "upgrade_purchased"; level: number };

export interface WorldState {
  time: number;
  phase: "running";
  flags: PhaseFlags;
  boundsRadius: number;
  nextProjectileId: number;
  nextEnemyId: number;
  nextLootId: number;
  player: ShipState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  loot: LootState[];
  wallet: WalletState;
  upgrade: UpgradeState;
  port: PortState;
  spawnDirector: SpawnDirectorState;
  events: SimulationEvent[];
}

export interface InputState {
  throttle: number;
  turn: number;
  fireLeft: boolean;
  fireRight: boolean;
  interact: boolean;
  repair: boolean;
}
