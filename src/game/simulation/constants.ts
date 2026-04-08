export const FIXED_TIME_STEP_60 = 1 / 60;
export const FIXED_TIME_STEP_30 = 1 / 30;
export const FIXED_TIME_STEP = FIXED_TIME_STEP_60;
export const FALLBACK_FIXED_TIME_STEP = FIXED_TIME_STEP_30;
export const MAX_FRAME_DT = 1 / 20;

export const PHYSICS_GRAVITY = -26;
export const PHYSICS_WATER_DENSITY_MULTIPLIER = 1;
export const PHYSICS_GLOBAL_DRAG_MULTIPLIER = 1;
export const PHYSICS_SEA_LEVEL = 0;

export const WORLD_LAYOUT_SCALE = 2;
const scaleWorldCoord = (value: number): number => value * WORLD_LAYOUT_SCALE;

export const WORLD_BOUNDS_RADIUS = scaleWorldCoord(95);

export const PLAYER_RESPAWN = { x: scaleWorldCoord(0), y: 0.22, z: scaleWorldCoord(-10), heading: 0 };
export const PORT_POSITION = { x: scaleWorldCoord(0), z: scaleWorldCoord(48) };
export const PORT_RADIUS = 15;
export const PORT_PROMPT_RADIUS = 22;
export const PORT_SAFE_RADIUS = 24;
export const ISLAND_LAYOUT = [
  { id: 0, kind: "port", label: "Port Haven", x: scaleWorldCoord(0), z: scaleWorldCoord(48), radius: 13 },
  { id: 1, kind: "treasure", label: "Skull Key", x: scaleWorldCoord(-58), z: scaleWorldCoord(22), radius: 11 },
  { id: 2, kind: "hostile", label: "Redwatch", x: scaleWorldCoord(56), z: scaleWorldCoord(-40), radius: 12 },
  { id: 3, kind: "scenic", label: "Palmrest", x: scaleWorldCoord(-22), z: scaleWorldCoord(-56), radius: 10 },
  { id: 4, kind: "treasure", label: "Sunken Crown", x: scaleWorldCoord(62), z: scaleWorldCoord(38), radius: 10 }
] as const;
export const ENEMY_SPAWN_POINTS = [
  { x: scaleWorldCoord(45), z: scaleWorldCoord(-34), heading: Math.PI * 0.62 },
  { x: scaleWorldCoord(-54), z: scaleWorldCoord(-32), heading: Math.PI * 1.78 },
  { x: scaleWorldCoord(58), z: scaleWorldCoord(6), heading: Math.PI * 0.95 },
  { x: scaleWorldCoord(-60), z: scaleWorldCoord(14), heading: Math.PI * 1.25 },
  { x: scaleWorldCoord(34), z: scaleWorldCoord(66), heading: Math.PI * 1.6 },
  { x: scaleWorldCoord(-34), z: scaleWorldCoord(68), heading: Math.PI * 1.35 }
];

export const SHIP_MAX_HP = 100;
export const SHIP_RADIUS = 2.1;
export const SHIP_CENTER_OF_MASS_Y = -0.25;
export const SHIP_SPAWN_FREEBOARD = 0.34;
export const SHIP_SAFE_SUBMERGE_DEPTH = 0.42;
export const SINK_DURATION = 3.6;
export const PLAYER_REPAIR_COOLDOWN = 6;
export const PLAYER_REPAIR_AMOUNT = 30;

export const PLAYER_MASS = 42;
export const PLAYER_THRUST_FORCE = 880;
export const PLAYER_TURN_TORQUE = 95;
export const PLAYER_LOW_SPEED_TURN_ASSIST = 0.62;
export const PLAYER_BUOYANCY_STRENGTH = 730;
export const PLAYER_BUOYANCY_DAMPING = 8;
export const PLAYER_LINEAR_DRAG_AIR = 0.24;
export const PLAYER_LINEAR_DRAG_WATER = 1.08;
export const PLAYER_LATERAL_DRAG_WATER = 2.7;
export const PLAYER_ANGULAR_DRAG_AIR = 0.9;
export const PLAYER_ANGULAR_DRAG_WATER = 2.35;
export const PLAYER_ROLL_DAMPING = 3.25;
export const PLAYER_PITCH_DAMPING = 3.15;
export const PLAYER_COLLISION_DAMAGE_THRESHOLD = 7.5;
export const PLAYER_COLLISION_DAMAGE_MULTIPLIER = 2.6;

export const MOVEMENT_MAX_SPEED = 40.5;
export const MOVEMENT_ACCELERATION = 60.75;
export const MOVEMENT_DRAG = 0.92;
export const MOVEMENT_MAX_TURN_RATE = 2.2;
export const MOVEMENT_TURN_ACCEL = 6;
export const MOVEMENT_TURN_LOW_SPEED_MULT = 0.12;
export const MOVEMENT_TURN_MID_SPEED_START = 0.35;
export const MOVEMENT_TURN_MID_SPEED_END = 0.65;
export const MOVEMENT_TURN_HIGH_SPEED_MULT = 0.55;
export const MOVEMENT_TURN_IDLE_SPEED_THRESHOLD = 0.06;
export const MOVEMENT_TURN_IDLE_INPUT_MULT = 0.4;
export const MOVEMENT_TURN_IDLE_ANGULAR_CAP = 0.22;
export const MOVEMENT_LATERAL_DAMPING = 0.18;
export const MOVEMENT_HEADING_ASSIST = 0.08;
export const MOVEMENT_REVERSE_ACCEL_MULT = 0.45;
export const MOVEMENT_REVERSE_SPEED_MULT = 0.35;
export const MOVEMENT_BRAKE_MULT = 0.85;

