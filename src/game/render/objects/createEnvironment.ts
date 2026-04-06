import {
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Fog,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  TorusGeometry
} from "three";
import type { IslandKind, IslandState, WorldState } from "../../simulation";

export interface EnvironmentObjects {
  root: Group;
  syncFromWorld: (worldState: WorldState, frameDt: number) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
      return { sand: "#9f8660", rock: "#5f4c42", accent: "#cb6651" };
    case "scenic":
      return { sand: "#d4b78a", rock: "#5f8a6f", accent: "#7ed2a5" };
  }
}

function createIslandMesh(island: IslandState): Group {
  const palette = getIslandPalette(island.kind);
  const scale = island.radius / 10;

  const group = new Group();

  const sand = new Mesh(
    new CircleGeometry(island.radius * 1.02, 20),
    new MeshStandardMaterial({
      color: palette.sand,
      flatShading: true,
      roughness: 0.9,
      side: DoubleSide
    })
  );
  sand.rotation.x = -Math.PI * 0.5;
  sand.position.y = 0.05;
  group.add(sand);

  const rock = new Mesh(
    new ConeGeometry(4.8 * scale, 3.2 * scale, 8),
    new MeshStandardMaterial({
      color: palette.rock,
      flatShading: true,
      roughness: 0.95
    })
  );
  rock.rotation.y = Math.PI * 0.16;
  rock.position.y = 1.48 * scale;
  group.add(rock);

  const markerHeight = island.kind === "port" ? 4.2 : 3.2;
  const markerRadius = island.kind === "hostile" ? 0.68 : 0.48;
  const marker = new Mesh(
    new ConeGeometry(markerRadius * scale, markerHeight * scale, 6),
    new MeshStandardMaterial({
      color: palette.accent,
      emissive: palette.accent,
      emissiveIntensity: island.kind === "hostile" ? 0.08 : 0.13,
      flatShading: true,
      roughness: 0.55
    })
  );
  marker.position.y = 2.4 * scale;
  marker.rotation.y = island.id * 0.6;
  group.add(marker);

  if (island.kind === "port") {
    const lantern = new Mesh(
      new CylinderGeometry(0.2, 0.2, 1.3, 6),
      new MeshStandardMaterial({
        color: "#ffecbe",
        emissive: "#f1c369",
        emissiveIntensity: 0.28,
        roughness: 0.3
      })
    );
    lantern.position.y = 4.4 * scale;
    group.add(lantern);
  }

  group.position.set(island.position.x, 0, island.position.z);
  return group;
}

