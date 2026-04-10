import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector3
} from "three";

export type WakeQualityLevel = "low" | "medium" | "high";

export interface WakeTuningControls {
  minSpeedThreshold: number;
  minSampleDistance: number;
  minSampleTime: number;
  sternPatchLength: number;
  sternPatchWidth: number;
  sternOpacity: number;
  sternUvScrollSpeed: number;
  baseWakeWidth: number;
  widthBySpeedMultiplier: number;
  widthByTurnMultiplier: number;
  ribbonStartWidthFactor: number;
  ribbonEndWidthFactor: number;
  maxWakeLifetime: number;
  alphaFadeCurve: number;
  edgeSoftness: number;
  textureScrollSpeed: number;
  normalBoostAmount: number;
  foamTintAmount: number;
  distortionLength: number;
  distortionFalloff: number;
  coreBandStrength: number;
  trailBandStrength: number;
  outerBandStrength: number;
  coreBandWidthMultiplier: number;
  trailBandWidthMultiplier: number;
  outerBandWidthMultiplier: number;
  coreBandLengthMultiplier: number;
  trailBandLengthMultiplier: number;
  outerBandLengthMultiplier: number;
  outerBandLifetimeMultiplier: number;
  turnAsymmetryStrength: number;
  throttleInfluenceStrength: number;
  accelerationInfluenceStrength: number;
  sprayBaseOpacity: number;
  sprayBoostMultiplier: number;
}

export interface WakeSample {
  position: Vector3;
  forward: Vector3;
  age: number;
  width: number;
  intensity: number;
}

export interface WakeShaderInfluence {
  sternX: number;
  sternZ: number;
  forwardX: number;
  forwardZ: number;
  intensity: number;
  width: number;
  length: number;
  turn: number;
  normalBoost: number;
  foamTint: number;
  falloff: number;
}

export interface ShipWakeController {
  update(deltaTime: number): void;
  setSpeed(speed: number): void;
  setThrottle(throttle: number): void;
  setTransform(position: Vector3, forward: Vector3): void;
  setTurnRate(turnRate: number): void;
  setBoosting(boosting: boolean): void;
  getShaderInfluences(): readonly WakeShaderInfluence[];
  getRoot(): Group;
  dispose(): void;
}

export interface WakeDebugSurface {
  getTuning: () => WakeTuningControls;
  updateTuning: (patch: Partial<WakeTuningControls>) => void;
}

export interface ShipWakeControllerOptions {
  quality: WakeQualityLevel;
  sternOffset: number;
  rootName: string;
  tuning?: Partial<WakeTuningControls>;
}

const QUALITY_SAMPLE_LIMIT: Record<WakeQualityLevel, number> = {
  low: 16,
  medium: 28,
  high: 40
};

