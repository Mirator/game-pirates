export const FIXED_TIME_STEP = 1 / 60;
export const MAX_FRAME_DT = 1 / 20;

export const WORLD_BOUNDS_RADIUS = 95;

export const PLAYER_RESPAWN = { x: 0, z: -10, heading: 0 };
export const ENEMY_RESPAWN = { x: 26, z: 18, heading: Math.PI };

export const SHIP_MAX_HP = 100;
export const SHIP_RADIUS = 2.1;
export const SINK_DURATION = 2.8;

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
