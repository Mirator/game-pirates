import {
  Group,
  Material,
  Mesh,
  Object3D
} from "three";
import { getAllShipModelIds, type ShipModelId } from "../../ships/shipProfiles";
import { getShipAssetUrl, SHIP_MATERIAL_PROFILES } from "./shipAssetManifest";
import {
  collectShipAssetComplexityMetrics,
  validateShipAssetComplexity
} from "./shipAssetComplexity";

export const SHIP_NODE_NAMES = {
  root: "ship_root",
  presentation: "ship-presentation",
  mast: "ship-mast",
  sailPrefix: "ship-sail",
  rigPrefix: "ship-rig-",
  flag: "ship-flag",
  wakeSternAnchor: "anchor-wake-stern",
  cannonLeftPrefix: "anchor-cannon-left-",
  cannonRightPrefix: "anchor-cannon-right-"
} as const;

export interface ShipAssetNodeContract {
  presentationName: string;
  mastName: string;
  sailNames: string[];
  rigNames: string[];
  flagName: string | null;
  wakeSternAnchorName: string;
  cannonLeftAnchorNames: string[];
  cannonRightAnchorNames: string[];
  triangleCount: number;
  nodeCount: number;
  materialCount: number;
}

export interface ShipAssetTemplate {
  modelId: ShipModelId;
  sourceUrl: string;
  root: Object3D;
  contract: ShipAssetNodeContract;
}

export interface ShipAssetFallbackMetadata {
  used: true;
  reason: "template_unavailable";
}

export interface ShipAssetInstance {
  modelId: ShipModelId;
  sourceUrl: string;
  root: Group;
  contract: ShipAssetNodeContract;
}

export interface ShipAssetInstanceResult {
  instance: ShipAssetInstance | null;
  fallback: ShipAssetFallbackMetadata | null;
}

const templateCache = new Map<ShipModelId, ShipAssetTemplate>();
const templateLoadPromises = new Map<ShipModelId, Promise<ShipAssetTemplate | null>>();
const MODEL_MATERIAL_PROFILE: Record<ShipModelId, keyof typeof SHIP_MATERIAL_PROFILES> = {
  player_v2: "player_refined",
  enemy_raider_v2: "enemy_aggressive",
  enemy_navy_v2: "enemy_heavy"
};
let gltfLoaderPromise: Promise<{ loadAsync: (url: string) => Promise<{ scene: Group }> }> | null = null;

function compareAnchorName(a: string, b: string): number {
  const indexA = Number.parseInt(a.replace(/^[^0-9]+/, ""), 10);
  const indexB = Number.parseInt(b.replace(/^[^0-9]+/, ""), 10);

  if (Number.isNaN(indexA) || Number.isNaN(indexB)) {
    return a.localeCompare(b);
  }
  return indexA - indexB;
}

function collectAnchors(root: Object3D, prefix: string): string[] {
  const names: string[] = [];
  root.traverse((obj) => {
    if (obj.name.startsWith(prefix)) {
      names.push(obj.name);
    }
  });
  return names.sort(compareAnchorName);
}

export function validateShipAssetContract(modelId: ShipModelId, root: Object3D): { ok: true; contract: ShipAssetNodeContract } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  const presentation = root.getObjectByName(SHIP_NODE_NAMES.presentation);
  const mast = root.getObjectByName(SHIP_NODE_NAMES.mast);
  const wakeSternAnchor = root.getObjectByName(SHIP_NODE_NAMES.wakeSternAnchor);
  const sails = collectAnchors(root, SHIP_NODE_NAMES.sailPrefix);
  const rigs = collectAnchors(root, SHIP_NODE_NAMES.rigPrefix);
  const cannonLeft = collectAnchors(root, SHIP_NODE_NAMES.cannonLeftPrefix);
  const cannonRight = collectAnchors(root, SHIP_NODE_NAMES.cannonRightPrefix);
  const complexityMetrics = collectShipAssetComplexityMetrics(root);

  if (!presentation) {
    errors.push(`Missing '${SHIP_NODE_NAMES.presentation}'.`);
  }
  if (!mast) {
    errors.push(`Missing '${SHIP_NODE_NAMES.mast}'.`);
  }
  if (!wakeSternAnchor) {
    errors.push(`Missing '${SHIP_NODE_NAMES.wakeSternAnchor}'.`);
  }
  if (sails.length < 1) {
    errors.push("Missing sail mesh nodes. Expected at least one node prefixed with 'ship-sail'.");
  }
  if (cannonLeft.length < 1) {
    errors.push("Missing left cannon anchors.");
  }
  if (cannonRight.length < 1) {
    errors.push("Missing right cannon anchors.");
  }

  const materialCount = complexityMetrics.materialCount;
  const materialProfile = SHIP_MATERIAL_PROFILES[MODEL_MATERIAL_PROFILE[modelId]];
  if (materialCount > materialProfile.maxMaterialCount) {
    errors.push(
      `Material count ${materialCount} exceeds max ${materialProfile.maxMaterialCount} for profile '${materialProfile.id}'.`
    );
  }
  errors.push(...validateShipAssetComplexity(modelId, complexityMetrics));

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    contract: {
      presentationName: SHIP_NODE_NAMES.presentation,
      mastName: SHIP_NODE_NAMES.mast,
      sailNames: sails,
      rigNames: rigs,
      flagName: root.getObjectByName(SHIP_NODE_NAMES.flag)?.name ?? null,
      wakeSternAnchorName: SHIP_NODE_NAMES.wakeSternAnchor,
      cannonLeftAnchorNames: cannonLeft,
      cannonRightAnchorNames: cannonRight,
      triangleCount: complexityMetrics.triangleCount,
      nodeCount: complexityMetrics.nodeCount,
      materialCount
    }
  };
}

