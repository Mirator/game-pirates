export const FIXED_TIME_STEP = 1 / 60;
export const MAX_FRAME_DT = 1 / 20;

export const WORLD_BOUNDS_RADIUS = 95;

export const PLAYER_RESPAWN = { x: 0, z: -10, heading: 0 };
export const PORT_POSITION = { x: 0, z: 48 };
export const PORT_RADIUS = 15;
export const PORT_PROMPT_RADIUS = 22;
export const PORT_SAFE_RADIUS = 24;
export const ENEMY_SPAWN_POINTS = [
  { x: 45, z: -34, heading: Math.PI * 0.62 },
  { x: -54, z: -32, heading: Math.PI * 1.78 },
  { x: 58, z: 6, heading: Math.PI * 0.95 },
  { x: -60, z: 14, heading: Math.PI * 1.25 },
  { x: 34, z: 66, heading: Math.PI * 1.6 },
  { x: -34, z: 68, heading: Math.PI * 1.35 }
];

export const SHIP_MAX_HP = 100;
export const SHIP_RADIUS = 2.1;
export const SINK_DURATION = 2.8;
export const PLAYER_REPAIR_COOLDOWN = 6;
export const PLAYER_REPAIR_AMOUNT = 30;

export const PLAYER_ACCELERATION = 18;
export const PLAYER_BRAKE_ACCELERATION = 26;
export const PLAYER_MAX_FORWARD_SPEED = 18;
export const PLAYER_MAX_REVERSE_SPEED = -5;
export const PLAYER_DRAG = 1.25;
export const PLAYER_TURN_RATE = 1.38;
export const PLAYER_DRIFT_GAIN = 2.5;
export const PLAYER_DRIFT_DAMPING = 2.4;

export const ENEMY_ACCELERATION = 14;
export const ENEMY_MAX_FORWARD_SPEED = 15;
export const ENEMY_MAX_REVERSE_SPEED = -4;
export const ENEMY_DRAG = 1.15;
export const ENEMY_TURN_RATE = 1.2;
export const ENEMY_DRIFT_GAIN = 1.9;
export const ENEMY_DRIFT_DAMPING = 2.2;

export const CANNON_RELOAD_TIME = 1.55;
export const CANNON_DAMAGE = 20;
export const CANNON_SPEED = 26;
export const CANNON_LIFETIME = 4.2;
export const CANNON_FIRING_CONE_DOT = 0.35;

export const ENEMY_DETECTION_RANGE = 68;
export const ENEMY_BROADSIDE_RANGE = 18;
export const ENEMY_SPAWN_MAX_ACTIVE = 2;
export const ENEMY_INITIAL_SPAWN_DELAY = 2;
export const ENEMY_STAGGER_SPAWN_DELAY = 10;

export const LOOT_LIFETIME = 20;
export const LOOT_PICKUP_RADIUS = 3.2;

export const UPGRADE_HULL_HP_BONUS = 20;
export const UPGRADE_HULL_COST_START = 60;
export const UPGRADE_HULL_COST_STEP = 40;
