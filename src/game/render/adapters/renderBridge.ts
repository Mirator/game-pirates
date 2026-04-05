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
import { SINK_DURATION, type LootState, type ShipState, type WorldState } from "../../simulation";
import type { EnvironmentObjects } from "../objects/createEnvironment";
import { createShipMesh } from "../objects/createShipMesh";

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

function applyShipPose(ship: ShipState, mesh: Group, time = 0): void {
  const sinkProgress = ship.status === "sinking" ? (SINK_DURATION - ship.sinkTimer) / SINK_DURATION : 0;
  const sinkOffset = -Math.max(0, sinkProgress) * 2.2;

  mesh.position.set(ship.position.x, sinkOffset + Math.sin(time * 2.3 + ship.position.x * 0.04) * 0.03, ship.position.z);
  mesh.rotation.set(0, ship.heading, ship.drift * 0.03 + sinkProgress * 0.28);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

export function syncRenderFromSimulation(worldState: WorldState, bridge: RenderBridgeState, frameDt: number): void {
  bridge.environment.update(worldState.time);

  applyShipPose(worldState.player, bridge.playerMesh, worldState.time);

  const enemySeen = new Set<number>();
  for (const enemy of worldState.enemies) {
    let enemyMesh = bridge.enemyMeshes.get(enemy.id);
    if (!enemyMesh) {
      enemyMesh = createShipMesh("#4e2d24", "#d9d0b2");
      bridge.enemyRoot.add(enemyMesh);
      bridge.enemyMeshes.set(enemy.id, enemyMesh);
    }
    applyShipPose(enemy, enemyMesh, worldState.time + enemy.id);
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

  const seenProjectiles = new Set<number>();
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

    projectileMesh.position.set(projectile.position.x, 1.06, projectile.position.z);
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

  const seenLoot = new Set<number>();
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

    lootMesh.position.set(
      loot.position.x,
      0.65 + Math.sin(worldState.time * 3.6 + loot.id * 0.8) * 0.16,
      loot.position.z
    );
    lootMesh.rotation.y += frameDt * 1.5;
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

  const playerForward = {
    x: Math.sin(worldState.player.heading),
    z: Math.cos(worldState.player.heading)
  };
  const followDistance = 12 + clamp(Math.abs(worldState.player.speed) * 0.55, 0, 4.5);
  const desiredHeight = 6.7 + clamp(Math.abs(worldState.player.speed) * 0.2, 0, 1.8);

  const desiredPosition = new Vector3(
    worldState.player.position.x - playerForward.x * followDistance,
    desiredHeight,
    worldState.player.position.z - playerForward.z * followDistance
  );
  const followStrength = 1 - Math.exp(-5.5 * frameDt);
  bridge.camera.position.lerp(desiredPosition, followStrength);
  bridge.camera.lookAt(
    worldState.player.position.x + playerForward.x * 1.3,
    1.5 + clamp(Math.abs(worldState.player.speed) * 0.06, 0, 0.4),
    worldState.player.position.z + playerForward.z * 1.3
  );
}
