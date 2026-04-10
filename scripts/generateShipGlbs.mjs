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

const COMPLEXITY_TARGETS = {
  player_v2: { minTriangles: 950, minNodes: 32, maxMaterials: 3 },
  enemy_raider_v2: { minTriangles: 750, minNodes: 30, maxMaterials: 3 },
  enemy_navy_v2: { minTriangles: 1200, minNodes: 38, maxMaterials: 3 }
};

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
      roughness: 0.76,
      metalness: 0.04,
      flatShading: true
    }),
    sail: new MeshStandardMaterial({
      name: `${palette.id}-sail`,
      color: palette.sail,
      roughness: 0.78,
      metalness: 0.01,
      side: DoubleSide,
      flatShading: false,
      emissive: palette.sail,
      emissiveIntensity: palette.id === "player" ? 0.08 : 0.05
    }),
    accent: new MeshStandardMaterial({
      name: `${palette.id}-accent`,
      color: palette.accent,
      roughness: 0.46,
      metalness: 0.16,
      flatShading: true
    })
  };
}

function addHullStructure(presentation, materials, config) {
  const hullBodyLength = config.hullLength * 0.9;
  const halfBody = hullBodyLength * 0.5;

  const hullCore = enableShadows(
    new Mesh(new CylinderGeometry(config.hullBeam * 0.28, config.hullBeam * 0.36, hullBodyLength, 24, 8), materials.wood)
  );
  hullCore.name = "ship-hull";
  hullCore.rotation.x = Math.PI * 0.5;
  hullCore.scale.y = Math.max(0.5, config.hullDepthScale * 0.72);
  hullCore.position.y = config.hullCenterY - config.hullSideHeight * 0.24;
  presentation.add(hullCore);

  const hullMid = enableShadows(
    new Mesh(new BoxGeometry(config.hullBeam * 0.76, config.hullSideHeight * 0.54, config.hullLength * 0.8, 4, 2, 8), materials.wood)
  );
  hullMid.name = "ship-hull-mid";
  hullMid.position.y = config.hullCenterY + config.hullSideHeight * 0.08;
  presentation.add(hullMid);

  const hullSideLeft = enableShadows(
    new Mesh(new BoxGeometry(config.hullBeam * 0.18, config.hullSideHeight * 1.06, config.hullLength * 0.82, 2, 2, 8), materials.wood)
  );
  hullSideLeft.name = "ship-hull-side-left";
  hullSideLeft.position.set(-config.hullBeam * 0.37, config.hullChineY - config.hullSideHeight * 0.08, 0);
  hullSideLeft.rotation.z = Math.PI * 0.17;
  presentation.add(hullSideLeft);

  const hullSideRight = enableShadows(
    new Mesh(new BoxGeometry(config.hullBeam * 0.18, config.hullSideHeight * 1.06, config.hullLength * 0.82, 2, 2, 8), materials.wood)
  );
  hullSideRight.name = "ship-hull-side-right";
  hullSideRight.position.set(config.hullBeam * 0.37, config.hullChineY - config.hullSideHeight * 0.08, 0);
  hullSideRight.rotation.z = -Math.PI * 0.17;
  presentation.add(hullSideRight);

  const upperHull = enableShadows(
    new Mesh(new BoxGeometry(config.hullBeam * 0.72, config.hullSideHeight * 0.44, config.hullLength * 0.78, 3, 2, 7), materials.wood)
  );
  upperHull.name = "ship-hull-upper";
  upperHull.position.y = config.hullChineY + config.hullSideHeight * 0.18;
  presentation.add(upperHull);

  const gunwaleLeft = enableShadows(new Mesh(new BoxGeometry(0.09, 0.09, config.hullLength * 0.82, 1, 1, 10), materials.wood));
  gunwaleLeft.name = "ship-gunwale-left";
  gunwaleLeft.position.set(-config.hullBeam * 0.44, config.hullChineY + config.hullSideHeight * 0.44, 0);
  presentation.add(gunwaleLeft);

  const gunwaleRight = enableShadows(new Mesh(new BoxGeometry(0.09, 0.09, config.hullLength * 0.82, 1, 1, 10), materials.wood));
  gunwaleRight.name = "ship-gunwale-right";
  gunwaleRight.position.set(config.hullBeam * 0.44, config.hullChineY + config.hullSideHeight * 0.44, 0);
  presentation.add(gunwaleRight);

  const bow = enableShadows(new Mesh(new ConeGeometry(config.hullBeam * config.bowRadius * 0.84, config.bowLength * 0.78, 18), materials.wood));
  bow.name = "ship-bow";
  bow.rotation.x = Math.PI * 0.5;
  bow.position.set(0, config.hullCenterY + config.hullSideHeight * 0.12, halfBody + config.bowLength * 0.12);
  presentation.add(bow);

  const bowCheekLeft = enableShadows(new Mesh(new BoxGeometry(config.hullBeam * 0.18, config.hullSideHeight * 0.64, config.bowLength * 0.62), materials.wood));
  bowCheekLeft.name = "ship-bow-cheek-left";
  bowCheekLeft.position.set(-config.hullBeam * 0.2, config.hullCenterY + config.hullSideHeight * 0.3, halfBody - config.bowLength * 0.16);
  bowCheekLeft.rotation.y = -Math.PI * 0.1;
  presentation.add(bowCheekLeft);

  const bowCheekRight = enableShadows(new Mesh(new BoxGeometry(config.hullBeam * 0.18, config.hullSideHeight * 0.64, config.bowLength * 0.62), materials.wood));
  bowCheekRight.name = "ship-bow-cheek-right";
  bowCheekRight.position.set(config.hullBeam * 0.2, config.hullCenterY + config.hullSideHeight * 0.3, halfBody - config.bowLength * 0.16);
  bowCheekRight.rotation.y = Math.PI * 0.1;
  presentation.add(bowCheekRight);

  const sternTransom = enableShadows(new Mesh(new BoxGeometry(config.hullBeam * 0.58, config.sternHeight, config.sternDepth * 0.46, 3, 2, 2), materials.wood));
  sternTransom.name = "ship-stern-transom";
  sternTransom.position.set(0, config.hullChineY + config.hullSideHeight * 0.3, -halfBody + config.sternDepth * 0.04);
  presentation.add(sternTransom);

  const sternQuarterLeft = enableShadows(new Mesh(new BoxGeometry(config.hullBeam * 0.14, config.sternHeight * 0.82, config.sternDepth * 0.62), materials.wood));
  sternQuarterLeft.name = "ship-stern-quarter-left";
  sternQuarterLeft.position.set(-config.hullBeam * 0.25, config.hullCenterY + config.hullSideHeight * 0.22, -halfBody + config.sternDepth * 0.02);
  sternQuarterLeft.rotation.y = -Math.PI * 0.12;
  presentation.add(sternQuarterLeft);

  const sternQuarterRight = enableShadows(new Mesh(new BoxGeometry(config.hullBeam * 0.14, config.sternHeight * 0.82, config.sternDepth * 0.62), materials.wood));
  sternQuarterRight.name = "ship-stern-quarter-right";
  sternQuarterRight.position.set(config.hullBeam * 0.25, config.hullCenterY + config.hullSideHeight * 0.22, -halfBody + config.sternDepth * 0.02);
  sternQuarterRight.rotation.y = Math.PI * 0.12;
  presentation.add(sternQuarterRight);

  const sternCap = enableShadows(new Mesh(new ConeGeometry(config.hullBeam * 0.24, config.sternDepth * 0.54, 14), materials.wood));
  sternCap.name = "ship-stern";
  sternCap.rotation.x = Math.PI * 0.5;
  sternCap.rotation.z = Math.PI;
  sternCap.position.set(0, config.hullCenterY + config.hullSideHeight * 0.08, -halfBody - config.sternDepth * 0.02);
  presentation.add(sternCap);

  const keel = enableShadows(new Mesh(new BoxGeometry(config.hullBeam * 0.24, config.keelHeight, hullBodyLength * 0.82), materials.wood));
  keel.name = "ship-keel";
  keel.position.set(0, -config.keelHeight * 0.34, 0);
  presentation.add(keel);

  const bowsprit = enableShadows(new Mesh(new CylinderGeometry(config.mastRadius * 0.42, config.mastRadius * 0.5, config.bowLength * 0.76, 8, 2), materials.wood));
  bowsprit.name = "ship-bowsprit";
  bowsprit.rotation.x = Math.PI * 0.5;
  bowsprit.position.set(0, config.deckY + config.deckHeight * 0.3, halfBody + config.bowLength * 0.24);
  presentation.add(bowsprit);

  const bowDetail = enableShadows(new Mesh(new SphereGeometry(config.hullBeam * 0.05, 9, 7), materials.accent));
  bowDetail.name = "ship-bow-detail";
  bowDetail.position.set(0, config.deckY + config.deckHeight * 0.28, halfBody + config.bowLength * 0.46);
  presentation.add(bowDetail);
}

