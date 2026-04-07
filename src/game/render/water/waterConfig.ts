import { DEFAULT_WATER_SURFACE_WAVES } from "../../physics/waterProfile";

export type WaterQualityLevel = "low" | "medium" | "high";

export interface WaterWaveComponent {
  amplitude: number;
  wavelength: number;
  speed: number;
  direction: readonly [number, number];
  steepness: number;
  phaseOffset: number;
}

export interface WaterQualityPreset {
  waveComponents: readonly WaterWaveComponent[];
  geometrySegments: number;
  normalStrength: number;
  normalTilingA: number;
  normalTilingB: number;
  normalScrollA: readonly [number, number];
  normalScrollB: readonly [number, number];
  fresnelStrength: number;
  fresnelPower: number;
  specularStrength: number;
  specularExponent: number;
  shorelineEnabled: boolean;
  shorelineStrength: number;
  shorelineRadiusScale: number;
  wakeIntensity: number;
  wakeLength: number;
  wakeWidth: number;
}

export interface WaterTuningControls {
  waveAmplitude: number;
  wavelength: number;
  waveSpeed: number;
  normalScrollSpeedA: number;
  normalScrollSpeedB: number;
  deepColor: string;
  shallowColor: string;
  fresnelStrength: number;
  wakeIntensity: number;
  foamThreshold: number;
}

export interface WaterRenderConfig {
  quality: WaterQualityLevel;
  tuning: WaterTuningControls;
}

export const WATER_MAX_WAVE_COMPONENTS = 4;
export const WATER_MAX_ISLANDS = 8;
export const DEFAULT_WATER_QUALITY: WaterQualityLevel = "high";

const DEFAULT_TUNING: WaterTuningControls = {
  waveAmplitude: 0.8,
  wavelength: 1,
  waveSpeed: 1,
  normalScrollSpeedA: 1,
  normalScrollSpeedB: 1,
  deepColor: "#1b5f93",
  shallowColor: "#54b9cc",
  fresnelStrength: 1,
  wakeIntensity: 1,
  foamThreshold: 0.46
};

const HIGH_WAVES: readonly WaterWaveComponent[] = DEFAULT_WATER_SURFACE_WAVES;

export const WATER_QUALITY_PRESETS: Record<WaterQualityLevel, WaterQualityPreset> = {
  high: {
    waveComponents: HIGH_WAVES,
    geometrySegments: 140,
    normalStrength: 0.24,
    normalTilingA: 0.021,
    normalTilingB: 0.037,
    normalScrollA: [0.0052, 0.0044],
    normalScrollB: [-0.0038, 0.0063],
    fresnelStrength: 1.25,
    fresnelPower: 4.2,
    specularStrength: 0.72,
    specularExponent: 54,
    shorelineEnabled: true,
    shorelineStrength: 1,
    shorelineRadiusScale: 1.68,
    wakeIntensity: 1.05,
    wakeLength: 30,
    wakeWidth: 2.7
  },
  medium: {
    waveComponents: HIGH_WAVES.slice(0, 3),
    geometrySegments: 90,
    normalStrength: 0.2,
    normalTilingA: 0.018,
    normalTilingB: 0.03,
    normalScrollA: [0.0042, 0.0035],
    normalScrollB: [-0.003, 0.0048],
    fresnelStrength: 1.08,
    fresnelPower: 4.6,
    specularStrength: 0.62,
    specularExponent: 42,
    shorelineEnabled: true,
    shorelineStrength: 0.82,
    shorelineRadiusScale: 1.55,
    wakeIntensity: 0.8,
    wakeLength: 24,
    wakeWidth: 2.25
  },
  low: {
    waveComponents: HIGH_WAVES.slice(0, 1),
    geometrySegments: 46,
    normalStrength: 0.12,
    normalTilingA: 0.015,
    normalTilingB: 0.015,
    normalScrollA: [0.0026, 0.0021],
    normalScrollB: [0.0026, 0.0021],
    fresnelStrength: 0.7,
    fresnelPower: 5.3,
    specularStrength: 0.42,
    specularExponent: 28,
    shorelineEnabled: false,
    shorelineStrength: 0,
    shorelineRadiusScale: 1.48,
    wakeIntensity: 0.5,
    wakeLength: 18,
    wakeWidth: 1.8
  }
};

export interface WaterDebugSnapshot extends WaterTuningControls {
  quality: WaterQualityLevel;
  activeWaveCount: number;
}

export function createDefaultWaterConfig(): WaterRenderConfig {
  return {
    quality: DEFAULT_WATER_QUALITY,
    tuning: { ...DEFAULT_TUNING }
  };
}

export function getWaterQualityPreset(quality: WaterQualityLevel): WaterQualityPreset {
  return WATER_QUALITY_PRESETS[quality];
}

export function sanitizeWaterTuning(next: Partial<WaterTuningControls>, current: WaterTuningControls): WaterTuningControls {
  const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
  return {
    waveAmplitude: clamp(next.waveAmplitude ?? current.waveAmplitude, 0.35, 2.25),
    wavelength: clamp(next.wavelength ?? current.wavelength, 0.5, 2.2),
    waveSpeed: clamp(next.waveSpeed ?? current.waveSpeed, 0.3, 2.4),
    normalScrollSpeedA: clamp(next.normalScrollSpeedA ?? current.normalScrollSpeedA, 0, 3),
    normalScrollSpeedB: clamp(next.normalScrollSpeedB ?? current.normalScrollSpeedB, 0, 3),
    deepColor: next.deepColor ?? current.deepColor,
    shallowColor: next.shallowColor ?? current.shallowColor,
    fresnelStrength: clamp(next.fresnelStrength ?? current.fresnelStrength, 0.2, 2.4),
    wakeIntensity: clamp(next.wakeIntensity ?? current.wakeIntensity, 0, 2.5),
    foamThreshold: clamp(next.foamThreshold ?? current.foamThreshold, 0.05, 0.95)
  };
}