const QUALITY_BASE_TUNING: Record<WakeQualityLevel, WakeTuningControls> = {
  low: {
    minSpeedThreshold: 2.8,
    minSampleDistance: 1.2,
    minSampleTime: 0.13,
    sternPatchLength: 1.8,
    sternPatchWidth: 1.2,
    sternOpacity: 0.16,
    sternUvScrollSpeed: 0.44,
    baseWakeWidth: 0.5,
    widthBySpeedMultiplier: 0.025,
    widthByTurnMultiplier: 0.2,
    ribbonStartWidthFactor: 0.32,
    ribbonEndWidthFactor: 1.25,
    maxWakeLifetime: 2.4,
    alphaFadeCurve: 1.55,
    edgeSoftness: 2.2,
    textureScrollSpeed: 0.34,
    normalBoostAmount: 0.14,
    foamTintAmount: 0.14,
    distortionLength: 6.5,
    distortionFalloff: 1.3,
    coreBandStrength: 1.02,
    trailBandStrength: 0.82,
    outerBandStrength: 0.48,
    coreBandWidthMultiplier: 0.82,
    trailBandWidthMultiplier: 1.38,
    outerBandWidthMultiplier: 2.0,
    coreBandLengthMultiplier: 0.38,
    trailBandLengthMultiplier: 1.0,
    outerBandLengthMultiplier: 1.82,
    outerBandLifetimeMultiplier: 1.45,
    turnAsymmetryStrength: 0.3,
    throttleInfluenceStrength: 0.28,
    accelerationInfluenceStrength: 0.26,
    sprayBaseOpacity: 0.0,
    sprayBoostMultiplier: 0.0
  },
  medium: {
    minSpeedThreshold: 2.1,
    minSampleDistance: 0.85,
    minSampleTime: 0.09,
    sternPatchLength: 2.2,
    sternPatchWidth: 1.55,
    sternOpacity: 0.2,
    sternUvScrollSpeed: 0.62,
    baseWakeWidth: 0.58,
    widthBySpeedMultiplier: 0.03,
    widthByTurnMultiplier: 0.28,
    ribbonStartWidthFactor: 0.3,
    ribbonEndWidthFactor: 1.35,
    maxWakeLifetime: 3.1,
    alphaFadeCurve: 1.42,
    edgeSoftness: 2.35,
    textureScrollSpeed: 0.44,
    normalBoostAmount: 0.18,
    foamTintAmount: 0.2,
    distortionLength: 8.5,
    distortionFalloff: 1.45,
    coreBandStrength: 1.12,
    trailBandStrength: 0.92,
    outerBandStrength: 0.54,
    coreBandWidthMultiplier: 0.86,
    trailBandWidthMultiplier: 1.5,
    outerBandWidthMultiplier: 2.22,
    coreBandLengthMultiplier: 0.42,
    trailBandLengthMultiplier: 1.1,
    outerBandLengthMultiplier: 2.0,
    outerBandLifetimeMultiplier: 1.65,
    turnAsymmetryStrength: 0.38,
    throttleInfluenceStrength: 0.38,
    accelerationInfluenceStrength: 0.35,
    sprayBaseOpacity: 0.0,
    sprayBoostMultiplier: 0.16
  },
  high: {
    minSpeedThreshold: 1.6,
    minSampleDistance: 0.62,
    minSampleTime: 0.055,
    sternPatchLength: 2.15,
    sternPatchWidth: 1.52,
    sternOpacity: 0.24,
    sternUvScrollSpeed: 0.84,
    baseWakeWidth: 0.62,
    widthBySpeedMultiplier: 0.034,
    widthByTurnMultiplier: 0.34,
    ribbonStartWidthFactor: 0.28,
    ribbonEndWidthFactor: 1.45,
    maxWakeLifetime: 3.8,
    alphaFadeCurve: 1.34,
    edgeSoftness: 2.5,
    textureScrollSpeed: 0.54,
    normalBoostAmount: 0.24,
    foamTintAmount: 0.28,
    distortionLength: 10.5,
    distortionFalloff: 1.62,
    coreBandStrength: 1.22,
    trailBandStrength: 1.0,
    outerBandStrength: 0.62,
    coreBandWidthMultiplier: 0.92,
    trailBandWidthMultiplier: 1.62,
    outerBandWidthMultiplier: 2.36,
    coreBandLengthMultiplier: 0.45,
    trailBandLengthMultiplier: 1.18,
    outerBandLengthMultiplier: 2.18,
    outerBandLifetimeMultiplier: 1.8,
    turnAsymmetryStrength: 0.45,
    throttleInfluenceStrength: 0.46,
    accelerationInfluenceStrength: 0.44,
    sprayBaseOpacity: 0.0,
    sprayBoostMultiplier: 0.24
  }
};

let wakeGlobalPatch: Partial<WakeTuningControls> = {};
let wakeGlobalPatchVersion = 0;

function getMergedTuning(base: WakeTuningControls): WakeTuningControls {
  return {
    ...base,
    ...wakeGlobalPatch
  };
}

export function getWakeGlobalTuning(): WakeTuningControls {
  return getMergedTuning(QUALITY_BASE_TUNING.high);
}

export function updateWakeGlobalTuning(patch: Partial<WakeTuningControls>): void {
  wakeGlobalPatch = {
    ...wakeGlobalPatch,
    ...patch
  };
  wakeGlobalPatchVersion += 1;
}

const WAKE_VERTEX_SHADER = `
attribute float aAge;
attribute float aIntensity;

varying vec2 vUv;
varying float vAge;
varying float vIntensity;

void main() {
  vUv = uv;
  vAge = aAge;
  vIntensity = aIntensity;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const UP_AXIS = new Vector3(0, 1, 0);

const WAKE_FRAGMENT_SHADER = `
uniform sampler2D uFoamMap;
uniform sampler2D uNoiseMap;
uniform float uTime;
uniform float uOpacity;
uniform float uTextureScrollSpeed;
uniform float uEdgeSoftness;
uniform vec3 uFoamColor;

varying vec2 vUv;
varying float vAge;
varying float vIntensity;

