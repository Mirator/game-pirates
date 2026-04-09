import { Color, Vector3 } from "three";
import type {
  CannonSide,
  EnemyState,
  ProjectileState,
  ShipState,
  WorldState
} from "../../simulation";
import { classifyRelativeSide } from "../../simulation/sideMath";
import type { ShipVisual } from "../objects/createShipMesh";

const HIT_FLASH_DURATION = 0.24;
const MUZZLE_FLASH_DURATION = 0.18;
const FLASH_COLOR = new Color("#ff8a56");
const MUZZLE_MIN_DISTANCE_SQ = 52;

export interface ShipFxRuntimeState {
  hitFlashTimer: number;
  muzzleLeftTimer: number;
  muzzleRightTimer: number;
}

export interface RenderBridgeFxState {
  playerVisual: ShipVisual;
  playerFx: ShipFxRuntimeState;
  enemyVisuals: Map<number, ShipVisual>;
  enemyFx: Map<number, ShipFxRuntimeState>;
  playerLastHp: number;
  enemyLastHp: Map<number, number>;
}

export function createShipFxRuntimeState(): ShipFxRuntimeState {
  return {
    hitFlashTimer: 0,
    muzzleLeftTimer: 0,
    muzzleRightTimer: 0
  };
}

function updateHitFlashFx(visual: ShipVisual, fx: ShipFxRuntimeState, dt: number): void {
  fx.hitFlashTimer = Math.max(0, fx.hitFlashTimer - dt);
  const flashStrength = fx.hitFlashTimer > 0 ? fx.hitFlashTimer / HIT_FLASH_DURATION : 0;

  for (const flashChannel of visual.flashChannels) {
    flashChannel.material.emissive.copy(flashChannel.baseEmissive).lerp(FLASH_COLOR, flashStrength * 0.78);
    flashChannel.material.emissiveIntensity = flashChannel.baseEmissiveIntensity + flashStrength * 0.92;
  }
}

function updateMuzzleFxTimer(timer: number, muzzle: ShipVisual["muzzleLeft"], dt: number): number {
  const nextTimer = Math.max(0, timer - dt);
  if (nextTimer <= 0) {
    muzzle.group.visible = false;
    muzzle.flashMaterial.opacity = 0;
    muzzle.flashMaterial.emissiveIntensity = 0.15;
    muzzle.smokeMaterial.opacity = 0;
    muzzle.smokeMaterial.emissiveIntensity = 0.04;
    return 0;
  }

  const life = nextTimer / MUZZLE_FLASH_DURATION;
  const flare = 1 - life;
  muzzle.group.visible = true;
  muzzle.group.scale.set(0.82 + flare * 1.05, 0.84 + flare * 0.62, 0.82 + flare * 1.05);
  muzzle.flashMaterial.opacity = 0.08 + flare * 0.8;
  muzzle.flashMaterial.emissiveIntensity = 0.24 + flare * 1.12;
  muzzle.smokeMaterial.opacity = 0.08 + flare * 0.4;
  muzzle.smokeMaterial.emissiveIntensity = 0.05 + flare * 0.28;
  return nextTimer;
}

export function updateShipVisualFx(ship: ShipState, visual: ShipVisual, fx: ShipFxRuntimeState, dt: number): void {
  updateHitFlashFx(visual, fx, dt);
  fx.muzzleLeftTimer = updateMuzzleFxTimer(fx.muzzleLeftTimer, visual.muzzleLeft, dt);
  fx.muzzleRightTimer = updateMuzzleFxTimer(fx.muzzleRightTimer, visual.muzzleRight, dt);

  if (ship.status !== "alive") {
    visual.muzzleLeft.group.visible = false;
    visual.muzzleRight.group.visible = false;
  }
}

function detectBroadsideSide(ship: ShipState, projectile: ProjectileState): CannonSide {
  const toProjectileX = projectile.position.x - ship.position.x;
  const toProjectileZ = projectile.position.z - ship.position.z;
  return classifyRelativeSide(ship.heading, toProjectileX, toProjectileZ);
}

