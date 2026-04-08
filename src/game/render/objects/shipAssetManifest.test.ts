import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry } from "three";
import { describe, expect, it } from "vitest";
import { getShipAssetManifestEntry, SHIP_MATERIAL_PROFILES } from "./shipAssetManifest";
import { SHIP_NODE_NAMES, validateShipAssetContract } from "./shipAssetLoader";

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

  const hull = new Mesh(new BoxGeometry(1, 1, 1), wood);
  hull.name = "ship-hull";
  presentation.add(hull);

  const mast = new Mesh(new BoxGeometry(0.2, 1.8, 0.2), wood);
  mast.name = SHIP_NODE_NAMES.mast;
  mast.position.y = 0.9;
  presentation.add(mast);

  const sailMesh = new Mesh(new PlaneGeometry(0.9, 0.8), sail);
  sailMesh.name = "ship-sail-main";
  sailMesh.position.y = 1.4;
  presentation.add(sailMesh);

  const flag = new Mesh(new PlaneGeometry(0.4, 0.2), accent);
  flag.name = SHIP_NODE_NAMES.flag;
  flag.position.set(0.1, 1.9, 0);
  presentation.add(flag);

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
  it("accepts a valid node contract", () => {
    const result = validateShipAssetContract("player_v2", createValidRoot());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.contract.sailNames.length).toBeGreaterThan(0);
    expect(result.contract.cannonLeftAnchorNames.length).toBeGreaterThan(0);
    expect(result.contract.cannonRightAnchorNames.length).toBeGreaterThan(0);
    expect(result.contract.materialCount).toBeLessThanOrEqual(3);
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
});
