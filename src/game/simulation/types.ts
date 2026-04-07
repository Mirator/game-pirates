export type ShipOwner = "player" | "enemy";
export type CannonSide = "left" | "right";
export type ShipStatus = "alive" | "sinking";
export type ShipDamageState = "healthy" | "damaged" | "critical" | "sunk";
export type EnemyAiState = "patrol" | "detect" | "chase" | "line_up_broadside" | "fire" | "flee";
export type EnemyArchetype = "merchant" | "raider" | "navy";
export type LootKind = "gold" | "repair_material" | "cargo" | "treasure_map";
export type IslandKind = "port" | "treasure" | "hostile" | "scenic";
export type WorldEventKind = "treasure_marker" | "enemy_convoy" | "storm" | "navy_patrol";
export type WaterContactState = "airborne" | "water_entry" | "submerged";
export type CollisionLayer = "world_static" | "ships" | "projectiles" | "pickups_debris" | "vfx";

export interface Vector2State {
  x: number;
  z: number;
}

export interface Vector3State {
  x: number;
  y: number;
  z: number;
}

export interface CannonReloadState {
  left: number;
  right: number;
}

export interface BuoyancyProbeState {
  id: string;
  localOffset: Vector3State;
  weight: number;
}

export interface DragCoefficientsState {
  linearAir: number;
  linearWater: number;
  lateralWater: number;
  angularAir: number;
  angularWater: number;
  rollDamping: number;
  pitchDamping: number;
}

export interface CollisionHullState {
  kind: "compound_hull";
  length: number;
  width: number;
  draft: number;
}

export interface ShipState {
  owner: ShipOwner;
  position: Vector3State;
  heading: number;
  pitch: number;
  roll: number;
  linearVelocity: Vector3State;
  angularVelocity: number;
  pitchVelocity: number;
  rollVelocity: number;
  speed: number;
  drift: number;
  throttle: number;
  turnInput: number;
  hp: number;
  maxHp: number;
  radius: number;
  mass: number;
  centerOfMass: Vector3State;
  buoyancyProbes: BuoyancyProbeState[];
  buoyancyStrength: number;
  buoyancyDamping: number;
  buoyancyLoss: number;
  hull: CollisionHullState;
  drag: DragCoefficientsState;
  thrustForce: number;
  turnTorque: number;
  lowSpeedTurnAssist: number;
  reload: CannonReloadState;
  status: ShipStatus;
  damageState: ShipDamageState;
  sinkTimer: number;
  repairCooldown: number;
  collisionLayer: "ships";
  waterState: WaterContactState;
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
  position: Vector3State;
  velocity: Vector3State;
  lifetime: number;
  active: boolean;
  mass: number;
  gravityScale: number;
  dragAir: number;
  dragWater: number;
  collisionRadius: number;
  impactImpulse: number;
  terminateOnWaterImpact: boolean;
  waterState: WaterContactState;
  collisionLayer: "projectiles";
}

export interface LootState {
  id: number;
  kind: LootKind;
  amount: number;
  position: Vector3State;
  velocity: Vector3State;
  yaw: number;
  angularVelocity: number;
  mass: number;
  buoyancyMultiplier: number;
  waterDrag: number;
  angularDamping: number;
  floats: boolean;
  waterState: WaterContactState;
  lifetime: number;
  pickupRadius: number;
  active: boolean;
  collisionLayer: "pickups_debris";
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

export interface PhysicsGlobalsState {
  tickRateHz: 60 | 30;
  gravity: number;
  waterDensityMultiplier: number;
  globalDragMultiplier: number;
  seaLevel: number;
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
  physics: PhysicsGlobalsState;
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
