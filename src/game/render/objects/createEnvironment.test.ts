import { Scene } from "three";
import { describe, expect, it } from "vitest";
import { createInitialWorldState } from "../../simulation";
import { createEnvironment } from "./createEnvironment";

describe("createEnvironment water quality controls", () => {
  it("defaults to high quality and supports switching quality tiers", () => {
    const environment = createEnvironment(new Scene());
    const configAtStart = environment.water.getConfig();
    expect(configAtStart.quality).toBe("high");
    expect(configAtStart.activeWaveCount).toBe(4);

    expect(() => environment.water.setQuality("medium")).not.toThrow();
    const mediumConfig = environment.water.getConfig();
    expect(mediumConfig.quality).toBe("medium");
    expect(mediumConfig.activeWaveCount).toBe(3);

    expect(() => environment.water.setQuality("low")).not.toThrow();
    const lowConfig = environment.water.getConfig();
    expect(lowConfig.quality).toBe("low");
    expect(lowConfig.activeWaveCount).toBe(1);
  });

  it("syncs without runtime errors after quality switches", () => {
    const environment = createEnvironment(new Scene());
    const worldState = createInitialWorldState();
    worldState.player.speed = 9;
    worldState.burst.active = true;

    environment.water.setQuality("high");
    expect(() =>
      environment.syncFromWorld(worldState, {
        frameDt: 1 / 60,
        renderTime: 10,
        cameraPosition: { x: 4, y: 7, z: -12 },
        playerPose: {
          x: worldState.player.position.x,
          z: worldState.player.position.z,
          heading: worldState.player.heading,
          speed: worldState.player.speed,
          drift: worldState.player.drift
        }
      })
    ).not.toThrow();
  });
});