function triggerHitFlash(fx: ShipFxRuntimeState): void {
  fx.hitFlashTimer = HIT_FLASH_DURATION;
}

function chooseMuzzleMount(visual: ShipVisual, side: CannonSide, projectile: ProjectileState): Vector3 {
  const mounts = side === "left" ? visual.cannonMounts.left : visual.cannonMounts.right;
  const fallback = new Vector3(side === "left" ? -1 : 1, 0.92, 0);
  const defaultMount = mounts[Math.floor(mounts.length * 0.5)] ?? fallback;
  if (mounts.length <= 1) {
    return defaultMount.clone();
  }

  visual.presentation.updateMatrixWorld(true);
  const localProjectile = visual.presentation.worldToLocal(
    new Vector3(projectile.position.x, projectile.position.y, projectile.position.z)
  );

  let bestMount = defaultMount;
  let bestDistance = Math.abs(defaultMount.z - localProjectile.z);
  for (const mount of mounts) {
    const distance = Math.abs(mount.z - localProjectile.z);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMount = mount;
    }
  }

  return bestMount.clone();
}

function triggerMuzzleFx(visual: ShipVisual, fx: ShipFxRuntimeState, side: CannonSide, projectile: ProjectileState): void {
  const muzzle = side === "left" ? visual.muzzleLeft : visual.muzzleRight;
  const mount = chooseMuzzleMount(visual, side, projectile);

  muzzle.group.position.set(mount.x + (side === "left" ? -0.3 : 0.3), mount.y + 0.04, mount.z);
  muzzle.group.visible = true;

  if (side === "left") {
    fx.muzzleLeftTimer = MUZZLE_FLASH_DURATION;
  } else {
    fx.muzzleRightTimer = MUZZLE_FLASH_DURATION;
  }
}

function findClosestEnemyForProjectile(worldState: WorldState, projectile: ProjectileState): EnemyState | undefined {
  let closest: EnemyState | undefined;
  let closestDistanceSq = Number.POSITIVE_INFINITY;

  for (const enemy of worldState.enemies) {
    if (enemy.status !== "alive") {
      continue;
    }
    const dx = projectile.position.x - enemy.position.x;
    const dz = projectile.position.z - enemy.position.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < closestDistanceSq) {
      closestDistanceSq = distanceSq;
      closest = enemy;
    }
  }

  if (closestDistanceSq > MUZZLE_MIN_DISTANCE_SQ) {
    return undefined;
  }
  return closest;
}

export function detectProjectileSpawnFx(
  worldState: WorldState,
  bridge: RenderBridgeFxState,
  projectile: ProjectileState
): void {
  if (projectile.owner === "player") {
    const side = detectBroadsideSide(worldState.player, projectile);
    triggerMuzzleFx(bridge.playerVisual, bridge.playerFx, side, projectile);
    return;
  }

  const sourceEnemy = findClosestEnemyForProjectile(worldState, projectile);
  if (!sourceEnemy) {
    return;
  }

  const enemyVisual = bridge.enemyVisuals.get(sourceEnemy.id);
  const enemyFx = bridge.enemyFx.get(sourceEnemy.id);
  if (!enemyVisual || !enemyFx) {
    return;
  }

  const side = detectBroadsideSide(sourceEnemy, projectile);
  triggerMuzzleFx(enemyVisual, enemyFx, side, projectile);
}

export function syncPlayerHpFx(worldState: WorldState, bridge: RenderBridgeFxState): void {
  if (worldState.player.hp < bridge.playerLastHp - 0.001) {
    triggerHitFlash(bridge.playerFx);
  }
  bridge.playerLastHp = worldState.player.hp;
}

export function syncEnemyHpFx(enemy: EnemyState, bridge: RenderBridgeFxState): void {
  const previousHp = bridge.enemyLastHp.get(enemy.id);
  if (previousHp !== undefined && enemy.hp < previousHp - 0.001) {
    const enemyFx = bridge.enemyFx.get(enemy.id);
    if (enemyFx) {
      triggerHitFlash(enemyFx);
    }
  }
  bridge.enemyLastHp.set(enemy.id, enemy.hp);
}
