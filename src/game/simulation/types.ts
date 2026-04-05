export type ShipOwner = "player" | "enemy";
export type CannonSide = "left" | "right";
export type ShipStatus = "alive" | "sinking";
export type EnemyAiState = "patrol" | "chase" | "broadside";

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
}

export interface EnemyState extends ShipState {
  aiState: EnemyAiState;
  patrolAngle: number;
}

export interface ProjectileState {
  id: number;
  owner: ShipOwner;
  position: Vector2State;
  velocity: Vector2State;
  lifetime: number;
  active: boolean;
}

export interface PhaseFlags {
  playerRespawns: number;
  enemyRespawns: number;
}

export interface WorldState {
  time: number;
  phase: "running";
  flags: PhaseFlags;
  boundsRadius: number;
  nextProjectileId: number;
  player: ShipState;
  enemy: EnemyState;
  projectiles: ProjectileState[];
}

export interface InputState {
  throttle: number;
  turn: number;
  fireLeft: boolean;
  fireRight: boolean;
}
