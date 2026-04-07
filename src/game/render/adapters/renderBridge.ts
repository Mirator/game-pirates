import {
  Color,
  ColorRepresentation,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3
} from "three";
import {
  SINK_DURATION,
  type CannonSide,
  type EnemyArchetype,
  type EnemyState,
  type LootState,
  type ProjectileState,
  type ShipOwner,
  type ShipState,
  type WorldState
} from "../../simulation";
import { classifyRelativeSide } from "../../simulation/sideMath";
import type { EnvironmentObjects } from "../objects/createEnvironment";
import { createShipDefinition, createShipMesh, type ShipVisual, type ShipVisualRole } from "../objects/createShipMesh";
import {
  createShipWakeController,
  type WakeDebugSurface,
  type ShipWakeController,
  type WakeQualityLevel,
  type WakeShaderInfluence
} from "../wake/createShipWakeController";

const HIT_FLASH_DURATION = 0.24;
const MUZZLE_FLASH_DURATION = 0.18;
const FLASH_COLOR = new Color("#ff8a56");
const MUZZLE_MIN_DISTANCE_SQ = 52;
const CAMERA_WORLD_UP = new Vector3(0, 1, 0);
const WAKE_POSITION_SCRATCH = new Vector3();
const WAKE_FORWARD_SCRATCH = new Vector3();

export interface RenderShipSnapshot {
  x: number;
  z: number;
  heading: number;
  speed: number;
  drift: number;
  throttle: number;
}

export interface RenderPositionSnapshot {
  x: number;
  z: number;
}

export interface RenderPreviousSnapshot {
  player: RenderShipSnapshot;
  enemies: Map<number, RenderShipSnapshot>;
  projectiles: Map<number, RenderPositionSnapshot>;
  loot: Map<number, RenderPositionSnapshot>;
}

export interface RenderInterpolationContext {
  alpha: number;
  fixedStep: number;
  previousSnapshot: RenderPreviousSnapshot;
}

interface InterpolatedShipPose {
  x: number;
  z: number;
  heading: number;
  speed: number;
  drift: number;
  throttle: number;
  turnRate: number;
}

export interface ShipFxRuntimeState {
  hitFlashTimer: number;
  muzzleLeftTimer: number;
  muzzleRightTimer: number;
}

export interface RenderBridgeState {
  scene: Scene;
  camera: PerspectiveCamera;
  playerMesh: Group;
  playerVisual: ShipVisual;
  wakeRoot: Group;
  wakeDebug: WakeDebugSurface;
  playerWakeController: ShipWakeController;
  enemyWakeControllers: Map<number, ShipWakeController>;
  wakeInfluencesScratch: WakeShaderInfluence[];
  enemyRoot: Group;
  enemyMeshes: Map<number, Group>;
  enemyVisuals: Map<number, ShipVisual>;
  environment: EnvironmentObjects;
  projectileRoot: Group;
  projectileMeshes: Map<number, Mesh>;
  lootRoot: Group;
  lootMeshes: Map<number, Mesh>;
  seenEnemyIds: Set<number>;
  seenProjectileIds: Set<number>;
  seenLootIds: Set<number>;
  knownProjectileOwners: Map<number, ShipOwner>;
  knownProjectilePruneScratch: number[];
  cameraDesiredPosition: Vector3;
  cameraDesiredLookTarget: Vector3;
  cameraLookTarget: Vector3;
  cameraSmoothedHeading: number;
  cameraHeadingInitialized: boolean;
  cameraLookInitialized: boolean;
  playerPoseScratch: InterpolatedShipPose;
  enemyPoseScratch: InterpolatedShipPose;
  enemyPoseCache: Map<number, InterpolatedShipPose>;
  playerFx: ShipFxRuntimeState;
  enemyFx: Map<number, ShipFxRuntimeState>;
  playerLastHp: number;
  enemyLastHp: Map<number, number>;
}

function createShipFxRuntimeState(): ShipFxRuntimeState {
  return {
    hitFlashTimer: 0,
    muzzleLeftTimer: 0,
    muzzleRightTimer: 0
  };
}

function createProjectileMesh(color: ColorRepresentation): Mesh {
  return new Mesh(
    new SphereGeometry(0.3, 6, 6),
    new MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.16,
      flatShading: true,
      roughness: 0.35
    })
  );
}