export const ENEMY_MASS_BASE = 36;
export const ENEMY_THRUST_FORCE_BASE = 780;
export const ENEMY_TURN_TORQUE_BASE = 80;
export const ENEMY_LOW_SPEED_TURN_ASSIST = 0.52;
export const ENEMY_BUOYANCY_STRENGTH = 620;
export const ENEMY_BUOYANCY_DAMPING = 8.5;
export const ENEMY_LINEAR_DRAG_AIR = 0.26;
export const ENEMY_LINEAR_DRAG_WATER = 1.14;
export const ENEMY_LATERAL_DRAG_WATER = 2.55;
export const ENEMY_ANGULAR_DRAG_AIR = 1.05;
export const ENEMY_ANGULAR_DRAG_WATER = 2.4;
export const ENEMY_ROLL_DAMPING = 3.35;
export const ENEMY_PITCH_DAMPING = 3.4;
export const ENEMY_COLLISION_DAMAGE_THRESHOLD = 8.2;
export const ENEMY_COLLISION_DAMAGE_MULTIPLIER = 2.3;

export const PLAYER_BURST_SPEED_MULTIPLIER = 1.6;
export const PLAYER_BURST_TURN_MULTIPLIER = 0.72;
export const PLAYER_BURST_THRUST_MULTIPLIER = 1.25;
export const PLAYER_BURST_DURATION = 1.5;
export const PLAYER_BURST_COOLDOWN = 3;

export const CANNON_RELOAD_TIME = 1.55;
export const CANNON_DAMAGE = 20;
export const CANNON_MUZZLE_VELOCITY = 31;
export const CANNON_VERTICAL_MUZZLE_VELOCITY = 1.9;
export const CANNON_INHERIT_SHIP_VELOCITY = 0.42;
export const CANNON_GRAVITY_SCALE = 1;
export const CANNON_DRAG_AIR = 0.14;
export const CANNON_DRAG_WATER = 7.5;
export const CANNON_LIFETIME = 6.2;
export const CANNON_FIRING_CONE_DOT = 0.35;
export const CANNON_COLLISION_RADIUS = 0.36;
export const CANNON_MASS = 6.5;
export const CANNON_IMPACT_IMPULSE = 6.4;
export const CANNON_TERMINATE_ON_WATER_IMPACT = true;
export const CANNON_RECOIL_IMPULSE = 2.2;
export const CANNON_RECOIL_YAW = 0.11;
export const CANNON_RECOIL_ROLL = 0.16;

export const ENEMY_DETECTION_RANGE = 68;
export const ENEMY_BROADSIDE_RANGE = 18;
export const ENEMY_SPAWN_MAX_ACTIVE = 3;
export const ENEMY_INITIAL_SPAWN_DELAY = 2;
export const ENEMY_STAGGER_SPAWN_DELAY = 8;
export const ENEMY_HARD_CAP = 4;

export const LOOT_LIFETIME = 20;
export const LOOT_PICKUP_RADIUS = 3.2;
export const CARGO_SALE_VALUE = 28;
export const LOOT_FLOAT_MASS_LIGHT = 4.5;
export const LOOT_FLOAT_MASS_HEAVY = 8.5;
export const LOOT_BUOYANCY_MULTIPLIER_LIGHT = 1.15;
export const LOOT_BUOYANCY_MULTIPLIER_HEAVY = 0.88;
export const LOOT_WATER_DRAG = 2.9;
export const LOOT_ANGULAR_DAMPING = 3.6;

export const UPGRADE_HULL_HP_BONUS = 20;
export const UPGRADE_HULL_COST_START = 60;
export const UPGRADE_HULL_COST_STEP = 40;

export const TREASURE_INTERACT_RADIUS = 9;
export const TREASURE_REWARD_BASE = 90;
export const TREASURE_REWARD_STEP = 25;

export const EVENT_INTERVAL = 36;
export const EVENT_TREASURE_DURATION = 28;
export const EVENT_CONVOY_DURATION = 24;
export const EVENT_STORM_DURATION = 32;
export const EVENT_NAVY_DURATION = 24;

export const STORM_RADIUS = 24;
export const STORM_INTENSITY_MAX = 0.55;
export const STORM_SPEED_MULTIPLIER = 0.72;

export const SHIP_COLLISION_RESTITUTION = 0.06;
export const SHIP_COLLISION_IMPULSE_SCALE = 0.72;
export const SHIP_COLLISION_ANGULAR_IMPULSE = 0.2;
export const PROJECTILE_HIT_ANGULAR_IMPULSE = 0.08;
