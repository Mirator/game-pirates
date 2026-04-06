import { DataTexture, LinearFilter, NoColorSpace, RGBAFormat, RepeatWrapping } from "three";

function fract(value: number): number {
  return value - Math.floor(value);
}

function createRng(seed: number): () => number {
  let state = Math.floor((Math.abs(seed) + 1) * 2147483647) % 2147483647;
  if (state === 0) {
    state = 1;
  }
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

interface WaveMode {
  kx: number;
  ky: number;
  phase: number;
  amplitude: number;
}

function buildModes(seed: number): WaveMode[] {
  const rng = createRng(seed);
  const modeCount = 6;
  const modes: WaveMode[] = [];

  for (let i = 0; i < modeCount; i += 1) {
    const angle = rng() * Math.PI * 2;
    const frequency = 1 + Math.floor(rng() * 4); // integer cycles to guarantee seamless tiling
    const kx = Math.round(Math.cos(angle) * frequency);
    const ky = Math.round(Math.sin(angle) * frequency);
    const safeKx = kx === 0 && ky === 0 ? 1 : kx;
    const amplitude = 0.35 / (1 + i * 0.55);

    modes.push({
      kx: safeKx,
      ky,
      phase: fract(rng()) * Math.PI * 2,
      amplitude
    });
  }

  return modes;
}

export function createWaterNormalTexture(size: number, seed: number): DataTexture {
  const data = new Uint8Array(size * size * 4);
  const tau = Math.PI * 2;
  const modes = buildModes(seed);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;

      let dhdu = 0;
      let dhdv = 0;

      for (const mode of modes) {
        const phase = tau * (mode.kx * u + mode.ky * v) + mode.phase;
        const cosPhase = Math.cos(phase);
        dhdu += mode.amplitude * tau * mode.kx * cosPhase;
        dhdv += mode.amplitude * tau * mode.ky * cosPhase;
      }

      // Convert periodic height derivatives to normal.
      const nxRaw = -dhdu * 0.22;
      const nzRaw = -dhdv * 0.22;
      const nyRaw = 1;
      const length = Math.hypot(nxRaw, nyRaw, nzRaw);
      const nx = nxRaw / length;
      const ny = nyRaw / length;
      const nz = nzRaw / length;

      const index = (y * size + x) * 4;
      data[index] = Math.round((nx * 0.5 + 0.5) * 255);
      data[index + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[index + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[index + 3] = 255;
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.colorSpace = NoColorSpace;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
