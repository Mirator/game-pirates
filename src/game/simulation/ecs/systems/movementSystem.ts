import {
  MOVEMENT_ACCELERATION,
  MOVEMENT_BRAKE_MULT,
  MOVEMENT_DRAG,
  MOVEMENT_HEADING_ASSIST,
  MOVEMENT_LATERAL_DAMPING,
  MOVEMENT_MAX_SPEED,
  MOVEMENT_MAX_TURN_RATE,
  MOVEMENT_REVERSE_ACCEL_MULT,
  MOVEMENT_REVERSE_SPEED_MULT,
  MOVEMENT_THROTTLE_RESPONSE,
  MOVEMENT_TURN_ACCEL,
  MOVEMENT_TURN_HIGH_SPEED_MULT,
  MOVEMENT_TURN_IDLE_ANGULAR_CAP,
  MOVEMENT_TURN_IDLE_INPUT_MULT,
  MOVEMENT_TURN_IDLE_SPEED_THRESHOLD,
  MOVEMENT_TURN_LOW_SPEED_MULT,
  MOVEMENT_TURN_MID_SPEED_END,
  MOVEMENT_TURN_MID_SPEED_START,
  PLAYER_BURST_SPEED_MULTIPLIER,
  PLAYER_BURST_THRUST_MULTIPLIER,
  PLAYER_BURST_TURN_MULTIPLIER,
  SHIP_SAFE_DESCENT_VELOCITY_CAP,
  SHIP_SAFE_SUBMERGE_DEPTH_ABSOLUTE_MAX,
  SHIP_SAFE_SUBMERGE_DEPTH_DRAFT_RATIO,
  SHIP_SAFE_SOFT_RECOVERY_GAIN,
  SHIP_SAFE_SUBMERGE_HARD_BAND,
  SHIP_SAFE_SUBMERGE_PROBE_PEAK_BLEND,
  SHIP_SAFE_SUBMERGE_SOFT_BAND,
  STORM_SPEED_MULTIPLIER
} from "../../constants";
import type { ShipState } from "../../types";
import { calculateForwardVector as forwardOf, calculateLeftVector as leftOf } from "../../sideMath";
import { DEFAULT_WATER_SURFACE_TUNING, DEFAULT_WATER_SURFACE_WAVES } from "../../../physics/waterProfile";
import { sampleWaterHeight } from "../../../physics/waterSurface";
import { clamp, normalizeAngle } from "../math";
import type { WorldWithEcs } from "../types";

const BUOYANCY_VERTICAL_RESPONSE_MULT = 1.25;
const BUOYANCY_BOW_PROBE_MULT = 1.12;
const BUOYANCY_STERN_PROBE_MULT = 0.92;
const BUOYANCY_MICRO_SUBMERGE_THRESHOLD = 0.01;

export interface MovementScales {
  accelerationScale: number;
  turnScale: number;
  speedScale: number;
}

export type MovementScaleResolver = (ship: ShipState) => MovementScales;

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
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

function seaHeight(worldState: WorldWithEcs, x: number, z: number): number {
  return (
    worldState.physics.seaLevel +
    sampleWaterHeight(DEFAULT_WATER_SURFACE_WAVES, { x, z }, worldState.time, DEFAULT_WATER_SURFACE_TUNING)
  );
}

function sampleProbeWaterReference(
  worldState: WorldWithEcs,
  ship: ShipState,
  forward = forwardOf(ship.heading),
  left = leftOf(ship.heading)
): number {
  let probeWaterSum = 0;
  let probeWaterCount = 0;
  let probeWaterMax = Number.NEGATIVE_INFINITY;
  for (const probe of ship.buoyancyProbes) {
    const wx = ship.position.x + left.x * probe.localOffset.x + forward.x * probe.localOffset.z;
    const wz = ship.position.z + left.z * probe.localOffset.x + forward.z * probe.localOffset.z;
    const wh = seaHeight(worldState, wx, wz);
    probeWaterSum += wh;
    probeWaterCount += 1;
    probeWaterMax = Math.max(probeWaterMax, wh);
  }

  const centerWaterHeight = seaHeight(worldState, ship.position.x, ship.position.z);
  if (probeWaterCount <= 0) {
    return centerWaterHeight;
  }
  const probeWaterAverage = probeWaterSum / probeWaterCount;
  const probeWaterReference = lerp(probeWaterAverage, probeWaterMax, SHIP_SAFE_SUBMERGE_PROBE_PEAK_BLEND);
  return Math.max(centerWaterHeight, probeWaterReference);
}