function addDeckStructure(presentation, materials, config) {
  const deck = enableShadows(new Mesh(new BoxGeometry(config.deckWidth, config.deckHeight, config.deckLength, 4, 1, 8), materials.accent));
  deck.name = "ship-deck";
  deck.position.set(0, config.deckY, config.deckZ);
  presentation.add(deck);

  const quarterDeck = enableShadows(
    new Mesh(new BoxGeometry(config.deckWidth * 0.74, config.deckHeight * 0.86, config.deckLength * 0.36, 3, 1, 4), materials.accent)
  );
  quarterDeck.name = "ship-quarterdeck";
  quarterDeck.position.set(0, config.deckY + config.deckHeight * 0.72, config.deckZ - config.deckLength * 0.3);
  presentation.add(quarterDeck);

  const sternGallery = enableShadows(
    new Mesh(new BoxGeometry(config.deckWidth * 0.58, config.deckHeight * 0.9, config.deckLength * 0.19, 3, 2, 2), materials.wood)
  );
  sternGallery.name = "ship-stern-gallery";
  sternGallery.position.set(0, config.deckY + config.deckHeight * 1.02, config.deckZ - config.deckLength * 0.44);
  presentation.add(sternGallery);

    if (config.forecastleLength > 0) {
      const forecastle = enableShadows(
      new Mesh(new BoxGeometry(config.deckWidth * 0.66, config.deckHeight * 0.8, config.forecastleLength, 3, 1, 3), materials.accent)
      );
      forecastle.name = "ship-forecastle";
      forecastle.position.set(0, config.deckY + config.deckHeight * 0.56, config.deckZ + config.deckLength * 0.26);
      presentation.add(forecastle);
  }

    if (config.cabinLength > 0) {
      const cabin = enableShadows(
      new Mesh(new BoxGeometry(config.deckWidth * 0.48, config.deckHeight * 1.08, config.cabinLength, 3, 2, 2), materials.wood)
      );
      cabin.name = "ship-cabin";
      cabin.position.set(0, config.deckY + config.deckHeight * 0.86, config.deckZ - config.deckLength * 0.12);
      presentation.add(cabin);
  }

  for (let i = 0; i < config.deckPlanks; i += 1) {
    const t = i / Math.max(1, config.deckPlanks - 1);
    const z = config.deckZ - config.deckLength * 0.42 + t * config.deckLength * 0.84;
    const plank = enableShadows(new Mesh(new BoxGeometry(config.deckWidth * 0.86, 0.03, 0.09), materials.wood));
    plank.name = `ship-deck-plank-${i}`;
    plank.position.set(0, config.deckY + config.deckHeight * 0.54, z);
    presentation.add(plank);
  }

  const trimLeft = enableShadows(new Mesh(new BoxGeometry(config.deckWidth * 0.94, 0.05, 0.08), materials.wood));
  trimLeft.name = "ship-trim-left";
  trimLeft.rotation.y = Math.PI * 0.5;
  trimLeft.position.set(-config.deckWidth * 0.44, config.deckY + config.deckHeight * 0.56, config.deckZ);
  presentation.add(trimLeft);

  const trimRight = enableShadows(new Mesh(new BoxGeometry(config.deckWidth * 0.94, 0.05, 0.08), materials.wood));
  trimRight.name = "ship-trim-right";
  trimRight.rotation.y = Math.PI * 0.5;
  trimRight.position.set(config.deckWidth * 0.44, config.deckY + config.deckHeight * 0.56, config.deckZ);
  presentation.add(trimRight);
}

