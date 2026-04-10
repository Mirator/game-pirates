import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry
} from "three";
import { describe, expect, it } from "vitest";
import { getShipAssetManifestEntry, SHIP_MATERIAL_PROFILES } from "./shipAssetManifest";
import { SHIP_ASSET_COMPLEXITY_THRESHOLDS } from "./shipAssetComplexity";
import {
  __resetShipAssetTemplateCacheForTests,
  instantiateValidatedShipAsset,
  SHIP_NODE_NAMES,
  validateShipAssetContract
} from "./shipAssetLoader";

function createAnchor(name: string, x: number, y: number, z: number): Object3D {
  const anchor = new Object3D();
  anchor.name = name;
  anchor.position.set(x, y, z);
  return anchor;
}

function createValidRoot(materialCount = 3): Group {
  const root = new Group();
  root.name = SHIP_NODE_NAMES.root;

  const presentation = new Group();
  presentation.name = SHIP_NODE_NAMES.presentation;
  root.add(presentation);

  const wood = new MeshStandardMaterial({ color: "#8a5a31" });
  const sail = new MeshStandardMaterial({ color: "#f0e7cf" });
  const accent = new MeshStandardMaterial({ color: "#a84d45" });
  const extra = new MeshStandardMaterial({ color: "#4d4d4d" });

  const hull = new Mesh(new CylinderGeometry(0.72, 0.9, 4.2, 20, 7), wood);
  hull.name = "ship-hull";
  hull.rotation.x = Math.PI * 0.5;
  hull.position.y = 0.48;
  presentation.add(hull);

  const bow = new Mesh(new ConeGeometry(0.42, 1.4, 16), wood);
  bow.name = "ship-bow";
  bow.rotation.x = Math.PI * 0.5;
  bow.rotation.z = Math.PI;
  bow.position.set(0, 0.5, 2.55);
  presentation.add(bow);

  const stern = new Mesh(new ConeGeometry(0.36, 1.2, 14), wood);
  stern.name = "ship-stern";
  stern.rotation.x = Math.PI * 0.5;
  stern.position.set(0, 0.52, -2.28);
  presentation.add(stern);

  const deck = new Mesh(new BoxGeometry(1.48, 0.3, 2.8, 4, 2, 6), wood);
  deck.name = "ship-deck";
  deck.position.set(0, 0.98, 0.34);
  presentation.add(deck);

  const mast = new Mesh(new CylinderGeometry(0.08, 0.1, 2.7, 12, 4), wood);
  mast.name = SHIP_NODE_NAMES.mast;
  mast.position.set(0, 2, 0.38);
  presentation.add(mast);

  const sailMesh = new Mesh(new PlaneGeometry(1.4, 1.1, 12, 9), sail);
  sailMesh.name = "ship-sail-main";
  sailMesh.position.set(0, 2.04, 0.4);
  presentation.add(sailMesh);

  const flag = new Mesh(new PlaneGeometry(0.4, 0.2), accent);
  flag.name = SHIP_NODE_NAMES.flag;
  flag.position.set(0.1, 3.3, 0.42);
  presentation.add(flag);

  const rigPennant = new Mesh(new PlaneGeometry(0.34, 0.16), sail);
  rigPennant.name = "ship-rig-pennant-main";
  rigPennant.position.set(0.14, 3.05, 0.4);
  presentation.add(rigPennant);
  const rigLeft = new Mesh(new CylinderGeometry(0.03, 0.03, 2, 6), wood);
  rigLeft.name = "ship-rig-shroud-left";
  rigLeft.position.set(-0.52, 1.74, 0.3);
  rigLeft.rotation.z = Math.PI * 0.16;
  presentation.add(rigLeft);
  const rigRight = new Mesh(new CylinderGeometry(0.03, 0.03, 2, 6), wood);
  rigRight.name = "ship-rig-shroud-right";
  rigRight.position.set(0.52, 1.74, 0.3);
  rigRight.rotation.z = -Math.PI * 0.16;
  presentation.add(rigRight);

  for (let i = 0; i < 18; i += 1) {
    const t = i / 17;
    const z = -1.55 + t * 3.3;
    const leftPost = new Mesh(new BoxGeometry(0.05, 0.32, 0.06), wood);
    leftPost.name = `ship-rail-post-left-${i}`;
    leftPost.position.set(-0.84, 1.06, z);
    presentation.add(leftPost);

    const rightPost = new Mesh(new BoxGeometry(0.05, 0.32, 0.06), wood);
    rightPost.name = `ship-rail-post-right-${i}`;
    rightPost.position.set(0.84, 1.06, z);
    presentation.add(rightPost);
  }

  for (let i = 0; i < 4; i += 1) {
    const z = -1.3 + i * 0.86;
    const leftHousing = new Mesh(new BoxGeometry(0.22, 0.2, 0.24), accent);
    leftHousing.name = `ship-cannon-housing-left-${i}`;
    leftHousing.position.set(-0.82, 0.92, z);
    presentation.add(leftHousing);
    const rightHousing = new Mesh(new BoxGeometry(0.22, 0.2, 0.24), accent);
    rightHousing.name = `ship-cannon-housing-right-${i}`;
    rightHousing.position.set(0.82, 0.92, z);
    presentation.add(rightHousing);

    const leftBarrel = new Mesh(new CylinderGeometry(0.06, 0.07, 0.5, 12, 2), accent);
    leftBarrel.name = `ship-cannon-left-${i}`;
    leftBarrel.rotation.z = Math.PI * 0.5;
    leftBarrel.position.set(-0.95, 0.94, z);
    presentation.add(leftBarrel);
    const rightBarrel = new Mesh(new CylinderGeometry(0.06, 0.07, 0.5, 12, 2), accent);
    rightBarrel.name = `ship-cannon-right-${i}`;
    rightBarrel.rotation.z = Math.PI * 0.5;
    rightBarrel.position.set(0.95, 0.94, z);
    presentation.add(rightBarrel);
  }

  const bowsprit = new Mesh(new CylinderGeometry(0.06, 0.08, 1.4, 10, 3), wood);
  bowsprit.name = "ship-bowsprit";
  bowsprit.rotation.x = Math.PI * 0.5;
  bowsprit.position.set(0, 1.16, 2.48);
  presentation.add(bowsprit);
  const bowDetail = new Mesh(new SphereGeometry(0.12, 10, 8), accent);
  bowDetail.name = "ship-bow-detail";
  bowDetail.position.set(0, 1.14, 3.05);
  presentation.add(bowDetail);

  if (materialCount > 3) {
    const detail = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), extra);
    detail.name = "ship-detail-extra";
    detail.position.set(0.25, 0.8, 0.2);
    presentation.add(detail);
  }

  presentation.add(createAnchor(SHIP_NODE_NAMES.wakeSternAnchor, 0, 0.05, -0.8));
  presentation.add(createAnchor(`${SHIP_NODE_NAMES.cannonLeftPrefix}0`, -0.65, 0.6, -0.4));
  presentation.add(createAnchor(`${SHIP_NODE_NAMES.cannonLeftPrefix}1`, -0.65, 0.6, 0.4));
  presentation.add(createAnchor(`${SHIP_NODE_NAMES.cannonRightPrefix}0`, 0.65, 0.6, -0.4));
  presentation.add(createAnchor(`${SHIP_NODE_NAMES.cannonRightPrefix}1`, 0.65, 0.6, 0.4));

  return root;
}

