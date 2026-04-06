export type ShipOwner = "player" | "enemy";
export type CannonSide = "left" | "right";
export type ShipStatus = "alive" | "sinking";
export type EnemyAiState = "patrol" | "detect" | "chase" | "line_up_broadside" | "fire" | "flee";
export type EnemyArchetype = "merchant" | "raider" | "navy";
export type LootKind = "gold" | "repair_material" | "cargo" | "treasure_map";
export type IslandKind = "port" | "treasure" | "hostile" | "scenic";
export type WorldEventKind = "treasure_marker" | "enemy_convoy" | "storm" | "navy_patrol";

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
  aiStateTimer: number;
  detectProgress: number;
  pendingFireSide: CannonSide | null;
}

export interface IslandState {
  id: number;
  kind: IslandKind;
  label: string;
  position: Vector2State;
  radius: number;
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
  cargo: number;
  treasureMaps: number;
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

export interface TreasureObjectiveState {
  active: boolean;
  markerPosition: Vector2State;
  targetIslandId: number | null;
  rewardGold: number;
  completedCount: number;
  fromMap: boolean;
  queuedMaps: number;
}

export interface StormState {
  active: boolean;
  center: Vector2State;
  radius: number;
  remaining: number;
  intensity: number;
}

export interface BurstState {
  active: boolean;
  remaining: number;
  cooldown: number;
}

export interface EventDirectorState {
  timer: number;
  interval: number;
  cycleIndex: number;
  activeKind: WorldEventKind | null;
  remaining: number;
  statusText: string;
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
  | { type: "cargo_sold"; amount: number; goldGained: number }
  | { type: "treasure_map_used" }
  | { type: "dock_open" }
  | { type: "dock_close" }
  | { type: "repair_used" }
  | { type: "burst_started" }
  | { type: "burst_ready" }
  | { type: "upgrade_purchased"; level: number }
  | { type: "treasure_collected"; amount: number }
  | { type: "world_event_started"; kind: WorldEventKind };

export interface WorldState {
  time: number;
  phase: "running";
  flags: PhaseFlags;
  boundsRadius: number;
  nextProjectileId: number;
  nextEnemyId: number;
  nextLootId: number;
  player: ShipState;
  islands: IslandState[];
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  loot: LootState[];
  wallet: WalletState;
  upgrade: UpgradeState;
  port: PortState;
  burst: BurstState;
  spawnDirector: SpawnDirectorState;
  treasureObjective: TreasureObjectiveState;
  storm: StormState;
  eventDirector: EventDirectorState;
  combatIntensity: number;
  events: SimulationEvent[];
  __ecs?: unknown;
}

export interface InputState {
  throttle: number;
  turn: number;
  fireLeft: boolean;
  fireRight: boolean;
  interact: boolean;
  repair: boolean;
  burst: boolean;
}
