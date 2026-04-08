export type ShipModelId = "player_v2" | "enemy_raider_v2" | "enemy_navy_v2";
export type ShipMaterialProfileId = "player_refined" | "enemy_aggressive" | "enemy_heavy" | "merchant_calm";
export type ShipColliderProfileId = "player_v2" | "enemy_raider_v2" | "enemy_navy_v2";
export type ShipFallbackPolicy = "procedural_on_failure";
export type ShipVisualRole = "player" | "merchant" | "raider" | "navy";

export interface ShipBuoyancyProbeDescriptor {
  id: string;
  localOffset: {
    x: number;
    y: number;
    z: number;
  };
  weight: number;
}

export interface ShipColliderProfile {
  id: ShipColliderProfileId;
  length: number;
  width: number;
  draft: number;
  radius: number;
  centerOfMassY: number;
  probeCenterYOffset: number;
}

export interface ShipVisualContract {
  role: ShipVisualRole;
  modelId: ShipModelId;
  materialProfileId: ShipMaterialProfileId;
  colliderProfileId: ShipColliderProfileId;
  fallbackPolicy: ShipFallbackPolicy;
}

const SHIP_COLLIDER_PROFILE_TABLE: Record<ShipColliderProfileId, ShipColliderProfile> = {
  player_v2: {
    id: "player_v2",
    length: 6.6,
    width: 2.85,
    draft: 0.96,
    radius: 2.2,
    centerOfMassY: -0.24,
    probeCenterYOffset: -0.14
  },
  enemy_raider_v2: {
    id: "enemy_raider_v2",
    length: 5.9,
    width: 2.5,
    draft: 0.9,
    radius: 2.1,
    centerOfMassY: -0.24,
    probeCenterYOffset: -0.12
  },
  enemy_navy_v2: {
    id: "enemy_navy_v2",
    length: 7.1,
    width: 3.1,
    draft: 1.06,
    radius: 2.5,
    centerOfMassY: -0.23,
    probeCenterYOffset: -0.16
  }
};

export const SHIP_VISUAL_CONTRACTS: Record<ShipVisualRole, ShipVisualContract> = {
  player: {
    role: "player",
    modelId: "player_v2",
    materialProfileId: "player_refined",
    colliderProfileId: "player_v2",
    fallbackPolicy: "procedural_on_failure"
  },
  merchant: {
    role: "merchant",
    modelId: "enemy_raider_v2",
    materialProfileId: "merchant_calm",
    colliderProfileId: "enemy_raider_v2",
    fallbackPolicy: "procedural_on_failure"
  },
  raider: {
    role: "raider",
    modelId: "enemy_raider_v2",
    materialProfileId: "enemy_aggressive",
    colliderProfileId: "enemy_raider_v2",
    fallbackPolicy: "procedural_on_failure"
  },
  navy: {
    role: "navy",
    modelId: "enemy_navy_v2",
    materialProfileId: "enemy_heavy",
    colliderProfileId: "enemy_navy_v2",
    fallbackPolicy: "procedural_on_failure"
  }
};

export function getShipVisualContract(role: ShipVisualRole): ShipVisualContract {
  return SHIP_VISUAL_CONTRACTS[role];
}

export function getShipColliderProfile(profileId: ShipColliderProfileId): ShipColliderProfile {
  return SHIP_COLLIDER_PROFILE_TABLE[profileId];
}

export function getShipColliderProfileForRole(role: ShipVisualRole): ShipColliderProfile {
  const contract = getShipVisualContract(role);
  return getShipColliderProfile(contract.colliderProfileId);
}

export function getShipColliderProfileForEnemyArchetype(archetype: "merchant" | "raider" | "navy"): ShipColliderProfile {
  if (archetype === "navy") {
    return getShipColliderProfile("enemy_navy_v2");
  }
  return getShipColliderProfile("enemy_raider_v2");
}

export function createShipBuoyancyProbes(profile: ShipColliderProfile): ShipBuoyancyProbeDescriptor[] {
  const halfLength = profile.length * 0.5;
  const halfWidth = profile.width * 0.5;
  return [
    { id: "bow-left", localOffset: { x: -halfWidth, y: 0, z: halfLength }, weight: 1 },
    { id: "bow-right", localOffset: { x: halfWidth, y: 0, z: halfLength }, weight: 1 },
    { id: "stern-left", localOffset: { x: -halfWidth, y: 0, z: -halfLength }, weight: 1 },
    { id: "stern-right", localOffset: { x: halfWidth, y: 0, z: -halfLength }, weight: 1 },
    { id: "center", localOffset: { x: 0, y: profile.probeCenterYOffset, z: 0 }, weight: 1.2 }
  ];
}

export function getAllShipModelIds(): ShipModelId[] {
  return ["player_v2", "enemy_raider_v2", "enemy_navy_v2"];
}
