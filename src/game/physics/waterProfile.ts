import type { WaterSurfaceTuning, WaterSurfaceWaveComponent } from "./waterSurface";

export const DEFAULT_WATER_SURFACE_TUNING: WaterSurfaceTuning = {
  waveAmplitude: 0.8,
  wavelength: 1,
  waveSpeed: 1
};

export const DEFAULT_WATER_SURFACE_WAVES: readonly WaterSurfaceWaveComponent[] = [
  {
    amplitude: 0.74,
    wavelength: 96,
    speed: 0.18,
    direction: [0.98, 0.2],
    steepness: 0.16,
    phaseOffset: 0
  },
  {
    amplitude: 0.36,
    wavelength: 48,
    speed: 0.31,
    direction: [-0.42, 0.91],
    steepness: 0.13,
    phaseOffset: 1.5
  },
  {
    amplitude: 0.22,
    wavelength: 26,
    speed: 0.44,
    direction: [0.76, -0.65],
    steepness: 0.1,
    phaseOffset: 2.4
  },
  {
    amplitude: 0.09,
    wavelength: 13,
    speed: 0.82,
    direction: [0.18, 0.98],
    steepness: 0.06,
    phaseOffset: 3.1
  }
];
