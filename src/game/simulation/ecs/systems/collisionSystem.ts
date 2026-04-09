import { SHIP_COLLISION_ANGULAR_IMPULSE, SHIP_COLLISION_IMPULSE_SCALE, SHIP_COLLISION_RESTITUTION } from "../../constants";
import type { ShipState } from "../../types";
import { clamp } from "../math";
import type { WorldWithEcs } from "../types";

export type CollisionImpactDamageHandler = (ship: ShipState, speed: number) => void;

export function collideShipWithIsland(
  worldState: WorldWithEcs,
  ship: ShipState,
  onImpactDamage: CollisionImpactDamageHandler
): void {
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
      onImpactDamage(ship, Math.abs(nv));
    }
  }
}

export function collideShips(
  a: ShipState,
  b: ShipState,
  onImpactDamage: CollisionImpactDamageHandler
): void {
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
  onImpactDamage(a, Math.abs(rvn));
  onImpactDamage(b, Math.abs(rvn));
}
