import {
  CircleGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  Vector3
} from "three";

export interface EnvironmentObjects {
  root: Group;
  update: (time: number) => void;
}

function createIsland(position: Vector3, scale: number): Group {
  const island = new Group();

  const rock = new Mesh(
    new ConeGeometry(5 * scale, 2.8 * scale, 8),
    new MeshStandardMaterial({
      color: "#658765",
      flatShading: true,
      roughness: 0.96
    })
  );
  rock.rotation.y = Math.PI * 0.2;
  rock.position.y = 1.35 * scale;
  island.add(rock);

  const sand = new Mesh(
    new CircleGeometry(5.5 * scale, 14),
    new MeshStandardMaterial({
      color: "#ddb777",
      flatShading: true,
      roughness: 0.9,
      side: DoubleSide
    })
  );
  sand.rotation.x = -Math.PI * 0.5;
  sand.position.y = 0.08 * scale;
  island.add(sand);

  island.position.copy(position);
  return island;
}

export function createEnvironment(scene: Scene): EnvironmentObjects {
  const root = new Group();
  scene.add(root);

  const waterGeometry = new PlaneGeometry(260, 260, 56, 56);
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

  const water = new Mesh(
    waterGeometry,
    new MeshStandardMaterial({
      color: new Color("#1d6d9f"),
      flatShading: true,
      roughness: 0.3,
      metalness: 0.02
    })
  );
  water.position.y = 0;
  root.add(water);

  const shallowRing = new Mesh(
    new CircleGeometry(42, 24),
    new MeshStandardMaterial({
      color: "#3f95bb",
      transparent: true,
      opacity: 0.45,
      roughness: 0.2
    })
  );
  shallowRing.rotation.x = -Math.PI * 0.5;
  shallowRing.position.y = 0.04;
  root.add(shallowRing);

  const islands = new Group();
  islands.add(createIsland(new Vector3(0, 0, 48), 1.2));
  islands.add(createIsland(new Vector3(-34, 0, -6), 0.85));
  islands.add(createIsland(new Vector3(38, 0, -42), 1.1));
  root.add(islands);

  return {
    root,
    update: (time) => {
      for (let i = 0; i < waterPositions.length; i += 3) {
        const baseX = baseWaterHeights[i] ?? 0;
        const baseZ = baseWaterHeights[i + 2] ?? 0;
        waterPositions[i + 1] = Math.sin(baseX * 0.06 + time * 1.2) * 0.16 + Math.cos(baseZ * 0.05 + time * 0.9) * 0.13;
      }
      positionAttribute.needsUpdate = true;
      waterGeometry.computeVertexNormals();

      shallowRing.rotation.z = time * 0.02;
    }
  };
}