function createLootMesh(loot: LootState): Mesh {
  return new Mesh(
    new SphereGeometry(loot.kind === "gold" ? 0.5 : 0.45, 6, 6),
    new MeshStandardMaterial({
      color: loot.kind === "gold" ? "#e8c251" : "#76c89f",
      emissive: loot.kind === "gold" ? "#9a7a20" : "#2f7b5c",
      emissiveIntensity: 0.14,
      roughness: 0.45
    })
  );
}

function mapEnemyRole(archetype: EnemyArchetype): ShipVisualRole {
  switch (archetype) {
    case "merchant":
      return "merchant";
    case "navy":
      return "navy";
    case "raider":
    default:
      return "raider";
  }
}

function mapEnemyWakeQuality(archetype: EnemyArchetype): WakeQualityLevel {
  switch (archetype) {
    case "merchant":
      return "low";
    case "navy":
      return "medium";
    case "raider":
    default:
      return "medium";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

function normalizeAngle(angle: number): number {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

function shortestAngleLerp(from: number, to: number, alpha: number): number {
  const delta = normalizeAngle(to - from);
  return normalizeAngle(from + delta * alpha);
}

function setInterpolatedShipPose(
  ship: ShipState,
  previous: RenderShipSnapshot | undefined,
  alpha: number,
  fixedStep: number,
  target: InterpolatedShipPose
): void {
  if (!previous) {
    target.x = ship.position.x;
    target.z = ship.position.z;
    target.heading = ship.heading;
    target.speed = ship.speed;
    target.drift = ship.drift;
    target.throttle = ship.throttle;
    target.turnRate = 0;
    return;
  }

  target.x = lerp(previous.x, ship.position.x, alpha);
  target.z = lerp(previous.z, ship.position.z, alpha);
  target.heading = shortestAngleLerp(previous.heading, ship.heading, alpha);
  target.speed = lerp(previous.speed, ship.speed, alpha);
  target.drift = lerp(previous.drift, ship.drift, alpha);
  target.throttle = lerp(previous.throttle, ship.throttle, alpha);
  target.turnRate = normalizeAngle(ship.heading - previous.heading) / Math.max(1e-5, fixedStep);
}

function copyPose(target: InterpolatedShipPose, source: InterpolatedShipPose): void {
  target.x = source.x;
  target.z = source.z;
  target.heading = source.heading;
  target.speed = source.speed;
  target.drift = source.drift;
  target.throttle = source.throttle;
  target.turnRate = source.turnRate;
}

function applyShipPose(ship: ShipState, pose: InterpolatedShipPose, visual: ShipVisual, renderTime: number): void {
  const sinkProgress = ship.status === "sinking" ? (SINK_DURATION - ship.sinkTimer) / SINK_DURATION : 0;
  const sinkOffset = -Math.max(0, sinkProgress) * 2.2;
  const speedAbs = Math.abs(pose.speed);
  const bobAmplitude = 0.02 + clamp(speedAbs * 0.003, 0, 0.06);
  const bob = Math.sin(renderTime * 2.1 + pose.x * 0.05 + pose.z * 0.04) * bobAmplitude;

  const rollFromDrift = clamp(pose.drift * 0.024, -0.22, 0.22);
  const leanFromTurn = clamp(-pose.turnRate * 0.032, -0.16, 0.16);
  const pitchFromInput = clamp(-pose.throttle * 0.08 + pose.speed * 0.004, -0.14, 0.14);
  const pitchFromWave = Math.sin(renderTime * 1.7 + pose.z * 0.03) * 0.02;

  visual.group.position.set(pose.x, sinkOffset + bob, pose.z);
  visual.group.rotation.set(
    pitchFromInput + pitchFromWave,
    pose.heading,
    rollFromDrift + leanFromTurn + sinkProgress * 0.24
  );
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

function updateShipVisualFx(ship: ShipState, visual: ShipVisual, fx: ShipFxRuntimeState, dt: number): void {
  updateHitFlashFx(visual, fx, dt);
  fx.muzzleLeftTimer = updateMuzzleFxTimer(fx.muzzleLeftTimer, visual.muzzleLeft, dt);
  fx.muzzleRightTimer = updateMuzzleFxTimer(fx.muzzleRightTimer, visual.muzzleRight, dt);

  if (ship.status !== "alive") {
    visual.muzzleLeft.group.visible = false;
    visual.muzzleRight.group.visible = false;
  }
}

function updateWakeController(
  controller: ShipWakeController,
  positionX: number,
  positionZ: number,
  heading: number,
  speed: number,
  turnRate: number,
  boosting: boolean,
  frameDt: number
): WakeShaderInfluence {
  const forwardX = Math.sin(heading);
  const forwardZ = Math.cos(heading);
  const position = WAKE_POSITION_SCRATCH.set(positionX, 0, positionZ);
  const forward = WAKE_FORWARD_SCRATCH.set(forwardX, 0, forwardZ);

  controller.setTransform(position, forward);
  controller.setSpeed(speed);
  controller.setTurnRate(turnRate);
  controller.setBoosting(boosting);
  controller.update(frameDt);
  return controller.getShaderInfluence();
}

function disposeGroup(group: Group): void {
  group.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.geometry || !mesh.material) {
      return;
    }
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) {
        (material as Material).dispose();
      }
    } else {
      (mesh.material as Material).dispose();
    }
  });
}