export function createEnvironment(scene: Scene): EnvironmentObjects {
  const root = new Group();
  scene.add(root);

  const calmFogColor = new Color("#8fd4ff");
  const stormFogColor = new Color("#6a8599");
  const calmBackground = new Color("#8fd4ff");
  const stormBackground = new Color("#6c8aa0");
  const calmWaterColor = new Color("#1d6d9f");
  const stormWaterColor = new Color("#26506f");
  const workingColor = new Color();

  const waterGeometry = new PlaneGeometry(280, 280, 60, 60);
  waterGeometry.rotateX(-Math.PI * 0.5);

  const positionAttribute = waterGeometry.getAttribute("position");
  if (!positionAttribute) {
    throw new Error("Water geometry is missing its position attribute.");
  }
  const waterPositions = positionAttribute.array as Float32Array;
  const baseWaterHeights = new Float32Array(waterPositions.length);
  for (let i = 0; i < waterPositions.length; i += 3) {
    baseWaterHeights[i] = waterPositions[i] ?? 0;
    baseWaterHeights[i + 1] = waterPositions[i + 1] ?? 0;
    baseWaterHeights[i + 2] = waterPositions[i + 2] ?? 0;
  }

  const waterMaterial = new MeshStandardMaterial({
    color: calmWaterColor,
    flatShading: true,
    roughness: 0.34,
    metalness: 0.02
  });
  const water = new Mesh(waterGeometry, waterMaterial);
  root.add(water);

  const shallowRingMaterial = new MeshStandardMaterial({
    color: "#3f95bb",
    transparent: true,
    opacity: 0.45,
    roughness: 0.22
  });
  const shallowRing = new Mesh(new CircleGeometry(42, 24), shallowRingMaterial);
  shallowRing.rotation.x = -Math.PI * 0.5;
  shallowRing.position.y = 0.04;
  root.add(shallowRing);

  const islandsRoot = new Group();
  root.add(islandsRoot);
  const islandMeshes = new Map<number, Group>();

  const treasureBeamMaterial = new MeshStandardMaterial({
    color: "#ffe482",
    emissive: "#c59c34",
    emissiveIntensity: 0.24,
    transparent: true,
    opacity: 0.36,
    roughness: 0.26,
    side: DoubleSide
  });
  const treasureRingMaterial = new MeshStandardMaterial({
    color: "#ffe9a8",
    emissive: "#d8a948",
    emissiveIntensity: 0.3,
    roughness: 0.22
  });
  const treasureBeacon = new Group();
  const treasureBeam = new Mesh(new CylinderGeometry(0.36, 0.66, 15, 10, 1, true), treasureBeamMaterial);
  treasureBeam.position.y = 7.5;
  treasureBeacon.add(treasureBeam);
  const treasureRing = new Mesh(new TorusGeometry(2.4, 0.18, 8, 22), treasureRingMaterial);
  treasureRing.rotation.x = Math.PI * 0.5;
  treasureRing.position.y = 0.22;
  treasureBeacon.add(treasureRing);
  treasureBeacon.visible = false;
  root.add(treasureBeacon);

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
  const stormDisk = new Mesh(new CircleGeometry(1, 42), stormDiskMaterial);
  stormDisk.rotation.x = -Math.PI * 0.5;
  stormDisk.position.y = 0.14;
  stormGroup.add(stormDisk);

  const stormRim = new Mesh(new TorusGeometry(1, 0.03, 8, 48), stormRimMaterial);
  stormRim.rotation.x = Math.PI * 0.5;
  stormRim.position.y = 0.2;
  stormGroup.add(stormRim);

  const stormClouds = new Group();
  for (let i = 0; i < 12; i += 1) {
    const cloud = new Mesh(
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
    );
    const angle = (i / 12) * Math.PI * 2;
    cloud.position.set(Math.cos(angle) * 0.84, 0.18 + ((i % 3) * 0.04), Math.sin(angle) * 0.84);
    cloud.rotation.y = angle + Math.PI * 0.5;
    stormClouds.add(cloud);
  }
  stormGroup.add(stormClouds);
  stormGroup.visible = false;
  root.add(stormGroup);

  const fog = scene.fog instanceof Fog ? scene.fog : null;

  return {
    root,
    syncFromWorld: (worldState, frameDt) => {
      for (let i = 0; i < waterPositions.length; i += 3) {
        const baseX = baseWaterHeights[i] ?? 0;
        const baseZ = baseWaterHeights[i + 2] ?? 0;
        const waveA = Math.sin(baseX * 0.06 + worldState.time * 1.24) * 0.17;
        const waveB = Math.cos(baseZ * 0.05 + worldState.time * 0.92) * 0.14;
        waterPositions[i + 1] = waveA + waveB;
      }
      positionAttribute.needsUpdate = true;

      shallowRing.rotation.z = worldState.time * 0.025;

      const seenIslands = new Set<number>();
      for (const island of worldState.islands) {
        let islandMesh = islandMeshes.get(island.id);
        if (!islandMesh) {
          islandMesh = createIslandMesh(island);
          islandMeshes.set(island.id, islandMesh);
          islandsRoot.add(islandMesh);
        }
        islandMesh.position.set(island.position.x, 0, island.position.z);
        seenIslands.add(island.id);
      }

      for (const [id, islandMesh] of islandMeshes.entries()) {
        if (seenIslands.has(id)) {
          continue;
        }
        islandsRoot.remove(islandMesh);
        disposeGroup(islandMesh);
        islandMeshes.delete(id);
      }

      if (worldState.treasureObjective.active) {
        treasureBeacon.visible = true;
        treasureBeacon.position.set(worldState.treasureObjective.markerPosition.x, 0, worldState.treasureObjective.markerPosition.z);

        const pulse = 0.72 + Math.sin(worldState.time * 2.7) * 0.14;
        treasureBeam.scale.set(1, pulse, 1);
        treasureBeamMaterial.opacity = 0.32 + Math.sin(worldState.time * 2.2) * 0.08;
        treasureRing.rotation.z += frameDt * 1.6;
      } else {
        treasureBeacon.visible = false;
      }

      if (worldState.storm.active) {
        stormGroup.visible = true;
        stormGroup.position.set(worldState.storm.center.x, 0, worldState.storm.center.z);
        stormGroup.scale.set(worldState.storm.radius, 1, worldState.storm.radius);

        const intensity = clamp(worldState.storm.intensity, 0, 1);
        stormDiskMaterial.opacity = 0.13 + intensity * 0.2;
        stormRimMaterial.opacity = 0.3 + intensity * 0.24;
        stormRimMaterial.emissiveIntensity = 0.14 + intensity * 0.2;
        stormClouds.rotation.y += frameDt * (0.34 + intensity * 0.32);
        stormRim.rotation.z -= frameDt * 0.8;
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
      const stormBlend = clamp(stormProximity * worldState.storm.intensity, 0, 1);

      workingColor.copy(calmWaterColor).lerp(stormWaterColor, stormBlend);
      waterMaterial.color.copy(workingColor);
      waterMaterial.emissiveIntensity = 0.02 + Math.sin(worldState.time * 1.8) * 0.01 + stormBlend * 0.02;
      shallowRingMaterial.opacity = 0.45 - stormBlend * 0.12;

      if (fog) {
        workingColor.copy(calmFogColor).lerp(stormFogColor, stormBlend);
        fog.color.copy(workingColor);
        fog.near = 70 - stormBlend * 18;
        fog.far = 190 - stormBlend * 86;
      }

      if (scene.background instanceof Color) {
        workingColor.copy(calmBackground).lerp(stormBackground, stormBlend * 0.8);
        scene.background.copy(workingColor);
      }
    }
  };
}
