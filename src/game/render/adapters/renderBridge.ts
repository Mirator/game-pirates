import {
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
import { SINK_DURATION, type EnemyArchetype, type LootState, type ShipState, type WorldState } from "../../simulation";
import type { EnvironmentObjects } from "../objects/createEnvironment";
import { createShipMesh } from "../objects/createShipMesh";

export interface RenderShipSnapshot {
  x: number;
  z: number;
  heading: number;
  speed: number;
  drift: number;
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

export interface RenderBridgeState {
  scene: Scene;
  camera: PerspectiveCamera;
  playerMesh: Group;
  enemyRoot: Group;
  enemyMeshes: Map<number, Group>;
  environment: EnvironmentObjects;
  projectileRoot: Group;
  projectileMeshes: Map<number, Mesh>;
  lootRoot: Group;
  lootMeshes: Map<number, Mesh>;
  seenEnemyIds: Set<number>;
  seenProjectileIds: Set<number>;
  seenLootIds: Set<number>;
  cameraDesiredPosition: Vector3;
  cameraDesiredLookTarget: Vector3;
  cameraLookTarget: Vector3;
  cameraSmoothedHeading: number;
  cameraHeadingInitialized: boolean;
  cameraLookInitialized: boolean;
  playerPoseScratch: InterpolatedShipPose;
  enemyPoseScratch: InterpolatedShipPose;
}

interface InterpolatedShipPose {
  x: number;
  z: number;
  heading: number;
  speed: number;
  drift: number;
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

function getEnemyPalette(archetype: EnemyArchetype): { hull: string; sail: string } {
  switch (archetype) {
    case "merchant":
      return { hull: "#5d4c37", sail: "#ece3c4" };
    case "navy":
      return { hull: "#3a4f6b", sail: "#e6eef8" };
    case "raider":
    default:
      return { hull: "#4e2d24", sail: "#d9d0b2" };
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
  target: InterpolatedShipPose
): void {
  if (!previous) {
    target.x = ship.position.x;
    target.z = ship.position.z;
    target.heading = ship.heading;
    target.speed = ship.speed;
    target.drift = ship.drift;
    return;
  }

  target.x = lerp(previous.x, ship.position.x, alpha);
  target.z = lerp(previous.z, ship.position.z, alpha);
  target.heading = shortestAngleLerp(previous.heading, ship.heading, alpha);
  target.speed = lerp(previous.speed, ship.speed, alpha);
  target.drift = lerp(previous.drift, ship.drift, alpha);
}

function applyShipPose(ship: ShipState, pose: InterpolatedShipPose, mesh: Group, renderTime = 0): void {
  const sinkProgress = ship.status === "sinking" ? (SINK_DURATION - ship.sinkTimer) / SINK_DURATION : 0;
  const sinkOffset = -Math.max(0, sinkProgress) * 2.2;

  mesh.position.set(pose.x, sinkOffset + Math.sin(renderTime * 2.3 + pose.x * 0.04) * 0.03, pose.z);
  mesh.rotation.set(0, pose.heading, pose.drift * 0.03 + sinkProgress * 0.28);
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

export function syncRenderFromSimulation(
  worldState: WorldState,
  bridge: RenderBridgeState,
  frameDt: number,
  interpolation: RenderInterpolationContext
): void {
  const alpha = clamp(interpolation.alpha, 0, 1);
  const renderTime = worldState.time - interpolation.fixedStep * (1 - alpha);

  const playerPose = bridge.playerPoseScratch;
  setInterpolatedShipPose(worldState.player, interpolation.previousSnapshot.player, alpha, playerPose);
  applyShipPose(worldState.player, playerPose, bridge.playerMesh, renderTime);

  const enemySeen = bridge.seenEnemyIds;
  enemySeen.clear();
  for (const enemy of worldState.enemies) {
    let enemyMesh = bridge.enemyMeshes.get(enemy.id);
    if (!enemyMesh) {
      const palette = getEnemyPalette(enemy.archetype);
      enemyMesh = createShipMesh(palette.hull, palette.sail);
      bridge.enemyRoot.add(enemyMesh);
      bridge.enemyMeshes.set(enemy.id, enemyMesh);
    }

    const enemyPose = bridge.enemyPoseScratch;
    setInterpolatedShipPose(enemy, interpolation.previousSnapshot.enemies.get(enemy.id), alpha, enemyPose);
    applyShipPose(enemy, enemyPose, enemyMesh, renderTime + enemy.id);
    enemySeen.add(enemy.id);
  }

  for (const [enemyId, enemyMesh] of bridge.enemyMeshes.entries()) {
    if (enemySeen.has(enemyId)) {
      continue;
    }
    bridge.enemyRoot.remove(enemyMesh);
    disposeGroup(enemyMesh);
    bridge.enemyMeshes.delete(enemyId);
  }

  const seenProjectiles = bridge.seenProjectileIds;
  seenProjectiles.clear();
  for (const projectile of worldState.projectiles) {
    if (!projectile.active) {
      continue;
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

  const headingDeadzone = 0.03;
  if (!bridge.cameraHeadingInitialized) {
    bridge.cameraSmoothedHeading = Math.abs(playerPose.heading) <= headingDeadzone ? 0 : playerPose.heading;
    bridge.cameraHeadingInitialized = true;
  }

  let headingDelta = normalizeAngle(playerPose.heading - bridge.cameraSmoothedHeading);
  if (Math.abs(headingDelta) <= headingDeadzone) {
    headingDelta = 0;
  } else {
    headingDelta = Math.sign(headingDelta) * (Math.abs(headingDelta) - headingDeadzone);
  }
  const headingFollowStrength = 1 - Math.exp(-4.8 * frameDt);
  bridge.cameraSmoothedHeading = normalizeAngle(bridge.cameraSmoothedHeading + headingDelta * headingFollowStrength);

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
    bridge.cameraLookTarget.copy(bridge.cameraDesiredLookTarget);
    bridge.cameraLookInitialized = true;
  }

  const positionFollowStrength = 1 - Math.exp(-5.2 * frameDt);
  const lookFollowStrength = 1 - Math.exp(-3.4 * frameDt);

  bridge.camera.position.lerp(bridge.cameraDesiredPosition, positionFollowStrength);
  bridge.cameraLookTarget.lerp(bridge.cameraDesiredLookTarget, lookFollowStrength);
  bridge.camera.lookAt(bridge.cameraLookTarget);

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
    }
  });
}