function addRailings(presentation, materials, config) {
  const span = config.deckLength * 0.9;
  const topY = config.deckY + config.deckHeight * 0.8;

  const leftRail = enableShadows(new Mesh(new BoxGeometry(0.09, 0.08, span, 1, 1, 10), materials.wood));
  leftRail.name = "ship-rail-left";
  leftRail.position.set(-config.deckWidth * 0.5, topY, config.deckZ);
  presentation.add(leftRail);

  const rightRail = enableShadows(new Mesh(new BoxGeometry(0.09, 0.08, span, 1, 1, 10), materials.wood));
  rightRail.name = "ship-rail-right";
  rightRail.position.set(config.deckWidth * 0.5, topY, config.deckZ);
  presentation.add(rightRail);

  for (let i = 0; i < config.railPostCount; i += 1) {
    const t = i / Math.max(1, config.railPostCount - 1);
    const z = config.deckZ - span * 0.5 + t * span;
    const leftPost = enableShadows(new Mesh(new BoxGeometry(0.05, 0.24, 0.06), materials.wood));
    leftPost.name = `ship-rail-post-left-${i}`;
    leftPost.position.set(-config.deckWidth * 0.51, topY - 0.14, z);
    presentation.add(leftPost);

    const rightPost = enableShadows(new Mesh(new BoxGeometry(0.05, 0.24, 0.06), materials.wood));
    rightPost.name = `ship-rail-post-right-${i}`;
    rightPost.position.set(config.deckWidth * 0.51, topY - 0.14, z);
    presentation.add(rightPost);
  }
}

