import type { WaterTuningControls, WaterWaveComponent } from "./waterConfig";
import { sampleWaterHeight } from "../../physics/waterSurface";

interface Vec2 {
  x: number;
  z: number;
}

export interface WaveShaderUniformState {
  amplitudes: number[];
  wavelengths: number[];
  speeds: number[];
  steepness: number[];
  phases: number[];
  directions: Array<readonly [number, number]>;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(min: number, max: number, value: number): number {
  const t = clamp01((value - min) / Math.max(1e-6, max - min));
  return t * t * (3 - 2 * t);
}

function normalizeDirection(direction: readonly [number, number]): readonly [number, number] {
  const length = Math.hypot(direction[0], direction[1]);
  if (length <= 1e-6) {
    return [1, 0];
  }
  return [direction[0] / length, direction[1] / length];
}

export function buildWaveShaderUniformState(
  components: readonly WaterWaveComponent[],
  tuning: Pick<WaterTuningControls, "waveAmplitude" | "wavelength" | "waveSpeed">
): WaveShaderUniformState {
  return {
    amplitudes: components.map((component) => component.amplitude * tuning.waveAmplitude),
    wavelengths: components.map((component) => component.wavelength * tuning.wavelength),
    speeds: components.map((component) => component.speed * tuning.waveSpeed),
    steepness: components.map((component) => component.steepness),
    phases: components.map((component) => component.phaseOffset),
    directions: components.map((component) => normalizeDirection(component.direction))
  };
}

export function sampleWaveHeightAtPoint(
  components: readonly WaterWaveComponent[],
  point: Vec2,
  time: number,
  tuning: Pick<WaterTuningControls, "waveAmplitude" | "wavelength" | "waveSpeed">
): number {
  return sampleWaterHeight(components, point, time, tuning);
}

export interface ShorelineIsland {
  x: number;
  z: number;
  radius: number;
}

export function computeShorelineMask(point: Vec2, islands: readonly ShorelineIsland[], shorelineRadiusScale: number): number {
  let mask = 0;
  for (const island of islands) {
    const inner = Math.max(0, island.radius);
    const outer = Math.max(inner + 1e-3, island.radius * shorelineRadiusScale);
    const distanceToIsland = Math.hypot(point.x - island.x, point.z - island.z);
    const islandMask = 1 - smoothstep(inner, outer, distanceToIsland);
    mask = Math.max(mask, islandMask);
  }
  return clamp01(mask);
}

export function computeWakeIntensity(speed: number, maxForwardSpeed: number, burstActive: boolean, baseIntensity: number): number {
  const normalizedSpeed = clamp01(Math.abs(speed) / Math.max(1e-4, maxForwardSpeed));
  const burstMultiplier = burstActive ? 1.35 : 1;
  return normalizedSpeed * Math.max(0, baseIntensity) * burstMultiplier;
}
