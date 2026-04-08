import {
  CANNON_COLLISION_RADIUS,
  CANNON_DAMAGE,
  CANNON_DRAG_AIR,
  CANNON_DRAG_WATER,
  CANNON_FIRING_CONE_DOT,
  CANNON_GRAVITY_SCALE,
  CANNON_IMPACT_IMPULSE,
  CANNON_INHERIT_SHIP_VELOCITY,
  CANNON_LIFETIME,
  CANNON_MASS,
  CANNON_MUZZLE_VELOCITY,
  CANNON_RECOIL_IMPULSE,
  CANNON_RECOIL_ROLL,
  CANNON_RECOIL_YAW,
  CANNON_RELOAD_TIME,
  CANNON_TERMINATE_ON_WATER_IMPACT,
  CANNON_VERTICAL_MUZZLE_VELOCITY,
  CARGO_SALE_VALUE,
  ENEMY_BROADSIDE_RANGE,
  ENEMY_DETECTION_RANGE,
  ENEMY_HARD_CAP,
  ENEMY_MASS_BASE,
  ENEMY_SPAWN_POINTS,
  EVENT_CONVOY_DURATION,
  EVENT_NAVY_DURATION,
  EVENT_STORM_DURATION,
  LOOT_ANGULAR_DAMPING,
  LOOT_BUOYANCY_MULTIPLIER_HEAVY,
  LOOT_BUOYANCY_MULTIPLIER_LIGHT,
  LOOT_FLOAT_MASS_HEAVY,
  LOOT_FLOAT_MASS_LIGHT,
  LOOT_LIFETIME,
  LOOT_PICKUP_RADIUS,
  LOOT_WATER_DRAG,
  MOVEMENT_ACCELERATION,
  MOVEMENT_BRAKE_MULT,
  MOVEMENT_DRAG,
  MOVEMENT_HEADING_ASSIST,
  MOVEMENT_LATERAL_DAMPING,
  MOVEMENT_MAX_SPEED,
  MOVEMENT_MAX_TURN_RATE,
  MOVEMENT_REVERSE_ACCEL_MULT,
  MOVEMENT_REVERSE_SPEED_MULT,
  MOVEMENT_TURN_ACCEL,
  MOVEMENT_TURN_HIGH_SPEED_MULT,
  MOVEMENT_TURN_IDLE_ANGULAR_CAP,
  MOVEMENT_TURN_IDLE_INPUT_MULT,
  MOVEMENT_TURN_IDLE_SPEED_THRESHOLD,
  MOVEMENT_TURN_LOW_SPEED_MULT,
  MOVEMENT_TURN_MID_SPEED_END,
  MOVEMENT_TURN_MID_SPEED_START,
  PLAYER_BURST_COOLDOWN,
  PLAYER_BURST_DURATION,
  PLAYER_BURST_SPEED_MULTIPLIER,
  PLAYER_BURST_TURN_MULTIPLIER,
  PLAYER_BURST_THRUST_MULTIPLIER,
  PLAYER_COLLISION_DAMAGE_MULTIPLIER,
  PLAYER_COLLISION_DAMAGE_THRESHOLD,
  PLAYER_REPAIR_AMOUNT,
  PLAYER_REPAIR_COOLDOWN,
  PLAYER_RESPAWN,
  PROJECTILE_HIT_ANGULAR_IMPULSE,
  SHIP_SAFE_SUBMERGE_DEPTH,
  SHIP_SPAWN_FREEBOARD,
  SHIP_COLLISION_ANGULAR_IMPULSE,
  SHIP_COLLISION_IMPULSE_SCALE,
  SHIP_COLLISION_RESTITUTION,
  SINK_DURATION,
  STORM_INTENSITY_MAX,
  STORM_RADIUS,
  STORM_SPEED_MULTIPLIER,
  UPGRADE_HULL_COST_STEP,
  UPGRADE_HULL_HP_BONUS,
  WORLD_LAYOUT_SCALE
} from "../constants";
import type {
  CannonSide,
  EnemyArchetype,
  EnemyState,
  InputState,
  LootKind,
  LootState,
  ProjectileState,
  ShipDamageState,
  ShipState,
  SimulationEvent,
  WorldEventKind
} from "../types";
import {
  calculateForwardVector as forwardOf,
  calculateLeftVector as leftOf,
  classifySideFromLeftDot,
  getBroadsideVector,
  sideDotAgainstShipLeft
} from "../sideMath";
import { DEFAULT_WATER_SURFACE_TUNING, DEFAULT_WATER_SURFACE_WAVES } from "../../physics/waterProfile";
import { sampleWaterHeight } from "../../physics/waterSurface";
import { createShipBuoyancyProbes, getShipColliderProfileForEnemyArchetype } from "../../ships/shipProfiles";
import { ensureEcsState, syncEcsFromWorldView, syncWorldViewFromEcs } from "./createEcsState";
import { clamp, distanceSquared, normalizeAngle, steeringTowardHeading } from "./math";
import type { EcsEnemyIntent, EcsState, WorldWithEcs } from "./types";

type EP = {
  maxHp: number;
  detectionRange: number;
  broadsideRange: number;
  reloadDuration: number;
  fleeThreshold: number;
  lootGoldBase: number;
  lootMaterialBase: number;
  lootCargoBase: number;
  massScale: number;
  thrustScale: number;
  turnScale: number;
  speedScale: number;
  buoyancyScale: number;
};

const EVENT_CYCLE: WorldEventKind[] = ["enemy_convoy", "storm", "navy_patrol"];
const PROJ_HEIGHT_HIT = 2.6;
const SINK_BUOY_LOSS_RATE = 0.55;

const EPF: Record<EnemyArchetype, EP> = {
  merchant: {
    maxHp: 68,
    detectionRange: 54,
    broadsideRange: 13,
    reloadDuration: 2.45,
    fleeThreshold: 0.75,
    lootGoldBase: 58,
    lootMaterialBase: 1,
    lootCargoBase: 3,
    massScale: 0.95,
    thrustScale: 0.78,
    turnScale: 0.86,
    speedScale: 0.9,
    buoyancyScale: 0.92
  },
  raider: {
    maxHp: 100,
    detectionRange: ENEMY_DETECTION_RANGE,
    broadsideRange: ENEMY_BROADSIDE_RANGE,
    reloadDuration: 1.7,
    fleeThreshold: 0.25,
    lootGoldBase: 36,
    lootMaterialBase: 2,
    lootCargoBase: 2,
    massScale: 1,
    thrustScale: 1,
    turnScale: 1,
    speedScale: 1,
    buoyancyScale: 1
  },
  navy: {
    maxHp: 150,
    detectionRange: 80,
    broadsideRange: 24,
    reloadDuration: 1.35,
    fleeThreshold: 0,
    lootGoldBase: 82,
    lootMaterialBase: 3,
    lootCargoBase: 4,
    massScale: 1.25,
    thrustScale: 0.85,
    turnScale: 0.8,
    speedScale: 0.88,
    buoyancyScale: 1.2
  }
};

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

function movementScalesFor(ship: ShipState): { accelerationScale: number; turnScale: number; speedScale: number } {
  if (ship.owner === "player") {
    return { accelerationScale: 1, turnScale: 1, speedScale: 1 };
  }
  const enemy = ship as EnemyState;
  const profile = EPF[enemy.archetype];
  return {
    accelerationScale: profile.thrustScale,
    turnScale: profile.turnScale,
    speedScale: profile.speedScale
  };
}

