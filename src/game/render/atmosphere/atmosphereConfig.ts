export type AtmospherePresetId = "clearDay" | "goldenHour" | "overcast" | "dusk" | "storm";

export interface AtmospherePreset {
  sunAzimuthDeg: number;
  sunElevationDeg: number;
  sunIntensity: number;
  sunColor: string;
  ambientIntensity: number;
  ambientSkyColor: string;
  ambientGroundColor: string;
  fogDensity: number;
  fogColor: string;
  skyTopColor: string;
  skyHorizonColor: string;
  skyBottomColor: string;
  skySunColor: string;
  skySunStrength: number;
  exposure: number;
  shadowMapResolution: number;
  shadowCameraBounds: number;
  shadowBias: number;
  shadowNormalBias: number;
}

export interface AtmosphereTuningControls {
  sunAzimuthDeg: number;
  sunElevationDeg: number;
  sunIntensity: number;
  ambientIntensity: number;
  fogDensity: number;
  fogColor: string;
  exposure: number;
  shadowMapResolution: number;
  shadowCameraBounds: number;
}

export interface AtmosphereRenderConfig {
  preset: AtmospherePresetId;
  tuning: AtmosphereTuningControls;
}

export interface AtmosphereDebugSnapshot extends AtmosphereTuningControls {
  preset: AtmospherePresetId;
  activeStormBlend: number;
  effectiveExposure: number;
}

export const ATMOSPHERE_PRESETS: Record<AtmospherePresetId, AtmospherePreset> = {
  clearDay: {
    sunAzimuthDeg: 54,
    sunElevationDeg: 40,
    sunIntensity: 1.08,
    sunColor: "#ffe3b3",
    ambientIntensity: 0.56,
    ambientSkyColor: "#d6f0ff",
    ambientGroundColor: "#3a6176",
    fogDensity: 0.0021,
    fogColor: "#8fc6e4",
    skyTopColor: "#74b9eb",
    skyHorizonColor: "#a8dbff",
    skyBottomColor: "#d8ecfb",
    skySunColor: "#ffe4ac",
    skySunStrength: 0.24,
    exposure: 1.0,
    shadowMapResolution: 1024,
    shadowCameraBounds: 95,
    shadowBias: -0.00015,
    shadowNormalBias: 0.021
  },
  goldenHour: {
    sunAzimuthDeg: 35,
    sunElevationDeg: 17,
    sunIntensity: 0.97,
    sunColor: "#ffc78a",
    ambientIntensity: 0.5,
    ambientSkyColor: "#ffd8bc",
    ambientGroundColor: "#6a5448",
    fogDensity: 0.0029,
    fogColor: "#efc09a",
    skyTopColor: "#f39f6f",
    skyHorizonColor: "#ffd6b3",
    skyBottomColor: "#f3e2cf",
    skySunColor: "#ffd09a",
    skySunStrength: 0.3,
    exposure: 1.03,
    shadowMapResolution: 1024,
    shadowCameraBounds: 92,
    shadowBias: -0.00016,
    shadowNormalBias: 0.023
  },
  overcast: {
    sunAzimuthDeg: 25,
    sunElevationDeg: 46,
    sunIntensity: 0.72,
    sunColor: "#d8e2eb",
    ambientIntensity: 0.76,
    ambientSkyColor: "#c7d7e2",
    ambientGroundColor: "#5d6770",
    fogDensity: 0.0037,
    fogColor: "#a5b3bf",
    skyTopColor: "#8b9dab",
    skyHorizonColor: "#b8c3cc",
    skyBottomColor: "#d1d9df",
    skySunColor: "#e9edf1",
    skySunStrength: 0.1,
    exposure: 0.95,
    shadowMapResolution: 1024,
    shadowCameraBounds: 100,
    shadowBias: -0.00012,
    shadowNormalBias: 0.018
  },
  dusk: {
    sunAzimuthDeg: -10,
    sunElevationDeg: 8,
    sunIntensity: 0.56,
    sunColor: "#ffb18d",
    ambientIntensity: 0.43,
    ambientSkyColor: "#9f8ec7",
    ambientGroundColor: "#4a455c",
    fogDensity: 0.0049,
    fogColor: "#7f7594",
    skyTopColor: "#3f4e86",
    skyHorizonColor: "#b17f8d",
    skyBottomColor: "#c7b0a4",
    skySunColor: "#ffb39a",
    skySunStrength: 0.18,
    exposure: 0.88,
    shadowMapResolution: 1024,
    shadowCameraBounds: 86,
    shadowBias: -0.0001,
    shadowNormalBias: 0.016
  },
  storm: {
    sunAzimuthDeg: 20,
    sunElevationDeg: 23,
    sunIntensity: 0.64,
    sunColor: "#c4d4df",
    ambientIntensity: 0.36,
    ambientSkyColor: "#7c92a7",
    ambientGroundColor: "#2d3d4a",
    fogDensity: 0.0073,
    fogColor: "#65788b",
    skyTopColor: "#4f6275",
    skyHorizonColor: "#7a8fa3",
    skyBottomColor: "#8ea1b1",
    skySunColor: "#d4e0e8",
    skySunStrength: 0.08,
    exposure: 0.82,
    shadowMapResolution: 1024,
    shadowCameraBounds: 88,
    shadowBias: -0.00008,
    shadowNormalBias: 0.014
  }
};

