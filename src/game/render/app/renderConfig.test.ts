import { describe, expect, it } from "vitest";
import { createRenderConfig } from "./renderConfig";

describe("createRenderConfig", () => {
  it("provides defaults for water and atmosphere", () => {
    const config = createRenderConfig();
    expect(config.water.quality).toBe("high");
    expect(config.atmosphere.preset).toBe("clearDay");
    expect(config.atmosphere.tuning.exposure).toBeGreaterThan(0);
  });

  it("merges water and atmosphere overrides with sanitization", () => {
    const config = createRenderConfig({
      water: {
        quality: "medium",
        tuning: {
          waveAmplitude: 999
        }
      },
      atmosphere: {
        preset: "dusk",
        tuning: {
          sunElevationDeg: 999,
          fogDensity: -10,
          shadowMapResolution: 1900
        }
      }
    });

    expect(config.water.quality).toBe("medium");
    expect(config.water.tuning.waveAmplitude).toBe(2.25);
    expect(config.atmosphere.preset).toBe("dusk");
    expect(config.atmosphere.tuning.sunElevationDeg).toBe(85);
    expect(config.atmosphere.tuning.fogDensity).toBe(0.0001);
    expect(config.atmosphere.tuning.shadowMapResolution).toBe(2048);
  });
});