function addRigLine(presentation, materials, name, length, radius, x, y, z, rotX, rotZ) {
  const line = enableShadows(new Mesh(new CylinderGeometry(radius, radius, length, 6), materials.wood));
  line.name = name;
  line.position.set(x, y, z);
  line.rotation.x = rotX;
  line.rotation.z = rotZ;
  presentation.add(line);
}

function addSail(presentation, materials, name, width, height, y, z, yaw, segX, segY) {
  const sail = new Mesh(new PlaneGeometry(width, height, segX, segY), materials.sail);
  sail.name = name;
  sail.position.set(0, y, z);
  sail.rotation.y = yaw;
  sail.castShadow = false;
  sail.receiveShadow = false;
  presentation.add(sail);
}

function addMastsAndSails(presentation, materials, config) {
  const mast = enableShadows(
    new Mesh(new CylinderGeometry(config.mastRadius * 0.9, config.mastRadius * 1.06, config.mastHeight, 10, 5), materials.wood)
  );
  mast.name = "ship-mast";
  mast.position.set(0, config.mastY, config.mastZ);
  mast.rotation.x = config.mastTiltX;
  presentation.add(mast);

  const yardMain = enableShadows(
    new Mesh(new CylinderGeometry(config.mastRadius * 0.2, config.mastRadius * 0.2, config.sailWidth * 1.2, 8, 2), materials.wood)
  );
  yardMain.name = "ship-rig-yard-main";
  yardMain.rotation.z = Math.PI * 0.5;
  yardMain.position.set(0, config.sailY + config.sailHeight * 0.33, config.sailZ);
  presentation.add(yardMain);

  addSail(
    presentation,
    materials,
    "ship-sail-main",
    config.sailWidth,
    config.sailHeight,
    config.sailY,
    config.sailZ,
    config.sailYaw,
    config.sailSegX,
    config.sailSegY
  );

  addRigLine(
    presentation,
    materials,
    "ship-rig-shroud-left",
    config.mastHeight * 0.86,
    config.mastRadius * 0.22,
    -config.hullBeam * 0.31,
    config.mastY + config.mastHeight * 0.08,
    config.mastZ + 0.04,
    0,
    Math.PI * 0.15
  );
  addRigLine(
    presentation,
    materials,
    "ship-rig-shroud-right",
    config.mastHeight * 0.86,
    config.mastRadius * 0.22,
    config.hullBeam * 0.31,
    config.mastY + config.mastHeight * 0.08,
    config.mastZ + 0.04,
    0,
    -Math.PI * 0.15
  );
  addRigLine(
    presentation,
    materials,
    "ship-rig-stay-fore",
    config.hullLength * 0.56,
    config.mastRadius * 0.18,
    0,
    config.mastY + config.mastHeight * 0.16,
    config.hullLength * 0.14,
    -Math.PI * 0.22,
    0
  );
  addRigLine(
    presentation,
    materials,
    "ship-rig-stay-aft",
    config.hullLength * 0.44,
    config.mastRadius * 0.18,
    0,
    config.mastY + config.mastHeight * 0.08,
    -config.hullLength * 0.14,
    Math.PI * 0.17,
    0
  );

  if (config.foreSail) {
    if (config.foreSail.mastHeight > 0) {
      const foreMast = enableShadows(
        new Mesh(
          new CylinderGeometry(config.foreSail.mastRadius * 0.9, config.foreSail.mastRadius * 1.05, config.foreSail.mastHeight, 9, 4),
          materials.wood
        )
      );
      foreMast.name = "ship-mast-fore";
      foreMast.position.set(0, config.foreSail.mastY, config.foreSail.z);
      foreMast.rotation.x = config.foreSail.mastTiltX;
      presentation.add(foreMast);
    }

    addSail(
      presentation,
      materials,
      "ship-sail-fore",
      config.foreSail.width,
      config.foreSail.height,
      config.foreSail.y,
      config.foreSail.z,
      config.foreSail.yaw,
      config.foreSail.segX,
      config.foreSail.segY
    );

    const yardFore = enableShadows(
      new Mesh(new CylinderGeometry(config.mastRadius * 0.16, config.mastRadius * 0.16, config.foreSail.width * 1.12, 7, 2), materials.wood)
    );
    yardFore.name = "ship-rig-yard-fore";
    yardFore.rotation.z = Math.PI * 0.5;
    yardFore.position.set(0, config.foreSail.y + config.foreSail.height * 0.32, config.foreSail.z);
    presentation.add(yardFore);

    addRigLine(
      presentation,
      materials,
      "ship-rig-fore-shroud-left",
      config.foreSail.mastHeight > 0 ? config.foreSail.mastHeight * 0.78 : config.foreSail.height,
      config.mastRadius * 0.15,
      -config.hullBeam * 0.24,
      config.foreSail.y,
      config.foreSail.z,
      0,
      Math.PI * 0.14
    );
    addRigLine(
      presentation,
      materials,
      "ship-rig-fore-shroud-right",
      config.foreSail.mastHeight > 0 ? config.foreSail.mastHeight * 0.78 : config.foreSail.height,
      config.mastRadius * 0.15,
      config.hullBeam * 0.24,
      config.foreSail.y,
      config.foreSail.z,
      0,
      -Math.PI * 0.14
    );
  }

  if (config.jibSail) {
    addSail(
      presentation,
      materials,
      "ship-sail-jib",
      config.jibSail.width,
      config.jibSail.height,
      config.jibSail.y,
      config.jibSail.z,
      config.jibSail.yaw,
      config.jibSail.segX,
      config.jibSail.segY
    );
    addRigLine(
      presentation,
      materials,
      "ship-rig-jib-stay",
      config.hullLength * 0.34,
      config.mastRadius * 0.13,
      0,
      config.jibSail.y,
      config.jibSail.z - config.hullLength * 0.08,
      -Math.PI * 0.28,
      0
    );
  }

  const pennant = new Mesh(new PlaneGeometry(config.flagWidth * 0.95, config.flagHeight * 0.44, 4, 2), materials.sail);
  pennant.name = "ship-rig-pennant-main";
  pennant.position.set(0.16, config.flagY - config.flagHeight * 0.3, config.flagZ + 0.04);
  pennant.rotation.y = config.flagYaw;
  pennant.castShadow = false;
  pennant.receiveShadow = false;
  presentation.add(pennant);
}

