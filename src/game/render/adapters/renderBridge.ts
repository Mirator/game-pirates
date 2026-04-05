import {
  ColorRepresentation,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3
} from "three";
import { SINK_DURATION, type ShipState, type WorldState } from "../../simulation";
import type { EnvironmentObjects } from "../objects/createEnvironment";

export interface RenderBridgeState {
  scene: Scene;
  camera: PerspectiveCamera;
  playerMesh: Group;
  enemyMesh: Group;
  environment: EnvironmentObjects;
  projectileRoot: Group;
  projectileMeshes: Map<number, Mesh>;
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

function applyShipPose(ship: ShipState, mesh: Group): void {
  const sinkProgress = ship.status === "sinking" ? (SINK_DURATION - ship.sinkTimer) / SINK_DURATION : 0;
  const sinkOffset = -Math.max(0, sinkProgress) * 2.2;

  mesh.position.set(ship.position.x, sinkOffset, ship.position.z);
  mesh.rotation.set(0, ship.heading, ship.drift * 0.03 + sinkProgress * 0.28);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function syncRenderFromSimulation(worldState: WorldState, bridge: RenderBridgeState, frameDt: number): void {
  bridge.environment.update(worldState.time);

  applyShipPose(worldState.player, bridge.playerMesh);
  applyShipPose(worldState.enemy, bridge.enemyMesh);

  const seen = new Set<number>();
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
    seen.add(projectile.id);
  }

  for (const [id, projectileMesh] of bridge.projectileMeshes.entries()) {
    if (seen.has(id)) {
      continue;
    }
    bridge.projectileRoot.remove(projectileMesh);
    projectileMesh.geometry.dispose();
    (projectileMesh.material as MeshStandardMaterial).dispose();
    bridge.projectileMeshes.delete(id);
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
