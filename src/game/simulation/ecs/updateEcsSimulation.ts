import {
  CANNON_FIRING_CONE_DOT,
  CARGO_SALE_VALUE,
  ENEMY_BROADSIDE_RANGE,
  ENEMY_DETECTION_RANGE,
  ENEMY_HARD_CAP,
  ENEMY_MASS_BASE,
  ENEMY_SPAWN_POINTS,
  PLAYER_BURST_COOLDOWN,
  PLAYER_BURST_DURATION,
  PLAYER_REPAIR_AMOUNT,
  PLAYER_REPAIR_COOLDOWN,
  PLAYER_RESPAWN,
  SHIP_SPAWN_FREEBOARD,
  SINK_DURATION,
  UPGRADE_HULL_COST_STEP,
  UPGRADE_HULL_HP_BONUS,
  WORLD_LAYOUT_SCALE
} from "../constants";
import type {
  CannonSide,
  EnemyArchetype,
  EnemyState,
  InputState,
  ShipDamageState,
  ShipState,
  SimulationEvent,
  WorldEventKind
} from "../types";
import {
  calculateForwardVector as forwardOf,
  classifySideFromLeftDot,
  sideDotAgainstShipLeft
} from "../sideMath";
import { DEFAULT_WATER_SURFACE_TUNING, DEFAULT_WATER_SURFACE_WAVES } from "../../physics/waterProfile";
import { sampleWaterHeight } from "../../physics/waterSurface";
import { createShipBuoyancyProbes, getShipColliderProfileForEnemyArchetype } from "../../ships/shipProfiles";
import { ensureEcsState, syncEcsFromWorldView, syncWorldViewFromEcs } from "./createEcsState";
import { clamp, distanceSquared, normalizeAngle, steeringTowardHeading } from "./math";
import {
  applyShipCollisionDamage,
  decReload,
  projectileSystem as projectileSystemCombat,
  tryFire as tryFireCombat
} from "./systems/combatSystem";
import { collideShipWithIsland, collideShips } from "./systems/collisionSystem";
import { updateEventTimer } from "./systems/eventSystem";
import { collectLoot, spawnLoot as spawnLootDrops, updateLootPhysics } from "./systems/lootSystem";
import { keepInBounds, updateShipPhysics } from "./systems/movementSystem";
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

function getEnemyReloadDuration(enemy: EnemyState): number {
  return EPF[enemy.archetype].reloadDuration;
}

function tryFire(ship: ShipState, side: CannonSide, worldState: WorldWithEcs, ecs: EcsState, enemy?: EnemyState): boolean {
  return tryFireCombat(
    ship,
    side,
    worldState,
    ecs,
    {
      emitEvent: (event) => {
        emitEvent(worldState, event);
      },
      getEnemyReloadDuration
    },
    enemy
  );
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
  applyShipCollisionDamage(ship, speed, {
    onPlayerDamage: (damage) => {
      damagePlayer(worldState, damage);
    },
    onEnemyDamage: (enemy, damage) => {
      damageEnemy(worldState, ecs, enemy, damage);
    }
  });
}

function projectileSystem(worldState: WorldWithEcs, ecs: EcsState, dt: number): void {
  projectileSystemCombat(worldState, ecs, dt, {
    onPlayerDamage: (damage) => {
      damagePlayer(worldState, damage);
    },
    onEnemyDamage: (enemy, damage) => {
      damageEnemy(worldState, ecs, enemy, damage);
    }
  });
}

function spawnLoot(worldState: WorldWithEcs, ecs: EcsState, enemy: EnemyState): void {
  const profile = EPF[enemy.archetype];
  spawnLootDrops(worldState, ecs, enemy, {
    lootGoldBase: profile.lootGoldBase,
    lootMaterialBase: profile.lootMaterialBase,
    lootCargoBase: profile.lootCargoBase
  });
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
  updateEventTimer(worldState, dt, {
    eventCycle: EVENT_CYCLE,
    spawnEnemy: (archetype, spawn) => {
      spawnEnemy(worldState, ecs, archetype, spawn);
    },
    chooseSpawnPoint: () => chooseSpawnPoint(worldState),
    normalizeHeading: (heading) => normalizeAngle(heading),
    hasAliveNavy: () => [...ecs.enemyTable.values()].some((enemy) => enemy.status === "alive" && enemy.archetype === "navy"),
    onWorldEventStarted: (kind) => {
      emitEvent(worldState, { type: "world_event_started", kind });
      if (kind === "enemy_convoy") {
        worldState.eventDirector.statusText = "Merchant convoy spotted with raider escort.";
      } else if (kind === "storm") {
        worldState.eventDirector.statusText = "Storm front rolling in. Visibility and speed reduced.";
      } else {
        worldState.eventDirector.statusText = "Navy patrol has entered contested waters.";
      }
    }
  });
  decReload(worldState.player, dt);
  for (const e of ecs.enemyTable.values()) decReload(e, dt);
  updateBurst(worldState, inputState, dt);
  const intents = ecs.enemyIntentScratch;
  intents.clear();
  for (const e of ecs.enemyTable.values()) intents.set(e.id, enemyIntent(worldState, e, dt));
  if (worldState.player.status === "alive") {
    updateShipPhysics(worldState, worldState.player, inputState.throttle, inputState.turn, dt, movementScalesFor, {
      boostActive: worldState.burst.active
    });
    keepInBounds(worldState, worldState.player, true);
  }
  for (const e of ecs.enemyTable.values()) {
    if (e.status !== "alive") continue;
    const i = intents.get(e.id) ?? { throttle: 0, turn: 0, fireSide: null };
    updateShipPhysics(worldState, e, i.throttle, i.turn, dt, movementScalesFor);
    keepInBounds(worldState, e, false);
  }
  const ships = [...ecs.shipTable.values()];
  const onCollisionImpact = (ship: ShipState, speed: number): void => {
    shipImpactDamage(worldState, ecs, ship, speed);
  };
  for (const s of ships) collideShipWithIsland(worldState, s, onCollisionImpact);
  for (let i = 0; i < ships.length; i += 1) {
    for (let j = i + 1; j < ships.length; j += 1) {
      if (ships[i] && ships[j]) {
        collideShips(ships[i]!, ships[j]!, onCollisionImpact);
      }
    }
  }
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