void main() {
  float age = clamp(vAge, 0.0, 1.0);
  float intensity = clamp(vIntensity, 0.0, 1.0);

  vec2 foamUv = vec2(
    vUv.x * 4.6 + sin(vUv.y * 18.0 + uTime * 0.8) * 0.06,
    vUv.y * 12.0 - uTime * uTextureScrollSpeed
  );
  vec2 noiseUvA = vec2(vUv.x * 7.8 - uTime * 0.12, vUv.y * 19.0 - uTime * 0.23);
  vec2 noiseUvB = vec2(vUv.x * 11.0 + uTime * 0.19, vUv.y * 27.0 + uTime * 0.11);

  float foamTex = texture2D(uFoamMap, foamUv).a;
  float noiseA = texture2D(uNoiseMap, noiseUvA).a;
  float noiseB = texture2D(uNoiseMap, noiseUvB).a;

  float center = max(0.0, 1.0 - abs(vUv.x * 2.0 - 1.0));
  float edge = pow(center, max(0.4, uEdgeSoftness));
  float ageFade = pow(max(0.0, 1.0 - age), 1.6);

  float breakupField = foamTex * 0.52 + noiseA * 0.33 + noiseB * 0.15;
  float breakup = smoothstep(0.35, 0.78, breakupField - age * 0.14 + (center - 0.5) * 0.12);
  float striations = 0.78 + sin(vUv.y * 46.0 + uTime * 4.1 + vUv.x * 12.0) * 0.22;
  float baseAlpha = uOpacity * intensity * ageFade * edge * striations;
  float alpha = baseAlpha * breakup;

  if (alpha < 0.006) {
    discard;
  }

  vec3 tint = mix(vec3(0.7, 0.85, 0.93), uFoamColor, clamp(breakup * 0.8 + center * 0.2, 0.0, 1.0));
  vec3 color = mix(tint, vec3(0.94, 0.98, 1.0), breakup * 0.25 * intensity);
  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

function createNoiseTexture(size: number, seed = 0): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;
      const wave = Math.sin((nx * 18 + ny * 11 + seed * 0.1) * Math.PI) * 0.5 + 0.5;
      const waveB = Math.sin((nx * 27 - ny * 23 + seed * 0.3) * Math.PI) * 0.5 + 0.5;
      const hash = Math.abs(Math.sin((x * 12.9898 + y * 78.233 + seed * 31.4) * 0.024) * 43758.5453123) % 1;
      const breakup = clamp(wave * 0.48 + waveB * 0.34 + hash * 0.18, 0, 1);
      const alpha = Math.round(breakup * 255);
      data[idx] = alpha;
      data[idx + 1] = alpha;
      data[idx + 2] = alpha;
      data[idx + 3] = alpha;
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createSternPatchTexture(size: number): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const v = y / (size - 1);
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1);
      const idx = (y * size + x) * 4;
      const xCenter = (u - 0.5) * 2;
      const yCenter = (v - 0.15) * 1.6;
      const radial = Math.sqrt(xCenter * xCenter + yCenter * yCenter);
      const ring = Math.max(0, 1 - radial * radial);
      const ripple = Math.sin((u * 22 + v * 9) * Math.PI) * 0.5 + 0.5;
      const alpha = Math.round(clamp(ring * (0.8 + ripple * 0.2), 0, 1) * 255);
      data[idx] = alpha;
      data[idx + 1] = alpha;
      data[idx + 2] = alpha;
      data[idx + 3] = alpha;
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

const FOAM_TEXTURE = createNoiseTexture(128, 1.7);
const BREAKUP_TEXTURE = createNoiseTexture(128, 9.2);
const STERN_TEXTURE = createSternPatchTexture(96);
const WAKE_LAYER_COUNT = 3;

function createEmptyWakeInfluence(): WakeShaderInfluence {
  return {
    sternX: 0,
    sternZ: 0,
    forwardX: 0,
    forwardZ: 1,
    intensity: 0,
    width: 0,
    length: 0,
    turn: 0,
    normalBoost: 0,
    foamTint: 0,
    falloff: 1
  };
}

class ShipWakeControllerImpl implements ShipWakeController {
  private readonly maxSamples: number;
  private readonly baseTuning: WakeTuningControls;
  private tuning: WakeTuningControls;
  private appliedPatchVersion = -1;
  private readonly root: Group;
  private readonly sternMesh: Mesh;
  private readonly sternMaterial: MeshStandardMaterial;
  private readonly ribbonMesh: Mesh;
  private readonly ribbonMaterial: ShaderMaterial;
  private readonly ribbonGeometry: BufferGeometry;
  private readonly sprayGroup: Group;
  private readonly sprayParts: Mesh[] = [];

  private readonly positions: Float32Array;
  private readonly uvs: Float32Array;
  private readonly ages: Float32Array;
  private readonly intensities: Float32Array;

  private readonly tmpA = new Vector3();
  private readonly tmpB = new Vector3();
  private readonly tmpTangent = new Vector3();
  private readonly tmpLateral = new Vector3();
  private readonly tmpLeftA = new Vector3();
  private readonly tmpRightA = new Vector3();
  private readonly tmpLeftB = new Vector3();
  private readonly tmpRightB = new Vector3();
  private readonly tmpStern = new Vector3();
  private readonly tmpRight = new Vector3();

  private position = new Vector3();
  private forward = new Vector3(0, 0, 1);
  private speed = 0;
  private previousSpeed = 0;
  private liveAcceleration = 0;
  private throttle = 0;
  private turnRate = 0;
  private boosting = false;
  private time = 0;
  private sampleTimer = 0;
  private lastSamplePosition = new Vector3();
  private hasLastSample = false;
  private liveIntensity = 0;
  private liveWidth = 0;
  private liveLength = 0;
  private readonly influences: WakeShaderInfluence[] = Array.from(
    { length: WAKE_LAYER_COUNT },
    () => createEmptyWakeInfluence()
  );
  private readonly samples: WakeSample[] = [];

