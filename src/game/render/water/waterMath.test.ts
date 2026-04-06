import { describe, expect, it } from "vitest";
import { buildWaveShaderUniformState, computeShorelineMask, computeWakeIntensity, sampleWaveHeightAtPoint } from "./waterMath";
import { getWaterQualityPreset } from "./waterConfig";

const baseTuning = {
  waveAmplitude: 1,
  wavelength: 1,
  waveSpeed: 1
};

describe("waterMath", () => {
  it("evolves wave output over time in a deterministic way", () => {
    const waves = getWaterQualityPreset("high").waveComponents;
    const point = { x: 12, z: -8 };
    const t0 = sampleWaveHeightAtPoint(waves, point, 0, baseTuning);
    const t1 = sampleWaveHeightAtPoint(waves, point, 4, baseTuning);
    const t1Repeat = sampleWaveHeightAtPoint(waves, point, 4, baseTuning);

    expect(Math.abs(t1 - t0)).toBeGreaterThan(0.001);
    expect(t1Repeat).toBeCloseTo(t1, 8);

    const uniformState = buildWaveShaderUniformState(waves, baseTuning);
    expect(uniformState.amplitudes).toHaveLength(waves.length);
    expect(uniformState.wavelengths).toHaveLength(waves.length);
    expect(uniformState.speeds).toHaveLength(waves.length);
  });

  it("produces stronger shoreline mask close to islands than far away", () => {
    const islands = [{ x: 0, z: 0, radius: 12 }];
    const nearMask = computeShorelineMask({ x: 10, z: 0 }, islands, 1.6);
    const farMask = computeShorelineMask({ x: 90, z: 90 }, islands, 1.6);

    expect(nearMask).toBeGreaterThan(farMask);
    expect(nearMask).toBeGreaterThan(0.1);
    expect(farMask).toBeLessThan(0.01);
  });

  it("scales wake intensity with speed and burst state", () => {
    const idle = computeWakeIntensity(0, 18, false, 1);
    const cruise = computeWakeIntensity(8, 18, false, 1);
    const burst = computeWakeIntensity(8, 18, true, 1);

    expect(idle).toBeCloseTo(0, 6);
    expect(cruise).toBeGreaterThan(idle);
    expect(burst).toBeGreaterThan(cruise);
  });
});
