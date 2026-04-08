import {
  getShipVisualContract,
  type ShipColliderProfileId,
  type ShipFallbackPolicy,
  type ShipMaterialProfileId,
  type ShipModelId,
  type ShipVisualRole
} from "../../ships/shipProfiles";

export interface ShipMaterialProfile {
  id: ShipMaterialProfileId;
  targetMaterialCount: number;
  maxMaterialCount: number;
}

export interface ShipAssetManifestEntry {
  role: ShipVisualRole;
  modelId: ShipModelId;
  colliderProfileId: ShipColliderProfileId;
  materialProfileId: ShipMaterialProfileId;
  fallbackPolicy: ShipFallbackPolicy;
  preferredSource: "gltf";
}

export const SHIP_MATERIAL_PROFILES: Record<ShipMaterialProfileId, ShipMaterialProfile> = {
  player_refined: {
    id: "player_refined",
    targetMaterialCount: 2,
    maxMaterialCount: 3
  },
  enemy_aggressive: {
    id: "enemy_aggressive",
    targetMaterialCount: 2,
    maxMaterialCount: 3
  },
  enemy_heavy: {
    id: "enemy_heavy",
    targetMaterialCount: 2,
    maxMaterialCount: 3
  },
  merchant_calm: {
    id: "merchant_calm",
    targetMaterialCount: 2,
    maxMaterialCount: 3
  }
};

export const SHIP_ASSET_MANIFEST: Record<ShipVisualRole, ShipAssetManifestEntry> = {
  player: {
    ...getShipVisualContract("player"),
    preferredSource: "gltf"
  },
  merchant: {
    ...getShipVisualContract("merchant"),
    preferredSource: "gltf"
  },
  raider: {
    ...getShipVisualContract("raider"),
    preferredSource: "gltf"
  },
  navy: {
    ...getShipVisualContract("navy"),
    preferredSource: "gltf"
  }
};

export const SHIP_ASSET_BASE_URL = "/assets/ships";

export function getShipAssetManifestEntry(role: ShipVisualRole): ShipAssetManifestEntry {
  return SHIP_ASSET_MANIFEST[role];
}

export function getShipAssetUrl(modelId: ShipModelId): string {
  return `${SHIP_ASSET_BASE_URL}/${modelId}.glb`;
}