  constructor(options: ShipWakeControllerOptions) {
    this.maxSamples = QUALITY_SAMPLE_LIMIT[options.quality];
    this.baseTuning = {
      ...QUALITY_BASE_TUNING[options.quality],
      ...(options.tuning ?? {})
    };
    this.tuning = getMergedTuning(this.baseTuning);
    this.appliedPatchVersion = wakeGlobalPatchVersion;

    this.root = new Group();
    this.root.name = options.rootName;

    const sternTexture = STERN_TEXTURE.clone();
    sternTexture.wrapS = RepeatWrapping;
    sternTexture.wrapT = RepeatWrapping;
    sternTexture.magFilter = LinearFilter;
    sternTexture.minFilter = LinearFilter;
    sternTexture.needsUpdate = true;
    this.sternMaterial = new MeshStandardMaterial({
      color: "#ecfbff",
      emissive: "#b6ebf8",
      emissiveIntensity: 0.25,
      transparent: true,
      alphaMap: sternTexture,
      alphaTest: 0.08,
      opacity: 0,
      roughness: 0.2,
      metalness: 0.02,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide
    });
    this.sternMesh = new Mesh(new PlaneGeometry(1.4, 1.8, 8, 8), this.sternMaterial);
    this.sternMesh.rotation.x = -Math.PI * 0.5;
    this.sternMesh.position.y = 0.05;
    this.sternMesh.visible = false;
    this.sternMesh.renderOrder = 22;
    this.root.add(this.sternMesh);

    const maxSegments = Math.max(1, this.maxSamples - 1);
    const maxVertices = maxSegments * 6;
    this.positions = new Float32Array(maxVertices * 3);
    this.uvs = new Float32Array(maxVertices * 2);
    this.ages = new Float32Array(maxVertices);
    this.intensities = new Float32Array(maxVertices);

    this.ribbonGeometry = new BufferGeometry();
    const positionAttr = new BufferAttribute(this.positions, 3);
    const uvAttr = new BufferAttribute(this.uvs, 2);
    const ageAttr = new BufferAttribute(this.ages, 1);
    const intensityAttr = new BufferAttribute(this.intensities, 1);
    positionAttr.setUsage(DynamicDrawUsage);
    uvAttr.setUsage(DynamicDrawUsage);
    ageAttr.setUsage(DynamicDrawUsage);
    intensityAttr.setUsage(DynamicDrawUsage);
    this.ribbonGeometry.setAttribute("position", positionAttr);
    this.ribbonGeometry.setAttribute("uv", uvAttr);
    this.ribbonGeometry.setAttribute("aAge", ageAttr);
    this.ribbonGeometry.setAttribute("aIntensity", intensityAttr);
    this.ribbonGeometry.setDrawRange(0, 0);
    this.ribbonGeometry.computeBoundingSphere();

    this.ribbonMaterial = new ShaderMaterial({
      uniforms: {
        uFoamMap: { value: FOAM_TEXTURE },
        uNoiseMap: { value: BREAKUP_TEXTURE },
        uTime: { value: 0 },
        uOpacity: { value: 0.3 },
        uTextureScrollSpeed: { value: this.tuning.textureScrollSpeed },
        uEdgeSoftness: { value: this.tuning.edgeSoftness },
        uFoamColor: { value: new Color("#d4f5ff") }
      },
      vertexShader: WAKE_VERTEX_SHADER,
      fragmentShader: WAKE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide
    });

    this.ribbonMesh = new Mesh(this.ribbonGeometry, this.ribbonMaterial);
    this.ribbonMesh.visible = false;
    this.ribbonMesh.frustumCulled = false;
    this.ribbonMesh.renderOrder = 21;
    this.root.add(this.ribbonMesh);

    this.sprayGroup = new Group();
    this.sprayGroup.visible = false;
    this.sprayGroup.renderOrder = 23;
    this.root.add(this.sprayGroup);

    for (let i = 0; i < 6; i += 1) {
      const sprayMaterial = new MeshStandardMaterial({
        color: "#f4fdff",
        emissive: "#c4f0ff",
        emissiveIntensity: 0.2,
        alphaMap: BREAKUP_TEXTURE,
        transparent: true,
        opacity: 0,
        roughness: 0.18,
        metalness: 0,
        depthWrite: false,
        depthTest: true,
        side: DoubleSide,
        blending: AdditiveBlending
      });
      const spray = new Mesh(new PlaneGeometry(0.45, 0.58), sprayMaterial);
      spray.rotation.x = -Math.PI * 0.5;
      spray.visible = false;
      spray.renderOrder = 23;
      this.sprayGroup.add(spray);
      this.sprayParts.push(spray);
    }

    this.tmpStern.set(0, 0, -Math.max(0.4, options.sternOffset));
  }

