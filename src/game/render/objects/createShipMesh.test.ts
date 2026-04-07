import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createShipDefinition, createShipMesh, type ShipVisualRole } from "./createShipMesh";

function getDimensions(role: ShipVisualRole): Vector3 {
  const visual = createShipMesh(createShipDefinition(role));
  const box = new Box3().setFromObject(visual.group);
  return box.getSize(new Vector3());
}

describe("createShipMesh ship factory", () => {
  it("creates required visible ship parts for every role", () => {
    const roles: ShipVisualRole[] = ["player", "merchant", "raider", "navy"];

    for (const role of roles) {
      const definition = createShipDefinition(role);
      const visual = createShipMesh(definition);
      const ship = visual.group;

      expect(ship.getObjectByName("ship-hull")).toBeTruthy();
      expect(ship.getObjectByName("ship-bow")).toBeTruthy();
      expect(ship.getObjectByName("ship-stern")).toBeTruthy();
      expect(ship.getObjectByName("ship-deck")).toBeTruthy();
      expect(ship.getObjectByName("ship-mast")).toBeTruthy();
      expect(ship.getObjectByName("ship-sail")).toBeTruthy();
      expect(ship.getObjectByName("ship-flag")).toBeTruthy();
      expect(ship.getObjectByName("ship-wake-trail")).toBeTruthy();
      expect(ship.getObjectByName("ship-wake-foam")).toBeTruthy();
      expect(visual.cannonMounts.left.length).toBe(definition.silhouette.cannonMountsPerSide);
      expect(visual.cannonMounts.right.length).toBe(definition.silhouette.cannonMountsPerSide);
    }
  });

  it("differentiates class silhouettes for small, medium, and heavy", () => {
    const small = getDimensions("merchant");
    const medium = getDimensions("player");
    const heavy = getDimensions("navy");

    expect(small.z).toBeLessThan(medium.z);
    expect(medium.z).toBeLessThan(heavy.z);
    expect(small.x).toBeLessThan(medium.x);
    expect(medium.x).toBeLessThan(heavy.x);
  });

  it("ensures player and enemy silhouettes are not identical", () => {
    const player = getDimensions("player");
    const merchant = getDimensions("merchant");
    const raider = getDimensions("raider");
    const navy = getDimensions("navy");

    const key = (dims: Vector3): string => `${dims.x.toFixed(3)}-${dims.y.toFixed(3)}-${dims.z.toFixed(3)}`;

    const silhouetteKeys = new Set([key(player), key(merchant), key(raider), key(navy)]);
    expect(silhouetteKeys.size).toBeGreaterThan(2);
    expect(key(player)).not.toBe(key(merchant));
    expect(key(player)).not.toBe(key(navy));
  });
});
