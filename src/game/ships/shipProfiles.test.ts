import { describe, expect, it } from "vitest";
import { createInitialWorldState } from "../simulation/createInitialWorldState";
import {
  createShipBuoyancyProbes,
  getShipColliderProfile,
  getShipColliderProfileForEnemyArchetype,
  getShipVisualContract
} from "./shipProfiles";

describe("ship profile contracts", () => {
  it("maps merchant to the raider model while navy stays distinct", () => {
    expect(getShipVisualContract("merchant").modelId).toBe("enemy_raider_v2");
    expect(getShipVisualContract("raider").modelId).toBe("enemy_raider_v2");
    expect(getShipVisualContract("navy").modelId).toBe("enemy_navy_v2");
  });

  it("creates simplified collider-friendly probe layouts", () => {
    const raiderProfile = getShipColliderProfileForEnemyArchetype("raider");
    const probes = createShipBuoyancyProbes(raiderProfile);

    expect(probes).toHaveLength(5);
    expect(probes[0]?.id).toBe("bow-left");
    expect(probes[4]?.id).toBe("center");

    const bow = probes[0];
    const stern = probes[2];
    expect((bow?.localOffset.z ?? 0) > 0).toBe(true);
    expect((stern?.localOffset.z ?? 0) < 0).toBe(true);
  });

  it("drives initial player collider values from the shared profile", () => {
    const world = createInitialWorldState();
    const profile = getShipColliderProfile("player_v2");

    expect(world.player.hull.length).toBeCloseTo(profile.length, 6);
    expect(world.player.hull.width).toBeCloseTo(profile.width, 6);
    expect(world.player.hull.draft).toBeCloseTo(profile.draft, 6);
    expect(world.player.radius).toBeCloseTo(profile.radius, 6);
  });
});