  update(deltaTime: number): void {
    this.applyGlobalPatchIfNeeded();
    const dt = Math.max(0, deltaTime);
    this.time += dt;
    this.sampleTimer += dt;

    const speedAbs = Math.abs(this.speed);
    const acceleration = dt > 1e-5 ? (this.speed - this.previousSpeed) / dt : 0;
    this.previousSpeed = this.speed;
    const accelerationFollow = 1 - Math.exp(-7.6 * dt);
    this.liveAcceleration = lerp(this.liveAcceleration, acceleration, accelerationFollow);
    const speedNorm = clamp((speedAbs - this.tuning.minSpeedThreshold * 0.2) / 8, 0, 1);
    const turnNorm = clamp(Math.abs(this.turnRate) * 0.045, 0, 1);
    const accelNorm = clamp(Math.abs(this.liveAcceleration) / 8.5, 0, 1);
    const boostFactor = this.boosting ? 1 : 0;
    const throttleNorm = clamp(Math.abs(this.throttle), 0, 1);
    const targetIntensity = clamp(
      speedNorm * 1.02 +
        turnNorm * 0.3 +
        boostFactor * 0.25 +
        throttleNorm * this.tuning.throttleInfluenceStrength +
        accelNorm * this.tuning.accelerationInfluenceStrength,
      0,
      1
    );
    const follow = targetIntensity > this.liveIntensity ? 1 - Math.exp(-8.2 * dt) : 1 - Math.exp(-3.8 * dt);
    this.liveIntensity = lerp(this.liveIntensity, targetIntensity, follow);
    this.liveWidth =
      this.tuning.baseWakeWidth +
      speedAbs * this.tuning.widthBySpeedMultiplier +
      turnNorm * this.tuning.baseWakeWidth * this.tuning.widthByTurnMultiplier +
      (this.boosting ? this.tuning.baseWakeWidth * 0.24 : 0);
    this.liveLength = this.tuning.distortionLength * (0.6 + speedNorm * 1.2 + turnNorm * 0.32 + boostFactor * 0.2);

    this.ageAndPruneSamples(dt);
    this.tryAddSample(speedAbs, speedNorm);
    this.rebuildRibbon();
    this.updateSternPatch(speedNorm);
    this.updateSpray(speedNorm);
    this.updateInfluences();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  setThrottle(throttle: number): void {
    this.throttle = clamp(throttle, -1, 1);
  }

  setTransform(position: Vector3, forward: Vector3): void {
    this.position.copy(position);
    this.forward.copy(forward);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-6) {
      this.forward.set(0, 0, 1);
    }
    this.forward.normalize();
  }

  setTurnRate(turnRate: number): void {
    this.turnRate = turnRate;
  }

  setBoosting(boosting: boolean): void {
    this.boosting = boosting;
  }

  getShaderInfluences(): readonly WakeShaderInfluence[] {
    return this.influences;
  }

  getRoot(): Group {
    return this.root;
  }

  dispose(): void {
    this.ribbonGeometry.dispose();
    this.ribbonMaterial.dispose();
    this.sternMesh.geometry.dispose();
    this.sternMaterial.dispose();
    for (const spray of this.sprayParts) {
      spray.geometry.dispose();
      (spray.material as MeshStandardMaterial).dispose();
    }
    this.samples.length = 0;
  }

  private applyGlobalPatchIfNeeded(): void {
    if (this.appliedPatchVersion === wakeGlobalPatchVersion) {
      return;
    }
    this.tuning = getMergedTuning(this.baseTuning);
    this.appliedPatchVersion = wakeGlobalPatchVersion;
  }

  private ageAndPruneSamples(dt: number): void {
    const maxLifetime = this.tuning.maxWakeLifetime;
    for (const sample of this.samples) {
      sample.age += dt;
    }
    while (this.samples.length > 0) {
      const sample = this.samples[0];
      if (!sample || sample.age <= maxLifetime) {
        break;
      }
      this.samples.shift();
    }
  }

  private computeSternPosition(target: Vector3): Vector3 {
    target.copy(this.position).addScaledVector(this.forward, this.tmpStern.z);
    target.y = 0.03;
    return target;
  }

  private tryAddSample(speedAbs: number, speedNorm: number): void {
    const minSpeed = this.tuning.minSpeedThreshold;
    if (speedAbs < minSpeed * 0.55) {
      return;
    }

    const sternPosition = this.computeSternPosition(this.tmpA);
    const minDistSq = this.tuning.minSampleDistance * this.tuning.minSampleDistance;
    let shouldSample = false;

    if (!this.hasLastSample) {
      shouldSample = true;
    } else {
      const distSq = sternPosition.distanceToSquared(this.lastSamplePosition);
      if (distSq >= minDistSq || this.sampleTimer >= this.tuning.minSampleTime) {
        shouldSample = true;
      }
    }

    if (!shouldSample) {
      return;
    }

    this.samples.push({
      position: sternPosition.clone(),
      forward: this.forward.clone(),
      age: 0,
      width: this.liveWidth,
      intensity: clamp(this.liveIntensity * (0.62 + speedNorm * 0.3), 0, 1)
    });

    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    this.lastSamplePosition.copy(sternPosition);
    this.hasLastSample = true;
    this.sampleTimer = 0;
  }

