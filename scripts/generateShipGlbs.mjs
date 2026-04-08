import { promises as fs } from "node:fs";
import path from "node:path";
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry
} from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

const OUTPUT_DIR = path.resolve(process.cwd(), "public/assets/ships");

class NodeFileReader {
  constructor() {
    this.result = null;
    this.onloadend = null;
  }

  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }

  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      const mime = blob.type || "application/octet-stream";
      this.result = `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`;
      this.onloadend?.();
    });
  }
}

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = NodeFileReader;
}

function enableShadows(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createMaterials(palette) {
  return {
    wood: new MeshStandardMaterial({
      name: `${palette.id}-wood`,
      color: palette.hull,
      roughness: 0.82,
      metalness: 0.05,
      flatShading: true
    }),
    sail: new MeshStandardMaterial({
      name: `${palette.id}-sail`,
      color: palette.sail,
      roughness: 0.78,
      metalness: 0,
      side: DoubleSide,
      flatShading: false,
      emissive: palette.sail,
      emissiveIntensity: 0.06
    }),
    accent: new MeshStandardMaterial({
      name: `${palette.id}-accent`,
      color: palette.accent,
      roughness: 0.45,
      metalness: 0.18,
      flatShading: true
    })
  };
}

function addCannonAnchors(presentation, config) {
  const halfSpan = ((config.cannonsPerSide - 1) * config.cannonSpacing) * 0.5;
  const y = config.hullHeight * 0.72 + 0.14;

  for (let i = 0; i < config.cannonsPerSide; i += 1) {
    const z = -halfSpan + i * config.cannonSpacing;

    const leftAnchor = new Object3D();
    leftAnchor.name = `anchor-cannon-left-${i}`;
    leftAnchor.position.set(-config.hullWidth * 0.58, y, z);
    presentation.add(leftAnchor);

    const rightAnchor = new Object3D();
    rightAnchor.name = `anchor-cannon-right-${i}`;
    rightAnchor.position.set(config.hullWidth * 0.58, y, z);
    presentation.add(rightAnchor);
  }
}

function addCannons(presentation, materials, config) {
  const halfSpan = ((config.cannonsPerSide - 1) * config.cannonSpacing) * 0.5;
  const y = config.hullHeight * 0.72 + 0.14;
  for (let i = 0; i < config.cannonsPerSide; i += 1) {
    const z = -halfSpan + i * config.cannonSpacing;

    const left = enableShadows(new Mesh(new CylinderGeometry(0.11, 0.12, 0.78, 8), materials.accent));
    left.name = `ship-cannon-left-${i}`;
    left.rotation.z = Math.PI * 0.5;
    left.position.set(-config.hullWidth * 0.54, y, z);
    presentation.add(left);

    const right = enableShadows(new Mesh(new CylinderGeometry(0.11, 0.12, 0.78, 8), materials.accent));
    right.name = `ship-cannon-right-${i}`;
    right.rotation.z = Math.PI * 0.5;
    right.position.set(config.hullWidth * 0.54, y, z);
    presentation.add(right);
  }
}

function addSails(presentation, materials, config) {
  const main = new Mesh(new PlaneGeometry(config.sailWidth, config.sailHeight), materials.sail);
  main.name = "ship-sail-main";
  main.position.set(0, config.sailY, config.sailZ);
  main.rotation.y = config.sailYaw;
  main.castShadow = false;
  main.receiveShadow = false;
  presentation.add(main);

  if (config.secondSail) {
    const fore = new Mesh(new PlaneGeometry(config.secondSail.width, config.secondSail.height), materials.sail);
    fore.name = "ship-sail-fore";
    fore.position.set(0, config.secondSail.y, config.secondSail.z);
    fore.rotation.y = config.secondSail.yaw;
    fore.castShadow = false;
    fore.receiveShadow = false;
    presentation.add(fore);
  }
}

function createShipModel(config) {
  const root = new Group();
  root.name = "ship_root";

  const presentation = new Group();
  presentation.name = "ship-presentation";
  root.add(presentation);

  const materials = createMaterials(config.palette);

  const hull = enableShadows(new Mesh(new BoxGeometry(config.hullWidth, config.hullHeight, config.hullLength), materials.wood));
  hull.name = "ship-hull";
  hull.position.y = config.hullHeight * 0.54;
  presentation.add(hull);

  const bow = enableShadows(new Mesh(new ConeGeometry(config.hullWidth * config.bowRadius, config.bowLength, 10), materials.wood));
  bow.name = "ship-bow";
  bow.rotation.x = Math.PI * 0.5;
  bow.rotation.z = Math.PI;
  bow.position.set(0, config.hullHeight * 0.55, config.hullLength * 0.5 + config.bowLength * 0.36);
  presentation.add(bow);

  const stern = enableShadows(new Mesh(new ConeGeometry(config.hullWidth * 0.28, config.sternLength, 8), materials.wood));
  stern.name = "ship-stern";
  stern.rotation.x = Math.PI * 0.5;
  stern.position.set(0, config.hullHeight * 0.52, -config.hullLength * 0.5 - config.sternLength * 0.28);
  presentation.add(stern);

  const keel = enableShadows(new Mesh(new CylinderGeometry(config.hullWidth * 0.3, config.hullWidth * 0.34, config.hullLength * 0.88, 10), materials.wood));
  keel.name = "ship-keel";
  keel.rotation.x = Math.PI * 0.5;
  keel.position.y = config.hullHeight * 0.32;
  presentation.add(keel);

  const deck = enableShadows(new Mesh(new BoxGeometry(config.deckWidth, config.deckHeight, config.deckLength), materials.wood));
  deck.name = "ship-deck";
  deck.position.set(0, config.hullHeight * 1.08, config.deckZ);
  presentation.add(deck);

  if (config.cabin) {
    const cabin = enableShadows(new Mesh(new BoxGeometry(config.cabin.width, config.cabin.height, config.cabin.length), materials.accent));
    cabin.name = "ship-cabin";
    cabin.position.set(0, config.cabin.y, config.cabin.z);
    presentation.add(cabin);
  }

  const mast = enableShadows(new Mesh(new CylinderGeometry(config.mastRadius * 0.88, config.mastRadius * 1.05, config.mastHeight, 8), materials.wood));
  mast.name = "ship-mast";
  mast.position.set(0, config.mastY, config.mastZ);
  presentation.add(mast);

  if (config.secondMast) {
    const secondMast = enableShadows(new Mesh(new CylinderGeometry(config.secondMast.radius * 0.88, config.secondMast.radius * 1.05, config.secondMast.height, 8), materials.wood));
    secondMast.name = "ship-mast-fore";
    secondMast.position.set(0, config.secondMast.y, config.secondMast.z);
    presentation.add(secondMast);
  }

  addSails(presentation, materials, config);

  const flag = enableShadows(new Mesh(new PlaneGeometry(config.flagWidth, config.flagHeight), materials.accent));
  flag.name = "ship-flag";
  flag.position.set(config.flagX, config.flagY, config.flagZ);
  flag.rotation.y = config.flagYaw;
  flag.castShadow = false;
  flag.receiveShadow = false;
  presentation.add(flag);

  addCannons(presentation, materials, config);
  addCannonAnchors(presentation, config);

  const wakeAnchor = new Object3D();
  wakeAnchor.name = "anchor-wake-stern";
  wakeAnchor.position.set(0, 0.04, -config.hullLength * 0.58);
  presentation.add(wakeAnchor);

  const bowFin = enableShadows(new Mesh(newSphereOrCone(config), materials.accent));
  bowFin.name = "ship-bow-fin";
  bowFin.position.set(0, config.hullHeight * 0.78, config.hullLength * 0.56);
  presentation.add(bowFin);

  return root;
}

function newSphereOrCone(config) {
  if (config.id === "enemy_raider_v2") {
    const geo = new ConeGeometry(config.hullWidth * 0.12, config.hullHeight * 0.65, 6);
    geo.rotateX(Math.PI * 0.5);
    return geo;
  }
  return new SphereGeometry(config.hullWidth * 0.12, 8, 8);
}

function exportGlb(root, outPath) {
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      root,
      async (result) => {
        if (!(result instanceof ArrayBuffer)) {
          reject(new Error("Expected ArrayBuffer GLB export."));
          return;
        }

        try {
          await fs.writeFile(outPath, Buffer.from(result));
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      (error) => reject(error),
      {
        binary: true,
        onlyVisible: true,
        trs: false
      }
    );
  });
}