function frameDragFactor(baseDrag: number, dt: number): number {
  const referenceStep = 1 / 60;
  return Math.pow(baseDrag, dt / referenceStep);
}

function speedBandedTurnFactor(speedNorm: number): number {
  const clampedSpeed = clamp(speedNorm, 0, 1);
  if (clampedSpeed < MOVEMENT_TURN_MID_SPEED_START) {
    const lowBandAlpha = MOVEMENT_TURN_MID_SPEED_START > 0 ? clampedSpeed / MOVEMENT_TURN_MID_SPEED_START : 1;
    return lerp(MOVEMENT_TURN_LOW_SPEED_MULT, 1, clamp(lowBandAlpha, 0, 1));
  }
  if (clampedSpeed <= MOVEMENT_TURN_MID_SPEED_END) {
    return 1;
  }
  const highBandWidth = Math.max(1e-4, 1 - MOVEMENT_TURN_MID_SPEED_END);
  const highBandAlpha = clamp((clampedSpeed - MOVEMENT_TURN_MID_SPEED_END) / highBandWidth, 0, 1);
  return lerp(1, MOVEMENT_TURN_HIGH_SPEED_MULT, highBandAlpha);
}

function emitEvent(worldState: WorldWithEcs, event: SimulationEvent): void {
  worldState.events.push(event);
}

function seaHeight(worldState: WorldWithEcs, x: number, z: number): number {
  return worldState.physics.seaLevel + sampleWaterHeight(DEFAULT_WATER_SURFACE_WAVES, { x, z }, worldState.time, DEFAULT_WATER_SURFACE_TUNING);
}

function resolveShipSpawnHeight(worldState: WorldWithEcs, x: number, z: number, fallbackY: number): number {
  return Math.max(fallbackY, seaHeight(worldState, x, z) + SHIP_SPAWN_FREEBOARD);
}

function setDamageState(ship: ShipState): void {
  if (ship.status === "sinking") {
    ship.damageState = "sunk";
    return;
  }
  const hpRatio = ship.maxHp > 0 ? ship.hp / ship.maxHp : 0;
  ship.damageState = hpRatio <= 0.3 ? "critical" : hpRatio <= 0.7 ? "damaged" : "healthy";
}

function decReload(ship: ShipState, dt: number): void {
  ship.reload.left = Math.max(0, ship.reload.left - dt);
  ship.reload.right = Math.max(0, ship.reload.right - dt);
  ship.repairCooldown = Math.max(0, ship.repairCooldown - dt);
}

function updatePortRange(worldState: WorldWithEcs): void {
  const p = worldState.player;
  const port = worldState.port;
  const dockSq = port.radius * port.radius;
  const promptSq = port.promptRadius * port.promptRadius;
  port.playerInRange = distanceSquared(p.position.x, p.position.z, port.position.x, port.position.z) <= dockSq;
  port.playerNearPort = distanceSquared(p.position.x, p.position.z, port.position.x, port.position.z) <= promptSq;
  if (!port.playerInRange && port.menuOpen) togglePortMenu(worldState, false);
}

function togglePortMenu(worldState: WorldWithEcs, open: boolean): void {
  if (worldState.port.menuOpen === open) return;
  worldState.port.menuOpen = open;
  if (open && worldState.burst.active) {
    worldState.burst.active = false;
    worldState.burst.remaining = 0;
    worldState.burst.cooldown = Math.max(worldState.burst.cooldown, PLAYER_BURST_COOLDOWN);
  }
  emitEvent(worldState, { type: open ? "dock_open" : "dock_close" });
}

function insideStorm(worldState: WorldWithEcs, ship: ShipState): boolean {
  return (
    worldState.storm.active &&
    distanceSquared(ship.position.x, ship.position.z, worldState.storm.center.x, worldState.storm.center.z) <= worldState.storm.radius ** 2
  );
}