function insideStorm(worldState: WorldWithEcs, ship: ShipState): boolean {
  return (
    worldState.storm.active &&
    (ship.position.x - worldState.storm.center.x) ** 2 + (ship.position.z - worldState.storm.center.z) ** 2 <=
      worldState.storm.radius ** 2
  );
}

export function updateShipPhysics(
  worldState: WorldWithEcs,
  ship: ShipState,
  throttle: number,
  turn: number,
  dt: number,
  resolveScales: MovementScaleResolver,
  options: { boostActive?: boolean } = {}
): void {
  if (ship.status !== "alive") return;

  const boostActive = options.boostActive === true && ship.owner === "player";
  const storm = insideStorm(worldState, ship);
  const scales = resolveScales(ship);
  const stormSpeedScale = storm ? STORM_SPEED_MULTIPLIER : 1;

  const f = forwardOf(ship.heading);
  const l = leftOf(ship.heading);
  const vx = ship.linearVelocity.x;
  const vz = ship.linearVelocity.z;
  const vy = ship.linearVelocity.y;

  const targetThrottleInput = clamp(throttle, -1, 1);
  const turnInput = clamp(turn, -1, 1);
  const throttleFollow = clamp(1 - Math.exp(-MOVEMENT_THROTTLE_RESPONSE * Math.max(0, dt)), 0, 1);
  const throttleInput = lerp(ship.throttle, targetThrottleInput, throttleFollow);

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
    const ph =
      ship.position.y + probe.localOffset.y + ship.pitch * probe.localOffset.z * 0.58 - ship.roll * probe.localOffset.x * 0.58;
    const sub = wh - ph;
    if (sub <= BUOYANCY_MICRO_SUBMERGE_THRESHOLD) continue;
    submerged += 1;
    const longitudinalProbeScale =
      probe.localOffset.z > 0.15 ? BUOYANCY_BOW_PROBE_MULT : probe.localOffset.z < -0.15 ? BUOYANCY_STERN_PROBE_MULT : 1;
    const b =
      sub *
      ship.buoyancyStrength *
      probe.weight *
      worldState.physics.waterDensityMultiplier *
      (1 - ship.buoyancyLoss) *
      BUOYANCY_VERTICAL_RESPONSE_MULT *
      longitudinalProbeScale;
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
  ship.pitch += -ship.pitch * clamp(dt * 0.5, 0, 1);
  ship.roll += -ship.roll * clamp(dt * 0.55, 0, 1);

  ship.position.x += ship.linearVelocity.x * dt;
  ship.position.y = clamp(ship.position.y + ship.linearVelocity.y * dt, -8, 6);
  ship.position.z += ship.linearVelocity.z * dt;

  const safeWaterRef = sampleProbeWaterReference(worldState, ship);
  const allowedDepth = Math.min(
    SHIP_SAFE_SUBMERGE_DEPTH_ABSOLUTE_MAX,
    ship.hull.draft * SHIP_SAFE_SUBMERGE_DEPTH_DRAFT_RATIO
  );
  const minSafeHeight = safeWaterRef - allowedDepth;
  const penetration = minSafeHeight - ship.position.y;
  if (penetration > 0) {
    ship.linearVelocity.y = Math.max(ship.linearVelocity.y, SHIP_SAFE_DESCENT_VELOCITY_CAP);
    if (penetration > SHIP_SAFE_SUBMERGE_HARD_BAND) {
      ship.position.y = minSafeHeight;
    } else if (penetration > SHIP_SAFE_SUBMERGE_SOFT_BAND) {
      const bandWidth = Math.max(1e-5, SHIP_SAFE_SUBMERGE_HARD_BAND - SHIP_SAFE_SUBMERGE_SOFT_BAND);
      const softBandAlpha = clamp((penetration - SHIP_SAFE_SUBMERGE_SOFT_BAND) / bandWidth, 0, 1);
      const recoveryVelocity = penetration * SHIP_SAFE_SOFT_RECOVERY_GAIN * softBandAlpha;
      ship.linearVelocity.y = Math.max(ship.linearVelocity.y, recoveryVelocity);
    }
  }

  const af = forwardOf(ship.heading);
  const al = leftOf(ship.heading);
  ship.speed = ship.linearVelocity.x * af.x + ship.linearVelocity.z * af.z;
  ship.drift = ship.linearVelocity.x * al.x + ship.linearVelocity.z * al.z;
  ship.throttle = throttleInput;
  ship.turnInput = turnInput;
  ship.buoyancyLoss = clamp((1 - ship.hp / Math.max(1, ship.maxHp)) * 0.5, 0, 0.5);
}

export function keepInBounds(worldState: WorldWithEcs, ship: ShipState, soft: boolean): void {
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