  private computeSampleSideVertices(index: number, outLeft: Vector3, outRight: Vector3): void {
    const sample = this.samples[index];
    if (!sample) {
      outLeft.set(0, 0, 0);
      outRight.set(0, 0, 0);
      return;
    }

    const prev = this.samples[Math.max(0, index - 1)] ?? sample;
    const next = this.samples[Math.min(this.samples.length - 1, index + 1)] ?? sample;

    const ageNorm = clamp(sample.age / this.tuning.maxWakeLifetime, 0, 1);
    this.tmpTangent.copy(next.position).sub(prev.position);
    this.tmpTangent.y = 0;
    if (this.tmpTangent.lengthSq() < 1e-6) {
      this.tmpTangent.copy(sample.forward);
      this.tmpTangent.y = 0;
    }
    this.tmpTangent.normalize();
    this.tmpLateral.crossVectors(sample.forward, UP_AXIS);
    this.tmpLateral.y = 0;
    if (this.tmpLateral.lengthSq() < 1e-6) {
      this.tmpLateral.set(-this.tmpTangent.z, 0, this.tmpTangent.x);
    }
    this.tmpLateral.normalize();

    const widthFactor = lerp(this.tuning.ribbonStartWidthFactor, this.tuning.ribbonEndWidthFactor, ageNorm);
    const width = sample.width * widthFactor;
    outLeft.copy(sample.position).addScaledVector(this.tmpLateral, width * 0.5);
    outRight.copy(sample.position).addScaledVector(this.tmpLateral, -width * 0.5);
  }