function detectBroadsideSide(ship: ShipState, projectile: ProjectileState): CannonSide {
  const toProjectileX = projectile.position.x - ship.position.x;
  const toProjectileZ = projectile.position.z - ship.position.z;
  return classifyRelativeSide(ship.heading, toProjectileX, toProjectileZ);
}

function orientCameraWithCanonicalBasis(camera: PerspectiveCamera, lookTarget: Vector3): void {
  camera.up.copy(CAMERA_WORLD_UP);
  camera.lookAt(lookTarget);
  camera.updateMatrixWorld();
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

  visual.group.updateMatrixWorld(true);
  const localProjectile = visual.group.worldToLocal(
    new Vector3(projectile.position.x, visual.group.position.y + 1, projectile.position.z)
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

function detectProjectileSpawnFx(worldState: WorldState, bridge: RenderBridgeState, projectile: ProjectileState): void {
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

function syncPlayerHpFx(worldState: WorldState, bridge: RenderBridgeState): void {
  if (worldState.player.hp < bridge.playerLastHp - 0.001) {
    triggerHitFlash(bridge.playerFx);
  }
  bridge.playerLastHp = worldState.player.hp;
}

function syncEnemyHpFx(enemy: EnemyState, bridge: RenderBridgeState): void {
  const previousHp = bridge.enemyLastHp.get(enemy.id);
  if (previousHp !== undefined && enemy.hp < previousHp - 0.001) {
    const enemyFx = bridge.enemyFx.get(enemy.id);
    if (enemyFx) {
      triggerHitFlash(enemyFx);
    }
  }
  bridge.enemyLastHp.set(enemy.id, enemy.hp);
}

export function syncRenderFromSimulation(
  worldState: WorldState,
  bridge: RenderBridgeState,
  frameDt: number,
  interpolation: RenderInterpolationContext
): void {
  const alpha = clamp(interpolation.alpha, 0, 1);
  const renderTime = worldState.time - interpolation.fixedStep * (1 - alpha);

  const playerPose = bridge.playerPoseScratch;
  setInterpolatedShipPose(worldState.player, interpolation.previousSnapshot.player, alpha, interpolation.fixedStep, playerPose);
  applyShipPose(worldState.player, playerPose, bridge.playerVisual, renderTime);
  syncPlayerHpFx(worldState, bridge);

  const enemySeen = bridge.seenEnemyIds;
  enemySeen.clear();
  for (const enemy of worldState.enemies) {
    let enemyVisual = bridge.enemyVisuals.get(enemy.id);
    if (!enemyVisual) {
      const role = mapEnemyRole(enemy.archetype);
      enemyVisual = createShipMesh(createShipDefinition(role));
      bridge.enemyRoot.add(enemyVisual.group);
      bridge.enemyMeshes.set(enemy.id, enemyVisual.group);
      bridge.enemyVisuals.set(enemy.id, enemyVisual);
      bridge.enemyFx.set(enemy.id, createShipFxRuntimeState());
      bridge.enemyLastHp.set(enemy.id, enemy.hp);

      const wakeController = createShipWakeController({
        quality: mapEnemyWakeQuality(enemy.archetype),
        sternOffset: enemyVisual.definition.silhouette.hullLength * 0.48,
        rootName: `wake-enemy-${enemy.id}`
      });
      bridge.wakeRoot.add(wakeController.getRoot());
      bridge.enemyWakeControllers.set(enemy.id, wakeController);
    }

    const enemyPose = bridge.enemyPoseScratch;
    setInterpolatedShipPose(
      enemy,
      interpolation.previousSnapshot.enemies.get(enemy.id),
      alpha,
      interpolation.fixedStep,
      enemyPose
    );
    applyShipPose(enemy, enemyPose, enemyVisual, renderTime + enemy.id);

    let cachedPose = bridge.enemyPoseCache.get(enemy.id);
    if (!cachedPose) {
      cachedPose = {
        x: 0,
        z: 0,
        heading: 0,
        speed: 0,
        drift: 0,
        throttle: 0,
        turnRate: 0
      };
      bridge.enemyPoseCache.set(enemy.id, cachedPose);
    }
    copyPose(cachedPose, enemyPose);
    syncEnemyHpFx(enemy, bridge);
    enemySeen.add(enemy.id);
  }

  for (const [enemyId, enemyMesh] of bridge.enemyMeshes.entries()) {
    if (enemySeen.has(enemyId)) {
      continue;
    }
    bridge.enemyRoot.remove(enemyMesh);
    disposeGroup(enemyMesh);
    bridge.enemyMeshes.delete(enemyId);
    bridge.enemyVisuals.delete(enemyId);
    bridge.enemyFx.delete(enemyId);
    bridge.enemyLastHp.delete(enemyId);
    bridge.enemyPoseCache.delete(enemyId);

    const wakeController = bridge.enemyWakeControllers.get(enemyId);
    if (wakeController) {
      bridge.wakeRoot.remove(wakeController.getRoot());
      wakeController.dispose();
      bridge.enemyWakeControllers.delete(enemyId);
    }
  }

  const seenProjectiles = bridge.seenProjectileIds;
  seenProjectiles.clear();
  for (const projectile of worldState.projectiles) {
    if (!projectile.active) {
      continue;
    }

    const isNewProjectile = !bridge.knownProjectileOwners.has(projectile.id);
    if (isNewProjectile) {
      bridge.knownProjectileOwners.set(projectile.id, projectile.owner);
      detectProjectileSpawnFx(worldState, bridge, projectile);
    }

    let projectileMesh = bridge.projectileMeshes.get(projectile.id);
    if (!projectileMesh) {
      projectileMesh = createProjectileMesh(projectile.owner === "player" ? "#191919" : "#c95b4c");
      bridge.projectileMeshes.set(projectile.id, projectileMesh);
      bridge.projectileRoot.add(projectileMesh);
    }

    const previousProjectile = interpolation.previousSnapshot.projectiles.get(projectile.id);
    const projectileX = previousProjectile ? lerp(previousProjectile.x, projectile.position.x, alpha) : projectile.position.x;
    const projectileZ = previousProjectile ? lerp(previousProjectile.z, projectile.position.z, alpha) : projectile.position.z;
    projectileMesh.position.set(projectileX, 1.06, projectileZ);
    seenProjectiles.add(projectile.id);
  }

  for (const [id, projectileMesh] of bridge.projectileMeshes.entries()) {
    if (seenProjectiles.has(id)) {
      continue;
    }
    bridge.projectileRoot.remove(projectileMesh);
    projectileMesh.geometry.dispose();
    (projectileMesh.material as MeshStandardMaterial).dispose();
    bridge.projectileMeshes.delete(id);
  }

  const knownProjectilePruneScratch = bridge.knownProjectilePruneScratch;
  knownProjectilePruneScratch.length = 0;
  for (const knownId of bridge.knownProjectileOwners.keys()) {
    if (!seenProjectiles.has(knownId)) {
      knownProjectilePruneScratch.push(knownId);
    }
  }
  for (const knownId of knownProjectilePruneScratch) {
    bridge.knownProjectileOwners.delete(knownId);
  }

  updateShipVisualFx(worldState.player, bridge.playerVisual, bridge.playerFx, frameDt);
  for (const enemy of worldState.enemies) {
    const enemyVisual = bridge.enemyVisuals.get(enemy.id);
    const enemyFx = bridge.enemyFx.get(enemy.id);
    if (!enemyVisual || !enemyFx) {
      continue;
    }
    updateShipVisualFx(enemy, enemyVisual, enemyFx, frameDt);
  }

  const wakeInfluences = bridge.wakeInfluencesScratch;
  wakeInfluences.length = 0;
  const playerWakeInfluence = updateWakeController(
    bridge.playerWakeController,
    playerPose.x,
    playerPose.z,
    playerPose.heading,
    playerPose.speed,
    playerPose.turnRate,
    worldState.burst.active,
    frameDt
  );
  if (playerWakeInfluence.intensity > 0.01) {
    wakeInfluences.push(playerWakeInfluence);
  }

  for (const enemy of worldState.enemies) {
    const enemyPose = bridge.enemyPoseCache.get(enemy.id);
    const enemyWakeController = bridge.enemyWakeControllers.get(enemy.id);
    if (!enemyPose || !enemyWakeController) {
      continue;
    }
    const wakeInfluence = updateWakeController(
      enemyWakeController,
      enemyPose.x,
      enemyPose.z,
      enemyPose.heading,
      enemyPose.speed,
      enemyPose.turnRate,
      false,
      frameDt
    );
    if (wakeInfluence.intensity > 0.01) {
      wakeInfluences.push(wakeInfluence);
    }
  }

  const seenLoot = bridge.seenLootIds;
  seenLoot.clear();
  for (const loot of worldState.loot) {
    if (!loot.active) {
      continue;
    }

    let lootMesh = bridge.lootMeshes.get(loot.id);
    if (!lootMesh) {
      lootMesh = createLootMesh(loot);
      bridge.lootRoot.add(lootMesh);
      bridge.lootMeshes.set(loot.id, lootMesh);
    }

    const previousLoot = interpolation.previousSnapshot.loot.get(loot.id);
    const lootX = previousLoot ? lerp(previousLoot.x, loot.position.x, alpha) : loot.position.x;
    const lootZ = previousLoot ? lerp(previousLoot.z, loot.position.z, alpha) : loot.position.z;
    lootMesh.position.set(lootX, 0.65 + Math.sin(renderTime * 3.6 + loot.id * 0.8) * 0.16, lootZ);
    lootMesh.rotation.y = renderTime * 1.5 + loot.id * 0.35;
    seenLoot.add(loot.id);
  }

  for (const [id, lootMesh] of bridge.lootMeshes.entries()) {
    if (seenLoot.has(id)) {
      continue;
    }
    bridge.lootRoot.remove(lootMesh);
    lootMesh.geometry.dispose();
    (lootMesh.material as Material).dispose();
    bridge.lootMeshes.delete(id);
  }

  bridge.cameraSmoothedHeading = playerPose.heading;
  bridge.cameraHeadingInitialized = true;

  const cameraForwardX = Math.sin(bridge.cameraSmoothedHeading);
  const cameraForwardZ = Math.cos(bridge.cameraSmoothedHeading);
  const speedAbs = Math.abs(playerPose.speed);
  const followDistance = 12 + clamp(speedAbs * 0.3, 0, 2.4);
  const desiredHeight = 6.7 + clamp(speedAbs * 0.11, 0, 1.0);

  bridge.cameraDesiredPosition.set(
    playerPose.x - cameraForwardX * followDistance,
    desiredHeight,
    playerPose.z - cameraForwardZ * followDistance
  );

  const desiredLookAhead = 1.15 + clamp(speedAbs * 0.03, 0, 0.24);
  bridge.cameraDesiredLookTarget.set(
    playerPose.x + cameraForwardX * desiredLookAhead,
    1.5 + clamp(speedAbs * 0.035, 0, 0.25),
    playerPose.z + cameraForwardZ * desiredLookAhead
  );

  if (!bridge.cameraLookInitialized) {
    bridge.camera.position.copy(bridge.cameraDesiredPosition);
    bridge.cameraLookTarget.copy(bridge.cameraDesiredLookTarget);
    bridge.cameraLookInitialized = true;
  }

  const positionFollowStrength = 1 - Math.exp(-5.2 * frameDt);
  const lookFollowStrength = 1 - Math.exp(-3.4 * frameDt);

  bridge.camera.position.lerp(bridge.cameraDesiredPosition, positionFollowStrength);
  bridge.cameraLookTarget.lerp(bridge.cameraDesiredLookTarget, lookFollowStrength);
  orientCameraWithCanonicalBasis(bridge.camera, bridge.cameraLookTarget);

  bridge.environment.syncFromWorld(worldState, {
    frameDt,
    renderTime,
    cameraPosition: bridge.camera.position,
    playerPose: {
      x: playerPose.x,
      z: playerPose.z,
      heading: playerPose.heading,
      speed: playerPose.speed,
      drift: playerPose.drift
    },
    wakeInfluences
  });
}