function updateShipPhysics(
  worldState: WorldWithEcs,
  ship: ShipState,
  throttle: number,
  turn: number,
  dt: number,
  options: { boostActive?: boolean } = {}
): void {
  if (ship.status !== "alive") return;

  const boostActive = options.boostActive === true && ship.owner === "player";
  const storm = insideStorm(worldState, ship);
  const scales = movementScalesFor(ship);
  const stormSpeedScale = storm ? STORM_SPEED_MULTIPLIER : 1;

  const f = forwardOf(ship.heading);
  const l = leftOf(ship.heading);
  const vx = ship.linearVelocity.x;
  const vz = ship.linearVelocity.z;
  const vy = ship.linearVelocity.y;

  const throttleInput = clamp(throttle, -1, 1);
  const turnInput = clamp(turn, -1, 1);

  let forwardSpeed = vx * f.x + vz * f.z;
  let lateralSpeed = vx * l.x + vz * l.z;

  const acceleration =
    MOVEMENT_ACCELERATION *
    scales.accelerationScale *
    stormSpeedScale *
    (boostActive ? PLAYER_BURST_THRUST_MULTIPLIER : 1);
  const turnScale = scales.turnScale * (boostActive ? PLAYER_BURST_TURN_MULTIPLIER : 1);
  const maxSpeed =
    MOVEMENT_MAX_SPEED *
    scales.speedScale *
    stormSpeedScale *
    (boostActive ? PLAYER_BURST_SPEED_MULTIPLIER : 1);
  const reverseSpeedCap = maxSpeed * MOVEMENT_REVERSE_SPEED_MULT;

  if (throttleInput > 0) {
    forwardSpeed += acceleration * throttleInput * dt;
  } else if (throttleInput < 0) {
    const reverseInput = -throttleInput;
    forwardSpeed -= acceleration * MOVEMENT_REVERSE_ACCEL_MULT * reverseInput * dt;
    if (forwardSpeed > 0) {
      forwardSpeed -= acceleration * MOVEMENT_BRAKE_MULT * reverseInput * dt;
    }
  }

  const dragFactor = frameDragFactor(MOVEMENT_DRAG, dt);
  forwardSpeed *= dragFactor;
  lateralSpeed *= dragFactor;

  const lateralDampingAlpha = clamp(MOVEMENT_LATERAL_DAMPING * dt * 60, 0, 1);
  lateralSpeed = lerp(lateralSpeed, 0, lateralDampingAlpha);

  forwardSpeed = clamp(forwardSpeed, -reverseSpeedCap, maxSpeed);

  const speedNorm = clamp(Math.abs(forwardSpeed) / Math.max(maxSpeed, 1e-4), 0, 1);
  const turnFactor = speedBandedTurnFactor(speedNorm);
  const idleTurn = speedNorm < MOVEMENT_TURN_IDLE_SPEED_THRESHOLD && Math.abs(throttleInput) < 0.1;
  const idleTurnInputScale = idleTurn ? MOVEMENT_TURN_IDLE_INPUT_MULT : 1;
  const targetTurnRate = turnInput * MOVEMENT_MAX_TURN_RATE * turnScale * turnFactor * idleTurnInputScale;
  ship.angularVelocity = lerp(ship.angularVelocity, targetTurnRate, clamp(MOVEMENT_TURN_ACCEL * dt, 0, 1));

  let planarVx = f.x * forwardSpeed + l.x * lateralSpeed;
  let planarVz = f.z * forwardSpeed + l.z * lateralSpeed;
  let planarSpeed = Math.hypot(planarVx, planarVz);

  if (planarSpeed > maxSpeed) {
    const speedClampScale = maxSpeed / Math.max(planarSpeed, 1e-5);
    planarVx *= speedClampScale;
    planarVz *= speedClampScale;
    forwardSpeed *= speedClampScale;
    lateralSpeed *= speedClampScale;
    planarSpeed = maxSpeed;
  }

  if (storm) {
    const stormDamping = Math.exp(-1.4 * dt);
    planarVx *= stormDamping;
    planarVz *= stormDamping;
    forwardSpeed *= stormDamping;
    lateralSpeed *= stormDamping;
    planarSpeed *= stormDamping;
  }

  if (planarSpeed > 0.2) {
    const moveHeading = Math.atan2(planarVx, planarVz);
    const headingDelta = normalizeAngle(moveHeading - ship.heading);
    const assistWeight = turnInput === 0 ? 1 : 0.22 * turnFactor;
    const assistRatio = clamp(Math.abs(lateralSpeed) / Math.max(0.5, Math.abs(forwardSpeed)), 0.18, 1);
    ship.angularVelocity += headingDelta * MOVEMENT_HEADING_ASSIST * assistWeight * assistRatio;
  }

  const maxAngularVelocity = idleTurn ? MOVEMENT_TURN_IDLE_ANGULAR_CAP : MOVEMENT_MAX_TURN_RATE * turnScale * 1.35;
  ship.angularVelocity = clamp(ship.angularVelocity, -maxAngularVelocity, maxAngularVelocity);

  let fy = worldState.physics.gravity * ship.mass - vy * ship.buoyancyDamping;
  let pitchT = -ship.pitchVelocity * ship.drag.pitchDamping * ship.mass;
  let rollT = -ship.rollVelocity * ship.drag.rollDamping * ship.mass;

  let submerged = 0;
  for (const probe of ship.buoyancyProbes) {
    const wx = ship.position.x + l.x * probe.localOffset.x + f.x * probe.localOffset.z;
    const wz = ship.position.z + l.z * probe.localOffset.x + f.z * probe.localOffset.z;
    const wh = seaHeight(worldState, wx, wz);
    const ph = ship.position.y + probe.localOffset.y + ship.pitch * probe.localOffset.z * 0.58 - ship.roll * probe.localOffset.x * 0.58;
    const sub = wh - ph;
    if (sub <= 0) continue;
    submerged += 1;
    const b = sub * ship.buoyancyStrength * probe.weight * worldState.physics.waterDensityMultiplier * (1 - ship.buoyancyLoss);
    fy += b;
    pitchT += b * probe.localOffset.z * 0.03;
    rollT += -b * probe.localOffset.x * 0.03;
  }

  if (submerged === 0 && ship.position.y > seaHeight(worldState, ship.position.x, ship.position.z) + 0.2) ship.waterState = "airborne";
  else if (submerged < Math.max(1, Math.floor(ship.buoyancyProbes.length * 0.5))) ship.waterState = "water_entry";
  else ship.waterState = "submerged";

  const invM = 1 / Math.max(1, ship.mass);
  ship.linearVelocity.x = planarVx;
  ship.linearVelocity.z = planarVz;
  ship.linearVelocity.y += fy * invM * dt;
  ship.pitchVelocity += pitchT * invM * dt;
  ship.rollVelocity += rollT * invM * dt;

  ship.heading = normalizeAngle(ship.heading + ship.angularVelocity * dt);
  ship.pitch = clamp(ship.pitch + ship.pitchVelocity * dt, -0.36, 0.36);
  ship.roll = clamp(ship.roll + ship.rollVelocity * dt, -0.42, 0.42);
  ship.pitch += (-ship.pitch) * clamp(dt * 0.8, 0, 1);
  ship.roll += (-ship.roll) * clamp(dt * 0.85, 0, 1);

  ship.position.x += ship.linearVelocity.x * dt;
  ship.position.y = clamp(ship.position.y + ship.linearVelocity.y * dt, -8, 6);
  ship.position.z += ship.linearVelocity.z * dt;

  const centerWaterHeight = seaHeight(worldState, ship.position.x, ship.position.z);
  const minSafeHeight = centerWaterHeight - SHIP_SAFE_SUBMERGE_DEPTH;
  if (ship.position.y < minSafeHeight) {
    ship.position.y = minSafeHeight;
    ship.linearVelocity.y = Math.max(ship.linearVelocity.y, -0.35);
  }

  const af = forwardOf(ship.heading);
  const al = leftOf(ship.heading);
  ship.speed = ship.linearVelocity.x * af.x + ship.linearVelocity.z * af.z;
  ship.drift = ship.linearVelocity.x * al.x + ship.linearVelocity.z * al.z;
  ship.throttle = throttleInput;
  ship.turnInput = turnInput;
  ship.buoyancyLoss = clamp((1 - ship.hp / Math.max(1, ship.maxHp)) * 0.5, 0, 0.5);
}

function keepInBounds(worldState: WorldWithEcs, ship: ShipState, soft: boolean): void {
  const d2 = ship.position.x * ship.position.x + ship.position.z * ship.position.z;
  if (d2 <= worldState.boundsRadius ** 2) return;
  const d = Math.sqrt(d2);
  const nx = ship.position.x / Math.max(1e-5, d);
  const nz = ship.position.z / Math.max(1e-5, d);
  ship.position.x = nx * worldState.boundsRadius;
  ship.position.z = nz * worldState.boundsRadius;
  const outV = ship.linearVelocity.x * nx + ship.linearVelocity.z * nz;
  if (outV > 0) {
    const s = soft ? 1.2 : 1.5;
    ship.linearVelocity.x -= nx * outV * s;
    ship.linearVelocity.z -= nz * outV * s;
  }
  if (!soft) ship.heading = normalizeAngle(Math.atan2(-ship.position.x, -ship.position.z));
}

function chooseSpawnArchetype(worldState: WorldWithEcs): EnemyArchetype {
  const threat = worldState.flags.enemiesSunk + Math.floor(worldState.time / 45);
  const s = (worldState.nextEnemyId + threat) % 10;
  if (worldState.time < 90) return s <= 2 ? "merchant" : "raider";
  if (worldState.time < 180) return s <= 1 ? "merchant" : s >= 8 ? "navy" : "raider";
  return s <= 1 ? "merchant" : s >= 6 ? "navy" : "raider";
}

function chooseSpawnPoint(worldState: WorldWithEcs): { x: number; z: number; heading: number } {
  let best = ENEMY_SPAWN_POINTS[0]!;
  let score = -Infinity;
  for (let i = 0; i < ENEMY_SPAWN_POINTS.length; i += 1) {
    const c = ENEMY_SPAWN_POINTS[i];
    if (!c) continue;
    const dp = Math.sqrt(distanceSquared(c.x, c.z, worldState.player.position.x, worldState.player.position.z));
    const dport = Math.sqrt(distanceSquared(c.x, c.z, worldState.port.position.x, worldState.port.position.z));
    if (dport < worldState.port.safeRadius) continue;
    const s = dp + ((worldState.nextEnemyId + i) % ENEMY_SPAWN_POINTS.length) * 0.01;
    if (s > score) {
      score = s;
      best = c;
    }
  }
  return best;
}