  private rebuildRibbon(): void {
    const sampleCount = this.samples.length;
    if (sampleCount < 2 || this.liveIntensity <= 0.01) {
      this.ribbonMesh.visible = false;
      this.ribbonGeometry.setDrawRange(0, 0);
      return;
    }

    let cumulativeDistance = 0;
    const distances = new Array<number>(sampleCount).fill(0);
    for (let i = 1; i < sampleCount; i += 1) {
      const prev = this.samples[i - 1];
      const current = this.samples[i];
      if (!prev || !current) {
        continue;
      }
      cumulativeDistance += prev.position.distanceTo(current.position);
      distances[i] = cumulativeDistance;
    }
    const invTotalDistance = cumulativeDistance > 1e-5 ? 1 / cumulativeDistance : 0;

    let vertexOffset = 0;
    for (let i = 0; i < sampleCount - 1; i += 1) {
      this.computeSampleSideVertices(i, this.tmpLeftA, this.tmpRightA);
      this.computeSampleSideVertices(i + 1, this.tmpLeftB, this.tmpRightB);

      const sampleA = this.samples[i];
      const sampleB = this.samples[i + 1];
      if (!sampleA || !sampleB) {
        continue;
      }

      const ageA = clamp(sampleA.age / this.tuning.maxWakeLifetime, 0, 1);
      const ageB = clamp(sampleB.age / this.tuning.maxWakeLifetime, 0, 1);
      const intensityA = clamp(sampleA.intensity * Math.pow(Math.max(0, 1 - ageA), this.tuning.alphaFadeCurve), 0, 1);
      const intensityB = clamp(sampleB.intensity * Math.pow(Math.max(0, 1 - ageB), this.tuning.alphaFadeCurve), 0, 1);
      const vA = 1 - (distances[i] ?? 0) * invTotalDistance;
      const vB = 1 - (distances[i + 1] ?? 0) * invTotalDistance;

      vertexOffset = this.writeWakeTriangle(vertexOffset, this.tmpLeftA, this.tmpRightA, this.tmpLeftB, vA, vA, vB, ageA, ageA, ageB, intensityA, intensityA, intensityB);
      vertexOffset = this.writeWakeTriangle(vertexOffset, this.tmpRightA, this.tmpRightB, this.tmpLeftB, vA, vB, vB, ageA, ageB, ageB, intensityA, intensityB, intensityB);
    }

    (this.ribbonGeometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    (this.ribbonGeometry.getAttribute("uv") as BufferAttribute).needsUpdate = true;
    (this.ribbonGeometry.getAttribute("aAge") as BufferAttribute).needsUpdate = true;
    (this.ribbonGeometry.getAttribute("aIntensity") as BufferAttribute).needsUpdate = true;
    this.ribbonGeometry.setDrawRange(0, vertexOffset);
    this.ribbonMesh.visible = vertexOffset > 0;
    const uniforms = this.ribbonMaterial.uniforms as {
      uTime: { value: number };
      uTextureScrollSpeed: { value: number };
      uEdgeSoftness: { value: number };
      uOpacity: { value: number };
    };
    uniforms.uTime.value = this.time;
    uniforms.uTextureScrollSpeed.value = this.tuning.textureScrollSpeed;
    uniforms.uEdgeSoftness.value = this.tuning.edgeSoftness;
    uniforms.uOpacity.value = 0.1 + this.liveIntensity * 0.2;
  }

  private writeWakeTriangle(
    vertexOffset: number,
    a: Vector3,
    b: Vector3,
    c: Vector3,
    vA: number,
    vB: number,
    vC: number,
    ageA: number,
    ageB: number,
    ageC: number,
    intensityA: number,
    intensityB: number,
    intensityC: number
  ): number {
    vertexOffset = this.writeVertex(vertexOffset, a, 0, vA, ageA, intensityA);
    vertexOffset = this.writeVertex(vertexOffset, b, 1, vB, ageB, intensityB);
    vertexOffset = this.writeVertex(vertexOffset, c, 0, vC, ageC, intensityC);
    return vertexOffset;
  }

  private writeVertex(
    vertexOffset: number,
    point: Vector3,
    u: number,
    v: number,
    age: number,
    intensity: number
  ): number {
    const positionIndex = vertexOffset * 3;
    const uvIndex = vertexOffset * 2;
    this.positions[positionIndex] = point.x;
    this.positions[positionIndex + 1] = 0.022;
    this.positions[positionIndex + 2] = point.z;
    this.uvs[uvIndex] = u;
    this.uvs[uvIndex + 1] = v;
    this.ages[vertexOffset] = age;
    this.intensities[vertexOffset] = intensity;
    return vertexOffset + 1;
  }

  private updateSternPatch(speedNorm: number): void {
    const sternPos = this.computeSternPosition(this.tmpB);
    const heading = Math.atan2(this.forward.x, this.forward.z);
    const intensity = clamp(this.liveIntensity * (0.45 + speedNorm * 0.35), 0, 1);
    const visible = intensity > 0.015;

    this.sternMesh.visible = visible;
    if (!visible) {
      this.sternMaterial.opacity = 0;
      return;
    }

    this.sternMesh.position.set(sternPos.x, 0.055, sternPos.z);
    this.sternMesh.rotation.y = heading;
    const jitter = Math.sin(this.time * 3.6 + sternPos.x * 0.12 + sternPos.z * 0.11) * 0.04;
    const turnNorm = clamp(Math.abs(this.turnRate) * 0.05, 0, 1);
    this.sternMesh.scale.set(
      this.tuning.sternPatchWidth * (1 + speedNorm * 0.18 + turnNorm * 0.22 + (this.boosting ? 0.1 : 0)),
      this.tuning.sternPatchLength * (0.86 + speedNorm * 0.22),
      1
    );
    this.sternMaterial.opacity = this.tuning.sternOpacity * intensity * (0.68 + jitter * 0.55);

    if (this.sternMaterial.alphaMap) {
      const alphaMap = this.sternMaterial.alphaMap;
      alphaMap.wrapS = RepeatWrapping;
      alphaMap.wrapT = RepeatWrapping;
      alphaMap.offset.y = (alphaMap.offset.y - this.time * this.tuning.sternUvScrollSpeed * 0.001) % 1;
      alphaMap.needsUpdate = true;
    }
  }

  private updateSpray(speedNorm: number): void {
    const sprayIntensity = this.boosting
      ? clamp(this.tuning.sprayBaseOpacity + speedNorm * 0.12 + this.tuning.sprayBoostMultiplier, 0, 1)
      : 0;

    const visible = sprayIntensity > 0.06;
    this.sprayGroup.visible = visible;
    if (!visible) {
      for (const spray of this.sprayParts) {
        spray.visible = false;
      }
      return;
    }

    const sternPos = this.computeSternPosition(this.tmpA);
    const heading = Math.atan2(this.forward.x, this.forward.z);
    this.tmpRight.set(-this.forward.z, 0, this.forward.x).normalize();

    let i = 0;
    for (const spray of this.sprayParts) {
      const phase = this.time * (2.5 + i * 0.27) + i * 1.3;
      const side = (i - (this.sprayParts.length - 1) * 0.5) * 0.18;
      const lateral = side + Math.sin(phase * 1.4) * 0.05;
      const backward = 0.2 + i * 0.25 + speedNorm * 0.55;
      const up = 0.02 + Math.abs(Math.sin(phase * 2.1)) * 0.08;

      spray.visible = true;
      spray.position.copy(sternPos);
      spray.position.addScaledVector(this.tmpRight, lateral);
      spray.position.addScaledVector(this.forward, -backward);
      spray.position.y = 0.06 + up;
      spray.rotation.y = heading + Math.sin(phase * 0.7) * 0.25;
      spray.rotation.z = Math.sin(phase * 1.1) * 0.15;
      spray.scale.set(0.82 + sprayIntensity * 0.95, 0.72 + sprayIntensity * 0.5, 1);

      const sprayMaterial = spray.material as MeshStandardMaterial;
      sprayMaterial.opacity = sprayIntensity * (0.06 + Math.sin(phase) * 0.02);
      sprayMaterial.emissiveIntensity = 0.18 + sprayIntensity * 0.5;
      i += 1;
    }
  }

  private updateInfluences(): void {
    const sternPos = this.computeSternPosition(this.tmpB);
    let sampledLength = 0;
    for (let i = 1; i < this.samples.length; i += 1) {
      const prev = this.samples[i - 1];
      const current = this.samples[i];
      if (!prev || !current) {
        continue;
      }
      sampledLength += prev.position.distanceTo(current.position);
    }

    const baseLength = Math.min(this.liveLength, sampledLength * 0.85 + this.tuning.baseWakeWidth * 2.2);
    const speedNorm = clamp((Math.abs(this.speed) - this.tuning.minSpeedThreshold * 0.2) / 8, 0, 1);
    const turnNorm = clamp(Math.abs(this.turnRate) * 0.045, 0, 1);
    const accelNorm = clamp(Math.abs(this.liveAcceleration) / 8.5, 0, 1);
    const throttleNorm = clamp(Math.abs(this.throttle), 0, 1);
    const boostNorm = this.boosting ? 1 : 0;
    const energy = clamp(
      speedNorm * 0.64 +
        turnNorm * 0.4 +
        accelNorm * this.tuning.accelerationInfluenceStrength +
        throttleNorm * this.tuning.throttleInfluenceStrength +
        boostNorm * 0.24,
      0,
      1.6
    );

    const turnSigned = clamp(this.turnRate * 0.06, -1, 1);
    const turnAsymmetry = 1 + Math.abs(turnSigned) * this.tuning.turnAsymmetryStrength;

    const core = this.influences[0] ?? createEmptyWakeInfluence();
    const trail = this.influences[1] ?? createEmptyWakeInfluence();
    const outer = this.influences[2] ?? createEmptyWakeInfluence();
    this.influences[0] = core;
    this.influences[1] = trail;
    this.influences[2] = outer;

    core.sternX = sternPos.x;
    core.sternZ = sternPos.z;
    core.forwardX = this.forward.x;
    core.forwardZ = this.forward.z;
    core.intensity = clamp(this.liveIntensity * this.tuning.coreBandStrength * (0.75 + energy * 0.4), 0, 1.2);
    core.width = this.liveWidth * this.tuning.coreBandWidthMultiplier * (0.8 + turnNorm * 0.2 * turnAsymmetry);
    core.length = Math.max(0.001, baseLength * this.tuning.coreBandLengthMultiplier);
    core.turn = turnSigned;
    core.normalBoost = this.tuning.normalBoostAmount * (1.1 + accelNorm * 0.28);
    core.foamTint = this.tuning.foamTintAmount * (1.2 + throttleNorm * 0.18);
    core.falloff = this.tuning.distortionFalloff * 1.05;

    trail.sternX = sternPos.x;
    trail.sternZ = sternPos.z;
    trail.forwardX = this.forward.x;
    trail.forwardZ = this.forward.z;
    trail.intensity = clamp(this.liveIntensity * this.tuning.trailBandStrength * (0.7 + energy * 0.35), 0, 1.1);
    trail.width = this.liveWidth * this.tuning.trailBandWidthMultiplier * (0.92 + turnNorm * 0.28 * turnAsymmetry);
    trail.length = Math.max(0.001, baseLength * this.tuning.trailBandLengthMultiplier);
    trail.turn = turnSigned;
    trail.normalBoost = this.tuning.normalBoostAmount * (0.9 + turnNorm * 0.3);
    trail.foamTint = this.tuning.foamTintAmount * (0.9 + throttleNorm * 0.18);
    trail.falloff = this.tuning.distortionFalloff;

    outer.sternX = sternPos.x;
    outer.sternZ = sternPos.z;
    outer.forwardX = this.forward.x;
    outer.forwardZ = this.forward.z;
    outer.intensity = clamp(this.liveIntensity * this.tuning.outerBandStrength * (0.6 + energy * 0.3), 0, 0.95);
    outer.width = this.liveWidth * this.tuning.outerBandWidthMultiplier * (1 + turnNorm * 0.35 * turnAsymmetry);
    outer.length = Math.max(
      0.001,
      baseLength * this.tuning.outerBandLengthMultiplier * this.tuning.outerBandLifetimeMultiplier
    );
    outer.turn = turnSigned;
    outer.normalBoost = this.tuning.normalBoostAmount * 0.72;
    outer.foamTint = this.tuning.foamTintAmount * 0.58;
    outer.falloff = this.tuning.distortionFalloff * 0.68;
  }
}

export function createShipWakeController(options: ShipWakeControllerOptions): ShipWakeController {
  return new ShipWakeControllerImpl(options);
}

export function createWakeDebugSurface(): WakeDebugSurface {
  return {
    getTuning: () => getWakeGlobalTuning(),
    updateTuning: (patch) => {
      updateWakeGlobalTuning(patch);
    }
  };
}
