import { describe, expect, it } from "vitest";
import {
  createAtmosphereTuningFromPreset,
  createDefaultAtmosphereConfig,
  getAtmospherePreset,
  sanitizeAtmosphereTuning,
  type AtmospherePresetId
} from "./atmosphereConfig";

describe("atmosphereConfig", () => {
  it("defaults to the clearDay preset with matching tuning values", () => {
    const config = createDefaultAtmosphereConfig();
    expect(config.preset).toBe("clearDay");

    const preset = getAtmospherePreset("clearDay");
    expect(config.tuning.sunAzimuthDeg).toBeCloseTo(preset.sunAzimuthDeg, 6);
    expect(config.tuning.sunElevationDeg).toBeCloseTo(preset.sunElevationDeg, 6);
    expect(config.tuning.fogDensity).toBeCloseTo(preset.fogDensity, 6);
    expect(config.tuning.shadowMapResolution).toBe(preset.shadowMapResolution);
  });

  it("sanitizes and clamps atmosphere tuning fields", () => {
    const current = createAtmosphereTuningFromPreset("clearDay");
    const sanitized = sanitizeAtmosphereTuning(
      {
        sunAzimuthDeg: 450,
        sunElevationDeg: 150,
        sunIntensity: 9,
        ambientIntensity: -3,
        fogDensity: 1,
        exposure: 0.1,
        shadowMapResolution: 700,
        shadowCameraBounds: -10
      },
      current
    );

    expect(sanitized.sunAzimuthDeg).toBe(90);
    expect(sanitized.sunElevationDeg).toBe(85);
    expect(sanitized.sunIntensity).toBe(2.2);
    expect(sanitized.ambientIntensity).toBe(0.1);
    expect(sanitized.fogDensity).toBe(0.015);
    expect(sanitized.exposure).toBe(0.5);
    expect(sanitized.shadowMapResolution).toBe(512);
    expect(sanitized.shadowCameraBounds).toBe(30);
  });

  it("exposes all required preset ids", () => {
    const ids: AtmospherePresetId[] = ["clearDay", "goldenHour", "overcast", "dusk", "storm"];
    for (const id of ids) {
      const preset = getAtmospherePreset(id);
      expect(preset.sunIntensity).toBeGreaterThan(0);
      expect(preset.fogDensity).toBeGreaterThan(0);
      expect(preset.shadowMapResolution).toBeGreaterThan(0);
    }
  });
});