function createEnemy(worldState: WorldWithEcs, id: number, archetype: EnemyArchetype, s: { x: number; z: number; heading: number }): EnemyState {
  const p = EPF[archetype];
  const colliderProfile = getShipColliderProfileForEnemyArchetype(archetype);
  return {
    id,
    archetype,
    owner: "enemy",
    position: { x: s.x, y: resolveShipSpawnHeight(worldState, s.x, s.z, 0.18), z: s.z },
    heading: s.heading,
    pitch: 0,
    roll: 0,
    linearVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: 0,
    pitchVelocity: 0,
    rollVelocity: 0,
    speed: 0,
    drift: 0,
    throttle: 0,
    turnInput: 0,
    hp: p.maxHp,
    maxHp: p.maxHp,
    radius: colliderProfile.radius,
    mass: ENEMY_MASS_BASE * p.massScale,
    centerOfMass: { x: 0, y: colliderProfile.centerOfMassY, z: 0 },
    buoyancyProbes: createShipBuoyancyProbes(colliderProfile),
    buoyancyStrength: 620 * p.buoyancyScale,
    buoyancyDamping: 8.5,
    buoyancyLoss: 0,
    hull: {
      kind: "compound_hull",
      length: colliderProfile.length,
      width: colliderProfile.width,
      draft: colliderProfile.draft
    },
    drag: { linearAir: 0.26, linearWater: 1.15, lateralWater: 2.55, angularAir: 1.02, angularWater: 2.4, rollDamping: 3.35, pitchDamping: 3.4 },
    thrustForce: 780 * p.thrustScale,
    turnTorque: 80 * p.turnScale,
    lowSpeedTurnAssist: 0.52,
    reload: { left: 0, right: 0 },
    status: "alive",
    damageState: "healthy",
    sinkTimer: 0,
    repairCooldown: 0,
    collisionLayer: "ships",
    waterState: "submerged",
    aiState: "patrol",
    patrolAngle: (id % 8) * 0.3,
    lootDropped: false,
    aiStateTimer: 0,
    detectProgress: 0,
    pendingFireSide: null
  };
}

function spawnEnemy(worldState: WorldWithEcs, ecs: EcsState, archetype: EnemyArchetype, spawn = chooseSpawnPoint(worldState)): void {
  if (ecs.enemyTable.size >= ENEMY_HARD_CAP) return;
  const id = worldState.nextEnemyId++;
  const e = createEnemy(worldState, id, archetype, spawn);
  ecs.enemyTable.set(id, e);
  ecs.shipTable.set(id, e);
}

function spawnEnemyIfNeeded(worldState: WorldWithEcs, ecs: EcsState): void {
  while (ecs.enemyTable.size < worldState.spawnDirector.maxActive && worldState.spawnDirector.timer <= 0) {
    spawnEnemy(worldState, ecs, chooseSpawnArchetype(worldState));
    worldState.spawnDirector.timer += worldState.spawnDirector.staggerDelay;
  }
}

function enemyIntent(worldState: WorldWithEcs, enemy: EnemyState, dt: number): EcsEnemyIntent {
  const player = worldState.player;
  const profile = EPF[enemy.archetype];
  enemy.aiStateTimer += dt;
  if (enemy.status !== "alive") return { throttle: 0, turn: 0, fireSide: null };

  const dx = player.position.x - enemy.position.x;
  const dz = player.position.z - enemy.position.z;
  const dist = Math.hypot(dx, dz);
  const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
  const flee = enemy.archetype === "merchant" && player.status === "alive" && (dist < profile.broadsideRange * 1.6 || hpRatio < profile.fleeThreshold);

  if (flee) enemy.aiState = "flee";
  else if (player.status !== "alive" || dist > profile.detectionRange) enemy.aiState = "patrol";
  else if (enemy.aiState === "patrol") {
    enemy.aiState = "detect";
    enemy.aiStateTimer = 0;
  }
  if (enemy.aiState === "detect" && enemy.aiStateTimer >= 0.45) {
    enemy.aiState = "chase";
    enemy.aiStateTimer = 0;
  }
  if (enemy.aiState === "chase" && dist <= profile.broadsideRange * 1.2 && enemy.aiStateTimer >= 0.3) {
    enemy.aiState = "line_up_broadside";
    enemy.aiStateTimer = 0;
  }

  let throttle = 0;
  let turn = 0;
  let fireSide: CannonSide | null = null;
  if (enemy.aiState === "flee") {
    throttle = 1;
    turn = steeringTowardHeading(enemy.heading, Math.atan2(-dx, -dz));
  } else if (enemy.aiState === "patrol") {
    enemy.patrolAngle += dt * (enemy.archetype === "merchant" ? 0.55 : 0.35);
    const r = (33 + (enemy.id % 4) * 5) * WORLD_LAYOUT_SCALE;
    const tx = Math.cos(enemy.patrolAngle) * r;
    const tz = Math.sin(enemy.patrolAngle) * r;
    throttle = enemy.archetype === "navy" ? 0.38 : 0.5;
    turn = steeringTowardHeading(enemy.heading, Math.atan2(tx - enemy.position.x, tz - enemy.position.z));
  } else if (enemy.aiState === "detect") {
    throttle = 0.28;
    turn = steeringTowardHeading(enemy.heading, Math.atan2(dx, dz));
  } else {
    const angleToPlayer = Math.atan2(dx, dz);
    const bl = normalizeAngle(angleToPlayer + Math.PI * 0.5);
    const br = normalizeAngle(angleToPlayer - Math.PI * 0.5);
    const target = Math.abs(normalizeAngle(bl - enemy.heading)) < Math.abs(normalizeAngle(br - enemy.heading)) ? bl : br;
    if (enemy.aiState === "chase") {
      throttle = enemy.archetype === "navy" ? 0.72 : 0.82;
      turn = steeringTowardHeading(enemy.heading, Math.atan2(dx, dz));
    } else {
      throttle = dist > profile.broadsideRange * 1.1 ? 0.4 : dist < profile.broadsideRange * 0.72 ? -0.2 : 0.06;
      turn = steeringTowardHeading(enemy.heading, target);
      const len = Math.hypot(dx, dz);
      if (len > 0.0001) {
        const nx = dx / len;
        const nz = dz / len;
        const f = forwardOf(enemy.heading);
        const dot = f.x * nx + f.z * nz;
        const sideDot = sideDotAgainstShipLeft(enemy.heading, nx, nz);
        const fireDot = enemy.archetype === "navy" ? CANNON_FIRING_CONE_DOT + 0.12 : CANNON_FIRING_CONE_DOT;
        const canFire = Math.abs(dot) <= fireDot && len <= profile.broadsideRange * 1.35 && (enemy.archetype !== "merchant" || len <= profile.broadsideRange * 0.85);
        if (canFire && enemy.aiStateTimer >= 0.18) {
          fireSide = classifySideFromLeftDot(sideDot);
          enemy.aiState = "fire";
          enemy.aiStateTimer = 0;
        }
      }
    }
  }
  if (enemy.aiState === "fire" && enemy.aiStateTimer > 0.22) {
    enemy.aiState = "line_up_broadside";
    enemy.aiStateTimer = 0;
  }
  enemy.pendingFireSide = fireSide;
  return { throttle, turn, fireSide };
}

