import type { WaterSurfaceTuning, WaterSurfaceWaveComponent } from "./waterSurface";

export const DEFAULT_WATER_SURFACE_TUNING: WaterSurfaceTuning = {
  waveAmplitude: 0.8,
  wavelength: 1,
  waveSpeed: 1
};

export const DEFAULT_WATER_SURFACE_WAVES: readonly WaterSurfaceWaveComponent[] = [
  {
    amplitude: 0.58,
    wavelength: 72,
    speed: 0.22,
    direction: [0.96, 0.28],
    steepness: 0.17,
    phaseOffset: 0
  },
  {
    amplitude: 0.4,
    wavelength: 42,
    speed: 0.34,
    direction: [-0.35, 0.94],
    steepness: 0.14,
    phaseOffset: 1.3
  },
  {
    amplitude: 0.24,
    wavelength: 20,
    speed: 0.52,
    direction: [0.86, -0.47],
    steepness: 0.1,
    phaseOffset: 2.1
  },
  {
    amplitude: 0.12,
    wavelength: 11,
    speed: 0.7,
    direction: [0.14, 0.99],
    steepness: 0.07,
    phaseOffset: 3.2
  }
];
