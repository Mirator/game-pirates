import {
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  Material,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  Vector4
} from "three";
import { type IslandKind, type IslandState, type WorldState } from "../../simulation";
import {
  createAtmosphereTuningFromPreset,
  createDefaultAtmosphereConfig,
  getAtmospherePreset,
  sanitizeAtmosphereTuning,
  type AtmosphereDebugSnapshot,
  type AtmospherePresetId,
  type AtmosphereRenderConfig,
  type AtmosphereTuningControls
} from "../atmosphere/atmosphereConfig";
import { createWaterNormalTexture } from "../water/createWaterNormalTexture";
import { buildWaveShaderUniformState } from "../water/waterMath";
import {
  createDefaultWaterConfig,
  getWaterQualityPreset,
  sanitizeWaterTuning,
  WATER_MAX_ISLANDS,
  WATER_MAX_WAVE_COMPONENTS,
  type WaterDebugSnapshot,
  type WaterQualityLevel,
  type WaterRenderConfig,
  type WaterTuningControls
} from "../water/waterConfig";

export interface EnvironmentPlayerPose {
  x: number;
  z: number;
  heading: number;
  speed: number;
  drift: number;
}

export interface EnvironmentWakeInfluence {
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

export interface EnvironmentShipInfluence {
  x: number;
  z: number;
  forwardX: number;
  forwardZ: number;
  speedNorm: number;
  accelNorm: number;
  turnNorm: number;
  throttleNorm: number;
  hullLength: number;
  hullWidth: number;
}

export interface EnvironmentSyncContext {
  frameDt: number;
  renderTime: number;
  cameraPosition: {
    x: number;
    y: number;
    z: number;
  };
  playerPose: EnvironmentPlayerPose;
  wakeInfluences?: readonly EnvironmentWakeInfluence[];
  shipInfluences?: readonly EnvironmentShipInfluence[];
}

export interface EnvironmentObjects {
  root: Group;
  syncFromWorld: (worldState: WorldState, context: EnvironmentSyncContext) => void;
  dispose: () => void;
  water: {
    getConfig: () => WaterDebugSnapshot;
    setQuality: (quality: WaterQualityLevel) => void;
    updateTuning: (patch: Partial<WaterTuningControls>) => void;
  };
  lighting: {
    getConfig: () => AtmosphereDebugSnapshot;
    setPreset: (preset: AtmospherePresetId) => void;
    updateTuning: (patch: Partial<AtmosphereTuningControls>) => void;
    getCurrentExposure: () => number;
  };
}

interface SkyUniformState {
  [key: string]: { value: unknown };
  uTopColor: { value: Color };
  uHorizonColor: { value: Color };
  uBottomColor: { value: Color };
  uSunColor: { value: Color };
  uSunDirection: { value: Vector3 };
  uSunStrength: { value: number };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

function createSunDirection(azimuthDeg: number, elevationDeg: number, target: Vector3): Vector3 {
  const azimuth = MathUtils.degToRad(azimuthDeg);
  const elevation = MathUtils.degToRad(elevationDeg);
  const cosElevation = Math.cos(elevation);
  target.set(Math.sin(azimuth) * cosElevation, Math.sin(elevation), Math.cos(azimuth) * cosElevation);
  return target.normalize();
}

function disposeGroup(group: Group): void {
  group.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.geometry || !mesh.material) {
      return;
    }
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) {
        (material as Material).dispose();
      }
    } else {
      (mesh.material as Material).dispose();
    }
  });
}