function addProjectile(worldState: WorldWithEcs, ecs: EcsState, ship: ShipState, side: CannonSide): void {
  const f = forwardOf(ship.heading);
  const s = getBroadsideVector(ship.heading, side);
  const dx = s.x * 0.96 + f.x * 0.14;
  const dz = s.z * 0.96 + f.z * 0.14;
  const len = Math.hypot(dx, dz);
  if (len < 0.0001) return;
  const dirX = dx / len;
  const dirZ = dz / len;
  const p: ProjectileState = {
    id: worldState.nextProjectileId++,
    owner: ship.owner,
    position: { x: ship.position.x + s.x * (ship.radius + 1.4) + f.x * 0.8, y: ship.position.y + 1.1, z: ship.position.z + s.z * (ship.radius + 1.4) + f.z * 0.8 },
    velocity: {
      x: dirX * CANNON_MUZZLE_VELOCITY + ship.linearVelocity.x * CANNON_INHERIT_SHIP_VELOCITY,
      y: CANNON_VERTICAL_MUZZLE_VELOCITY + ship.linearVelocity.y * CANNON_INHERIT_SHIP_VELOCITY * 0.35,
      z: dirZ * CANNON_MUZZLE_VELOCITY + ship.linearVelocity.z * CANNON_INHERIT_SHIP_VELOCITY
    },
    lifetime: CANNON_LIFETIME,
    active: true,
    mass: CANNON_MASS,
    gravityScale: CANNON_GRAVITY_SCALE,
    dragAir: CANNON_DRAG_AIR,
    dragWater: CANNON_DRAG_WATER,
    collisionRadius: CANNON_COLLISION_RADIUS,
    impactImpulse: CANNON_IMPACT_IMPULSE,
    terminateOnWaterImpact: CANNON_TERMINATE_ON_WATER_IMPACT,
    waterState: "airborne",
    collisionLayer: "projectiles"
  };
  ecs.projectileTable.set(p.id, p);
  const invM = 1 / Math.max(1, ship.mass);
  ship.linearVelocity.x += -(s.x * CANNON_RECOIL_IMPULSE + f.x * CANNON_RECOIL_IMPULSE * 0.2) * invM;
  ship.linearVelocity.z += -(s.z * CANNON_RECOIL_IMPULSE + f.z * CANNON_RECOIL_IMPULSE * 0.2) * invM;
  ship.angularVelocity += (side === "left" ? CANNON_RECOIL_YAW : -CANNON_RECOIL_YAW) * invM;
  ship.rollVelocity += (side === "left" ? CANNON_RECOIL_ROLL : -CANNON_RECOIL_ROLL) * invM;
}

function reloadDuration(ship: ShipState, enemy?: EnemyState): number {
  return ship.owner === "player" ? CANNON_RELOAD_TIME : EPF[(enemy ?? (ship as EnemyState)).archetype].reloadDuration;
}

function tryFire(ship: ShipState, side: CannonSide, worldState: WorldWithEcs, ecs: EcsState, enemy?: EnemyState): boolean {
  if (ship.status !== "alive" || ship.reload[side] > 0) return false;
  ship.reload[side] = reloadDuration(ship, enemy);
  addProjectile(worldState, ecs, ship, side);
  emitEvent(worldState, { type: "cannon_fire", owner: ship.owner });
  return true;
}

function beginShipSinking(worldState: WorldWithEcs, ship: ShipState): void {
  if (ship.status !== "alive") return;
  ship.status = "sinking";
  ship.damageState = "sunk";
  ship.sinkTimer = SINK_DURATION;
  ship.throttle = 0;
  ship.turnInput = 0;
  emitEvent(worldState, { type: "ship_sunk", owner: ship.owner });
}

function damagePlayer(worldState: WorldWithEcs, dmg: number): void {
  const p = worldState.player;
  if (p.status !== "alive") return;
  p.hp = Math.max(0, p.hp - dmg);
  setDamageState(p);
  emitEvent(worldState, { type: "ship_hit", target: "player" });
  if (p.hp <= 0) beginShipSinking(worldState, p);
}

function damageEnemy(worldState: WorldWithEcs, ecs: EcsState, e: EnemyState, dmg: number): void {
  if (e.status !== "alive") return;
  e.hp = Math.max(0, e.hp - dmg);
  setDamageState(e);
  emitEvent(worldState, { type: "ship_hit", target: "enemy" });
  if (e.hp <= 0) {
    beginShipSinking(worldState, e);
    if (!e.lootDropped) {
      spawnLoot(worldState, ecs, e);
      e.lootDropped = true;
      worldState.flags.enemiesSunk += 1;
    }
  }
}

function shipImpactDamage(worldState: WorldWithEcs, ecs: EcsState, ship: ShipState, speed: number): void {
  if (speed <= PLAYER_COLLISION_DAMAGE_THRESHOLD) return;
  const dmg = Math.round((speed - PLAYER_COLLISION_DAMAGE_THRESHOLD) * PLAYER_COLLISION_DAMAGE_MULTIPLIER);
  if (dmg <= 0) return;
  if (ship.owner === "player") damagePlayer(worldState, dmg);
  else damageEnemy(worldState, ecs, ship as EnemyState, Math.max(1, Math.round(dmg * (1 / PLAYER_COLLISION_DAMAGE_MULTIPLIER))));
}

function collideShipWithIsland(worldState: WorldWithEcs, ecs: EcsState, ship: ShipState): void {
  if (ship.status !== "alive") return;
  for (const island of worldState.islands) {
    const dx = ship.position.x - island.position.x;
    const dz = ship.position.z - island.position.z;
    const d = Math.hypot(dx, dz);
    const minD = ship.radius + island.radius;
    if (d >= minD) continue;
    const nx = dx / Math.max(1e-4, d);
    const nz = dz / Math.max(1e-4, d);
    const pen = minD - Math.max(1e-4, d);
    ship.position.x += nx * pen;
    ship.position.z += nz * pen;
    const nv = ship.linearVelocity.x * nx + ship.linearVelocity.z * nz;
    if (nv < 0) {
      ship.linearVelocity.x += nx * (-(1 + SHIP_COLLISION_RESTITUTION) * nv);
      ship.linearVelocity.z += nz * (-(1 + SHIP_COLLISION_RESTITUTION) * nv);
      const tangentSpeed = ship.linearVelocity.x * -nz + ship.linearVelocity.z * nx;
      const angularKick = clamp(
        (tangentSpeed / Math.max(1, ship.mass)) * SHIP_COLLISION_ANGULAR_IMPULSE * 0.7,
        -SHIP_COLLISION_ANGULAR_IMPULSE,
        SHIP_COLLISION_ANGULAR_IMPULSE
      );
      ship.angularVelocity += angularKick;
      shipImpactDamage(worldState, ecs, ship, Math.abs(nv));
    }
  }
}

function collideShips(worldState: WorldWithEcs, ecs: EcsState, a: ShipState, b: ShipState): void {
  if (a.status !== "alive" || b.status !== "alive") return;
  const dx = a.position.x - b.position.x;
  const dz = a.position.z - b.position.z;
  const d = Math.hypot(dx, dz);
  const minD = a.radius + b.radius;
  if (d >= minD) return;
  const nx = dx / Math.max(1e-4, d);
  const nz = dz / Math.max(1e-4, d);
  const pen = minD - Math.max(1e-4, d);
  const invA = 1 / Math.max(1, a.mass);
  const invB = 1 / Math.max(1, b.mass);
  const inv = Math.max(1e-5, invA + invB);
  a.position.x += nx * pen * (invA / inv);
  a.position.z += nz * pen * (invA / inv);
  b.position.x -= nx * pen * (invB / inv);
  b.position.z -= nz * pen * (invB / inv);
  const rvx = a.linearVelocity.x - b.linearVelocity.x;
  const rvz = a.linearVelocity.z - b.linearVelocity.z;
  const rvn = rvx * nx + rvz * nz;
  if (rvn > 0) return;
  const j = (-(1 + SHIP_COLLISION_RESTITUTION) * rvn * SHIP_COLLISION_IMPULSE_SCALE) / inv;
  const ix = j * nx;
  const iz = j * nz;
  a.linearVelocity.x += ix * invA;
  a.linearVelocity.z += iz * invA;
  b.linearVelocity.x -= ix * invB;
  b.linearVelocity.z -= iz * invB;
  const rvTangent = rvx * -nz + rvz * nx;
  const angularKick = clamp(
    rvTangent * SHIP_COLLISION_ANGULAR_IMPULSE * 0.02,
    -SHIP_COLLISION_ANGULAR_IMPULSE,
    SHIP_COLLISION_ANGULAR_IMPULSE
  );
  a.angularVelocity += angularKick;
  b.angularVelocity -= angularKick;
  shipImpactDamage(worldState, ecs, a, Math.abs(rvn));
  shipImpactDamage(worldState, ecs, b, Math.abs(rvn));
}

