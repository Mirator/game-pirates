import {
  createAtmosphereTuningFromPreset,
  createDefaultAtmosphereConfig,
  sanitizeAtmosphereTuning,
  type AtmosphereRenderConfig,
  type AtmosphereTuningControls
} from "../atmosphere/atmosphereConfig";
import { createDefaultWaterConfig, sanitizeWaterTuning, type WaterRenderConfig, type WaterTuningControls } from "../water/waterConfig";

export interface RenderConfig {
  water: WaterRenderConfig;
  atmosphere: AtmosphereRenderConfig;
}

export interface RenderConfigOverrides {
  water?: Omit<Partial<WaterRenderConfig>, "tuning"> & {
    tuning?: Partial<WaterTuningControls>;
  };
  atmosphere?: Omit<Partial<AtmosphereRenderConfig>, "tuning"> & {
    tuning?: Partial<AtmosphereTuningControls>;
  };
}

export function createRenderConfig(overrides: RenderConfigOverrides = {}): RenderConfig {
  const baseWater = createDefaultWaterConfig();
  const defaultAtmosphere = createDefaultAtmosphereConfig();
  const atmospherePreset = overrides.atmosphere?.preset ?? defaultAtmosphere.preset;
  const mergedWater: WaterRenderConfig = {
    quality: overrides.water?.quality ?? baseWater.quality,
    tuning: sanitizeWaterTuning(overrides.water?.tuning ?? {}, baseWater.tuning)
  };
  const mergedAtmosphere: AtmosphereRenderConfig = {
    preset: atmospherePreset,
    tuning: sanitizeAtmosphereTuning(overrides.atmosphere?.tuning ?? {}, createAtmosphereTuningFromPreset(atmospherePreset))
  };

  return {
    water: mergedWater,
    atmosphere: mergedAtmosphere
  };
}
