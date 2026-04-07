export const FIXED_TIME_STEP = 1 / 60;
export const MAX_FRAME_DT = 1 / 20;

export const WORLD_LAYOUT_SCALE = 2;
const scaleWorldCoord = (value: number): number => value * WORLD_LAYOUT_SCALE;

export const WORLD_BOUNDS_RADIUS = scaleWorldCoord(95);

export const PLAYER_RESPAWN = { x: scaleWorldCoord(0), z: scaleWorldCoord(-10), heading: 0 };
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
export const PLAYER_BURST_SPEED_MULTIPLIER = 1.35;
export const PLAYER_BURST_DURATION = 1.2;
export const PLAYER_BURST_COOLDOWN = 4;

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
export const ENEMY_SPAWN_MAX_ACTIVE = 3;
export const ENEMY_INITIAL_SPAWN_DELAY = 2;
export const ENEMY_STAGGER_SPAWN_DELAY = 8;
export const ENEMY_HARD_CAP = 4;

export const LOOT_LIFETIME = 20;
export const LOOT_PICKUP_RADIUS = 3.2;
export const CARGO_SALE_VALUE = 28;

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