function projectileSystem(worldState: WorldWithEcs, ecs: EcsState, dt: number): void {
  for (const p of ecs.projectileTable.values()) {
    if (!p.active) continue;
    p.velocity.y += worldState.physics.gravity * p.gravityScale * dt;
    const drag = p.waterState === "submerged" ? p.dragWater : p.dragAir;
    const damp = Math.exp(-drag * dt);
    p.velocity.x *= damp;
    p.velocity.y *= damp;
    p.velocity.z *= damp;
    p.position.x += p.velocity.x * dt;
    p.position.y += p.velocity.y * dt;
    p.position.z += p.velocity.z * dt;
    p.lifetime -= dt;
    if (p.lifetime <= 0 || p.position.x ** 2 + p.position.z ** 2 > (worldState.boundsRadius * 1.3) ** 2) {
      p.active = false;
      continue;
    }
    const wh = seaHeight(worldState, p.position.x, p.position.z);
    if (p.position.y <= wh) {
      p.waterState = "submerged";
      p.velocity.x *= 0.42;
      p.velocity.y *= 0.42;
      p.velocity.z *= 0.42;
      if (p.terminateOnWaterImpact) {
        p.active = false;
        continue;
      }
    }
    for (const island of worldState.islands) {
      if (distanceSquared(p.position.x, p.position.z, island.position.x, island.position.z) <= island.radius ** 2) {
        p.active = false;
        break;
      }
    }
    if (!p.active) continue;
    if (p.owner === "enemy") {
      const ship = worldState.player;
      if (
        ship.status === "alive" &&
        distanceSquared(p.position.x, p.position.z, ship.position.x, ship.position.z) <= (ship.radius + p.collisionRadius) ** 2 &&
        Math.abs(p.position.y - ship.position.y) <= PROJ_HEIGHT_HIT
      ) {
        p.active = false;
        const len = Math.hypot(p.velocity.x, p.velocity.y, p.velocity.z) || 1;
        const imp = p.impactImpulse / Math.max(1, ship.mass);
        ship.linearVelocity.x += (p.velocity.x / len) * imp;
        ship.linearVelocity.z += (p.velocity.z / len) * imp;
        damagePlayer(worldState, CANNON_DAMAGE);
      }
      continue;
    }
    for (const e of ecs.enemyTable.values()) {
      if (
        e.status === "alive" &&
        distanceSquared(p.position.x, p.position.z, e.position.x, e.position.z) <= (e.radius + p.collisionRadius) ** 2 &&
        Math.abs(p.position.y - e.position.y) <= PROJ_HEIGHT_HIT
      ) {
        p.active = false;
        const len = Math.hypot(p.velocity.x, p.velocity.y, p.velocity.z) || 1;
        const imp = p.impactImpulse / Math.max(1, e.mass);
        e.linearVelocity.x += (p.velocity.x / len) * imp;
        e.linearVelocity.z += (p.velocity.z / len) * imp;
        const angularKick = clamp(
          ((p.velocity.x * p.velocity.z > 0 ? 1 : -1) * PROJECTILE_HIT_ANGULAR_IMPULSE) / Math.max(1, e.mass),
          -PROJECTILE_HIT_ANGULAR_IMPULSE,
          PROJECTILE_HIT_ANGULAR_IMPULSE
        );
        e.angularVelocity += angularKick;
        damageEnemy(worldState, ecs, e, CANNON_DAMAGE);
        break;
      }
    }
  }
}

function maybeLoot(worldState: WorldWithEcs, ecs: EcsState, enemy: EnemyState, kind: LootKind, amount: number, angleOffset: number, speed: number): void {
  if (amount <= 0) return;
  const angle = enemy.id * 0.71 + angleOffset;
  const heavy = kind === "cargo";
  const loot: LootState = {
    id: worldState.nextLootId++,
    kind,
    amount,
    position: { x: enemy.position.x + Math.cos(angle) * 1.8, y: enemy.position.y + 1, z: enemy.position.z + Math.sin(angle) * 1.8 },
    velocity: { x: Math.cos(angle) * speed + enemy.linearVelocity.x * 0.2, y: 1.7, z: Math.sin(angle) * speed + enemy.linearVelocity.z * 0.2 },
    yaw: enemy.heading,
    angularVelocity: (enemy.id % 2 === 0 ? 1 : -1) * 0.75,
    mass: heavy ? LOOT_FLOAT_MASS_HEAVY : LOOT_FLOAT_MASS_LIGHT,
    buoyancyMultiplier: heavy ? LOOT_BUOYANCY_MULTIPLIER_HEAVY : LOOT_BUOYANCY_MULTIPLIER_LIGHT,
    waterDrag: LOOT_WATER_DRAG,
    angularDamping: LOOT_ANGULAR_DAMPING,
    floats: true,
    waterState: "airborne",
    lifetime: LOOT_LIFETIME,
    pickupRadius: LOOT_PICKUP_RADIUS,
    active: true,
    collisionLayer: "pickups_debris"
  };
  ecs.lootTable.set(loot.id, loot);
}

function spawnLoot(worldState: WorldWithEcs, ecs: EcsState, enemy: EnemyState): void {
  const p = EPF[enemy.archetype];
  maybeLoot(worldState, ecs, enemy, "gold", p.lootGoldBase + (enemy.id % 4) * 5, 0.2, 2.3);
  maybeLoot(worldState, ecs, enemy, "repair_material", p.lootMaterialBase + (enemy.id % 2), -0.32, 1.5);
  maybeLoot(worldState, ecs, enemy, "cargo", p.lootCargoBase + (enemy.id % 3), 0.92, 1.8);
}

function updateLootPhysics(worldState: WorldWithEcs, ecs: EcsState, dt: number): void {
  for (const l of ecs.lootTable.values()) {
    if (!l.active) continue;
    const wh = seaHeight(worldState, l.position.x, l.position.z);
    let fy = worldState.physics.gravity * l.mass;
    const inWater = l.position.y <= wh + 0.05;
    if (inWater && l.floats) {
      const sub = wh - l.position.y;
      if (sub > 0) fy += sub * l.mass * 9.5 * l.buoyancyMultiplier;
      l.waterState = sub > 0.02 ? "submerged" : "water_entry";
    } else l.waterState = "airborne";
    const damp = Math.exp(-(inWater ? l.waterDrag : 0.32) * dt);
    l.velocity.y += (fy / Math.max(1, l.mass)) * dt;
    l.velocity.x *= damp;
    l.velocity.y *= damp;
    l.velocity.z *= damp;
    l.position.x += l.velocity.x * dt;
    l.position.y += l.velocity.y * dt;
    l.position.z += l.velocity.z * dt;
    l.angularVelocity *= Math.exp(-l.angularDamping * dt);
    l.yaw = normalizeAngle(l.yaw + l.angularVelocity * dt);
    l.lifetime -= dt;
    if (l.lifetime <= 0) l.active = false;
  }
}

