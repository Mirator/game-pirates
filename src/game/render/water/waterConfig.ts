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
  reflectionBlendStrength: number;
  depthGradientDistanceMax: number;
  farColorDesaturation: number;
  horizonLiftStrength: number;
  microNormalScale: number;
  microNormalWeight: number;
  specularGlintExponent: number;
  specularGlintStrength: number;
  crestFoamStrength: number;
  crestFoamThreshold: number;
  wakeIntensity: number;
  foamThreshold: number;
  nearHullDarkeningStrength: number;
  nearHullDarkeningRadius: number;
  curvatureFoamStrength: number;
  wavePeakHighlightStrength: number;
  localInteractionRadius: number;
  localInteractionLength: number;
  bowInteractionStrength: number;
  hullInteractionStrength: number;
  interactionNormalBoost: number;
  bowRippleFrequency: number;
  bowRippleStrength: number;
  nearFieldRadius: number;
  nearFieldNormalBoost: number;
  nearFieldDetailBoost: number;
  nearFieldContrastBoost: number;
  directionalStreakStrength: number;
  directionalStreakScale: number;
  directionalStreakAnisotropy: number;
  disturbedSpecularBoost: number;
  disturbedHighlightFlicker: number;
  disturbedContrastBoost: number;
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
  reflectionBlendStrength: 0.95,
  depthGradientDistanceMax: 220,
  farColorDesaturation: 0.28,
  horizonLiftStrength: 0.32,
  microNormalScale: 4.2,
  microNormalWeight: 0.34,
  specularGlintExponent: 72,
  specularGlintStrength: 1,
  crestFoamStrength: 0.62,
  crestFoamThreshold: 0.34,
  wakeIntensity: 1.35,
  foamThreshold: 0.46,
  nearHullDarkeningStrength: 0.24,
  nearHullDarkeningRadius: 8.8,
  curvatureFoamStrength: 0.6,
  wavePeakHighlightStrength: 0.34,
  localInteractionRadius: 10.5,
  localInteractionLength: 11.5,
  bowInteractionStrength: 0.72,
  hullInteractionStrength: 0.56,
  interactionNormalBoost: 0.62,
  bowRippleFrequency: 10.2,
  bowRippleStrength: 0.42,
  nearFieldRadius: 48,
  nearFieldNormalBoost: 0.4,
  nearFieldDetailBoost: 0.54,
  nearFieldContrastBoost: 0.3,
  directionalStreakStrength: 0.18,
  directionalStreakScale: 0.034,
  directionalStreakAnisotropy: 0.72,
  disturbedSpecularBoost: 0.84,
  disturbedHighlightFlicker: 0.34,
  disturbedContrastBoost: 0.42
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
    reflectionBlendStrength: clamp(next.reflectionBlendStrength ?? current.reflectionBlendStrength, 0, 2),
    depthGradientDistanceMax: clamp(next.depthGradientDistanceMax ?? current.depthGradientDistanceMax, 20, 400),
    farColorDesaturation: clamp(next.farColorDesaturation ?? current.farColorDesaturation, 0, 1),
    horizonLiftStrength: clamp(next.horizonLiftStrength ?? current.horizonLiftStrength, 0, 1.5),
    microNormalScale: clamp(next.microNormalScale ?? current.microNormalScale, 0.25, 12),
    microNormalWeight: clamp(next.microNormalWeight ?? current.microNormalWeight, 0, 1.5),
    specularGlintExponent: clamp(next.specularGlintExponent ?? current.specularGlintExponent, 8, 256),
    specularGlintStrength: clamp(next.specularGlintStrength ?? current.specularGlintStrength, 0, 3),
    crestFoamStrength: clamp(next.crestFoamStrength ?? current.crestFoamStrength, 0, 2.5),
    crestFoamThreshold: clamp(next.crestFoamThreshold ?? current.crestFoamThreshold, 0, 1),
    wakeIntensity: clamp(next.wakeIntensity ?? current.wakeIntensity, 0, 2.5),
    foamThreshold: clamp(next.foamThreshold ?? current.foamThreshold, 0.05, 0.95),
    nearHullDarkeningStrength: clamp(
      next.nearHullDarkeningStrength ?? current.nearHullDarkeningStrength,
      0,
      1.2
    ),
    nearHullDarkeningRadius: clamp(next.nearHullDarkeningRadius ?? current.nearHullDarkeningRadius, 2, 20),
    curvatureFoamStrength: clamp(next.curvatureFoamStrength ?? current.curvatureFoamStrength, 0, 2),
    wavePeakHighlightStrength: clamp(
      next.wavePeakHighlightStrength ?? current.wavePeakHighlightStrength,
      0,
      1
    ),
    localInteractionRadius: clamp(next.localInteractionRadius ?? current.localInteractionRadius, 3, 24),
    localInteractionLength: clamp(next.localInteractionLength ?? current.localInteractionLength, 4, 30),
    bowInteractionStrength: clamp(next.bowInteractionStrength ?? current.bowInteractionStrength, 0, 2),
    hullInteractionStrength: clamp(next.hullInteractionStrength ?? current.hullInteractionStrength, 0, 2),
    interactionNormalBoost: clamp(next.interactionNormalBoost ?? current.interactionNormalBoost, 0, 2),
    bowRippleFrequency: clamp(next.bowRippleFrequency ?? current.bowRippleFrequency, 1, 24),
    bowRippleStrength: clamp(next.bowRippleStrength ?? current.bowRippleStrength, 0, 2),
    nearFieldRadius: clamp(next.nearFieldRadius ?? current.nearFieldRadius, 8, 120),
    nearFieldNormalBoost: clamp(next.nearFieldNormalBoost ?? current.nearFieldNormalBoost, 0, 2),
    nearFieldDetailBoost: clamp(next.nearFieldDetailBoost ?? current.nearFieldDetailBoost, 0, 2),
    nearFieldContrastBoost: clamp(next.nearFieldContrastBoost ?? current.nearFieldContrastBoost, 0, 1.5),
    directionalStreakStrength: clamp(next.directionalStreakStrength ?? current.directionalStreakStrength, 0, 1.5),
    directionalStreakScale: clamp(next.directionalStreakScale ?? current.directionalStreakScale, 0.001, 0.2),
    directionalStreakAnisotropy: clamp(
      next.directionalStreakAnisotropy ?? current.directionalStreakAnisotropy,
      0,
      1
    ),
    disturbedSpecularBoost: clamp(next.disturbedSpecularBoost ?? current.disturbedSpecularBoost, 0, 2.5),
    disturbedHighlightFlicker: clamp(next.disturbedHighlightFlicker ?? current.disturbedHighlightFlicker, 0, 1.5),
    disturbedContrastBoost: clamp(next.disturbedContrastBoost ?? current.disturbedContrastBoost, 0, 1.5)
  };
}
