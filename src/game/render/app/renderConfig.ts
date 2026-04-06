import { createDefaultWaterConfig, sanitizeWaterTuning, type WaterRenderConfig, type WaterTuningControls } from "../water/waterConfig";

export interface RenderConfig {
  water: WaterRenderConfig;
}

export interface RenderConfigOverrides {
  water?: Partial<WaterRenderConfig> & {
    tuning?: Partial<WaterTuningControls>;
  };
}

export function createRenderConfig(overrides: RenderConfigOverrides = {}): RenderConfig {
  const baseWater = createDefaultWaterConfig();
  const mergedWater: WaterRenderConfig = {
    quality: overrides.water?.quality ?? baseWater.quality,
    tuning: sanitizeWaterTuning(overrides.water?.tuning ?? {}, baseWater.tuning)
  };

  return {
    water: mergedWater
  };
}