function collectLoot(worldState: WorldWithEcs, ecs: EcsState): boolean {
  let collected = false;
  for (const l of ecs.lootTable.values()) {
    if (!l.active) continue;
    const range = l.pickupRadius + worldState.player.radius * 0.75;
    if (distanceSquared(worldState.player.position.x, worldState.player.position.z, l.position.x, l.position.z) > range ** 2) continue;
    l.active = false;
    collected = true;
    worldState.flags.lootCollected += 1;
    if (l.kind === "gold") {
      worldState.wallet.gold += l.amount;
      worldState.flags.goldCollected += l.amount;
    } else if (l.kind === "repair_material") worldState.wallet.repairMaterials += l.amount;
    else if (l.kind === "cargo") worldState.wallet.cargo += l.amount;
    emitEvent(worldState, { type: "loot_pickup", kind: l.kind, amount: l.amount });
  }
  return collected;
}

function tryRepair(worldState: WorldWithEcs): void {
  const p = worldState.player;
  if (p.status !== "alive" || p.repairCooldown > 0 || p.hp >= p.maxHp || worldState.wallet.repairMaterials <= 0) return;
  worldState.wallet.repairMaterials -= 1;
  p.hp = Math.min(p.maxHp, p.hp + PLAYER_REPAIR_AMOUNT);
  p.repairCooldown = PLAYER_REPAIR_COOLDOWN;
  setDamageState(p);
  emitEvent(worldState, { type: "repair_used" });
}

function updateBurst(worldState: WorldWithEcs, inputState: InputState, dt: number): void {
  const b = worldState.burst;
  const oldCd = b.cooldown;
  b.cooldown = Math.max(0, b.cooldown - dt);
  if (oldCd > 0 && b.cooldown === 0) emitEvent(worldState, { type: "burst_ready" });

  const stopBurst = (startCooldown: boolean): void => {
    if (!b.active) {
      return;
    }
    b.active = false;
    b.remaining = 0;
    if (startCooldown) {
      b.cooldown = Math.max(b.cooldown, PLAYER_BURST_COOLDOWN);
    }
  };

  if (worldState.player.status !== "alive" || worldState.port.menuOpen) {
    stopBurst(true);
    return;
  }

  if (!b.active && inputState.burst && b.cooldown <= 0) {
    b.active = true;
    b.remaining = PLAYER_BURST_DURATION;
    emitEvent(worldState, { type: "burst_started" });
  }

  if (!b.active) {
    return;
  }

  if (!inputState.burst) {
    stopBurst(true);
    return;
  }

  b.remaining = Math.max(0, b.remaining - dt);
  if (b.remaining <= 0) {
    stopBurst(true);
  }
}

function updateSinking(worldState: WorldWithEcs, ecs: EcsState, dt: number): void {
  const p = worldState.player;
  if (p.status === "sinking") {
    p.sinkTimer = Math.max(0, p.sinkTimer - dt);
    p.buoyancyLoss = clamp(p.buoyancyLoss + dt * SINK_BUOY_LOSS_RATE, 0, 1);
    p.rollVelocity += 0.12 * dt;
    p.pitchVelocity += 0.08 * dt;
    p.linearVelocity.x *= Math.exp(-1.1 * dt);
    p.linearVelocity.z *= Math.exp(-1.1 * dt);
    p.linearVelocity.y -= 2 * dt;
    p.position.y += p.linearVelocity.y * dt;
    p.roll = clamp(p.roll + p.rollVelocity * dt, -1.1, 1.1);
    p.pitch = clamp(p.pitch + p.pitchVelocity * dt, -0.8, 0.8);
    if (p.sinkTimer <= 0) {
      p.position.x = PLAYER_RESPAWN.x;
      p.position.z = PLAYER_RESPAWN.z;
      p.position.y = resolveShipSpawnHeight(worldState, p.position.x, p.position.z, PLAYER_RESPAWN.y);
      p.heading = PLAYER_RESPAWN.heading;
      p.pitch = 0;
      p.roll = 0;
      p.linearVelocity = { x: 0, y: 0, z: 0 };
      p.angularVelocity = 0;
      p.pitchVelocity = 0;
      p.rollVelocity = 0;
      p.speed = 0;
      p.drift = 0;
      p.throttle = 0;
      p.turnInput = 0;
      p.hp = p.maxHp;
      p.reload.left = 0;
      p.reload.right = 0;
      p.status = "alive";
      p.damageState = "healthy";
      p.sinkTimer = 0;
      p.repairCooldown = 0;
      p.buoyancyLoss = 0;
      p.waterState = "submerged";
      worldState.flags.playerRespawns += 1;
    }
  }
  for (const e of ecs.enemyTable.values()) {
    if (e.status !== "sinking") continue;
    e.sinkTimer = Math.max(0, e.sinkTimer - dt);
    e.buoyancyLoss = clamp(e.buoyancyLoss + dt * SINK_BUOY_LOSS_RATE, 0, 1);
    e.rollVelocity += 0.1 * dt;
    e.linearVelocity.x *= Math.exp(-1.2 * dt);
    e.linearVelocity.z *= Math.exp(-1.2 * dt);
    e.linearVelocity.y -= 2.1 * dt;
    e.position.y += e.linearVelocity.y * dt;
    if (e.sinkTimer <= 0) {
      ecs.enemyTable.delete(e.id);
      ecs.shipTable.delete(e.id);
    }
  }
}

function spawnConvoy(worldState: WorldWithEcs, ecs: EcsState): void {
  const b = chooseSpawnPoint(worldState);
  spawnEnemy(worldState, ecs, "merchant", b);
  spawnEnemy(worldState, ecs, "raider", { x: b.x + Math.cos(b.heading + Math.PI * 0.5) * 7, z: b.z + Math.sin(b.heading + Math.PI * 0.5) * 7, heading: normalizeAngle(b.heading + 0.1) });
}

function spawnNavyPatrol(worldState: WorldWithEcs, ecs: EcsState): void {
  const navyAlive = [...ecs.enemyTable.values()].some((e) => e.status === "alive" && e.archetype === "navy");
  if (!navyAlive) spawnEnemy(worldState, ecs, "navy");
}

function activateStorm(worldState: WorldWithEcs): void {
  const c = worldState.islands.filter((i) => i.kind === "hostile" || i.kind === "scenic");
  const pick = c[worldState.eventDirector.cycleIndex % Math.max(1, c.length)] ?? worldState.islands[0];
  if (!pick) return;
  worldState.storm.active = true;
  worldState.storm.center.x = pick.position.x;
  worldState.storm.center.z = pick.position.z;
  worldState.storm.radius = STORM_RADIUS;
  worldState.storm.remaining = EVENT_STORM_DURATION;
  worldState.storm.intensity = STORM_INTENSITY_MAX;
}

function startEvent(worldState: WorldWithEcs, ecs: EcsState, kind: WorldEventKind): void {
  worldState.eventDirector.activeKind = kind;
  emitEvent(worldState, { type: "world_event_started", kind });
  if (kind === "enemy_convoy") {
    spawnConvoy(worldState, ecs);
    worldState.eventDirector.remaining = EVENT_CONVOY_DURATION;
    worldState.eventDirector.statusText = "Merchant convoy spotted with raider escort.";
  } else if (kind === "storm") {
    activateStorm(worldState);
    worldState.eventDirector.remaining = EVENT_STORM_DURATION;
    worldState.eventDirector.statusText = "Storm front rolling in. Visibility and speed reduced.";
  } else {
    spawnNavyPatrol(worldState, ecs);
    worldState.eventDirector.remaining = EVENT_NAVY_DURATION;
    worldState.eventDirector.statusText = "Navy patrol has entered contested waters.";
  }
}

