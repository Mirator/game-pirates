import { DoubleSide, Mesh, MeshStandardMaterial, Scene, ShaderMaterial, Vector2, Vector3, Vector4 } from "three";
import { describe, expect, it } from "vitest";
import { createInitialWorldState } from "../../simulation";
import { createEnvironment } from "./createEnvironment";

describe("createEnvironment water quality controls", () => {
  function sync(environment: ReturnType<typeof createEnvironment>, worldState = createInitialWorldState()): void {
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

    expect(config.nearHullDarkeningStrength).toBeGreaterThan(0);
    expect(config.nearHullDarkeningRadius).toBeGreaterThan(2);
    expect(config.curvatureFoamStrength).toBeGreaterThan(0);
    expect(config.wavePeakHighlightStrength).toBeGreaterThan(0);
  });

  it("sanitizes extended water tuning controls and pushes values to shader uniforms", () => {
    const scene = new Scene();
    const environment = createEnvironment(scene);
    environment.water.updateTuning({
      nearHullDarkeningStrength: 9,
      nearHullDarkeningRadius: -2,
      curvatureFoamStrength: 5,
      wavePeakHighlightStrength: -1
    });

    const config = environment.water.getConfig();
    expect(config.nearHullDarkeningStrength).toBeCloseTo(1.2, 6);
    expect(config.nearHullDarkeningRadius).toBeCloseTo(2, 6);
    expect(config.curvatureFoamStrength).toBeCloseTo(2, 6);
    expect(config.wavePeakHighlightStrength).toBeCloseTo(0, 6);

    sync(environment, createInitialWorldState());
    const waterMaterial = findWaterMaterial(scene);
    expect(waterMaterial).not.toBeNull();
    if (!waterMaterial) {
      return;
    }
    const uniforms = waterMaterial.uniforms as Record<string, { value?: unknown }>;
    expect(uniforms.uNearHullDarkeningStrength?.value).toBeCloseTo(1.2, 6);
    expect(uniforms.uNearHullDarkeningRadius?.value).toBeCloseTo(2, 6);
    expect(uniforms.uCurvatureFoamStrength?.value).toBeCloseTo(2, 6);
    expect(uniforms.uWavePeakHighlightStrength?.value).toBeCloseTo(0, 6);
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