function addCannons(presentation, materials, config) {
  const halfSpan = ((config.cannonsPerSide - 1) * config.cannonSpacing) * 0.5;
  const y = config.deckY + config.deckHeight * 0.38;

  for (let i = 0; i < config.cannonsPerSide; i += 1) {
    const z = -halfSpan + i * config.cannonSpacing;

    const leftPort = enableShadows(new Mesh(new BoxGeometry(0.24, 0.18, 0.24), materials.wood));
    leftPort.name = `ship-cannon-housing-left-${i}`;
    leftPort.position.set(-config.hullBeam * 0.47, y - 0.03, z);
    presentation.add(leftPort);

    const rightPort = enableShadows(new Mesh(new BoxGeometry(0.24, 0.18, 0.24), materials.wood));
    rightPort.name = `ship-cannon-housing-right-${i}`;
    rightPort.position.set(config.hullBeam * 0.47, y - 0.03, z);
    presentation.add(rightPort);

    const leftBarrel = enableShadows(new Mesh(new CylinderGeometry(0.07, 0.08, 0.66, 10, 2), materials.accent));
    leftBarrel.name = `ship-cannon-left-${i}`;
    leftBarrel.rotation.z = Math.PI * 0.5;
    leftBarrel.position.set(-config.hullBeam * 0.58, y, z);
    presentation.add(leftBarrel);

    const rightBarrel = enableShadows(new Mesh(new CylinderGeometry(0.07, 0.08, 0.66, 10, 2), materials.accent));
    rightBarrel.name = `ship-cannon-right-${i}`;
    rightBarrel.rotation.z = Math.PI * 0.5;
    rightBarrel.position.set(config.hullBeam * 0.58, y, z);
    presentation.add(rightBarrel);

    const leftAnchor = new Object3D();
    leftAnchor.name = `anchor-cannon-left-${i}`;
    leftAnchor.position.set(-config.hullBeam * 0.58, y, z);
    presentation.add(leftAnchor);

    const rightAnchor = new Object3D();
    rightAnchor.name = `anchor-cannon-right-${i}`;
    rightAnchor.position.set(config.hullBeam * 0.58, y, z);
    presentation.add(rightAnchor);
  }
}