function enableShadows(mesh: Mesh, castShadow = true, receiveShadow = true): Mesh {
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

function getIslandPalette(kind: IslandKind): {
  sand: string;
  rock: string;
  accent: string;
} {
  switch (kind) {
    case "port":
      return { sand: "#d9b474", rock: "#68856a", accent: "#f2cc87" };
    case "treasure":
      return { sand: "#e0bc79", rock: "#537a62", accent: "#ffd84d" };
    case "hostile":
      return { sand: "#b89b72", rock: "#776255", accent: "#da8774" };
    case "scenic":
      return { sand: "#d4b78a", rock: "#5f8a6f", accent: "#7ed2a5" };
  }
}

function createIslandMesh(island: IslandState): Group {
  const palette = getIslandPalette(island.kind);
  const isHostile = island.kind === "hostile";
  const scale = island.radius / 10;

  const group = new Group();

  const sand = enableShadows(
    new Mesh(
      new CylinderGeometry(island.radius * 1.02, island.radius * 1.02, 0.18 * scale, 20),
      new MeshStandardMaterial({
        color: palette.sand,
        emissive: palette.sand,
        emissiveIntensity: isHostile ? 0.2 : 0.08,
        flatShading: true,
        roughness: 0.9
      })
    ),
    false,
    false
  );
  sand.position.y = 0.09 * scale;
  group.add(sand);

  const rockRadius = (isHostile ? 3.9 : 4.8) * scale;
  const rockHeight = (isHostile ? 2.5 : 3.2) * scale;
  const rock = enableShadows(
    new Mesh(
      new ConeGeometry(rockRadius, rockHeight, 8),
      new MeshStandardMaterial({
        color: palette.rock,
        emissive: palette.rock,
        emissiveIntensity: isHostile ? 0.2 : 0.08,
        flatShading: true,
        roughness: 0.95
      })
    ),
    false,
    false
  );
  rock.rotation.y = Math.PI * 0.16;
  rock.position.y = (isHostile ? 1.26 : 1.48) * scale;
  group.add(rock);

  const markerHeight = island.kind === "port" ? 4.2 : 3.2;
  const markerRadius = island.kind === "hostile" ? 0.68 : 0.48;
  const marker = enableShadows(
    new Mesh(
      new ConeGeometry(markerRadius * scale, markerHeight * scale, 6),
      new MeshStandardMaterial({
        color: palette.accent,
        emissive: palette.accent,
        emissiveIntensity: island.kind === "hostile" ? 0.18 : 0.13,
        flatShading: true,
        roughness: 0.55
      })
    ),
    false,
    false
  );
  marker.position.y = 2.4 * scale;
  marker.rotation.y = island.id * 0.6;
  group.add(marker);

  if (island.kind === "port") {
    const lantern = enableShadows(
      new Mesh(
        new CylinderGeometry(0.2, 0.2, 1.3, 6),
        new MeshStandardMaterial({
          color: "#ffecbe",
          emissive: "#f1c369",
          emissiveIntensity: 0.28,
          roughness: 0.3
        })
      ),
      false,
      false
    );
    lantern.position.y = 4.4 * scale;
    group.add(lantern);
  }

  group.position.set(island.position.x, 0, island.position.z);
  return group;
}

function createWaterGeometry(segments: number): PlaneGeometry {
  const geometry = new PlaneGeometry(760, 760, segments, segments);
  geometry.rotateX(-Math.PI * 0.5);
  return geometry;
}

const WATER_MAX_WAKE_SOURCES = 24;
const WATER_MAX_SHIP_INFLUENCES = 8;

const WATER_VERTEX_SHADER = `
#define MAX_WAVES ${WATER_MAX_WAVE_COMPONENTS}

uniform float uTime;
uniform int uWaveCount;
uniform vec2 uWaveDirections[MAX_WAVES];
uniform float uWaveAmplitudes[MAX_WAVES];
uniform float uWaveLengths[MAX_WAVES];
uniform float uWaveSpeeds[MAX_WAVES];
uniform float uWaveSteepness[MAX_WAVES];
uniform float uWavePhases[MAX_WAVES];
uniform vec2 uWaterOriginXZ;

varying vec3 vWorldPos;
varying vec3 vGeomNormal;
varying vec2 vWorldUv;

#include <fog_pars_vertex>

vec3 displaceSurface(vec3 inPosition) {
  vec3 displaced = inPosition;
  vec2 sampleXZ = inPosition.xz + uWaterOriginXZ;
  for (int i = 0; i < MAX_WAVES; i += 1) {
    if (i >= uWaveCount) {
      continue;
    }
    vec2 direction = normalize(uWaveDirections[i]);
    float wavelength = max(0.001, uWaveLengths[i]);
    float waveNumber = 6.28318530718 / wavelength;
    float phase = waveNumber * dot(direction, sampleXZ) + uTime * uWaveSpeeds[i] + uWavePhases[i];
    float amplitude = uWaveAmplitudes[i];
    float steepness = uWaveSteepness[i];
    float cosine = cos(phase);
    float sine = sin(phase);

    displaced.x += direction.x * (steepness * amplitude * cosine);
    displaced.y += amplitude * sine;
    displaced.z += direction.y * (steepness * amplitude * cosine);
  }
  return displaced;
}

vec3 computeDisplacedNormal(vec3 inPosition) {
  float epsilon = 0.5;
  vec3 center = displaceSurface(inPosition);
  vec3 offsetX = displaceSurface(inPosition + vec3(epsilon, 0.0, 0.0));
  vec3 offsetZ = displaceSurface(inPosition + vec3(0.0, 0.0, epsilon));
  vec3 tangentX = offsetX - center;
  vec3 tangentZ = offsetZ - center;
  return normalize(cross(tangentZ, tangentX));
}

void main() {
  vec3 displaced = displaceSurface(position);
  vec3 objectNormal = computeDisplacedNormal(position);
  vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);

  vWorldPos = worldPosition.xyz;
  vGeomNormal = normalize(mat3(modelMatrix) * objectNormal);
  vWorldUv = worldPosition.xz;

  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const WATER_FRAGMENT_SHADER = `
#define MAX_WAVES ${WATER_MAX_WAVE_COMPONENTS}
#define MAX_ISLANDS ${WATER_MAX_ISLANDS}
#define MAX_WAKE_SOURCES ${WATER_MAX_WAKE_SOURCES}
#define MAX_SHIP_INFLUENCES ${WATER_MAX_SHIP_INFLUENCES}

uniform float uTime;
uniform vec2 uWaveDirections[MAX_WAVES];
uniform vec3 uCameraPos;
uniform vec3 uSunDirection;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uSkyColor;
uniform vec3 uStormColor;
uniform vec3 uFoamColor;
uniform float uStormBlend;

uniform sampler2D uNormalMapA;
uniform sampler2D uNormalMapB;
uniform vec2 uNormalScrollA;
uniform vec2 uNormalScrollB;
uniform float uNormalTilingA;
uniform float uNormalTilingB;
uniform float uNormalStrength;

uniform float uFresnelStrength;
uniform float uFresnelPower;
uniform float uSpecularStrength;
uniform float uSpecularExponent;
uniform float uReflectionBlendStrength;
uniform float uDepthGradientDistanceMax;
uniform float uFarColorDesaturation;
uniform float uHorizonLiftStrength;
uniform float uMicroNormalScale;
uniform float uMicroNormalWeight;
uniform float uSpecularGlintExponent;
uniform float uSpecularGlintStrength;
uniform float uCrestFoamStrength;
uniform float uCrestFoamThreshold;

uniform int uWakeSourceCount;
uniform vec4 uWakeSources[MAX_WAKE_SOURCES];
uniform vec4 uWakeDirections[MAX_WAKE_SOURCES];
uniform vec4 uWakeTuning[MAX_WAKE_SOURCES];
uniform float uWakeDistortionStrength;
uniform float uWakeFoamTintStrength;
uniform float uFoamThreshold;
uniform vec2 uPlayerPos;
uniform float uNearHullDarkeningStrength;
uniform float uNearHullDarkeningRadius;
uniform float uCurvatureFoamStrength;
uniform float uWavePeakHighlightStrength;
uniform int uShipInfluenceCount;
uniform vec4 uShipInfluencePosDir[MAX_SHIP_INFLUENCES];
uniform vec4 uShipInfluenceMotion[MAX_SHIP_INFLUENCES];
uniform vec4 uShipInfluenceHull[MAX_SHIP_INFLUENCES];
uniform float uLocalInteractionRadius;
uniform float uLocalInteractionLength;
uniform float uBowInteractionStrength;
uniform float uHullInteractionStrength;
uniform float uInteractionNormalBoost;
uniform float uBowRippleFrequency;
uniform float uBowRippleStrength;
uniform float uNearFieldRadius;
uniform float uNearFieldNormalBoost;
uniform float uNearFieldDetailBoost;
uniform float uNearFieldContrastBoost;
uniform float uDirectionalStreakStrength;
uniform float uDirectionalStreakScale;
uniform float uDirectionalStreakAnisotropy;
uniform float uDisturbedSpecularBoost;
uniform float uDisturbedHighlightFlicker;
uniform float uDisturbedContrastBoost;

uniform int uShorelineEnabled;
uniform int uIslandCount;
uniform vec4 uIslandData[MAX_ISLANDS];
uniform float uShorelineStrength;

varying vec3 vWorldPos;
varying vec3 vGeomNormal;
varying vec2 vWorldUv;

#include <fog_pars_fragment>

vec3 decodeNormal(vec3 encoded) {
  return normalize(encoded * 2.0 - 1.0);
}

float waterLuma(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

vec3 desaturate(vec3 color, float amount) {
  return mix(color, vec3(waterLuma(color)), clamp(amount, 0.0, 1.0));
}

vec2 safeNormalize2(vec2 value) {
  float len = length(value);
  if (len <= 1e-5) {
    return vec2(0.0, 1.0);
  }
  return value / len;
}

float computeShorelineMask() {
  if (uShorelineEnabled == 0) {
    return 0.0;
  }

  float mask = 0.0;
  for (int i = 0; i < MAX_ISLANDS; i += 1) {
    if (i >= uIslandCount) {
      continue;
    }
    vec4 island = uIslandData[i];
    float islandDistance = distance(vWorldPos.xz, island.xy);
    float islandMask = 1.0 - smoothstep(island.z, island.w, islandDistance);
    mask = max(mask, islandMask);
  }
  return mask * uShorelineStrength;
}

float computeWakeFactor(out vec2 wakeFlow, out float wakeFoamTint) {
  wakeFlow = vec2(0.0);
  wakeFoamTint = 0.0;

  float wakeFactor = 0.0;
  for (int i = 0; i < MAX_WAKE_SOURCES; i += 1) {
    if (i >= uWakeSourceCount) {
      continue;
    }

    vec4 source = uWakeSources[i];
    vec4 direction = uWakeDirections[i];
    vec4 tuning = uWakeTuning[i];

    float intensity = source.z;
    if (intensity <= 0.0001) {
      continue;
    }

    vec2 stern = source.xy;
    float width = max(0.001, source.w);
    vec2 forward = normalize(direction.xy);
    float trailLength = max(width, direction.z);
    float turn = direction.w;
    float normalBoost = tuning.x;
    float foamTint = tuning.y;
    float falloff = max(0.2, tuning.z);

    vec2 toFragment = vWorldPos.xz - stern;
    float along = dot(toFragment, -forward);
    if (along <= 0.0 || along > trailLength) {
      continue;
    }

    vec2 right = vec2(-forward.y, forward.x);
    float lateral = dot(toFragment, right);
    float absLateral = abs(lateral);

    float widthMask = 1.0 - smoothstep(width * 0.38, width * 1.22, absLateral);
    float lengthMask = 1.0 - smoothstep(trailLength * 0.03, trailLength * 0.92, along);
    float sternMask = 1.0 - smoothstep(width * 0.12, width * 0.72, length(toFragment));
    float swirl = 0.9 + sin((along * 0.55 + uTime * 2.4) + lateral * 0.75) * 0.1;
    float turbulence = 0.86 + (sin(along * 0.9 + uTime * 3.2 + lateral * 2.2) * 0.5 + 0.5) * 0.24;
    float signedLateral = clamp(lateral / (width * 1.2), -1.0, 1.0);
    float asymmetry = 1.0 + signedLateral * clamp(turn, -1.0, 1.0) * 0.35;

    float vTarget = along * (0.15 + abs(turn) * 0.13);
    float vMask = 1.0 - smoothstep(width * 0.24, width * 0.9, abs(absLateral - vTarget));
    float coreBandMask = smoothstep(1.02, 1.16, falloff);
    float outerBandMask = 1.0 - smoothstep(0.74, 0.92, falloff);
    float trailBandMask = clamp(1.0 - coreBandMask - outerBandMask, 0.0, 1.0);
    float wakeShape = mix(widthMask, vMask, 0.62);
    float ribbonContribution =
      wakeShape * lengthMask * falloff * (0.2 + trailBandMask * 0.22 + outerBandMask * 0.1) * asymmetry;
    float sternContribution = sternMask * (0.84 * coreBandMask + 0.18 * trailBandMask);
    float contribution = max(ribbonContribution, sternContribution) * intensity * swirl * turbulence;
    wakeFactor += contribution;
    float foamBandWeight = coreBandMask * 1.0 + trailBandMask * 0.52 + outerBandMask * 0.18;
    wakeFoamTint += contribution * foamTint * foamBandWeight;

    float flowBandWeight = 0.55 * coreBandMask + 0.92 * trailBandMask + 1.18 * outerBandMask;
    wakeFlow += right * signedLateral * contribution * (0.62 + abs(turn) * 0.55) * normalBoost * flowBandWeight;
  }

  wakeFactor = clamp(wakeFactor, 0.0, 0.82);
  wakeFoamTint = clamp(wakeFoamTint, 0.0, 0.68);
  return wakeFactor;
}

float computeNearestShipDistance() {
  float nearest = 1e5;
  for (int i = 0; i < MAX_SHIP_INFLUENCES; i += 1) {
    if (i >= uShipInfluenceCount) {
      continue;
    }
    vec2 shipPos = uShipInfluencePosDir[i].xy;
    nearest = min(nearest, distance(vWorldPos.xz, shipPos));
  }
  if (nearest > 9e4) {
    nearest = distance(vWorldPos.xz, uPlayerPos);
  }
  return nearest;
}

float computeShipInteraction(
  out vec2 interactionFlow,
  out float interactionFoam,
  out float interactionBrightness,
  out float interactionDisturbance
) {
  interactionFlow = vec2(0.0);
  interactionFoam = 0.0;
  interactionBrightness = 0.0;
  interactionDisturbance = 0.0;
  float interactionMask = 0.0;

  for (int i = 0; i < MAX_SHIP_INFLUENCES; i += 1) {
    if (i >= uShipInfluenceCount) {
      continue;
    }

    vec4 posDir = uShipInfluencePosDir[i];
    vec4 motion = uShipInfluenceMotion[i];
    vec4 hull = uShipInfluenceHull[i];
    vec2 shipPos = posDir.xy;
    vec2 forward = safeNormalize2(posDir.zw);
    vec2 right = vec2(-forward.y, forward.x);
    vec2 toFragment = vWorldPos.xz - shipPos;
    float along = dot(toFragment, forward);
    float lateral = dot(toFragment, right);
    float absLateral = abs(lateral);

    float hullLength = max(1.0, hull.x);
    float hullWidth = max(0.5, hull.y);
    float localRadius = max(hullWidth * 2.2, uLocalInteractionRadius);
    float localLength = max(hullLength * 1.3, uLocalInteractionLength);

    float foreMask = smoothstep(-hullLength * 0.7, hullLength * 0.55, along);
    float aftMask = 1.0 - smoothstep(hullLength * 0.55, localLength, along);
    float hullLongMask = foreMask * aftMask;
    float hullLateralMask = 1.0 - smoothstep(hullWidth * 0.35, localRadius, absLateral);
    float hullMask = hullLongMask * hullLateralMask;

    vec2 bowCenter = shipPos + forward * (hullLength * 0.56);
    float bowDistance = distance(vWorldPos.xz, bowCenter);
    float bowRadius = max(hullWidth * 1.4, localRadius * 0.42);
    float bowMask = 1.0 - smoothstep(0.0, bowRadius, bowDistance);

    float sideBand = smoothstep(hullWidth * 0.42, hullWidth * 1.35, absLateral);
    sideBand *= 1.0 - smoothstep(hullWidth * 1.35, localRadius, absLateral);
    float sideLongMask = 1.0 - smoothstep(hullLength * 0.1, localLength, abs(along));
    float sideMask = sideBand * sideLongMask;

    float speedNorm = clamp(motion.x, 0.0, 1.8);
    float accelNorm = clamp(motion.y, 0.0, 1.8);
    float turnNorm = clamp(motion.z, 0.0, 1.8);
    float throttleNorm = clamp(motion.w, 0.0, 1.0);
    float motionEnergy = clamp(
      speedNorm * 0.78 + accelNorm * 0.62 + turnNorm * 0.52 + throttleNorm * 0.44,
      0.0,
      1.8
    );

    float bowStrength = bowMask * uBowInteractionStrength * (0.35 + motionEnergy * 1.08);
    float hullStrength = hullMask * uHullInteractionStrength * (0.32 + motionEnergy * 0.95);
    float sideStrength = sideMask * uHullInteractionStrength * (0.24 + turnNorm * 1.05 + speedNorm * 0.42);

    float ripplePhase = along * uBowRippleFrequency - uTime * (2.4 + speedNorm * 2.8);
    float bowRipples = (sin(ripplePhase) * 0.5 + 0.5) * bowMask;
    bowRipples *= uBowRippleStrength * (0.24 + motionEnergy * 1.04);

    float signedLateral = clamp(lateral / max(0.001, localRadius), -1.0, 1.0);
    float asymmetry = 1.0 + signedLateral * clamp(motion.z, -1.0, 1.0) * 0.35;
    float contribution = clamp((bowStrength + hullStrength + sideStrength) * asymmetry, 0.0, 1.6);

    interactionMask += contribution;
    interactionBrightness += contribution * 0.78 + bowRipples * 0.68;
    interactionFoam += contribution * (0.28 + accelNorm * 0.3) + bowRipples * 1.02;
    interactionDisturbance += contribution * (0.62 + turnNorm * 0.4) + bowRipples * 0.56;
    interactionFlow += right * signedLateral * contribution * (0.62 + turnNorm * 0.65);
    interactionFlow += forward * (bowRipples * 0.14);
  }

  interactionMask = clamp(interactionMask, 0.0, 1.45);
  interactionFoam = clamp(interactionFoam, 0.0, 1.7);
  interactionBrightness = clamp(interactionBrightness, 0.0, 1.8);
  interactionDisturbance = clamp(interactionDisturbance, 0.0, 1.8);
  return interactionMask;
}

float computeDirectionalStreak(vec3 viewDirection, vec3 detailNormal) {
  vec2 primaryDirection = safeNormalize2(uWaveDirections[0]);
  vec2 secondaryDirection = vec2(-primaryDirection.y, primaryDirection.x);
  vec2 streakDirection = safeNormalize2(mix(secondaryDirection, primaryDirection, clamp(uDirectionalStreakAnisotropy, 0.0, 1.0)));
  float phaseWarp = sin(dot(vWorldPos.xz, vec2(0.08, -0.06)) + uTime * 0.23) * 6.0;
  float phase = (dot(vWorldPos.xz, streakDirection) + phaseWarp) * uDirectionalStreakScale + uTime * 0.58;
  float broad = sin(phase) * 0.5 + 0.5;
  float detail = sin(phase * 2.15 + detailNormal.x * 7.3 + detailNormal.z * 6.2) * 0.5 + 0.5;
  float streakMask = smoothstep(0.58, 0.96, broad * 0.6 + detail * 0.4);
  float glancing = smoothstep(0.08, 0.82, 1.0 - abs(viewDirection.y));
  return streakMask * glancing * uDirectionalStreakStrength;
}

void main() {
  float cameraDistance = distance(vWorldPos.xz, uCameraPos.xz);
  float nearestShipDistance = computeNearestShipDistance();
  float nearFieldCameraMask = 1.0 - smoothstep(0.0, max(0.001, uNearFieldRadius), cameraDistance);
  float nearFieldShipMask = 1.0 - smoothstep(0.0, max(0.001, uNearFieldRadius * 0.95), nearestShipDistance);
  float nearFieldMask = clamp(max(nearFieldCameraMask, nearFieldShipMask), 0.0, 1.0);

  vec2 uvA = vWorldUv * uNormalTilingA + uTime * uNormalScrollA;
  float detailScale = 1.0 + nearFieldMask * uNearFieldDetailBoost;
  vec2 uvB = vWorldUv * (uNormalTilingB * max(0.001, uMicroNormalScale) * detailScale) + uTime * uNormalScrollB;

  vec3 normalA = decodeNormal(texture2D(uNormalMapA, uvA).xyz);
  vec3 normalB = decodeNormal(texture2D(uNormalMapB, uvB).xyz);
  float microWeight = max(0.0, uMicroNormalWeight);
  vec3 detailNormal = normalize(vec3(normalA.x + normalB.x * microWeight, 1.0, normalA.z + normalB.z * microWeight));
  float nearFieldNormalStrength = 1.0 + nearFieldMask * uNearFieldNormalBoost;

  vec3 surfaceNormal = normalize(vGeomNormal + vec3(detailNormal.x, detailNormal.y * 0.12, detailNormal.z) * uNormalStrength * nearFieldNormalStrength);
  vec3 viewDirection = normalize(uCameraPos - vWorldPos);
  vec3 sunDirection = normalize(uSunDirection);

  float shorelineMask = computeShorelineMask();

  vec2 wakeFlow;
  float wakeFoamTint;
  float wakeFactor = computeWakeFactor(wakeFlow, wakeFoamTint);

  vec2 interactionFlow;
  float interactionFoam;
  float interactionBrightness;
  float interactionDisturbance;
  float interactionMask = computeShipInteraction(
    interactionFlow,
    interactionFoam,
    interactionBrightness,
    interactionDisturbance
  );

  float combinedDisturbance = clamp(wakeFactor + interactionDisturbance * 0.58, 0.0, 1.45);
  surfaceNormal = normalize(
    surfaceNormal +
      vec3(
        wakeFlow.x + interactionFlow.x,
        combinedDisturbance * (uWakeDistortionStrength + interactionMask * uInteractionNormalBoost),
        wakeFlow.y + interactionFlow.y
      )
  );
  float foamFactor = smoothstep(uFoamThreshold + 0.15, 0.9, wakeFactor + interactionFoam * 0.34);

  float nearHullMask = 1.0 - smoothstep(0.0, max(0.001, uNearHullDarkeningRadius), nearestShipDistance);
  float curvatureSignal = max(0.0, 1.0 - surfaceNormal.y);
  float curvatureFoam = smoothstep(0.12, 0.46, curvatureSignal) * uCurvatureFoamStrength;
  float crestThreshold = clamp(uCrestFoamThreshold, 0.0, 1.0);
  float crestFoam = smoothstep(crestThreshold, min(1.0, crestThreshold + 0.24), curvatureSignal) * uCrestFoamStrength;
  float wavePeakHighlight =
    smoothstep(0.2, 0.56, vWorldPos.y) * uWavePeakHighlightStrength * (0.44 + nearHullMask * 0.62 + interactionMask * 0.58);

  float depthFactor = clamp(cameraDistance / max(1.0, uDepthGradientDistanceMax), 0.0, 1.0);
  vec3 depthColor = mix(uDeepColor, uShallowColor, depthFactor);
  depthColor = desaturate(depthColor, depthFactor * uFarColorDesaturation);
  vec3 baseColor = mix(depthColor, uShallowColor, clamp(shorelineMask + wakeFactor * 0.09 + interactionBrightness * 0.16, 0.0, 1.0));
  baseColor *= 1.0 - nearHullMask * uNearHullDarkeningStrength;
  baseColor = mix(baseColor, uStormColor, clamp(uStormBlend, 0.0, 1.0) * 0.72);

  float ndv = max(0.0, dot(surfaceNormal, viewDirection));
  float fresnel = pow(1.0 - ndv, max(0.1, uFresnelPower)) * uFresnelStrength;
  float reflectionBlend = clamp(fresnel * uReflectionBlendStrength, 0.0, 1.0);
  vec3 halfVector = normalize(viewDirection + sunDirection);
  float glintExponent = mix(uSpecularExponent, uSpecularGlintExponent, 0.7);
  float disturbedMask = clamp(wakeFactor * 1.1 + interactionMask * 0.95, 0.0, 1.0);
  float disturbedSpecular = 1.0 + disturbedMask * uDisturbedSpecularBoost;
  float highlightFlicker = 1.0 + (sin((vWorldPos.x + vWorldPos.z) * 0.25 + uTime * 8.5) * 0.5 + 0.5) * disturbedMask * uDisturbedHighlightFlicker;
  float specular =
    pow(max(dot(surfaceNormal, halfVector), 0.0), glintExponent) * uSpecularStrength * uSpecularGlintStrength * disturbedSpecular * highlightFlicker;
  specular *= 0.35 + reflectionBlend * 0.65;
  float directionalStreak = computeDirectionalStreak(viewDirection, detailNormal);

  vec3 finalColor = mix(baseColor, uSkyColor, reflectionBlend);
  finalColor += specular * vec3(1.0, 0.95, 0.84);
  finalColor += directionalStreak * vec3(0.05, 0.08, 0.1);
  finalColor += vec3(0.08, 0.12, 0.14) * wavePeakHighlight;
  finalColor = mix(
    finalColor,
    uFoamColor,
    clamp(
      foamFactor * (0.2 + wakeFoamTint * uWakeFoamTintStrength) +
        interactionFoam * 0.2 +
        curvatureFoam * 0.2 +
        crestFoam * 0.25,
      0.0,
      0.48
    )
  );

  float luma = waterLuma(finalColor);
  float contrastBoost = 1.0 + nearFieldMask * uNearFieldContrastBoost + disturbedMask * uDisturbedContrastBoost;
  finalColor = (finalColor - vec3(luma)) * contrastBoost + vec3(luma);

  float horizonMask = smoothstep(0.2, 1.0, 1.0 - abs(viewDirection.y)) * depthFactor;
  finalColor = mix(finalColor, uSkyColor, clamp(horizonMask * uHorizonLiftStrength, 0.0, 0.55));

  gl_FragColor = vec4(finalColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

const SKY_VERTEX_SHADER = `
varying vec3 vDirection;

vec3 safeNormalize(vec3 inputVec) {
  float lenSq = dot(inputVec, inputVec);
  if (lenSq <= 1e-6) {
    return vec3(0.0, 1.0, 0.0);
  }
  return inputVec * inversesqrt(lenSq);
}

void main() {
  vDirection = safeNormalize(position);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const SKY_FRAGMENT_SHADER = `
uniform vec3 uTopColor;
uniform vec3 uHorizonColor;
uniform vec3 uBottomColor;
uniform vec3 uSunColor;
uniform vec3 uSunDirection;
uniform float uSunStrength;

varying vec3 vDirection;

vec3 safeNormalize(vec3 inputVec) {
  float lenSq = dot(inputVec, inputVec);
  if (lenSq <= 1e-6) {
    return vec3(0.0, 1.0, 0.0);
  }
  return inputVec * inversesqrt(lenSq);
}

void main() {
  vec3 direction = safeNormalize(vDirection);
  float t = clamp(direction.y * 0.5 + 0.5, 0.0, 1.0);

  vec3 color = mix(uBottomColor, uHorizonColor, smoothstep(0.1, 0.56, t));
  color = mix(color, uTopColor, smoothstep(0.5, 1.0, t));

  float sunMask = pow(max(dot(direction, safeNormalize(uSunDirection)), 0.0), 180.0);
  color += uSunColor * sunMask * uSunStrength;

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function applyAtmosphereToSky(
  skyUniforms: SkyUniformState,
  basePresetId: AtmospherePresetId,
  stormBlend: number,
  workingA: Color,
  workingB: Color
): void {
  const basePreset = getAtmospherePreset(basePresetId);
  const stormPreset = getAtmospherePreset("storm");

  workingA.set(basePreset.skyTopColor);
  workingB.set(stormPreset.skyTopColor);
  skyUniforms.uTopColor.value.copy(workingA.lerp(workingB, stormBlend));

  workingA.set(basePreset.skyHorizonColor);
  workingB.set(stormPreset.skyHorizonColor);
  skyUniforms.uHorizonColor.value.copy(workingA.lerp(workingB, stormBlend));

  workingA.set(basePreset.skyBottomColor);
  workingB.set(stormPreset.skyBottomColor);
  skyUniforms.uBottomColor.value.copy(workingA.lerp(workingB, stormBlend));

  workingA.set(basePreset.skySunColor);
  workingB.set(stormPreset.skySunColor);
  skyUniforms.uSunColor.value.copy(workingA.lerp(workingB, stormBlend));

  skyUniforms.uSunStrength.value = lerp(basePreset.skySunStrength, stormPreset.skySunStrength, stormBlend);
}

export function createEnvironment(
  scene: Scene,
  configuredWater: WaterRenderConfig = createDefaultWaterConfig(),
  configuredAtmosphere: AtmosphereRenderConfig = createDefaultAtmosphereConfig()
): EnvironmentObjects {
  const root = new Group();
  scene.add(root);

  const defaultWaterConfig = createDefaultWaterConfig();
  let waterConfig: WaterRenderConfig = {
    quality: configuredWater.quality ?? defaultWaterConfig.quality,
    tuning: sanitizeWaterTuning(configuredWater.tuning, defaultWaterConfig.tuning)
  };
  let waterPreset = getWaterQualityPreset(waterConfig.quality);

  const defaultAtmosphere = createDefaultAtmosphereConfig();
  const initialAtmospherePreset = configuredAtmosphere.preset ?? defaultAtmosphere.preset;
  let atmosphereConfig: AtmosphereRenderConfig = {
    preset: initialAtmospherePreset,
    tuning: sanitizeAtmosphereTuning(
      configuredAtmosphere.tuning,
      createAtmosphereTuningFromPreset(initialAtmospherePreset)
    )
  };

  scene.background = null;
  const fog = new FogExp2(new Color(atmosphereConfig.tuning.fogColor), atmosphereConfig.tuning.fogDensity);
  scene.fog = fog;

  const sun = new DirectionalLight("#ffe3b3", atmosphereConfig.tuning.sunIntensity);
  sun.castShadow = true;
  sun.shadow.radius = 2;
  scene.add(sun);
  scene.add(sun.target);

  const hemisphere = new HemisphereLight("#d6f0ff", "#3a6176", atmosphereConfig.tuning.ambientIntensity);
  hemisphere.position.set(0, 25, 0);
  scene.add(hemisphere);

  const skyUniforms: SkyUniformState = {
    uTopColor: { value: new Color("#74b9eb") },
    uHorizonColor: { value: new Color("#a8dbff") },
    uBottomColor: { value: new Color("#d8ecfb") },
    uSunColor: { value: new Color("#ffe4ac") },
    uSunDirection: { value: new Vector3(0.3, 0.8, 0.4).normalize() },
    uSunStrength: { value: 0.24 }
  };

  const sky = new Mesh(
    new SphereGeometry(300, 28, 20),
    new ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      side: DoubleSide,
      depthTest: false,
      depthWrite: false,
      fog: false
    })
  );
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  scene.add(sky);

  const stormWaterColor = new Color("#264f6b");
  const workingColorA = new Color();
  const workingColorB = new Color();
  const baseSunDirection = new Vector3();
  const stormSunDirection = new Vector3();
  const effectiveSunDirection = new Vector3();
  const shadowTarget = new Vector3();
  const lastCameraPosition = new Vector3(0, 6, -12);
  const lastPlayerPosition = new Vector3(0, 0, 0);
  let activeStormBlend = 0;
  let currentExposure = atmosphereConfig.tuning.exposure;

  const waveDirections = Array.from({ length: WATER_MAX_WAVE_COMPONENTS }, () => new Vector2(1, 0));
  const islandData = Array.from({ length: WATER_MAX_ISLANDS }, () => new Vector4(0, 0, 0, 0));
  const wakeSourceData = Array.from({ length: WATER_MAX_WAKE_SOURCES }, () => new Vector4(0, 0, 0, 0));
  const wakeDirectionData = Array.from({ length: WATER_MAX_WAKE_SOURCES }, () => new Vector4(0, 1, 0, 0));
  const wakeTuningData = Array.from({ length: WATER_MAX_WAKE_SOURCES }, () => new Vector4(0, 0, 1, 0));
  const shipInfluencePosDirData = Array.from({ length: WATER_MAX_SHIP_INFLUENCES }, () => new Vector4(0, 0, 0, 1));
  const shipInfluenceMotionData = Array.from({ length: WATER_MAX_SHIP_INFLUENCES }, () => new Vector4(0, 0, 0, 0));
  const shipInfluenceHullData = Array.from({ length: WATER_MAX_SHIP_INFLUENCES }, () => new Vector4(5.2, 2.4, 0, 0));
  const normalMapA = createWaterNormalTexture(128, 11.3);
  const normalMapB = createWaterNormalTexture(128, 29.7);

  const waterUniforms = {
    uTime: { value: 0 },
    uWaveCount: { value: 0 },
    uWaveDirections: { value: waveDirections },
    uWaveAmplitudes: { value: [0, 0, 0, 0] },
    uWaveLengths: { value: [1, 1, 1, 1] },
    uWaveSpeeds: { value: [0, 0, 0, 0] },
    uWaveSteepness: { value: [0, 0, 0, 0] },
    uWavePhases: { value: [0, 0, 0, 0] },
    uWaterOriginXZ: { value: new Vector2(0, 0) },
    uCameraPos: { value: new Vector3(0, 6, -12) },
    uSunDirection: { value: new Vector3(22, 40, 10).normalize() },
    uDeepColor: { value: new Color(waterConfig.tuning.deepColor) },
    uShallowColor: { value: new Color(waterConfig.tuning.shallowColor) },
    uSkyColor: { value: new Color("#a6d8f5") },
    uStormColor: { value: stormWaterColor.clone() },
    uFoamColor: { value: new Color("#d2f4ff") },
    uStormBlend: { value: 0 },
    uNormalMapA: { value: normalMapA },
    uNormalMapB: { value: normalMapB },
    uNormalScrollA: { value: new Vector2() },
    uNormalScrollB: { value: new Vector2() },
    uNormalTilingA: { value: 0.06 },
    uNormalTilingB: { value: 0.12 },
    uNormalStrength: { value: 0.35 },
    uFresnelStrength: { value: 1.1 },
    uFresnelPower: { value: 4.4 },
    uSpecularStrength: { value: 0.6 },
    uSpecularExponent: { value: 40 },
    uReflectionBlendStrength: { value: waterConfig.tuning.reflectionBlendStrength },
    uDepthGradientDistanceMax: { value: waterConfig.tuning.depthGradientDistanceMax },
    uFarColorDesaturation: { value: waterConfig.tuning.farColorDesaturation },
    uHorizonLiftStrength: { value: waterConfig.tuning.horizonLiftStrength },
    uMicroNormalScale: { value: waterConfig.tuning.microNormalScale },
    uMicroNormalWeight: { value: waterConfig.tuning.microNormalWeight },
    uSpecularGlintExponent: { value: waterConfig.tuning.specularGlintExponent },
    uSpecularGlintStrength: { value: waterConfig.tuning.specularGlintStrength },
    uCrestFoamStrength: { value: waterConfig.tuning.crestFoamStrength },
    uCrestFoamThreshold: { value: waterConfig.tuning.crestFoamThreshold },
    uWakeSourceCount: { value: 0 },
    uWakeSources: { value: wakeSourceData },
    uWakeDirections: { value: wakeDirectionData },
    uWakeTuning: { value: wakeTuningData },
    uWakeDistortionStrength: { value: 0.055 },
    uWakeFoamTintStrength: { value: 0.18 },
    uFoamThreshold: { value: waterConfig.tuning.foamThreshold },
    uPlayerPos: { value: new Vector2() },
    uNearHullDarkeningStrength: { value: waterConfig.tuning.nearHullDarkeningStrength },
    uNearHullDarkeningRadius: { value: waterConfig.tuning.nearHullDarkeningRadius },
    uCurvatureFoamStrength: { value: waterConfig.tuning.curvatureFoamStrength },
    uWavePeakHighlightStrength: { value: waterConfig.tuning.wavePeakHighlightStrength },
    uShipInfluenceCount: { value: 0 },
    uShipInfluencePosDir: { value: shipInfluencePosDirData },
    uShipInfluenceMotion: { value: shipInfluenceMotionData },
    uShipInfluenceHull: { value: shipInfluenceHullData },
    uLocalInteractionRadius: { value: waterConfig.tuning.localInteractionRadius },
    uLocalInteractionLength: { value: waterConfig.tuning.localInteractionLength },
    uBowInteractionStrength: { value: waterConfig.tuning.bowInteractionStrength },
    uHullInteractionStrength: { value: waterConfig.tuning.hullInteractionStrength },
    uInteractionNormalBoost: { value: waterConfig.tuning.interactionNormalBoost },
    uBowRippleFrequency: { value: waterConfig.tuning.bowRippleFrequency },
    uBowRippleStrength: { value: waterConfig.tuning.bowRippleStrength },
    uNearFieldRadius: { value: waterConfig.tuning.nearFieldRadius },
    uNearFieldNormalBoost: { value: waterConfig.tuning.nearFieldNormalBoost },
    uNearFieldDetailBoost: { value: waterConfig.tuning.nearFieldDetailBoost },
    uNearFieldContrastBoost: { value: waterConfig.tuning.nearFieldContrastBoost },
    uDirectionalStreakStrength: { value: waterConfig.tuning.directionalStreakStrength },
    uDirectionalStreakScale: { value: waterConfig.tuning.directionalStreakScale },
    uDirectionalStreakAnisotropy: { value: waterConfig.tuning.directionalStreakAnisotropy },
    uDisturbedSpecularBoost: { value: waterConfig.tuning.disturbedSpecularBoost },
    uDisturbedHighlightFlicker: { value: waterConfig.tuning.disturbedHighlightFlicker },
    uDisturbedContrastBoost: { value: waterConfig.tuning.disturbedContrastBoost },
    uShorelineEnabled: { value: 1 },
    uIslandCount: { value: 0 },
    uIslandData: { value: islandData },
    uShorelineStrength: { value: 1 },
    fogColor: { value: new Color(atmosphereConfig.tuning.fogColor) },
    fogNear: { value: 70 },
    fogFar: { value: 190 },
    fogDensity: { value: atmosphereConfig.tuning.fogDensity }
  };

  const waterMaterial = new ShaderMaterial({
    uniforms: waterUniforms,
    vertexShader: WATER_VERTEX_SHADER,
    fragmentShader: WATER_FRAGMENT_SHADER,
    fog: true,
    side: DoubleSide
  });
  const water = new Mesh(createWaterGeometry(waterPreset.geometrySegments), waterMaterial);
  water.position.y = 0;
  water.castShadow = false;
  water.receiveShadow = false;
  root.add(water);

  const applyWaterConfig = (rebuildGeometry: boolean): void => {
    waterPreset = getWaterQualityPreset(waterConfig.quality);
    const waveState = buildWaveShaderUniformState(waterPreset.waveComponents, waterConfig.tuning);
    const waveCount = Math.min(WATER_MAX_WAVE_COMPONENTS, waterPreset.waveComponents.length);
    waterUniforms.uWaveCount.value = waveCount;

    const amplitudes = [0, 0, 0, 0];
    const wavelengths = [1, 1, 1, 1];
    const speeds = [0, 0, 0, 0];
    const steepness = [0, 0, 0, 0];
    const phases = [0, 0, 0, 0];
    for (let i = 0; i < WATER_MAX_WAVE_COMPONENTS; i += 1) {
      const direction = waveState.directions[i] ?? [1, 0];
      const waveDirection = waterUniforms.uWaveDirections.value[i];
      waveDirection?.set(direction[0], direction[1]);
      amplitudes[i] = waveState.amplitudes[i] ?? 0;
      wavelengths[i] = waveState.wavelengths[i] ?? 1;
      speeds[i] = waveState.speeds[i] ?? 0;
      steepness[i] = waveState.steepness[i] ?? 0;
      phases[i] = waveState.phases[i] ?? 0;
    }

    waterUniforms.uWaveAmplitudes.value = amplitudes;
    waterUniforms.uWaveLengths.value = wavelengths;
    waterUniforms.uWaveSpeeds.value = speeds;
    waterUniforms.uWaveSteepness.value = steepness;
    waterUniforms.uWavePhases.value = phases;

    waterUniforms.uNormalStrength.value = waterPreset.normalStrength;
    waterUniforms.uNormalTilingA.value = waterPreset.normalTilingA;
    waterUniforms.uNormalTilingB.value = waterPreset.normalTilingB;
    waterUniforms.uNormalScrollA.value.set(
      waterPreset.normalScrollA[0] * waterConfig.tuning.normalScrollSpeedA,
      waterPreset.normalScrollA[1] * waterConfig.tuning.normalScrollSpeedA
    );
    waterUniforms.uNormalScrollB.value.set(
      waterPreset.normalScrollB[0] * waterConfig.tuning.normalScrollSpeedB,
      waterPreset.normalScrollB[1] * waterConfig.tuning.normalScrollSpeedB
    );

    waterUniforms.uFresnelStrength.value = waterPreset.fresnelStrength * waterConfig.tuning.fresnelStrength;
    waterUniforms.uFresnelPower.value = waterPreset.fresnelPower;
    waterUniforms.uSpecularStrength.value = waterPreset.specularStrength;
    waterUniforms.uSpecularExponent.value = waterPreset.specularExponent;
    waterUniforms.uReflectionBlendStrength.value = waterConfig.tuning.reflectionBlendStrength;
    waterUniforms.uDepthGradientDistanceMax.value = waterConfig.tuning.depthGradientDistanceMax;
    waterUniforms.uFarColorDesaturation.value = waterConfig.tuning.farColorDesaturation;
    waterUniforms.uHorizonLiftStrength.value = waterConfig.tuning.horizonLiftStrength;
    waterUniforms.uMicroNormalScale.value = waterConfig.tuning.microNormalScale;
    waterUniforms.uMicroNormalWeight.value = waterConfig.tuning.microNormalWeight;
    waterUniforms.uSpecularGlintExponent.value = waterConfig.tuning.specularGlintExponent;
    waterUniforms.uSpecularGlintStrength.value = waterConfig.tuning.specularGlintStrength;
    waterUniforms.uCrestFoamStrength.value = waterConfig.tuning.crestFoamStrength;
    waterUniforms.uCrestFoamThreshold.value = waterConfig.tuning.crestFoamThreshold;
    waterUniforms.uWakeDistortionStrength.value = 0.034 + waterPreset.wakeIntensity * waterConfig.tuning.wakeIntensity * 0.036;
    waterUniforms.uWakeFoamTintStrength.value = 0.096 + waterPreset.wakeIntensity * waterConfig.tuning.wakeIntensity * 0.108;
    waterUniforms.uFoamThreshold.value = waterConfig.tuning.foamThreshold;
    waterUniforms.uNearHullDarkeningStrength.value = waterConfig.tuning.nearHullDarkeningStrength;
    waterUniforms.uNearHullDarkeningRadius.value = waterConfig.tuning.nearHullDarkeningRadius;
    waterUniforms.uCurvatureFoamStrength.value = waterConfig.tuning.curvatureFoamStrength;
    waterUniforms.uWavePeakHighlightStrength.value = waterConfig.tuning.wavePeakHighlightStrength;
    waterUniforms.uLocalInteractionRadius.value = waterConfig.tuning.localInteractionRadius;
    waterUniforms.uLocalInteractionLength.value = waterConfig.tuning.localInteractionLength;
    waterUniforms.uBowInteractionStrength.value = waterConfig.tuning.bowInteractionStrength;
    waterUniforms.uHullInteractionStrength.value = waterConfig.tuning.hullInteractionStrength;
    waterUniforms.uInteractionNormalBoost.value = waterConfig.tuning.interactionNormalBoost;
    waterUniforms.uBowRippleFrequency.value = waterConfig.tuning.bowRippleFrequency;
    waterUniforms.uBowRippleStrength.value = waterConfig.tuning.bowRippleStrength;
    waterUniforms.uNearFieldRadius.value = waterConfig.tuning.nearFieldRadius;
    waterUniforms.uNearFieldNormalBoost.value = waterConfig.tuning.nearFieldNormalBoost;
    waterUniforms.uNearFieldDetailBoost.value = waterConfig.tuning.nearFieldDetailBoost;
    waterUniforms.uNearFieldContrastBoost.value = waterConfig.tuning.nearFieldContrastBoost;
    waterUniforms.uDirectionalStreakStrength.value = waterConfig.tuning.directionalStreakStrength;
    waterUniforms.uDirectionalStreakScale.value = waterConfig.tuning.directionalStreakScale;
    waterUniforms.uDirectionalStreakAnisotropy.value = waterConfig.tuning.directionalStreakAnisotropy;
    waterUniforms.uDisturbedSpecularBoost.value = waterConfig.tuning.disturbedSpecularBoost;
    waterUniforms.uDisturbedHighlightFlicker.value = waterConfig.tuning.disturbedHighlightFlicker;
    waterUniforms.uDisturbedContrastBoost.value = waterConfig.tuning.disturbedContrastBoost;
    waterUniforms.uShorelineEnabled.value = waterPreset.shorelineEnabled ? 1 : 0;
    waterUniforms.uShorelineStrength.value = waterPreset.shorelineStrength;
    waterUniforms.uDeepColor.value.set(waterConfig.tuning.deepColor);
    waterUniforms.uShallowColor.value.set(waterConfig.tuning.shallowColor);

    if (rebuildGeometry) {
      const currentGeometry = water.geometry as PlaneGeometry;
      const currentSegments = currentGeometry.parameters.widthSegments;
      if (currentSegments !== waterPreset.geometrySegments) {
        const oldGeometry = water.geometry;
        water.geometry = createWaterGeometry(waterPreset.geometrySegments);
        oldGeometry.dispose();
      }
    }
  };

  const applyLightingState = (): void => {
    const basePreset = getAtmospherePreset(atmosphereConfig.preset);
    const stormPreset = getAtmospherePreset("storm");
    const stormBlend = atmosphereConfig.preset === "storm" ? 0 : activeStormBlend;

    createSunDirection(atmosphereConfig.tuning.sunAzimuthDeg, atmosphereConfig.tuning.sunElevationDeg, baseSunDirection);
    createSunDirection(stormPreset.sunAzimuthDeg, stormPreset.sunElevationDeg, stormSunDirection);
    effectiveSunDirection.copy(baseSunDirection).lerp(stormSunDirection, stormBlend).normalize();

    const effectiveSunIntensity = lerp(atmosphereConfig.tuning.sunIntensity, stormPreset.sunIntensity, stormBlend);
    const effectiveAmbientIntensity = lerp(atmosphereConfig.tuning.ambientIntensity, stormPreset.ambientIntensity, stormBlend);
    const effectiveFogDensity = lerp(atmosphereConfig.tuning.fogDensity, stormPreset.fogDensity, stormBlend);
    const effectiveShadowBounds = atmosphereConfig.tuning.shadowCameraBounds;
    const effectiveShadowResolution = atmosphereConfig.tuning.shadowMapResolution;

    currentExposure = lerp(atmosphereConfig.tuning.exposure, stormPreset.exposure, stormBlend);

    workingColorA.set(basePreset.sunColor);
    workingColorB.set(stormPreset.sunColor);
    sun.color.copy(workingColorA.lerp(workingColorB, stormBlend));
    sun.intensity = effectiveSunIntensity;

    workingColorA.set(basePreset.ambientSkyColor);
    workingColorB.set(stormPreset.ambientSkyColor);
    hemisphere.color.copy(workingColorA.lerp(workingColorB, stormBlend));
    workingColorA.set(basePreset.ambientGroundColor);
    workingColorB.set(stormPreset.ambientGroundColor);
    hemisphere.groundColor.copy(workingColorA.lerp(workingColorB, stormBlend));
    hemisphere.intensity = effectiveAmbientIntensity;

    workingColorA.set(atmosphereConfig.tuning.fogColor);
    workingColorB.set(stormPreset.fogColor);
    fog.color.copy(workingColorA.lerp(workingColorB, stormBlend));
    fog.density = effectiveFogDensity;

    applyAtmosphereToSky(skyUniforms, atmosphereConfig.preset, stormBlend, workingColorA, workingColorB);
    skyUniforms.uSunDirection.value.copy(effectiveSunDirection);

    sun.shadow.mapSize.set(effectiveShadowResolution, effectiveShadowResolution);
    const shadowCamera = sun.shadow.camera as OrthographicCamera;
    shadowCamera.left = -effectiveShadowBounds;
    shadowCamera.right = effectiveShadowBounds;
    shadowCamera.top = effectiveShadowBounds;
    shadowCamera.bottom = -effectiveShadowBounds;
    shadowCamera.near = 6;
    shadowCamera.far = Math.max(120, effectiveShadowBounds * 3.1);
    shadowCamera.updateProjectionMatrix();

    sun.shadow.bias = lerp(basePreset.shadowBias, stormPreset.shadowBias, stormBlend);
    sun.shadow.normalBias = lerp(basePreset.shadowNormalBias, stormPreset.shadowNormalBias, stormBlend);

    shadowTarget.set(lastPlayerPosition.x, 0, lastPlayerPosition.z);
    sun.target.position.copy(shadowTarget);
    sun.position.copy(effectiveSunDirection).multiplyScalar(effectiveShadowBounds * 1.25).add(shadowTarget);
    sun.target.updateMatrixWorld();

    sky.position.copy(lastCameraPosition);
    waterUniforms.uSunDirection.value.copy(effectiveSunDirection);
    waterUniforms.uSkyColor.value.copy(skyUniforms.uHorizonColor.value).lerp(skyUniforms.uTopColor.value, 0.22);
    waterUniforms.fogColor.value.copy(fog.color);
    waterUniforms.fogDensity.value = fog.density;
  };

  applyWaterConfig(false);
  applyLightingState();

  const islandsRoot = new Group();
  root.add(islandsRoot);
  const islandMeshes = new Map<number, Group>();
  const seenIslandIds = new Set<number>();

  const stormDiskMaterial = new MeshStandardMaterial({
    color: "#4f6d82",
    emissive: "#384f61",
    emissiveIntensity: 0.18,
    transparent: true,
    opacity: 0.24,
    roughness: 0.6,
    metalness: 0,
    side: DoubleSide
  });
  const stormRimMaterial = new MeshStandardMaterial({
    color: "#96b7ca",
    emissive: "#7ea5bf",
    emissiveIntensity: 0.22,
    transparent: true,
    opacity: 0.45,
    roughness: 0.35,
    metalness: 0.08
  });

  const stormGroup = new Group();
  const stormDisk = enableShadows(new Mesh(new CircleGeometry(1, 42), stormDiskMaterial), false, false);
  stormDisk.rotation.x = -Math.PI * 0.5;
  stormDisk.position.y = 0.14;
  stormGroup.add(stormDisk);

  const stormRim = enableShadows(new Mesh(new TorusGeometry(1, 0.03, 8, 48), stormRimMaterial), false, false);
  stormRim.rotation.x = Math.PI * 0.5;
  stormRim.position.y = 0.2;
  stormGroup.add(stormRim);

  const stormClouds = new Group();
  for (let i = 0; i < 12; i += 1) {
    const cloud = enableShadows(
      new Mesh(
        new ConeGeometry(0.12, 0.28, 5),
        new MeshStandardMaterial({
          color: "#9ab7c9",
          emissive: "#7d9db3",
          emissiveIntensity: 0.08,
          flatShading: true,
          transparent: true,
          opacity: 0.32,
          roughness: 0.55
        })
      ),
      false,
      false
    );
    const angle = (i / 12) * Math.PI * 2;
    cloud.position.set(Math.cos(angle) * 0.84, 0.18 + (i % 3) * 0.04, Math.sin(angle) * 0.84);
    cloud.rotation.y = angle + Math.PI * 0.5;
    stormClouds.add(cloud);
  }
  stormGroup.add(stormClouds);
  stormGroup.visible = false;
  root.add(stormGroup);
  let disposed = false;

  return {
    root,
    water: {
      getConfig: () => ({
        quality: waterConfig.quality,
        activeWaveCount: getWaterQualityPreset(waterConfig.quality).waveComponents.length,
        waveAmplitude: waterConfig.tuning.waveAmplitude,
        wavelength: waterConfig.tuning.wavelength,
        waveSpeed: waterConfig.tuning.waveSpeed,
        normalScrollSpeedA: waterConfig.tuning.normalScrollSpeedA,
        normalScrollSpeedB: waterConfig.tuning.normalScrollSpeedB,
        deepColor: waterConfig.tuning.deepColor,
        shallowColor: waterConfig.tuning.shallowColor,
        fresnelStrength: waterConfig.tuning.fresnelStrength,
        reflectionBlendStrength: waterConfig.tuning.reflectionBlendStrength,
        depthGradientDistanceMax: waterConfig.tuning.depthGradientDistanceMax,
        farColorDesaturation: waterConfig.tuning.farColorDesaturation,
        horizonLiftStrength: waterConfig.tuning.horizonLiftStrength,
        microNormalScale: waterConfig.tuning.microNormalScale,
        microNormalWeight: waterConfig.tuning.microNormalWeight,
        specularGlintExponent: waterConfig.tuning.specularGlintExponent,
        specularGlintStrength: waterConfig.tuning.specularGlintStrength,
        crestFoamStrength: waterConfig.tuning.crestFoamStrength,
        crestFoamThreshold: waterConfig.tuning.crestFoamThreshold,
        wakeIntensity: waterConfig.tuning.wakeIntensity,
        foamThreshold: waterConfig.tuning.foamThreshold,
        nearHullDarkeningStrength: waterConfig.tuning.nearHullDarkeningStrength,
        nearHullDarkeningRadius: waterConfig.tuning.nearHullDarkeningRadius,
        curvatureFoamStrength: waterConfig.tuning.curvatureFoamStrength,
        wavePeakHighlightStrength: waterConfig.tuning.wavePeakHighlightStrength,
        localInteractionRadius: waterConfig.tuning.localInteractionRadius,
        localInteractionLength: waterConfig.tuning.localInteractionLength,
        bowInteractionStrength: waterConfig.tuning.bowInteractionStrength,
        hullInteractionStrength: waterConfig.tuning.hullInteractionStrength,
        interactionNormalBoost: waterConfig.tuning.interactionNormalBoost,
        bowRippleFrequency: waterConfig.tuning.bowRippleFrequency,
        bowRippleStrength: waterConfig.tuning.bowRippleStrength,
        nearFieldRadius: waterConfig.tuning.nearFieldRadius,
        nearFieldNormalBoost: waterConfig.tuning.nearFieldNormalBoost,
        nearFieldDetailBoost: waterConfig.tuning.nearFieldDetailBoost,
        nearFieldContrastBoost: waterConfig.tuning.nearFieldContrastBoost,
        directionalStreakStrength: waterConfig.tuning.directionalStreakStrength,
        directionalStreakScale: waterConfig.tuning.directionalStreakScale,
        directionalStreakAnisotropy: waterConfig.tuning.directionalStreakAnisotropy,
        disturbedSpecularBoost: waterConfig.tuning.disturbedSpecularBoost,
        disturbedHighlightFlicker: waterConfig.tuning.disturbedHighlightFlicker,
        disturbedContrastBoost: waterConfig.tuning.disturbedContrastBoost
      }),
      setQuality: (quality) => {
        if (disposed) {
          return;
        }
        if (quality === waterConfig.quality) {
          return;
        }
        waterConfig = {
          ...waterConfig,
          quality
        };
        applyWaterConfig(true);
      },
      updateTuning: (patch) => {
        if (disposed) {
          return;
        }
        waterConfig = {
          ...waterConfig,
          tuning: sanitizeWaterTuning(patch, waterConfig.tuning)
        };
        applyWaterConfig(false);
      }
    },
    lighting: {
      getConfig: () => ({
        preset: atmosphereConfig.preset,
        sunAzimuthDeg: atmosphereConfig.tuning.sunAzimuthDeg,
        sunElevationDeg: atmosphereConfig.tuning.sunElevationDeg,
        sunIntensity: atmosphereConfig.tuning.sunIntensity,
        ambientIntensity: atmosphereConfig.tuning.ambientIntensity,
        fogDensity: atmosphereConfig.tuning.fogDensity,
        fogColor: atmosphereConfig.tuning.fogColor,
        exposure: atmosphereConfig.tuning.exposure,
        shadowMapResolution: atmosphereConfig.tuning.shadowMapResolution,
        shadowCameraBounds: atmosphereConfig.tuning.shadowCameraBounds,
        activeStormBlend,
        effectiveExposure: currentExposure
      }),
      setPreset: (preset) => {
        if (disposed) {
          return;
        }
        atmosphereConfig = {
          preset,
          tuning: createAtmosphereTuningFromPreset(preset)
        };
        applyLightingState();
      },
      updateTuning: (patch) => {
        if (disposed) {
          return;
        }
        atmosphereConfig = {
          ...atmosphereConfig,
          tuning: sanitizeAtmosphereTuning(patch, atmosphereConfig.tuning)
        };
        applyLightingState();
      },
      getCurrentExposure: () => currentExposure
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;

      scene.remove(root);
      scene.remove(sky);
      scene.remove(sun);
      scene.remove(sun.target);
      scene.remove(hemisphere);
      scene.fog = null;

      disposeGroup(root);
      islandMeshes.clear();
      seenIslandIds.clear();

      sky.geometry.dispose();
      if (Array.isArray(sky.material)) {
        for (const material of sky.material) {
          (material as Material).dispose();
        }
      } else {
        (sky.material as Material).dispose();
      }

      normalMapA.dispose();
      normalMapB.dispose();
      sun.shadow.map?.dispose();
    },
    syncFromWorld: (worldState, context) => {
      if (disposed) {
        return;
      }
      lastCameraPosition.set(context.cameraPosition.x, context.cameraPosition.y, context.cameraPosition.z);
      lastPlayerPosition.set(context.playerPose.x, 0, context.playerPose.z);

      water.position.set(context.cameraPosition.x, 0, context.cameraPosition.z);
      waterUniforms.uTime.value = context.renderTime;
      waterUniforms.uWaterOriginXZ.value.set(water.position.x, water.position.z);
      waterUniforms.uCameraPos.value.set(context.cameraPosition.x, context.cameraPosition.y, context.cameraPosition.z);
      waterUniforms.uPlayerPos.value.set(context.playerPose.x, context.playerPose.z);
      const wakeInfluences = context.wakeInfluences ?? [];
      const wakeCount = Math.min(WATER_MAX_WAKE_SOURCES, wakeInfluences.length);
      waterUniforms.uWakeSourceCount.value = wakeCount;

      for (let i = 0; i < WATER_MAX_WAKE_SOURCES; i += 1) {
        const source = wakeSourceData[i];
        const direction = wakeDirectionData[i];
        const tuning = wakeTuningData[i];
        const influence = i < wakeCount ? wakeInfluences[i] : undefined;

        if (!source || !direction || !tuning) {
          continue;
        }

        if (!influence) {
          source.set(0, 0, 0, 0);
          direction.set(0, 1, 0, 0);
          tuning.set(0, 0, 1, 0);
          continue;
        }

        source.set(
          influence.sternX,
          influence.sternZ,
          Math.max(0, influence.intensity),
          Math.max(0.001, influence.width)
        );
        direction.set(
          influence.forwardX,
          influence.forwardZ,
          Math.max(0.001, influence.length),
          influence.turn
        );
        tuning.set(
          Math.max(0, influence.normalBoost),
          Math.max(0, influence.foamTint),
          Math.max(0.2, influence.falloff),
          0
        );
      }

      const shipInfluences = context.shipInfluences ?? [];
      const shipInfluenceCount = Math.min(WATER_MAX_SHIP_INFLUENCES, shipInfluences.length);
      waterUniforms.uShipInfluenceCount.value = shipInfluenceCount;

      for (let i = 0; i < WATER_MAX_SHIP_INFLUENCES; i += 1) {
        const posDir = shipInfluencePosDirData[i];
        const motion = shipInfluenceMotionData[i];
        const hull = shipInfluenceHullData[i];
        const influence = i < shipInfluenceCount ? shipInfluences[i] : undefined;

        if (!posDir || !motion || !hull) {
          continue;
        }

        if (!influence) {
          posDir.set(0, 0, 0, 1);
          motion.set(0, 0, 0, 0);
          hull.set(5.2, 2.4, 0, 0);
          continue;
        }

        posDir.set(influence.x, influence.z, influence.forwardX, influence.forwardZ);
        motion.set(
          Math.max(0, influence.speedNorm),
          Math.max(0, influence.accelNorm),
          Math.max(0, influence.turnNorm),
          Math.max(0, influence.throttleNorm)
        );
        hull.set(Math.max(0.5, influence.hullLength), Math.max(0.3, influence.hullWidth), 0, 0);
      }

      let islandCount = 0;
      for (let i = 0; i < WATER_MAX_ISLANDS; i += 1) {
        const island = worldState.islands[i];
        const data = islandData[i];
        if (!island || !data) {
          if (data) {
            data.set(0, 0, 0, 0);
          }
          continue;
        }

        data.set(
          island.position.x,
          island.position.z,
          island.radius,
          island.radius * waterPreset.shorelineRadiusScale
        );
        islandCount += 1;
      }
      waterUniforms.uIslandCount.value = islandCount;

      seenIslandIds.clear();
      for (const island of worldState.islands) {
        let islandMesh = islandMeshes.get(island.id);
        if (!islandMesh) {
          islandMesh = createIslandMesh(island);
          islandMeshes.set(island.id, islandMesh);
          islandsRoot.add(islandMesh);
        }
        islandMesh.position.set(island.position.x, 0, island.position.z);
        seenIslandIds.add(island.id);
      }

      for (const [id, islandMesh] of islandMeshes.entries()) {
        if (seenIslandIds.has(id)) {
          continue;
        }
        islandsRoot.remove(islandMesh);
        disposeGroup(islandMesh);
        islandMeshes.delete(id);
      }

      if (worldState.storm.active) {
        stormGroup.visible = true;
        stormGroup.position.set(worldState.storm.center.x, 0, worldState.storm.center.z);
        stormGroup.scale.set(worldState.storm.radius, 1, worldState.storm.radius);

        const intensity = clamp(worldState.storm.intensity, 0, 1);
        stormDiskMaterial.opacity = 0.13 + intensity * 0.2;
        stormRimMaterial.opacity = 0.3 + intensity * 0.24;
        stormRimMaterial.emissiveIntensity = 0.14 + intensity * 0.2;
        stormClouds.rotation.y = context.renderTime * (0.34 + intensity * 0.32);
        stormRim.rotation.z = -context.renderTime * 0.8;
      } else {
        stormGroup.visible = false;
      }

      const stormDistance = Math.sqrt(
        (worldState.player.position.x - worldState.storm.center.x) ** 2 +
          (worldState.player.position.z - worldState.storm.center.z) ** 2
      );
      const stormProximity =
        worldState.storm.active && worldState.storm.radius > 0
          ? clamp(1 - stormDistance / (worldState.storm.radius * 1.4), 0, 1)
          : 0;
      activeStormBlend = clamp(stormProximity * worldState.storm.intensity, 0, 1);
      waterUniforms.uStormBlend.value = activeStormBlend;
      applyLightingState();
    }
  };
}
