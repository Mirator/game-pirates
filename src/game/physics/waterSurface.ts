export interface WaterSurfaceWaveComponent {
  amplitude: number;
  wavelength: number;
  speed: number;
  direction: readonly [number, number];
  steepness: number;
  phaseOffset: number;
}

export interface WaterSurfacePoint {
  x: number;
  z: number;
}

export interface WaterSurfaceTuning {
  waveAmplitude: number;
  wavelength: number;
  waveSpeed: number;
}

function normalizeDirection(direction: readonly [number, number]): readonly [number, number] {
  const length = Math.hypot(direction[0], direction[1]);
  if (length <= 1e-6) {
    return [1, 0];
  }
  return [direction[0] / length, direction[1] / length];
}

export function sampleWaterHeight(
  components: readonly WaterSurfaceWaveComponent[],
  point: WaterSurfacePoint,
  time: number,
  tuning: WaterSurfaceTuning
): number {
  let height = 0;
  for (const component of components) {
    const direction = normalizeDirection(component.direction);
    const wavelength = Math.max(1e-3, component.wavelength * tuning.wavelength);
    const amplitude = component.amplitude * tuning.waveAmplitude;
    const speed = component.speed * tuning.waveSpeed;
    const waveNumber = (Math.PI * 2) / wavelength;
    const phase = waveNumber * (direction[0] * point.x + direction[1] * point.z) + time * speed + component.phaseOffset;
    height += Math.sin(phase) * amplitude;
  }
  return height;
}