function createShipModel(config) {
  const root = new Group();
  root.name = "ship_root";

  const presentation = new Group();
  presentation.name = "ship-presentation";
  root.add(presentation);

  const materials = createMaterials(config.palette);

  addHullStructure(presentation, materials, config);
  addDeckStructure(presentation, materials, config);
  addRailings(presentation, materials, config);
  addMastsAndSails(presentation, materials, config);
  addCannons(presentation, materials, config);

  const flag = new Mesh(new PlaneGeometry(config.flagWidth, config.flagHeight, 4, 2), materials.accent);
  flag.name = "ship-flag";
  flag.position.set(config.flagX, config.flagY, config.flagZ);
  flag.rotation.y = config.flagYaw;
  flag.castShadow = false;
  flag.receiveShadow = false;
  presentation.add(flag);

  const wakeAnchor = new Object3D();
  wakeAnchor.name = "anchor-wake-stern";
  wakeAnchor.position.set(0, 0.05, -config.hullLength * 0.58);
  presentation.add(wakeAnchor);

  return root;
}

function countMeshTriangles(mesh) {
  const geometry = mesh.geometry;
  if (!geometry) {
    return 0;
  }

  if (geometry.index?.count) {
    return Math.floor(geometry.index.count / 3);
  }

  const positions = geometry.getAttribute("position");
  return positions ? Math.floor(positions.count / 3) : 0;
}

