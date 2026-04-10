import { DoubleSide, Mesh, MeshStandardMaterial, Scene, ShaderMaterial, Vector2, Vector3, Vector4 } from "three";
import { describe, expect, it } from "vitest";
import { createInitialWorldState } from "../../simulation";
import { createEnvironment } from "./createEnvironment";

describe("createEnvironment water quality controls", () => {
  function sync(
    environment: ReturnType<typeof createEnvironment>,
    worldState = createInitialWorldState(),
    cameraPosition = { x: 4, y: 7, z: -12 }
  ): void {
    environment.syncFromWorld(worldState, {
      frameDt: 1 / 60,
      renderTime: 10,
      cameraPosition,
      playerPose: {
        x: worldState.player.position.x,
        z: worldState.player.position.z,
        heading: worldState.player.heading,
        speed: worldState.player.speed,
        drift: worldState.player.drift
      }
    });
  }

  function findWaterSunDirection(scene: Scene): Vector3 | null {
    let found: Vector3 | null = null;
    scene.traverse((obj) => {
      if (found) {
        return;
      }
      const mesh = obj as Mesh;
      const material = mesh.material;
      if (!(material instanceof ShaderMaterial)) {
        return;
      }
      const uniforms = material.uniforms as Record<string, { value?: unknown }>;
      const candidate = uniforms.uSunDirection?.value;
      if (candidate instanceof Vector3) {
        found = candidate.clone();
      }
    });
    return found;
  }

  function findWaterMaterial(scene: Scene): ShaderMaterial | null {
    let found: ShaderMaterial | null = null;
    scene.traverse((obj) => {
      if (found) {
        return;
      }
      const mesh = obj as Mesh;
      const material = mesh.material;
      if (!(material instanceof ShaderMaterial)) {
        return;
      }
      const uniforms = material.uniforms as Record<string, { value?: unknown }>;
      if (uniforms.uDeepColor && uniforms.uShallowColor && uniforms.uNormalMapA && uniforms.uNormalMapB) {
        found = material;
      }
    });
    return found;
  }

  function findSkyMesh(scene: Scene): Mesh | null {
    let found: Mesh | null = null;
    scene.traverse((obj) => {
      if (found) {
        return;
      }
      const mesh = obj as Mesh;
      const material = mesh.material;
      if (!(material instanceof ShaderMaterial)) {
        return;
      }
      const uniforms = material.uniforms as Record<string, { value?: unknown }>;
      if (uniforms.uTopColor && uniforms.uHorizonColor && uniforms.uBottomColor && uniforms.uSunDirection) {
        found = mesh;
      }
    });
    return found;
  }

  it("defaults to high quality and supports switching quality tiers", () => {
    const environment = createEnvironment(new Scene());
    const configAtStart = environment.water.getConfig();
    expect(configAtStart.quality).toBe("high");
    expect(configAtStart.activeWaveCount).toBe(4);

    expect(() => environment.water.setQuality("medium")).not.toThrow();
    const mediumConfig = environment.water.getConfig();
    expect(mediumConfig.quality).toBe("medium");
    expect(mediumConfig.activeWaveCount).toBe(3);

    expect(() => environment.water.setQuality("low")).not.toThrow();
    const lowConfig = environment.water.getConfig();
    expect(lowConfig.quality).toBe("low");
    expect(lowConfig.activeWaveCount).toBe(1);
  });

  it("exposes extended water grounding controls in debug snapshot", () => {
    const environment = createEnvironment(new Scene());
    const config = environment.water.getConfig();

    expect(config.reflectionBlendStrength).toBeGreaterThan(0);
    expect(config.depthGradientDistanceMax).toBeGreaterThan(20);
    expect(config.farColorDesaturation).toBeGreaterThanOrEqual(0);
    expect(config.horizonLiftStrength).toBeGreaterThan(0);
    expect(config.microNormalScale).toBeGreaterThan(0.25);
    expect(config.microNormalWeight).toBeGreaterThan(0);
    expect(config.specularGlintExponent).toBeGreaterThan(8);
    expect(config.specularGlintStrength).toBeGreaterThanOrEqual(0);
    expect(config.crestFoamStrength).toBeGreaterThan(0);
    expect(config.crestFoamThreshold).toBeGreaterThanOrEqual(0);
    expect(config.nearHullDarkeningStrength).toBeGreaterThan(0);
    expect(config.nearHullDarkeningRadius).toBeGreaterThan(2);
    expect(config.curvatureFoamStrength).toBeGreaterThan(0);
    expect(config.wavePeakHighlightStrength).toBeGreaterThan(0);
    expect(config.localInteractionRadius).toBeGreaterThan(3);
    expect(config.localInteractionLength).toBeGreaterThan(4);
    expect(config.bowInteractionStrength).toBeGreaterThan(0);
    expect(config.hullInteractionStrength).toBeGreaterThan(0);
    expect(config.interactionNormalBoost).toBeGreaterThan(0);
    expect(config.bowRippleFrequency).toBeGreaterThan(1);
    expect(config.bowRippleStrength).toBeGreaterThan(0);
    expect(config.nearFieldRadius).toBeGreaterThan(8);
    expect(config.nearFieldNormalBoost).toBeGreaterThanOrEqual(0);
    expect(config.nearFieldDetailBoost).toBeGreaterThanOrEqual(0);
    expect(config.nearFieldContrastBoost).toBeGreaterThanOrEqual(0);
    expect(config.directionalStreakStrength).toBeGreaterThanOrEqual(0);
    expect(config.directionalStreakScale).toBeGreaterThan(0);
    expect(config.directionalStreakAnisotropy).toBeGreaterThanOrEqual(0);
    expect(config.disturbedSpecularBoost).toBeGreaterThanOrEqual(0);
    expect(config.disturbedHighlightFlicker).toBeGreaterThanOrEqual(0);
    expect(config.disturbedContrastBoost).toBeGreaterThanOrEqual(0);
  });

  it("sanitizes extended water tuning controls and pushes values to shader uniforms", () => {
    const scene = new Scene();
    const environment = createEnvironment(scene);
    environment.water.updateTuning({
      reflectionBlendStrength: 8,
      depthGradientDistanceMax: 6,
      farColorDesaturation: 8,
      horizonLiftStrength: 8,
      microNormalScale: 0.02,
      microNormalWeight: -3,
      specularGlintExponent: 500,
      specularGlintStrength: 8,
      crestFoamStrength: 9,
      crestFoamThreshold: -2,
      nearHullDarkeningStrength: 9,
      nearHullDarkeningRadius: -2,
      curvatureFoamStrength: 5,
      wavePeakHighlightStrength: -1,
      localInteractionRadius: 1,
      localInteractionLength: 80,
      bowInteractionStrength: 4,
      hullInteractionStrength: -2,
      interactionNormalBoost: 8,
      bowRippleFrequency: 0.2,
      bowRippleStrength: 9,
      nearFieldRadius: 200,
      nearFieldNormalBoost: -4,
      nearFieldDetailBoost: 9,
      nearFieldContrastBoost: 9,
      directionalStreakStrength: 9,
      directionalStreakScale: 0.0001,
      directionalStreakAnisotropy: 9,
      disturbedSpecularBoost: 9,
      disturbedHighlightFlicker: -1,
      disturbedContrastBoost: 9
    });

    const config = environment.water.getConfig();
    expect(config.reflectionBlendStrength).toBeCloseTo(2, 6);
    expect(config.depthGradientDistanceMax).toBeCloseTo(20, 6);
    expect(config.farColorDesaturation).toBeCloseTo(1, 6);
    expect(config.horizonLiftStrength).toBeCloseTo(1.5, 6);
    expect(config.microNormalScale).toBeCloseTo(0.25, 6);
    expect(config.microNormalWeight).toBeCloseTo(0, 6);
    expect(config.specularGlintExponent).toBeCloseTo(256, 6);
    expect(config.specularGlintStrength).toBeCloseTo(3, 6);
    expect(config.crestFoamStrength).toBeCloseTo(2.5, 6);
    expect(config.crestFoamThreshold).toBeCloseTo(0, 6);
    expect(config.nearHullDarkeningStrength).toBeCloseTo(1.2, 6);
    expect(config.nearHullDarkeningRadius).toBeCloseTo(2, 6);
    expect(config.curvatureFoamStrength).toBeCloseTo(2, 6);
    expect(config.wavePeakHighlightStrength).toBeCloseTo(0, 6);
    expect(config.localInteractionRadius).toBeCloseTo(3, 6);
    expect(config.localInteractionLength).toBeCloseTo(30, 6);
    expect(config.bowInteractionStrength).toBeCloseTo(2, 6);
    expect(config.hullInteractionStrength).toBeCloseTo(0, 6);
    expect(config.interactionNormalBoost).toBeCloseTo(2, 6);
    expect(config.bowRippleFrequency).toBeCloseTo(1, 6);
    expect(config.bowRippleStrength).toBeCloseTo(2, 6);
    expect(config.nearFieldRadius).toBeCloseTo(120, 6);
    expect(config.nearFieldNormalBoost).toBeCloseTo(0, 6);
    expect(config.nearFieldDetailBoost).toBeCloseTo(2, 6);
    expect(config.nearFieldContrastBoost).toBeCloseTo(1.5, 6);
    expect(config.directionalStreakStrength).toBeCloseTo(1.5, 6);
    expect(config.directionalStreakScale).toBeCloseTo(0.001, 6);
    expect(config.directionalStreakAnisotropy).toBeCloseTo(1, 6);
    expect(config.disturbedSpecularBoost).toBeCloseTo(2.5, 6);
    expect(config.disturbedHighlightFlicker).toBeCloseTo(0, 6);
    expect(config.disturbedContrastBoost).toBeCloseTo(1.5, 6);

    sync(environment, createInitialWorldState());
    const waterMaterial = findWaterMaterial(scene);
    expect(waterMaterial).not.toBeNull();
    if (!waterMaterial) {
      return;
    }
    const uniforms = waterMaterial.uniforms as Record<string, { value?: unknown }>;
    expect(uniforms.uReflectionBlendStrength?.value).toBeCloseTo(2, 6);
    expect(uniforms.uDepthGradientDistanceMax?.value).toBeCloseTo(20, 6);
    expect(uniforms.uFarColorDesaturation?.value).toBeCloseTo(1, 6);
    expect(uniforms.uHorizonLiftStrength?.value).toBeCloseTo(1.5, 6);
    expect(uniforms.uMicroNormalScale?.value).toBeCloseTo(0.25, 6);
    expect(uniforms.uMicroNormalWeight?.value).toBeCloseTo(0, 6);
    expect(uniforms.uSpecularGlintExponent?.value).toBeCloseTo(256, 6);
    expect(uniforms.uSpecularGlintStrength?.value).toBeCloseTo(3, 6);
    expect(uniforms.uCrestFoamStrength?.value).toBeCloseTo(2.5, 6);
    expect(uniforms.uCrestFoamThreshold?.value).toBeCloseTo(0, 6);
    expect(uniforms.uNearHullDarkeningStrength?.value).toBeCloseTo(1.2, 6);
    expect(uniforms.uNearHullDarkeningRadius?.value).toBeCloseTo(2, 6);
    expect(uniforms.uCurvatureFoamStrength?.value).toBeCloseTo(2, 6);
    expect(uniforms.uWavePeakHighlightStrength?.value).toBeCloseTo(0, 6);
    expect(uniforms.uLocalInteractionRadius?.value).toBeCloseTo(3, 6);
    expect(uniforms.uLocalInteractionLength?.value).toBeCloseTo(30, 6);
    expect(uniforms.uBowInteractionStrength?.value).toBeCloseTo(2, 6);
    expect(uniforms.uHullInteractionStrength?.value).toBeCloseTo(0, 6);
    expect(uniforms.uInteractionNormalBoost?.value).toBeCloseTo(2, 6);
    expect(uniforms.uBowRippleFrequency?.value).toBeCloseTo(1, 6);
    expect(uniforms.uBowRippleStrength?.value).toBeCloseTo(2, 6);
    expect(uniforms.uNearFieldRadius?.value).toBeCloseTo(120, 6);
    expect(uniforms.uNearFieldNormalBoost?.value).toBeCloseTo(0, 6);
    expect(uniforms.uNearFieldDetailBoost?.value).toBeCloseTo(2, 6);
    expect(uniforms.uNearFieldContrastBoost?.value).toBeCloseTo(1.5, 6);
    expect(uniforms.uDirectionalStreakStrength?.value).toBeCloseTo(1.5, 6);
    expect(uniforms.uDirectionalStreakScale?.value).toBeCloseTo(0.001, 6);
    expect(uniforms.uDirectionalStreakAnisotropy?.value).toBeCloseTo(1, 6);
    expect(uniforms.uDisturbedSpecularBoost?.value).toBeCloseTo(2.5, 6);
    expect(uniforms.uDisturbedHighlightFlicker?.value).toBeCloseTo(0, 6);
    expect(uniforms.uDisturbedContrastBoost?.value).toBeCloseTo(1.5, 6);
  });

  it("syncs without runtime errors after quality switches", () => {
    const environment = createEnvironment(new Scene());
    const worldState = createInitialWorldState();
    worldState.player.speed = 9;
    worldState.burst.active = true;

    environment.water.setQuality("high");
    expect(() => sync(environment, worldState)).not.toThrow();
  });

  it("feeds player position into near-hull water shading uniforms", () => {
    const scene = new Scene();
    const environment = createEnvironment(scene);
    const worldState = createInitialWorldState();
    worldState.player.position.x = 37;
    worldState.player.position.z = -14;

    sync(environment, worldState);
    const waterMaterial = findWaterMaterial(scene);
    expect(waterMaterial).not.toBeNull();
    if (!waterMaterial) {
      return;
    }
    const uniforms = waterMaterial.uniforms as Record<string, { value?: unknown }>;
    const playerPos = uniforms.uPlayerPos?.value;
    expect(playerPos).toBeInstanceOf(Vector2);
    if (!(playerPos instanceof Vector2)) {
      return;
    }
    expect(playerPos.x).toBeCloseTo(37, 6);
    expect(playerPos.y).toBeCloseTo(-14, 6);
  });

  it("world-locks wave phase via mesh-origin uniform during camera shifts", () => {
    const scene = new Scene();
    const environment = createEnvironment(scene);
    const worldState = createInitialWorldState();
    const sampleWorldPoint = { x: 42.3, z: -17.8 };

    const sampleWaveHeight = (
      uniforms: Record<string, { value?: unknown }>,
      meshOrigin: Vector2,
      useWorldLock: boolean
    ): number => {
      const waveCount = (uniforms.uWaveCount?.value as number) ?? 0;
      const waveDirections = (uniforms.uWaveDirections?.value as Vector2[]) ?? [];
      const amplitudes = (uniforms.uWaveAmplitudes?.value as number[]) ?? [];
      const wavelengths = (uniforms.uWaveLengths?.value as number[]) ?? [];
      const speeds = (uniforms.uWaveSpeeds?.value as number[]) ?? [];
      const phases = (uniforms.uWavePhases?.value as number[]) ?? [];
      const time = (uniforms.uTime?.value as number) ?? 0;

      const localX = sampleWorldPoint.x - meshOrigin.x;
      const localZ = sampleWorldPoint.z - meshOrigin.y;
      const phaseX = useWorldLock ? localX + meshOrigin.x : localX;
      const phaseZ = useWorldLock ? localZ + meshOrigin.y : localZ;

      let y = 0;
      const activeWaveCount = Math.min(waveCount, waveDirections.length, amplitudes.length, wavelengths.length, speeds.length, phases.length);
      for (let i = 0; i < activeWaveCount; i += 1) {
        const direction = waveDirections[i];
        if (!(direction instanceof Vector2)) {
          continue;
        }
        const wavelength = Math.max(0.001, wavelengths[i] ?? 1);
        const waveNumber = (Math.PI * 2) / wavelength;
        const phase = waveNumber * (direction.x * phaseX + direction.y * phaseZ) + time * (speeds[i] ?? 0) + (phases[i] ?? 0);
        y += (amplitudes[i] ?? 0) * Math.sin(phase);
      }
      return y;
    };

    sync(environment, worldState, { x: 12, y: 7, z: -18 });
    const waterMaterial = findWaterMaterial(scene);
    expect(waterMaterial).not.toBeNull();
    if (!waterMaterial) {
      return;
    }
    let uniforms = waterMaterial.uniforms as Record<string, { value?: unknown }>;
    const firstOrigin = uniforms.uWaterOriginXZ?.value;
    expect(firstOrigin).toBeInstanceOf(Vector2);
    if (!(firstOrigin instanceof Vector2)) {
      return;
    }
    expect(firstOrigin.x).toBeCloseTo(12, 6);
    expect(firstOrigin.y).toBeCloseTo(-18, 6);
    const lockedHeightA = sampleWaveHeight(uniforms, firstOrigin, true);
    const legacyHeightA = sampleWaveHeight(uniforms, firstOrigin, false);

    sync(environment, worldState, { x: -34, y: 8, z: 44 });
    uniforms = waterMaterial.uniforms as Record<string, { value?: unknown }>;
    const secondOrigin = uniforms.uWaterOriginXZ?.value;
    expect(secondOrigin).toBeInstanceOf(Vector2);
    if (!(secondOrigin instanceof Vector2)) {
      return;
    }
    expect(secondOrigin.x).toBeCloseTo(-34, 6);
    expect(secondOrigin.y).toBeCloseTo(44, 6);
    const lockedHeightB = sampleWaveHeight(uniforms, secondOrigin, true);
    const legacyHeightB = sampleWaveHeight(uniforms, secondOrigin, false);

    expect(lockedHeightA).toBeCloseTo(lockedHeightB, 6);
    expect(Math.abs(legacyHeightA - legacyHeightB)).toBeGreaterThan(0.08);

    expect(waterMaterial.vertexShader).toContain("uniform vec2 uWaterOriginXZ;");
    expect(waterMaterial.vertexShader).toContain("vec2 sampleXZ = inPosition.xz + uWaterOriginXZ;");
    expect(waterMaterial.vertexShader).toContain("dot(direction, sampleXZ)");
  });

  it("keeps wake uniforms stable under strong turn-scaled influences", () => {
    const scene = new Scene();
    const environment = createEnvironment(scene);
    const worldState = createInitialWorldState();

    expect(() =>
      environment.syncFromWorld(worldState, {
        frameDt: 1 / 60,
        renderTime: 10,
        cameraPosition: { x: 4, y: 7, z: -12 },
        playerPose: {
          x: worldState.player.position.x,
          z: worldState.player.position.z,
          heading: worldState.player.heading,
          speed: worldState.player.speed,
          drift: worldState.player.drift
        },
        wakeInfluences: [
          {
            sternX: 2,
            sternZ: -1,
            forwardX: 0.2,
            forwardZ: 0.98,
            intensity: 0.8,
            width: 1.8,
            length: 10,
            turn: -0.95,
            normalBoost: 0.4,
            foamTint: 0.3,
            falloff: 1.4
          },
          {
            sternX: -3,
            sternZ: 1.5,
            forwardX: -0.35,
            forwardZ: 0.94,
            intensity: 0.72,
            width: 1.6,
            length: 9,
            turn: 0.92,
            normalBoost: 0.35,
            foamTint: 0.28,
            falloff: 1.35
          }
        ]
      })
    ).not.toThrow();

    const waterMaterial = findWaterMaterial(scene);
    expect(waterMaterial).not.toBeNull();
    if (!waterMaterial) {
      return;
    }
    const uniforms = waterMaterial.uniforms as Record<string, { value?: unknown }>;
    expect(uniforms.uWakeSourceCount?.value).toBe(2);
    const wakeDirections = uniforms.uWakeDirections?.value as Vector4[] | undefined;
    expect(wakeDirections?.[0]?.w).toBeCloseTo(-0.95, 6);
    expect(wakeDirections?.[1]?.w).toBeCloseTo(0.92, 6);
  });

  it("supports expanded wake source capacity and clamps to shader max", () => {
    const scene = new Scene();
    const environment = createEnvironment(scene);
    const worldState = createInitialWorldState();
    const wakeInfluences = Array.from({ length: 30 }, (_, index) => ({
      sternX: index * 0.4,
      sternZ: -index * 0.2,
      forwardX: 0,
      forwardZ: 1,
      intensity: 0.45,
      width: 1.2,
      length: 8,
      turn: 0,
      normalBoost: 0.25,
      foamTint: 0.2,
      falloff: 1.1
    }));

    environment.syncFromWorld(worldState, {
      frameDt: 1 / 60,
      renderTime: 10,
      cameraPosition: { x: 4, y: 7, z: -12 },
      playerPose: {
        x: worldState.player.position.x,
        z: worldState.player.position.z,
        heading: worldState.player.heading,
        speed: worldState.player.speed,
        drift: worldState.player.drift
      },
      wakeInfluences
    });

    const waterMaterial = findWaterMaterial(scene);
    expect(waterMaterial).not.toBeNull();
    if (!waterMaterial) {
      return;
    }
    const uniforms = waterMaterial.uniforms as Record<string, { value?: unknown }>;
    expect(uniforms.uWakeSourceCount?.value).toBe(24);
  });

  it("plumbs all-ship interaction influences into shader uniforms", () => {
    const scene = new Scene();
    const environment = createEnvironment(scene);
    const worldState = createInitialWorldState();

    environment.syncFromWorld(worldState, {
      frameDt: 1 / 60,
      renderTime: 10,
      cameraPosition: { x: 4, y: 7, z: -12 },
      playerPose: {
        x: worldState.player.position.x,
        z: worldState.player.position.z,
        heading: worldState.player.heading,
        speed: worldState.player.speed,
        drift: worldState.player.drift
      },
      shipInfluences: [
        {
          x: 2,
          z: -1,
          forwardX: 0.1,
          forwardZ: 0.99,
          speedNorm: 0.7,
          accelNorm: 0.4,
          turnNorm: 0.2,
          throttleNorm: 0.85,
          hullLength: 8.4,
          hullWidth: 2.9
        },
        {
          x: -3.5,
          z: 4.2,
          forwardX: -0.44,
          forwardZ: 0.9,
          speedNorm: 0.5,
          accelNorm: 0.15,
          turnNorm: 0.62,
          throttleNorm: 0.65,
          hullLength: 7.2,
          hullWidth: 2.4
        }
      ]
    });

    const waterMaterial = findWaterMaterial(scene);
    expect(waterMaterial).not.toBeNull();
    if (!waterMaterial) {
      return;
    }
    const uniforms = waterMaterial.uniforms as Record<string, { value?: unknown }>;
    expect(uniforms.uShipInfluenceCount?.value).toBe(2);
    const posDir = uniforms.uShipInfluencePosDir?.value as Vector4[] | undefined;
    const motion = uniforms.uShipInfluenceMotion?.value as Vector4[] | undefined;
    const hull = uniforms.uShipInfluenceHull?.value as Vector4[] | undefined;
    expect(posDir?.[0]?.x).toBeCloseTo(2, 6);
    expect(posDir?.[1]?.z).toBeCloseTo(-0.44, 6);
    expect(motion?.[0]?.w).toBeCloseTo(0.85, 6);
    expect(hull?.[1]?.y).toBeCloseTo(2.4, 6);
  });

  it("supports switching and tuning lighting presets", () => {
    const environment = createEnvironment(new Scene());
    const start = environment.lighting.getConfig();
    expect(start.preset).toBe("clearDay");

    environment.lighting.setPreset("goldenHour");
    const golden = environment.lighting.getConfig();
    expect(golden.preset).toBe("goldenHour");

    environment.lighting.updateTuning({
      sunAzimuthDeg: 120,
      sunElevationDeg: 35,
      ambientIntensity: 0.62
    });
    const tuned = environment.lighting.getConfig();
    expect(tuned.sunAzimuthDeg).toBe(120);
    expect(tuned.sunElevationDeg).toBe(35);
    expect(tuned.ambientIntensity).toBeCloseTo(0.62, 6);
  });

  it("applies storm blending to runtime exposure", () => {
    const environment = createEnvironment(new Scene());
    const worldState = createInitialWorldState();
    worldState.storm.active = true;
    worldState.storm.center.x = worldState.player.position.x;
    worldState.storm.center.z = worldState.player.position.z;
    worldState.storm.radius = 40;
    worldState.storm.intensity = 0.55;

    sync(environment, worldState);
    const lighting = environment.lighting.getConfig();
    expect(lighting.activeStormBlend).toBeGreaterThan(0);
    expect(environment.lighting.getCurrentExposure()).toBeLessThanOrEqual(lighting.exposure);
  });

  it("updates water sun direction from lighting", () => {
    const scene = new Scene();
    const environment = createEnvironment(scene);
    environment.lighting.updateTuning({
      sunAzimuthDeg: 90,
      sunElevationDeg: 45
    });

    sync(environment, createInitialWorldState());

    const sunDirection = findWaterSunDirection(scene);
    expect(sunDirection).not.toBeNull();
    if (!sunDirection) {
      return;
    }
    expect(sunDirection.x).toBeGreaterThan(0.65);
    expect(sunDirection.y).toBeGreaterThan(0.65);
  });

  it("supports idempotent disposal", () => {
    const scene = new Scene();
    const environment = createEnvironment(scene);
    expect(() => environment.dispose()).not.toThrow();
    expect(() => environment.dispose()).not.toThrow();
  });

  it("renders water shader double-sided to prevent horizon culling voids", () => {
    const scene = new Scene();
    const environment = createEnvironment(scene);
    sync(environment, createInitialWorldState());

    const waterMaterial = findWaterMaterial(scene);
    expect(waterMaterial).not.toBeNull();
    if (!waterMaterial) {
      return;
    }

    expect(waterMaterial.side).toBe(DoubleSide);
  });

  it("renders sky dome without depth-tested culling gaps", () => {
    const scene = new Scene();
    createEnvironment(scene);

    const skyMesh = findSkyMesh(scene);
    expect(skyMesh).not.toBeNull();
    if (!skyMesh) {
      return;
    }

    const skyMaterial = skyMesh.material;
    if (!(skyMaterial instanceof ShaderMaterial)) {
      return;
    }

    expect(skyMaterial.side).toBe(DoubleSide);
    expect(skyMaterial.depthTest).toBe(false);
    expect(skyMaterial.depthWrite).toBe(false);
    expect((skyMesh.geometry as { parameters?: { radius?: number } }).parameters?.radius ?? 0).toBeLessThan(400);
  });

  it("keeps hostile island meshes readable without harsh shadow silhouettes", () => {
    const scene = new Scene();
    const environment = createEnvironment(scene);
    const worldState = createInitialWorldState();
    sync(environment, worldState);

    const hostile = worldState.islands.find((island) => island.kind === "hostile");
    expect(hostile).toBeDefined();
    if (!hostile) {
      return;
    }

    const nearbyIslandMeshes: Mesh[] = [];
    const worldPosition = new Vector3();
    scene.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh || !(mesh.material instanceof MeshStandardMaterial)) {
        return;
      }
      mesh.getWorldPosition(worldPosition);
      const dx = worldPosition.x - hostile.position.x;
      const dz = worldPosition.z - hostile.position.z;
      if (dx * dx + dz * dz <= 20 * 20) {
        nearbyIslandMeshes.push(mesh);
      }
    });

    expect(nearbyIslandMeshes.length).toBeGreaterThan(0);
    for (const mesh of nearbyIslandMeshes) {
      expect(mesh.castShadow).toBe(false);
      expect(mesh.receiveShadow).toBe(false);

      const material = mesh.material;
      if (!(material instanceof MeshStandardMaterial)) {
        continue;
      }

      const luminance = material.color.r * 0.2126 + material.color.g * 0.7152 + material.color.b * 0.0722;
      expect(luminance).toBeGreaterThan(0.12);
      expect(material.emissiveIntensity).toBeGreaterThan(0.1);
    }
  });
});