describe("ship asset manifest", () => {
  it("maps merchant and raider to the raider v2 model", () => {
    const merchant = getShipAssetManifestEntry("merchant");
    const raider = getShipAssetManifestEntry("raider");
    const navy = getShipAssetManifestEntry("navy");

    expect(merchant.modelId).toBe("enemy_raider_v2");
    expect(raider.modelId).toBe("enemy_raider_v2");
    expect(navy.modelId).toBe("enemy_navy_v2");
  });

  it("enforces target-2/max-3 material policy", () => {
    const playerProfile = SHIP_MATERIAL_PROFILES.player_refined;
    const enemyProfile = SHIP_MATERIAL_PROFILES.enemy_aggressive;

    expect(playerProfile.targetMaterialCount).toBe(2);
    expect(playerProfile.maxMaterialCount).toBe(3);
    expect(enemyProfile.targetMaterialCount).toBe(2);
    expect(enemyProfile.maxMaterialCount).toBe(3);
  });
});

describe("validateShipAssetContract", () => {
  it("accepts node + complexity contracts for all v3 model IDs", () => {
    const modelIds = ["player_v2", "enemy_raider_v2", "enemy_navy_v2"] as const;
    for (const modelId of modelIds) {
      const result = validateShipAssetContract(modelId, createValidRoot());
      expect(result.ok).toBe(true);
      if (!result.ok) {
        continue;
      }
      const threshold = SHIP_ASSET_COMPLEXITY_THRESHOLDS[modelId];
      expect(result.contract.sailNames.length).toBeGreaterThan(0);
      expect(result.contract.rigNames.length).toBeGreaterThan(0);
      expect(result.contract.cannonLeftAnchorNames.length).toBeGreaterThan(0);
      expect(result.contract.cannonRightAnchorNames.length).toBeGreaterThan(0);
      expect(result.contract.triangleCount).toBeGreaterThanOrEqual(threshold.minTriangleCount);
      expect(result.contract.nodeCount).toBeGreaterThanOrEqual(threshold.minNodeCount);
      expect(result.contract.materialCount).toBeLessThanOrEqual(3);
    }
  });

  it("fails when mesh complexity is below v3 thresholds", () => {
    const sparseRoot = new Group();
    sparseRoot.name = SHIP_NODE_NAMES.root;
    const presentation = new Group();
    presentation.name = SHIP_NODE_NAMES.presentation;
    sparseRoot.add(presentation);

    const material = new MeshStandardMaterial({ color: "#8a5a31" });
    const mast = new Mesh(new BoxGeometry(0.1, 1, 0.1), material);
    mast.name = SHIP_NODE_NAMES.mast;
    presentation.add(mast);
    const sail = new Mesh(new PlaneGeometry(0.5, 0.5), material);
    sail.name = "ship-sail-main";
    presentation.add(sail);
    presentation.add(createAnchor(SHIP_NODE_NAMES.wakeSternAnchor, 0, 0, -0.2));
    presentation.add(createAnchor(`${SHIP_NODE_NAMES.cannonLeftPrefix}0`, -0.4, 0.4, 0));
    presentation.add(createAnchor(`${SHIP_NODE_NAMES.cannonRightPrefix}0`, 0.4, 0.4, 0));

    const result = validateShipAssetContract("enemy_navy_v2", sparseRoot);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.join("\n")).toContain("Triangle count");
  });

  it("fails when stern wake anchor is missing", () => {
    const root = createValidRoot();
    const anchor = root.getObjectByName(SHIP_NODE_NAMES.wakeSternAnchor);
    anchor?.parent?.remove(anchor);

    const result = validateShipAssetContract("enemy_raider_v2", root);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.join("\n")).toContain(SHIP_NODE_NAMES.wakeSternAnchor);
  });

  it("fails when material count exceeds max budget", () => {
    const result = validateShipAssetContract("enemy_navy_v2", createValidRoot(4));
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.join("\n")).toContain("Material count");
  });

  it("returns fallback metadata when validated templates are unavailable", () => {
    __resetShipAssetTemplateCacheForTests();
    const result = instantiateValidatedShipAsset("player_v2");
    expect(result.instance).toBeNull();
    expect(result.fallback?.used).toBe(true);
    expect(result.fallback?.reason).toBe("template_unavailable");
  });
});