function collectComplexityMetrics(root) {
  let triangleCount = 0;
  let nodeCount = 0;
  const materialSet = new Set();

  root.traverse((obj) => {
    nodeCount += 1;
    if (!obj.isMesh) {
      return;
    }

    triangleCount += countMeshTriangles(obj);
    if (Array.isArray(obj.material)) {
      for (const material of obj.material) {
        materialSet.add(material);
      }
      return;
    }
    materialSet.add(obj.material);
  });

  return {
    triangleCount,
    nodeCount,
    materialCount: materialSet.size
  };
}

function validateComplexity(id, metrics) {
  const target = COMPLEXITY_TARGETS[id];
  if (!target) {
    return;
  }

  if (metrics.triangleCount < target.minTriangles) {
    throw new Error(`[ship-assets] ${id} triangle count ${metrics.triangleCount} below ${target.minTriangles}.`);
  }
  if (metrics.nodeCount < target.minNodes) {
    throw new Error(`[ship-assets] ${id} node count ${metrics.nodeCount} below ${target.minNodes}.`);
  }
  if (metrics.materialCount > target.maxMaterials) {
    throw new Error(`[ship-assets] ${id} material count ${metrics.materialCount} exceeds ${target.maxMaterials}.`);
  }
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
      hull: "#9a6f45",
      sail: "#f3ecd9",
      accent: "#c79a5d"
    },
    hullLength: 6.8,
    hullBeam: 2.86,
    hullDepthScale: 0.8,
    hullCenterY: 0.36,
    hullChineY: 0.8,
    hullSideHeight: 0.34,
    bowRadius: 0.3,
    bowLength: 1.5,
    sternDepth: 1.08,
    sternHeight: 0.42,
    keelHeight: 0.32,
    deckWidth: 2.08,
    deckHeight: 0.3,
    deckLength: 3.86,
    deckY: 1.04,
    deckZ: 0.28,
    forecastleLength: 1.04,
    cabinLength: 1.22,
    deckPlanks: 9,
    railPostCount: 12,
    mastRadius: 0.13,
    mastHeight: 3.58,
    mastY: 2.64,
    mastZ: 0.36,
    mastTiltX: -0.02,
    sailWidth: 2.34,
    sailHeight: 2.04,
    sailY: 2.56,
    sailZ: 0.38,
    sailYaw: 0,
    sailSegX: 7,
    sailSegY: 6,
    foreSail: {
      width: 1.36,
      height: 1.18,
      y: 2.3,
      z: 1.46,
      yaw: -Math.PI * 0.12,
      segX: 5,
      segY: 4,
      mastHeight: 0,
      mastRadius: 0,
      mastY: 0,
      mastTiltX: 0
    },
    jibSail: null,
    cannonsPerSide: 3,
    cannonSpacing: 1.48,
    flagWidth: 0.74,
    flagHeight: 0.32,
    flagX: 0.16,
    flagY: 4.28,
    flagZ: 0.6,
    flagYaw: -Math.PI * 0.14
  },
  {
    id: "enemy_raider_v2",
    palette: {
      id: "raider",
      hull: "#604036",
      sail: "#cab99f",
      accent: "#8f4b44"
    },
    hullLength: 6.38,
    hullBeam: 2.44,
    hullDepthScale: 0.74,
    hullCenterY: 0.32,
    hullChineY: 0.74,
    hullSideHeight: 0.32,
    bowRadius: 0.24,
    bowLength: 1.8,
    sternDepth: 0.96,
    sternHeight: 0.36,
    keelHeight: 0.3,
    deckWidth: 1.78,
    deckHeight: 0.28,
    deckLength: 3.42,
    deckY: 0.96,
    deckZ: 0.28,
    forecastleLength: 0.7,
    cabinLength: 0.86,
    deckPlanks: 8,
    railPostCount: 10,
    mastRadius: 0.12,
    mastHeight: 3.26,
    mastY: 2.34,
    mastZ: 0.3,
    mastTiltX: 0.06,
    sailWidth: 1.98,
    sailHeight: 1.76,
    sailY: 2.28,
    sailZ: 0.32,
    sailYaw: Math.PI * 0.1,
    sailSegX: 6,
    sailSegY: 5,
    foreSail: {
      width: 1.14,
      height: 0.98,
      y: 2.02,
      z: 1.32,
      yaw: -Math.PI * 0.2,
      segX: 4,
      segY: 3,
      mastHeight: 0,
      mastRadius: 0,
      mastY: 0,
      mastTiltX: 0
    },
    jibSail: null,
    cannonsPerSide: 3,
    cannonSpacing: 1.34,
    flagWidth: 0.62,
    flagHeight: 0.26,
    flagX: 0.13,
    flagY: 3.7,
    flagZ: 0.44,
    flagYaw: Math.PI * 0.18
  },
  {
    id: "enemy_navy_v2",
    palette: {
      id: "navy",
      hull: "#536f89",
      sail: "#e6eff7",
      accent: "#8f6f4e"
    },
    hullLength: 7.62,
    hullBeam: 3.34,
    hullDepthScale: 0.84,
    hullCenterY: 0.4,
    hullChineY: 0.9,
    hullSideHeight: 0.4,
    bowRadius: 0.3,
    bowLength: 1.78,
    sternDepth: 1.36,
    sternHeight: 0.56,
    keelHeight: 0.36,
    deckWidth: 2.48,
    deckHeight: 0.34,
    deckLength: 4.56,
    deckY: 1.16,
    deckZ: 0.24,
    forecastleLength: 1.34,
    cabinLength: 1.56,
    deckPlanks: 11,
    railPostCount: 16,
    mastRadius: 0.14,
    mastHeight: 4.02,
    mastY: 2.98,
    mastZ: 0.44,
    mastTiltX: -0.01,
    sailWidth: 2.56,
    sailHeight: 2.22,
    sailY: 3.0,
    sailZ: 0.44,
    sailYaw: 0,
    sailSegX: 8,
    sailSegY: 7,
    foreSail: {
      width: 1.9,
      height: 1.62,
      y: 2.58,
      z: -1.34,
      yaw: 0,
      segX: 6,
      segY: 5,
      mastHeight: 3.18,
      mastRadius: 0.11,
      mastY: 2.46,
      mastTiltX: 0.02
    },
    jibSail: {
      width: 1.34,
      height: 1.08,
      y: 2.22,
      z: 1.9,
      yaw: -Math.PI * 0.22,
      segX: 4,
      segY: 3
    },
    cannonsPerSide: 4,
    cannonSpacing: 1.42,
    flagWidth: 0.82,
    flagHeight: 0.34,
    flagX: 0.18,
    flagY: 4.74,
    flagZ: 0.56,
    flagYaw: Math.PI * 0.16
  }
];

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const config of SHIP_CONFIGS) {
    const root = createShipModel(config);
    const metrics = collectComplexityMetrics(root);
    validateComplexity(config.id, metrics);

    const outPath = path.join(OUTPUT_DIR, `${config.id}.glb`);
    await exportGlb(root, outPath);

    console.log(
      `[ship-assets] ${config.id}: tris=${metrics.triangleCount}, nodes=${metrics.nodeCount}, materials=${metrics.materialCount} -> ${outPath}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