function cloneMaterial(material: Material): Material {
  return material.clone();
}

function cloneRootWithUniqueMaterials(root: Object3D): Object3D {
  const clone = root.clone(true);
  const materialCloneMap = new Map<Material, Material>();

  clone.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.material) {
      return;
    }

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => {
        const cached = materialCloneMap.get(material);
        if (cached) {
          return cached;
        }
        const materialClone = cloneMaterial(material);
        materialCloneMap.set(material, materialClone);
        return materialClone;
      });
      return;
    }

    const cached = materialCloneMap.get(mesh.material);
    if (cached) {
      mesh.material = cached;
      return;
    }

    const materialClone = cloneMaterial(mesh.material);
    materialCloneMap.set(mesh.material, materialClone);
    mesh.material = materialClone;
  });

  return clone;
}

async function loadTemplate(modelId: ShipModelId): Promise<ShipAssetTemplate | null> {
  const cachedTemplate = templateCache.get(modelId);
  if (cachedTemplate) {
    return cachedTemplate;
  }

  const existingPromise = templateLoadPromises.get(modelId);
  if (existingPromise) {
    return existingPromise;
  }

  const sourceUrl = getShipAssetUrl(modelId);
  const loadPromise = (async (): Promise<ShipAssetTemplate | null> => {
    try {
      const loader = await getGltfLoader();
      const gltf = await loader.loadAsync(sourceUrl);

      const rawRoot = gltf.scene.getObjectByName(SHIP_NODE_NAMES.root);
      if (!rawRoot) {
        console.warn(`[ship-assets] ${modelId} missing root '${SHIP_NODE_NAMES.root}'. Falling back to procedural.`);
        return null;
      }

      const validation = validateShipAssetContract(modelId, rawRoot);
      if (!validation.ok) {
        console.warn(`[ship-assets] ${modelId} failed validation:\n${validation.errors.join("\n")}`);
        return null;
      }

      const template: ShipAssetTemplate = {
        modelId,
        sourceUrl,
        root: rawRoot,
        contract: validation.contract
      };
      templateCache.set(modelId, template);
      return template;
    } catch (error) {
      console.warn(`[ship-assets] failed loading ${sourceUrl}. Falling back to procedural.`, error);
      return null;
    } finally {
      templateLoadPromises.delete(modelId);
    }
  })();

  templateLoadPromises.set(modelId, loadPromise);
  return loadPromise;
}

export async function preloadShipAssetsForBrowser(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const modelIds = getAllShipModelIds();
  await Promise.all(modelIds.map((modelId) => loadTemplate(modelId)));
}

export function getPreloadedShipAssetTemplate(modelId: ShipModelId): ShipAssetTemplate | null {
  return templateCache.get(modelId) ?? null;
}

export function instantiateValidatedShipAsset(modelId: ShipModelId): ShipAssetInstanceResult {
  const template = templateCache.get(modelId);
  if (!template) {
    return {
      instance: null,
      fallback: {
        used: true,
        reason: "template_unavailable"
      }
    };
  }

  const cloned = cloneRootWithUniqueMaterials(template.root);
  let root: Group;
  if (cloned instanceof Group) {
    root = cloned;
  } else {
    const wrapper = new Group();
    wrapper.name = cloned.name || SHIP_NODE_NAMES.root;
    wrapper.add(cloned);
    root = wrapper;
  }

  return {
    instance: {
      modelId,
      sourceUrl: template.sourceUrl,
      root,
      contract: template.contract
    },
    fallback: null
  };
}

export function instantiateShipAssetRoot(modelId: ShipModelId): Group | null {
  return instantiateValidatedShipAsset(modelId).instance?.root ?? null;
}

export function __resetShipAssetTemplateCacheForTests(): void {
  templateCache.clear();
  templateLoadPromises.clear();
  gltfLoaderPromise = null;
}

async function getGltfLoader(): Promise<{ loadAsync: (url: string) => Promise<{ scene: Group }> }> {
  if (!gltfLoaderPromise) {
    gltfLoaderPromise = import("../loaders/vendor/loaders/GLTFLoader.js").then(({ GLTFLoader }) => new GLTFLoader());
  }
  return gltfLoaderPromise;
}
