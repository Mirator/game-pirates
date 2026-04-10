import { Mesh, MeshStandardMaterial, Object3D } from "three";
import type { ShipModelId } from "../../ships/shipProfiles";

export interface ShipAssetComplexityMetrics {
  triangleCount: number;
  nodeCount: number;
  materialCount: number;
}

export interface ShipAssetComplexityThreshold {
  minTriangleCount: number;
  minNodeCount: number;
}

export const SHIP_ASSET_COMPLEXITY_THRESHOLDS: Record<ShipModelId, ShipAssetComplexityThreshold> = {
  player_v2: {
    minTriangleCount: 950,
    minNodeCount: 32
  },
  enemy_raider_v2: {
    minTriangleCount: 750,
    minNodeCount: 30
  },
  enemy_navy_v2: {
    minTriangleCount: 1200,
    minNodeCount: 38
  }
};

function countMeshTriangles(mesh: Mesh): number {
  const geometry = mesh.geometry;
  if (!geometry) {
    return 0;
  }

  const indexedCount = geometry.index?.count ?? 0;
  if (indexedCount > 0) {
    return Math.floor(indexedCount / 3);
  }

  const position = geometry.getAttribute("position");
  if (!position) {
    return 0;
  }
  return Math.floor(position.count / 3);
}

function countUniqueStandardMaterials(root: Object3D): number {
  const seen = new Set<MeshStandardMaterial>();
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.material) {
      return;
    }

    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) {
        if (material instanceof MeshStandardMaterial) {
          seen.add(material);
        }
      }
      return;
    }

    if (mesh.material instanceof MeshStandardMaterial) {
      seen.add(mesh.material);
    }
  });
  return seen.size;
}

export function collectShipAssetComplexityMetrics(root: Object3D): ShipAssetComplexityMetrics {
  let triangleCount = 0;
  let nodeCount = 0;

  root.traverse((obj) => {
    nodeCount += 1;
    const mesh = obj as Mesh;
    if (!mesh.isMesh) {
      return;
    }
    triangleCount += countMeshTriangles(mesh);
  });

  return {
    triangleCount,
    nodeCount,
    materialCount: countUniqueStandardMaterials(root)
  };
}

export function validateShipAssetComplexity(
  modelId: ShipModelId,
  metrics: ShipAssetComplexityMetrics
): string[] {
  const errors: string[] = [];
  const threshold = SHIP_ASSET_COMPLEXITY_THRESHOLDS[modelId];

  if (metrics.triangleCount < threshold.minTriangleCount) {
    errors.push(
      `Triangle count ${metrics.triangleCount} is below minimum ${threshold.minTriangleCount} for '${modelId}'.`
    );
  }
  if (metrics.nodeCount < threshold.minNodeCount) {
    errors.push(
      `Node count ${metrics.nodeCount} is below minimum ${threshold.minNodeCount} for '${modelId}'.`
    );
  }

  return errors;
}