const SHIP_CONFIGS = [
  {
    id: "player_v2",
    palette: {
      id: "player",
      hull: "#855128",
      sail: "#efe5c7",
      accent: "#d7a84f"
    },
    hullWidth: 2.95,
    hullHeight: 0.96,
    hullLength: 6.8,
    bowRadius: 0.33,
    bowLength: 1.65,
    sternLength: 1.25,
    deckWidth: 2.2,
    deckHeight: 0.34,
    deckLength: 3.7,
    deckZ: 0.52,
    mastRadius: 0.13,
    mastHeight: 3.6,
    mastY: 2.6,
    mastZ: 0.5,
    secondMast: null,
    sailWidth: 2.25,
    sailHeight: 1.9,
    sailY: 2.58,
    sailZ: 0.58,
    sailYaw: 0,
    secondSail: null,
    cannonsPerSide: 3,
    cannonSpacing: 1.56,
    cabin: {
      width: 1.5,
      height: 0.4,
      length: 1.25,
      y: 1.38,
      z: -1.42
    },
    flagWidth: 0.7,
    flagHeight: 0.3,
    flagX: 0.16,
    flagY: 4.28,
    flagZ: 0.56,
    flagYaw: -Math.PI * 0.15
  },
  {
    id: "enemy_raider_v2",
    palette: {
      id: "raider",
      hull: "#4d2f27",
      sail: "#c4b89a",
      accent: "#a2453d"
    },
    hullWidth: 2.55,
    hullHeight: 0.86,
    hullLength: 6.0,
    bowRadius: 0.28,
    bowLength: 1.75,
    sternLength: 1.1,
    deckWidth: 1.9,
    deckHeight: 0.3,
    deckLength: 3.15,
    deckZ: 0.42,
    mastRadius: 0.12,
    mastHeight: 3.2,
    mastY: 2.28,
    mastZ: 0.36,
    secondMast: null,
    sailWidth: 1.95,
    sailHeight: 1.7,
    sailY: 2.35,
    sailZ: 0.36,
    sailYaw: Math.PI * 0.08,
    secondSail: null,
    cannonsPerSide: 3,
    cannonSpacing: 1.46,
    cabin: {
      width: 1.26,
      height: 0.35,
      length: 1.05,
      y: 1.26,
      z: -1.26
    },
    flagWidth: 0.62,
    flagHeight: 0.26,
    flagX: 0.15,
    flagY: 3.72,
    flagZ: 0.38,
    flagYaw: Math.PI * 0.18
  },
  {
    id: "enemy_navy_v2",
    palette: {
      id: "navy",
      hull: "#36516f",
      sail: "#dce7f1",
      accent: "#b6423f"
    },
    hullWidth: 3.2,
    hullHeight: 1.08,
    hullLength: 7.4,
    bowRadius: 0.31,
    bowLength: 1.9,
    sternLength: 1.45,
    deckWidth: 2.5,
    deckHeight: 0.36,
    deckLength: 4.1,
    deckZ: 0.58,
    mastRadius: 0.14,
    mastHeight: 3.95,
    mastY: 2.9,
    mastZ: 0.52,
    secondMast: {
      radius: 0.11,
      height: 3.1,
      y: 2.35,
      z: -1.48
    },
    sailWidth: 2.35,
    sailHeight: 2.05,
    sailY: 2.98,
    sailZ: 0.52,
    sailYaw: 0,
    secondSail: {
      width: 1.7,
      height: 1.45,
      y: 2.58,
      z: -1.52,
      yaw: 0
    },
    cannonsPerSide: 4,
    cannonSpacing: 1.48,
    cabin: {
      width: 1.78,
      height: 0.48,
      length: 1.42,
      y: 1.56,
      z: -1.86
    },
    flagWidth: 0.78,
    flagHeight: 0.32,
    flagX: 0.18,
    flagY: 4.68,
    flagZ: 0.52,
    flagYaw: Math.PI * 0.16
  }
];

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const config of SHIP_CONFIGS) {
    const root = createShipModel(config);
    const outPath = path.join(OUTPUT_DIR, `${config.id}.glb`);
    await exportGlb(root, outPath);
    console.log(`[ship-assets] wrote ${outPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