export const DEFAULT_ATMOSPHERE_PRESET: AtmospherePresetId = "clearDay";

const SHADOW_MAP_RESOLUTIONS = [256, 512, 1024, 2048, 4096] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAzimuthDegrees(value: number): number {
  let normalized = value;
  while (normalized > 180) normalized -= 360;
  while (normalized < -180) normalized += 360;
  return normalized;
}

function normalizeShadowMapResolution(value: number): number {
  let closest: number = SHADOW_MAP_RESOLUTIONS[0];
  let smallestDistance = Number.POSITIVE_INFINITY;
  for (const resolution of SHADOW_MAP_RESOLUTIONS) {
    const distance = Math.abs(resolution - value);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      closest = resolution;
    }
  }
  return closest;
}

export function getAtmospherePreset(id: AtmospherePresetId): AtmospherePreset {
  return ATMOSPHERE_PRESETS[id];
}

export function createAtmosphereTuningFromPreset(id: AtmospherePresetId): AtmosphereTuningControls {
  const preset = getAtmospherePreset(id);
  return {
    sunAzimuthDeg: preset.sunAzimuthDeg,
    sunElevationDeg: preset.sunElevationDeg,
    sunIntensity: preset.sunIntensity,
    ambientIntensity: preset.ambientIntensity,
    fogDensity: preset.fogDensity,
    fogColor: preset.fogColor,
    exposure: preset.exposure,
    shadowMapResolution: preset.shadowMapResolution,
    shadowCameraBounds: preset.shadowCameraBounds
  };
}

export function createDefaultAtmosphereConfig(): AtmosphereRenderConfig {
  return {
    preset: DEFAULT_ATMOSPHERE_PRESET,
    tuning: createAtmosphereTuningFromPreset(DEFAULT_ATMOSPHERE_PRESET)
  };
}

export function sanitizeAtmosphereTuning(
  next: Partial<AtmosphereTuningControls>,
  current: AtmosphereTuningControls
): AtmosphereTuningControls {
  return {
    sunAzimuthDeg: normalizeAzimuthDegrees(next.sunAzimuthDeg ?? current.sunAzimuthDeg),
    sunElevationDeg: clamp(next.sunElevationDeg ?? current.sunElevationDeg, 4, 85),
    sunIntensity: clamp(next.sunIntensity ?? current.sunIntensity, 0.2, 2.2),
    ambientIntensity: clamp(next.ambientIntensity ?? current.ambientIntensity, 0.1, 1.4),
    fogDensity: clamp(next.fogDensity ?? current.fogDensity, 0.0001, 0.015),
    fogColor: next.fogColor ?? current.fogColor,
    exposure: clamp(next.exposure ?? current.exposure, 0.5, 1.5),
    shadowMapResolution: normalizeShadowMapResolution(next.shadowMapResolution ?? current.shadowMapResolution),
    shadowCameraBounds: clamp(next.shadowCameraBounds ?? current.shadowCameraBounds, 30, 220)
  };
}