function eventTimer(worldState: WorldWithEcs, ecs: EcsState, dt: number): void {
  const d = worldState.eventDirector;
  if (d.activeKind) {
    d.remaining = Math.max(0, d.remaining - dt);
    if (worldState.storm.active) {
      worldState.storm.remaining = Math.max(0, worldState.storm.remaining - dt);
      if (worldState.storm.remaining <= 0) worldState.storm.active = false;
    }
    if (d.remaining <= 0) {
      d.activeKind = null;
      d.timer = d.interval;
      d.statusText = "Scanning the horizon for the next encounter.";
      worldState.storm.active = false;
      worldState.storm.remaining = 0;
    }
    return;
  }
  d.timer -= dt;
  if (d.timer > 0) return;
  const kind = EVENT_CYCLE[d.cycleIndex % EVENT_CYCLE.length]!;
  d.cycleIndex += 1;
  startEvent(worldState, ecs, kind);
}

function trySellCargo(worldState: WorldWithEcs): boolean {
  if (!worldState.port.menuOpen || worldState.wallet.cargo <= 0) return false;
  const amount = worldState.wallet.cargo;
  const gold = amount * CARGO_SALE_VALUE;
  worldState.wallet.cargo = 0;
  worldState.wallet.gold += gold;
  emitEvent(worldState, { type: "cargo_sold", amount, goldGained: gold });
  return true;
}

function updateCombatIntensity(worldState: WorldWithEcs, ecs: EcsState, dt: number): void {
  if (worldState.port.menuOpen || worldState.player.status !== "alive") {
    worldState.combatIntensity = Math.max(0, worldState.combatIntensity - dt * 1.8);
    return;
  }
  let near = Number.POSITIVE_INFINITY;
  for (const e of ecs.enemyTable.values()) {
    if (e.status !== "alive") continue;
    const d = Math.sqrt(distanceSquared(worldState.player.position.x, worldState.player.position.z, e.position.x, e.position.z));
    if (d < near) near = d;
  }
  let t = 0.08;
  if (Number.isFinite(near)) t = near < 24 ? 1 : near < 40 ? 0.72 : near < 62 ? 0.45 : 0.22;
  if (ecs.projectileTable.size > 2) t = Math.min(1, t + 0.16);
  if (insideStorm(worldState, worldState.player)) t = Math.min(1, t + 0.08);
  const a = clamp(dt * 2.8, 0, 1);
  worldState.combatIntensity = clamp(worldState.combatIntensity + (t - worldState.combatIntensity) * a, 0, 1);
}

function cleanup(ecs: EcsState): void {
  for (const p of ecs.projectileTable.values()) if (!p.active) ecs.projectileTable.delete(p.id);
  for (const l of ecs.lootTable.values()) if (!l.active) ecs.lootTable.delete(l.id);
}

export function closePortMenuEcs(worldState: WorldWithEcs): void {
  togglePortMenu(worldState, false);
}

export function tryPurchaseHullUpgradeEcs(worldState: WorldWithEcs): boolean {
  if (!worldState.port.menuOpen || worldState.wallet.gold < worldState.upgrade.nextCost) return false;
  worldState.wallet.gold -= worldState.upgrade.nextCost;
  worldState.upgrade.hullLevel += 1;
  worldState.upgrade.nextCost += UPGRADE_HULL_COST_STEP;
  worldState.player.maxHp += UPGRADE_HULL_HP_BONUS;
  worldState.player.hp = Math.min(worldState.player.maxHp, worldState.player.hp + UPGRADE_HULL_HP_BONUS);
  worldState.player.mass += 1.4;
  worldState.player.buoyancyStrength += 10;
  setDamageState(worldState.player);
  emitEvent(worldState, { type: "upgrade_purchased", level: worldState.upgrade.hullLevel });
  return true;
}

export function trySellCargoEcs(worldState: WorldWithEcs): boolean {
  return trySellCargo(worldState);
}

export function drainSimulationEventsEcs(worldState: WorldWithEcs): SimulationEvent[] {
  const drained = [...worldState.events];
  worldState.events.length = 0;
  return drained;
}

export function updateEcsSimulation(worldState: WorldWithEcs, inputState: InputState, dt: number): void {
  if (dt <= 0) return;
  const ecs = ensureEcsState(worldState);
  syncEcsFromWorldView(worldState, ecs);
  worldState.time += dt;
  updatePortRange(worldState);
  let interact = false;
  if (inputState.interact) {
    if (worldState.port.menuOpen) togglePortMenu(worldState, false);
    else interact = true;
  }
  if (worldState.port.menuOpen) {
    if (inputState.repair) tryRepair(worldState);
    updateCombatIntensity(worldState, ecs, dt);
    syncWorldViewFromEcs(worldState, ecs);
    return;
  }
  eventTimer(worldState, ecs, dt);
  decReload(worldState.player, dt);
  for (const e of ecs.enemyTable.values()) decReload(e, dt);
  updateBurst(worldState, inputState, dt);
  const intents = ecs.enemyIntentScratch;
  intents.clear();
  for (const e of ecs.enemyTable.values()) intents.set(e.id, enemyIntent(worldState, e, dt));
  if (worldState.player.status === "alive") {
    updateShipPhysics(worldState, worldState.player, inputState.throttle, inputState.turn, dt, {
      boostActive: worldState.burst.active
    });
    keepInBounds(worldState, worldState.player, true);
  }
  for (const e of ecs.enemyTable.values()) {
    if (e.status !== "alive") continue;
    const i = intents.get(e.id) ?? { throttle: 0, turn: 0, fireSide: null };
    updateShipPhysics(worldState, e, i.throttle, i.turn, dt);
    keepInBounds(worldState, e, false);
  }
  const ships = [...ecs.shipTable.values()];
  for (const s of ships) collideShipWithIsland(worldState, ecs, s);
  for (let i = 0; i < ships.length; i += 1) for (let j = i + 1; j < ships.length; j += 1) if (ships[i] && ships[j]) collideShips(worldState, ecs, ships[i]!, ships[j]!);
  if (worldState.player.status === "alive") {
    if (inputState.fireLeft) tryFire(worldState.player, "left", worldState, ecs);
    if (inputState.fireRight) tryFire(worldState.player, "right", worldState, ecs);
    if (inputState.repair) tryRepair(worldState);
  }
  for (const e of ecs.enemyTable.values()) {
    if (e.status !== "alive") continue;
    const i = intents.get(e.id);
    if (e.aiState === "fire" && i?.fireSide) {
      const f = tryFire(e, i.fireSide, worldState, ecs, e);
      if (f) {
        e.aiState = "line_up_broadside";
        e.aiStateTimer = 0;
      }
    }
  }
  projectileSystem(worldState, ecs, dt);
  updateSinking(worldState, ecs, dt);
  updateLootPhysics(worldState, ecs, dt);
  let consumed = false;
  if (interact) {
    consumed = collectLoot(worldState, ecs);
  }
  updatePortRange(worldState);
  if (interact && !consumed && worldState.port.playerInRange) togglePortMenu(worldState, true);
  worldState.spawnDirector.timer -= dt;
  spawnEnemyIfNeeded(worldState, ecs);
  setDamageState(worldState.player);
  for (const e of ecs.enemyTable.values()) setDamageState(e);
  cleanup(ecs);
  updateCombatIntensity(worldState, ecs, dt);
  syncWorldViewFromEcs(worldState, ecs);
}
