import {
  ClampToEdgeWrapping,
  Box3,
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  Group,
  LinearFilter,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RGBAFormat,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  UnsignedByteType,
  Vector3
} from "three";
import {
  getShipVisualContract,
  type ShipColliderProfileId,
  type ShipFallbackPolicy,
  type ShipMaterialProfileId,
  type ShipModelId,
  type ShipVisualRole
} from "../../ships/shipProfiles";
import { instantiateValidatedShipAsset, SHIP_NODE_NAMES } from "./shipAssetLoader";

export type { ShipVisualRole } from "../../ships/shipProfiles";

export type ShipClass = "small" | "medium" | "heavy";
export type ShipAssetSource = "procedural" | "gltf";
export type SailShape = "square" | "lateen";

export interface ShipSilhouette {
  hullLength: number;
  hullWidth: number;
  hullHeight: number;
  bowLength: number;
  sternLength: number;
  deckLength: number;
  deckWidth: number;
  mastHeight: number;
  mastRadius: number;
  sailWidth: number;
  sailHeight: number;
  sailOffsetY: number;
  sailOffsetZ: number;
  sailShape: SailShape;
  flagWidth: number;
  flagHeight: number;
  cannonMountsPerSide: number;
  cannonMountSpacing: number;
  cannonMountLength: number;
  cannonMountRadius: number;
}

export interface ShipPalette {
  hull: string;
  deck: string;
  mast: string;
  sail: string;
  accent: string;
  cannon: string;
}

export interface ShipDefinition {
  role: ShipVisualRole;
  shipClass: ShipClass;
  silhouette: ShipSilhouette;
  palette: ShipPalette;
  modelId: ShipModelId;
  materialProfileId: ShipMaterialProfileId;
  colliderProfileId: ShipColliderProfileId;
  fallbackPolicy: ShipFallbackPolicy;
  assetSource?: ShipAssetSource;
  assetId?: string;
}

export interface ShipFlashChannel {
  material: MeshStandardMaterial;
  baseEmissive: Color;
  baseEmissiveIntensity: number;
}

export interface ShipMuzzleFx {
  group: Group;
  flashMaterial: MeshStandardMaterial;
  smokeMaterial: MeshStandardMaterial;
}

export interface ShipSailVisual {
  mesh: Mesh;
  baseRotation: { x: number; y: number; z: number };
  basePosition: Vector3;
  baseScale: Vector3;
  phaseOffset: number;
}

export interface ShipRigVisual {
  mesh: Mesh;
  baseRotation: { x: number; y: number; z: number };
  basePosition: Vector3;
  baseScale: Vector3;
  phaseOffset: number;
  swayWeight: number;
}

export interface ShipVisual {
  group: Group;
  presentation: Group;
  definition: ShipDefinition;
  resolvedAssetSource: ShipAssetSource;
  materialCount: number;
  wakeSternOffset: number;
  sails: ShipSailVisual[];
  rigs: ShipRigVisual[];
  contactShadow: Mesh;
  contactShadowMaterial: MeshBasicMaterial;
  contactPatch: Mesh;
  contactPatchMaterial: MeshBasicMaterial;
  cannonMounts: {
    left: Vector3[];
    right: Vector3[];
  };
  wakeTrail: Mesh;
  wakeTrailMaterial: MeshStandardMaterial;
  wakeFoam: Mesh;
  wakeFoamMaterial: MeshStandardMaterial;
  wakeRibbonLeft: Mesh;
  wakeRibbonLeftMaterial: MeshStandardMaterial;
  wakeRibbonRight: Mesh;
  wakeRibbonRightMaterial: MeshStandardMaterial;
  wakeSpray: Mesh;
  wakeSprayMaterial: MeshStandardMaterial;
  muzzleLeft: ShipMuzzleFx;
  muzzleRight: ShipMuzzleFx;
  flashChannels: ShipFlashChannel[];
}

interface ShipClassPreset {
  hullLength: number;
  hullWidth: number;
  hullHeight: number;
  bowLength: number;
  sternLength: number;
  deckLength: number;
  deckWidth: number;
  mastHeight: number;
  mastRadius: number;
  sailWidth: number;
  sailHeight: number;
  sailOffsetY: number;
  sailOffsetZ: number;
  flagWidth: number;
  flagHeight: number;
  cannonMountsPerSide: number;
  cannonMountSpacing: number;
  cannonMountLength: number;
  cannonMountRadius: number;
}

interface RoleStyle {
  shipClass: ShipClass;
  sailShape: SailShape;
  palette: ShipPalette;
}

const SHIP_CLASS_PRESETS: Record<ShipClass, ShipClassPreset> = {
  small: {
    hullLength: 5.2,
    hullWidth: 2.4,
    hullHeight: 0.78,
    bowLength: 1.2,
    sternLength: 1.0,
    deckLength: 2.6,
    deckWidth: 1.7,
    mastHeight: 2.8,
    mastRadius: 0.11,
    sailWidth: 1.45,
    sailHeight: 1.32,
    sailOffsetY: 2.05,
    sailOffsetZ: 0.35,
    flagWidth: 0.62,
    flagHeight: 0.28,
    cannonMountsPerSide: 2,
    cannonMountSpacing: 1.65,
    cannonMountLength: 0.72,
    cannonMountRadius: 0.11
  },
  medium: {
    hullLength: 6.4,
    hullWidth: 3.0,
    hullHeight: 0.9,
    bowLength: 1.55,
    sternLength: 1.2,
    deckLength: 3.4,
    deckWidth: 2.2,
    mastHeight: 3.6,
    mastRadius: 0.13,
    sailWidth: 2.08,
    sailHeight: 1.82,
    sailOffsetY: 2.54,
    sailOffsetZ: 0.58,
    flagWidth: 0.72,
    flagHeight: 0.34,
    cannonMountsPerSide: 3,
    cannonMountSpacing: 1.56,
    cannonMountLength: 0.8,
    cannonMountRadius: 0.12
  },
  heavy: {
    hullLength: 7.8,
    hullWidth: 3.5,
    hullHeight: 1.08,
    bowLength: 1.9,
    sternLength: 1.55,
    deckLength: 4.35,
    deckWidth: 2.64,
    mastHeight: 4.22,
    mastRadius: 0.15,
    sailWidth: 2.58,
    sailHeight: 2.18,
    sailOffsetY: 3.0,
    sailOffsetZ: 0.72,
    flagWidth: 0.82,
    flagHeight: 0.38,
    cannonMountsPerSide: 4,
    cannonMountSpacing: 1.52,
    cannonMountLength: 0.9,
    cannonMountRadius: 0.13
  }
};

const ROLE_STYLES: Record<ShipVisualRole, RoleStyle> = {
  player: {
    shipClass: "medium",
    sailShape: "square",
    palette: {
      hull: "#7a4a24",
      deck: "#ead0a0",
      mast: "#674325",
      sail: "#f5edd2",
      accent: "#f2d07c",
      cannon: "#2f2f33"
    }
  },
  merchant: {
    shipClass: "small",
    sailShape: "lateen",
    palette: {
      hull: "#66543f",
      deck: "#d5b88a",
      mast: "#5b3d27",
      sail: "#ddd2b1",
      accent: "#6d8ca0",
      cannon: "#3d3d42"
    }
  },
  raider: {
    shipClass: "medium",
    sailShape: "lateen",
    palette: {
      hull: "#4a2b23",
      deck: "#b9986e",
      mast: "#523224",
      sail: "#c7b79a",
      accent: "#bf4c43",
      cannon: "#25272a"
    }
  },
  navy: {
    shipClass: "heavy",
    sailShape: "square",
    palette: {
      hull: "#35506f",
      deck: "#d2be96",
      mast: "#5f4630",
      sail: "#dee9f4",
      accent: "#b73c39",
      cannon: "#1f222b"
    }
  }
};

function createMaterial(
  color: string,
  options: Partial<Pick<MeshStandardMaterial, "roughness" | "metalness" | "emissiveIntensity">> = {}
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: options.roughness ?? 0.82,
    metalness: options.metalness ?? 0.08,
    emissiveIntensity: options.emissiveIntensity ?? 0.0
  });
}

function createDoubleSidedMaterial(
  color: string,
  options: Partial<Pick<MeshStandardMaterial, "roughness" | "metalness" | "emissiveIntensity">> = {}
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    side: DoubleSide,
    flatShading: true,
    roughness: options.roughness ?? 0.8,
    metalness: options.metalness ?? 0.04,
    emissiveIntensity: options.emissiveIntensity ?? 0.0
  });
}

function enableShadows(mesh: Mesh): Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createSailGeometry(shape: SailShape, width: number, height: number): PlaneGeometry | ShapeGeometry {
  if (shape === "square") {
    return new PlaneGeometry(width, height);
  }

  const sailShape = new Shape();
  sailShape.moveTo(-width * 0.5, -height * 0.5);
  sailShape.lineTo(width * 0.5, -height * 0.5);
  sailShape.lineTo(width * 0.35, height * 0.5);
  sailShape.closePath();
  return new ShapeGeometry(sailShape);
}

function createMuzzleFx(name: string, side: "left" | "right"): ShipMuzzleFx {
  const group = new Group();
  group.name = name;
  group.visible = false;
  const direction = side === "left" ? -1 : 1;

  const flashMaterial = new MeshStandardMaterial({
    color: "#ffd8a2",
    emissive: "#ff9a44",
    emissiveIntensity: 0.15,
    roughness: 0.15,
    metalness: 0,
    transparent: true,
    opacity: 0
  });
  const smokeMaterial = new MeshStandardMaterial({
    color: "#c6ced7",
    emissive: "#8f97a0",
    emissiveIntensity: 0.04,
    roughness: 0.8,
    metalness: 0,
    transparent: true,
    opacity: 0
  });

  const flash = enableShadows(new Mesh(new ConeGeometry(0.2, 0.6, 6), flashMaterial));
  flash.name = `${name}-flash`;
  flash.rotation.z = direction * Math.PI * 0.5;
  flash.position.x = 0.22 * direction;
  group.add(flash);

  const smoke = enableShadows(new Mesh(new ConeGeometry(0.26, 0.78, 5), smokeMaterial));
  smoke.name = `${name}-smoke`;
  smoke.rotation.z = direction * Math.PI * 0.5;
  smoke.position.x = 0.3 * direction;
  smoke.position.y = 0.04;
  group.add(smoke);

  return {
    group,
    flashMaterial,
    smokeMaterial
  };
}

function createWakeMaterial(
  color: string,
  alphaMap: DataTexture,
  emissiveIntensity = 0.12,
  roughness = 0.32
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    emissive: "#9cd6e7",
    emissiveIntensity,
    roughness,
    metalness: 0,
    transparent: true,
    alphaMap,
    opacity: 0,
    alphaTest: 0.01,
    depthWrite: false,
    side: DoubleSide
  });
}

function createWakeStripGeometry(frontWidth: number, backWidth: number, length: number): ShapeGeometry {
  const strip = new Shape();
  strip.moveTo(-frontWidth * 0.5, 0);
  strip.lineTo(frontWidth * 0.5, 0);
  strip.lineTo(backWidth * 0.5, length);
  strip.lineTo(-backWidth * 0.5, length);
  strip.closePath();
  return new ShapeGeometry(strip);
}

function createWakeAlphaTexture(kind: "trail" | "foam"): DataTexture {
  const size = 96;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    const v = y / (size - 1);
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1);

      const centeredX = (u - 0.5) * 2;
      const radial = Math.abs(centeredX);
      const along = 1 - v;

      let alpha = 0;
      if (kind === "trail") {
        const edgeFalloff = Math.max(0, 1 - Math.pow(radial, 1.35));
        const alongFalloff = Math.max(0, Math.pow(along, 0.68));
        const breakup = 0.84 + Math.sin((u * 29 + v * 16) * Math.PI) * 0.08;
        alpha = edgeFalloff * alongFalloff * breakup;
      } else {
        const radius = Math.hypot(centeredX, (v - 0.45) * 2.2);
        const core = Math.max(0, 1 - Math.pow(radius, 1.7));
        const foamNoise = 0.86 + Math.sin((u * 37 + v * 22) * Math.PI) * 0.14;
        alpha = core * foamNoise;
      }

      const byte = Math.max(0, Math.min(255, Math.round(alpha * 255)));
      const idx = (y * size + x) * 4;
      data[idx] = byte;
      data[idx + 1] = byte;
      data[idx + 2] = byte;
      data[idx + 3] = 255;
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createContactAlphaTexture(innerStrength: number): DataTexture {
  const size = 96;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const v = y / (size - 1);
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1);
      const dx = (u - 0.5) * 2;
      const dy = (v - 0.5) * 2;
      const radius = Math.hypot(dx, dy);
      const edge = Math.max(0, 1 - Math.pow(radius, 1.55));
      const alpha = Math.max(0, Math.min(1, edge * innerStrength));
      const byte = Math.round(alpha * 255);
      const idx = (y * size + x) * 4;
      data[idx] = byte;
      data[idx + 1] = byte;
      data[idx + 2] = byte;
      data[idx + 3] = 255;
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createContactMaterial(
  color: string,
  alphaMap: DataTexture,
  opacity: number
): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    alphaMap,
    alphaTest: 0.02,
    depthWrite: false,
    side: DoubleSide
  });
}

const WAKE_TRAIL_ALPHA_TEXTURE = createWakeAlphaTexture("trail");
const WAKE_FOAM_ALPHA_TEXTURE = createWakeAlphaTexture("foam");
const CONTACT_SHADOW_ALPHA_TEXTURE = createContactAlphaTexture(1.0);
const CONTACT_PATCH_ALPHA_TEXTURE = createContactAlphaTexture(0.78);
const WOOD_NORMAL_TEXTURE = createSurfaceTexture("wood-normal");
const WOOD_ROUGHNESS_TEXTURE = createSurfaceTexture("wood-roughness");
const SAIL_ROUGHNESS_TEXTURE = createSurfaceTexture("sail-roughness");

function createSurfaceTexture(kind: "wood-normal" | "wood-roughness" | "sail-roughness"): DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    const v = y / (size - 1);
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1);
      const idx = (y * size + x) * 4;

      if (kind === "wood-normal") {
        const grain = Math.sin((u * 6.5 + v * 0.8) * Math.PI * 2) * 0.11;
        const wobble = Math.sin((u * 1.5 + v * 4.4) * Math.PI * 2) * 0.06;
        const nx = 0.5 + grain + wobble;
        const ny = 0.5 + Math.sin((u * 4.8 - v * 3.3) * Math.PI * 2) * 0.08;
        const centeredX = (nx - 0.5) * 2;
        const centeredY = (ny - 0.5) * 2;
        const centeredZ = Math.sqrt(Math.max(0.02, 1 - centeredX * centeredX - centeredY * centeredY));
        const nz = centeredZ * 0.5 + 0.5;
        data[idx] = Math.max(0, Math.min(255, Math.round(nx * 255)));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round(ny * 255)));
        data[idx + 2] = Math.max(0, Math.min(255, Math.round(nz * 255)));
        data[idx + 3] = 255;
        continue;
      }

      if (kind === "wood-roughness") {
        const stripe = 0.6 + Math.sin((u * 5.2 + v * 0.7) * Math.PI * 2) * 0.17;
        const blotch = 0.18 + Math.sin((u * 1.7 - v * 2.8) * Math.PI * 2) * 0.12;
        const value = Math.max(0, Math.min(1, stripe + blotch));
        const byte = Math.round(value * 255);
        data[idx] = byte;
        data[idx + 1] = byte;
        data[idx + 2] = byte;
        data[idx + 3] = 255;
        continue;
      }

      const weave =
        0.74 +
        Math.sin((u * 8 + v * 0.3) * Math.PI * 2) * 0.1 +
        Math.sin((v * 7.5 + u * 0.3) * Math.PI * 2) * 0.1;
      const value = Math.max(0.45, Math.min(0.96, weave));
      const byte = Math.round(value * 255);
      data[idx] = byte;
      data[idx + 1] = byte;
      data[idx + 2] = byte;
      data[idx + 3] = 255;
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

function applyShipMaterialColor(material: MeshStandardMaterial, palette: ShipPalette): void {
  const materialName = material.name.toLowerCase();
  if (materialName.includes("sail")) {
    material.color.set(palette.sail);
    return;
  }
  if (materialName.includes("cannon")) {
    material.color.set(palette.cannon);
    return;
  }
  if (materialName.includes("deck")) {
    material.color.set(palette.deck);
    return;
  }
  if (materialName.includes("mast")) {
    material.color.set(palette.mast);
    return;
  }
  if (materialName.includes("accent")) {
    material.color.set(palette.accent);
    return;
  }
  material.color.set(palette.hull);
}

function applyShipMaterialPolish(material: MeshStandardMaterial, role: ShipVisualRole): void {
  const materialName = material.name.toLowerCase();
  const isSail = materialName.includes("sail");
  const isAccent = materialName.includes("accent");
  const isCannon = materialName.includes("cannon");
  const playerSailBoost = role === "player" ? 0.02 : 0;

  if (isSail) {
    material.roughnessMap = SAIL_ROUGHNESS_TEXTURE;
    material.roughness = 0.78;
    material.metalness = 0.02;
    material.normalMap = null;
    material.side = DoubleSide;
    material.flatShading = false;
    material.emissive.copy(material.color);
    material.emissiveIntensity = 0.06 + playerSailBoost;
    material.needsUpdate = true;
    return;
  }

  material.roughnessMap = WOOD_ROUGHNESS_TEXTURE;
  material.normalMap = WOOD_NORMAL_TEXTURE;
  if (isAccent || isCannon) {
    material.roughness = 0.46;
    material.metalness = 0.22;
    material.normalScale.set(0.22, 0.22);
  } else {
    material.roughness = 0.82;
    material.metalness = 0.06;
    material.normalScale.set(0.36, 0.28);
  }
  material.needsUpdate = true;
}

function tuneShipMaterials(materials: MeshStandardMaterial[], role: ShipVisualRole, palette: ShipPalette): void {
  for (const material of materials) {
    applyShipMaterialColor(material, palette);
    applyShipMaterialPolish(material, role);
  }
}

function getBaseDefinition(role: ShipVisualRole): ShipDefinition {
  const style = ROLE_STYLES[role];
  const classPreset = SHIP_CLASS_PRESETS[style.shipClass];
  const contract = getShipVisualContract(role);

  return {
    role,
    shipClass: style.shipClass,
    palette: {
      ...style.palette
    },
    silhouette: {
      hullLength: classPreset.hullLength,
      hullWidth: classPreset.hullWidth,
      hullHeight: classPreset.hullHeight,
      bowLength: classPreset.bowLength,
      sternLength: classPreset.sternLength,
      deckLength: classPreset.deckLength,
      deckWidth: classPreset.deckWidth,
      mastHeight: classPreset.mastHeight,
      mastRadius: classPreset.mastRadius,
      sailWidth: classPreset.sailWidth,
      sailHeight: classPreset.sailHeight,
      sailOffsetY: classPreset.sailOffsetY,
      sailOffsetZ: classPreset.sailOffsetZ,
      sailShape: style.sailShape,
      flagWidth: classPreset.flagWidth,
      flagHeight: classPreset.flagHeight,
      cannonMountsPerSide: classPreset.cannonMountsPerSide,
      cannonMountSpacing: classPreset.cannonMountSpacing,
      cannonMountLength: classPreset.cannonMountLength,
      cannonMountRadius: classPreset.cannonMountRadius
    },
    modelId: contract.modelId,
    materialProfileId: contract.materialProfileId,
    colliderProfileId: contract.colliderProfileId,
    fallbackPolicy: contract.fallbackPolicy,
    assetSource: "gltf",
    assetId: contract.modelId
  };
}

export function createShipDefinition(role: ShipVisualRole): ShipDefinition {
  return getBaseDefinition(role);
}

function registerFlashChannels(materials: MeshStandardMaterial[]): ShipFlashChannel[] {
  return materials.map((material) => ({
    material,
    baseEmissive: material.emissive.clone(),
    baseEmissiveIntensity: material.emissiveIntensity
  }));
}

function getUniqueStandardMaterials(root: Object3D): MeshStandardMaterial[] {
  const unique = new Set<MeshStandardMaterial>();
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.material) {
      return;
    }

    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) {
        if (material instanceof MeshStandardMaterial) {
          unique.add(material);
        }
      }
      return;
    }

    if (mesh.material instanceof MeshStandardMaterial) {
      unique.add(mesh.material);
    }
  });

  return [...unique];
}

function collectSailsFromRoot(root: Object3D): ShipSailVisual[] {
  const sails: ShipSailVisual[] = [];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.name.startsWith(SHIP_NODE_NAMES.sailPrefix)) {
      return;
    }

    mesh.castShadow = false;
    mesh.receiveShadow = false;
    sails.push({
      mesh,
      baseRotation: {
        x: mesh.rotation.x,
        y: mesh.rotation.y,
        z: mesh.rotation.z
      },
      basePosition: mesh.position.clone(),
      baseScale: mesh.scale.clone(),
      phaseOffset: sails.length * 0.28
    });
  });

  if (sails.length === 0) {
    const fallbackSail = root.getObjectByName("ship-sail") as Mesh | null;
    if (fallbackSail?.isMesh) {
      fallbackSail.castShadow = false;
      fallbackSail.receiveShadow = false;
      sails.push({
        mesh: fallbackSail,
        baseRotation: {
          x: fallbackSail.rotation.x,
          y: fallbackSail.rotation.y,
          z: fallbackSail.rotation.z
        },
        basePosition: fallbackSail.position.clone(),
        baseScale: fallbackSail.scale.clone(),
        phaseOffset: 0
      });
    }
  }

  return sails;
}

function createRigVisual(mesh: Mesh, index: number, swayWeight: number): ShipRigVisual {
  return {
    mesh,
    baseRotation: {
      x: mesh.rotation.x,
      y: mesh.rotation.y,
      z: mesh.rotation.z
    },
    basePosition: mesh.position.clone(),
    baseScale: mesh.scale.clone(),
    phaseOffset: index * 0.41,
    swayWeight
  };
}

function collectRigsFromRoot(root: Object3D): ShipRigVisual[] {
  const rigs: Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.name.startsWith(SHIP_NODE_NAMES.rigPrefix)) {
      return;
    }
    rigs.push(mesh);
  });

  rigs.sort((a, b) => a.name.localeCompare(b.name));
  return rigs.map((mesh, index) =>
    createRigVisual(mesh, index, mesh.name.includes("pennant") ? 1.16 : 0.78)
  );
}

function collectAnchorMounts(root: Object3D, prefix: string, intoLocalSpace: Object3D): Vector3[] {
  const anchors: { order: number; point: Vector3 }[] = [];
  const scratch = new Vector3();
  root.updateMatrixWorld(true);

  root.traverse((obj) => {
    if (!obj.name.startsWith(prefix)) {
      return;
    }
    obj.getWorldPosition(scratch);
    const local = intoLocalSpace.worldToLocal(scratch.clone());
    const suffix = obj.name.slice(prefix.length);
    const parsed = Number.parseInt(suffix, 10);
    anchors.push({
      order: Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed,
      point: local
    });
  });

  anchors.sort((a, b) => a.order - b.order);
  return anchors.map((anchor) => anchor.point);
}

function countStandardMaterials(root: Object3D): number {
  return getUniqueStandardMaterials(root).length;
}

function disposeObjectHierarchy(root: Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry || !mesh.material) {
      return;
    }

    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) {
        material.dispose();
      }
      return;
    }
    mesh.material.dispose();
  });
}

export function createShipMesh(definition: ShipDefinition): ShipVisual {
  const silhouette = definition.silhouette;
  const palette = definition.palette;
  const requestedAssetSource = definition.assetSource ?? "procedural";
  let resolvedAssetSource: ShipAssetSource = "procedural";
  let materialCount = 0;
  let wakeSternOffset = silhouette.hullLength * 0.48;

  const group = new Group();
  group.name = `ship-${definition.role}`;
  group.userData.shipRole = definition.role;
  group.userData.shipClass = definition.shipClass;
  group.userData.assetId = definition.assetId ?? definition.modelId;
  group.userData.modelId = definition.modelId;
  group.userData.materialProfileId = definition.materialProfileId;
  group.userData.colliderProfileId = definition.colliderProfileId;
  group.userData.requestedAssetSource = requestedAssetSource;
  group.userData.assetSource = resolvedAssetSource;
  group.userData.assetFallback = null;
  group.userData.assetFallbackReason = null;
  group.userData.triangleCount = 0;
  group.userData.nodeCount = 0;

  const presentation = new Group();
  presentation.name = "ship-presentation";
  group.add(presentation);

  const hullMaterial = createMaterial(palette.hull, { roughness: 0.8, metalness: 0.1 });
  const deckMaterial = createMaterial(palette.deck, { roughness: 0.88, metalness: 0.04 });
  const mastMaterial = createMaterial(palette.mast, { roughness: 0.86, metalness: 0.04 });
  const sailMaterial = createDoubleSidedMaterial(palette.sail, { roughness: 0.76, metalness: 0.02 });
  hullMaterial.name = "procedural-wood-hull";
  deckMaterial.name = "procedural-wood-deck";
  mastMaterial.name = "procedural-wood-mast";
  sailMaterial.name = "procedural-sail";
  sailMaterial.flatShading = false;
  sailMaterial.emissive.set(palette.sail);
  sailMaterial.emissiveIntensity = 0.08;
  const accentMaterial = createDoubleSidedMaterial(palette.accent, {
    roughness: 0.42,
    metalness: 0.1,
    emissiveIntensity: 0.08
  });
  accentMaterial.name = "procedural-accent";
  const cannonMaterial = createMaterial(palette.cannon, { roughness: 0.38, metalness: 0.32 });
  cannonMaterial.name = "procedural-accent-cannon";
  tuneShipMaterials([hullMaterial, deckMaterial, mastMaterial, sailMaterial, accentMaterial, cannonMaterial], definition.role, palette);

  const hull = enableShadows(
    new Mesh(new BoxGeometry(silhouette.hullWidth, silhouette.hullHeight, silhouette.hullLength), hullMaterial)
  );
  hull.name = "ship-hull";
  hull.position.y = silhouette.hullHeight * 0.58;
  presentation.add(hull);

  const bow = enableShadows(
    new Mesh(
      new ConeGeometry(silhouette.hullWidth * 0.36, silhouette.bowLength, 7),
      hullMaterial
    )
  );
  bow.name = "ship-bow";
  bow.rotation.x = Math.PI * 0.5;
  bow.rotation.z = Math.PI;
  bow.position.set(0, silhouette.hullHeight * 0.56, silhouette.hullLength * 0.5 + silhouette.bowLength * 0.33);
  presentation.add(bow);

  const stern = enableShadows(
    new Mesh(
      new ConeGeometry(silhouette.hullWidth * 0.3, silhouette.sternLength, 6),
      hullMaterial
    )
  );
  stern.name = "ship-stern";
  stern.rotation.x = Math.PI * 0.5;
  stern.position.set(0, silhouette.hullHeight * 0.52, -silhouette.hullLength * 0.5 - silhouette.sternLength * 0.28);
  presentation.add(stern);

  const deck = enableShadows(
    new Mesh(
      new BoxGeometry(silhouette.deckWidth, silhouette.hullHeight * 0.34, silhouette.deckLength),
      deckMaterial
    )
  );
  deck.name = "ship-deck";
  deck.position.set(0, silhouette.hullHeight * 1.18, silhouette.sailOffsetZ * 0.42);
  presentation.add(deck);

  const mast = enableShadows(
    new Mesh(
      new CylinderGeometry(
        silhouette.mastRadius * 0.9,
        silhouette.mastRadius * 1.1,
        silhouette.mastHeight,
        7
      ),
      mastMaterial
    )
  );
  mast.name = "ship-mast";
  mast.position.set(0, silhouette.hullHeight + silhouette.mastHeight * 0.5, silhouette.sailOffsetZ * 0.34);
  presentation.add(mast);

  const sail = new Mesh(createSailGeometry(silhouette.sailShape, silhouette.sailWidth, silhouette.sailHeight), sailMaterial);
  sail.castShadow = false;
  sail.receiveShadow = false;
  sail.name = "ship-sail";
  sail.position.set(0, silhouette.sailOffsetY, silhouette.sailOffsetZ);
  sail.rotation.y = silhouette.sailShape === "lateen" ? Math.PI * 0.08 : 0;
  presentation.add(sail);

  const sails: ShipSailVisual[] = [
    {
      mesh: sail,
      baseRotation: {
        x: sail.rotation.x,
        y: sail.rotation.y,
        z: sail.rotation.z
      },
      basePosition: sail.position.clone(),
      baseScale: sail.scale.clone(),
      phaseOffset: 0
    }
  ];

  const rigs: ShipRigVisual[] = [];
  const rigA = enableShadows(
    new Mesh(
      new CylinderGeometry(silhouette.mastRadius * 0.12, silhouette.mastRadius * 0.12, silhouette.mastHeight * 0.75, 6),
      mastMaterial
    )
  );
  rigA.name = "ship-rig-shroud-left";
  rigA.position.set(-silhouette.hullWidth * 0.28, silhouette.hullHeight + silhouette.mastHeight * 0.52, silhouette.sailOffsetZ * 0.18);
  rigA.rotation.z = Math.PI * 0.15;
  presentation.add(rigA);
  rigs.push(createRigVisual(rigA, rigs.length, 0.72));

  const rigB = enableShadows(
    new Mesh(
      new CylinderGeometry(silhouette.mastRadius * 0.12, silhouette.mastRadius * 0.12, silhouette.mastHeight * 0.75, 6),
      mastMaterial
    )
  );
  rigB.name = "ship-rig-shroud-right";
  rigB.position.set(silhouette.hullWidth * 0.28, silhouette.hullHeight + silhouette.mastHeight * 0.52, silhouette.sailOffsetZ * 0.18);
  rigB.rotation.z = -Math.PI * 0.15;
  presentation.add(rigB);
  rigs.push(createRigVisual(rigB, rigs.length, 0.72));

  const rigC = enableShadows(
    new Mesh(
      new CylinderGeometry(silhouette.mastRadius * 0.1, silhouette.mastRadius * 0.1, silhouette.hullLength * 0.56, 6),
      mastMaterial
    )
  );
  rigC.name = "ship-rig-stay-fore";
  rigC.position.set(0, silhouette.hullHeight + silhouette.mastHeight * 0.64, silhouette.hullLength * 0.16);
  rigC.rotation.x = -Math.PI * 0.23;
  presentation.add(rigC);
  rigs.push(createRigVisual(rigC, rigs.length, 0.64));

  const rigPennant = new Mesh(
    new PlaneGeometry(silhouette.flagWidth * 0.9, silhouette.flagHeight * 0.42),
    sailMaterial
  );
  rigPennant.name = "ship-rig-pennant-main";
  rigPennant.castShadow = false;
  rigPennant.receiveShadow = false;
  rigPennant.position.set(0.14, silhouette.hullHeight + silhouette.mastHeight * 0.88, silhouette.sailOffsetZ * 0.2);
  rigPennant.rotation.y = definition.role === "player" ? -Math.PI * 0.16 : Math.PI * 0.18;
  presentation.add(rigPennant);
  rigs.push(createRigVisual(rigPennant, rigs.length, 1.14));

  const flag = enableShadows(
    new Mesh(new PlaneGeometry(silhouette.flagWidth, silhouette.flagHeight), accentMaterial)
  );
  flag.name = "ship-flag";
  flag.position.set(
    definition.shipClass === "heavy" ? 0.18 : 0.12,
    silhouette.hullHeight + silhouette.mastHeight + silhouette.flagHeight * 0.42,
    silhouette.sailOffsetZ
  );
  flag.rotation.y = definition.role === "player" ? -Math.PI * 0.12 : Math.PI * 0.17;
  presentation.add(flag);

  const cannonMountsLeft: Vector3[] = [];
  const cannonMountsRight: Vector3[] = [];
  const mountCount = silhouette.cannonMountsPerSide;
  const mountHalfSpan = ((mountCount - 1) * silhouette.cannonMountSpacing) * 0.5;
  const mountY = silhouette.hullHeight * 0.72 + 0.12;
  for (let i = 0; i < mountCount; i += 1) {
    const zOffset = -mountHalfSpan + i * silhouette.cannonMountSpacing;

    const leftMount = enableShadows(
      new Mesh(
        new CylinderGeometry(
          silhouette.cannonMountRadius,
          silhouette.cannonMountRadius * 1.08,
          silhouette.cannonMountLength,
          7
        ),
        cannonMaterial
      )
    );
    leftMount.name = `ship-cannon-left-${i}`;
    leftMount.rotation.z = Math.PI * 0.5;
    leftMount.position.set(
      -silhouette.hullWidth * 0.5 - silhouette.cannonMountLength * 0.22,
      mountY,
      zOffset
    );
    presentation.add(leftMount);
    cannonMountsLeft.push(leftMount.position.clone());

    const rightMount = enableShadows(
      new Mesh(
        new CylinderGeometry(
          silhouette.cannonMountRadius,
          silhouette.cannonMountRadius * 1.08,
          silhouette.cannonMountLength,
          7
        ),
        cannonMaterial
      )
    );
    rightMount.name = `ship-cannon-right-${i}`;
    rightMount.rotation.z = Math.PI * 0.5;
    rightMount.position.set(
      silhouette.hullWidth * 0.5 + silhouette.cannonMountLength * 0.22,
      mountY,
      zOffset
    );
    presentation.add(rightMount);
    cannonMountsRight.push(rightMount.position.clone());
  }

  const wakeTrailMaterial = createWakeMaterial("#c8efff", WAKE_TRAIL_ALPHA_TEXTURE, 0.2, 0.22);
  const wakeTrail = new Mesh(
    createWakeStripGeometry(silhouette.hullWidth * 0.95, silhouette.hullWidth * 2.9, silhouette.hullLength * 2.9),
    wakeTrailMaterial
  );
  wakeTrail.name = "ship-wake-trail";
  wakeTrail.rotation.x = -Math.PI * 0.5;
  wakeTrail.position.set(0, 0.06, -silhouette.hullLength * 0.58);
  wakeTrail.userData.baseX = wakeTrail.position.x;
  wakeTrail.userData.baseZ = wakeTrail.position.z;
  wakeTrail.visible = false;
  group.add(wakeTrail);

  const wakeFoamMaterial = createWakeMaterial("#f4fcff", WAKE_FOAM_ALPHA_TEXTURE, 0.24, 0.16);
  const wakeFoam = new Mesh(
    new CircleGeometry(Math.max(0.65, silhouette.hullWidth * 0.43), 26),
    wakeFoamMaterial
  );
  wakeFoam.name = "ship-wake-foam";
  wakeFoam.rotation.x = -Math.PI * 0.5;
  wakeFoam.position.set(0, 0.085, -silhouette.hullLength * 0.52);
  wakeFoam.scale.set(1.25, 0.74, 1);
  wakeFoam.userData.baseX = wakeFoam.position.x;
  wakeFoam.userData.baseZ = wakeFoam.position.z;
  wakeFoam.visible = false;
  group.add(wakeFoam);

  const wakeRibbonLeftMaterial = createWakeMaterial("#d8f6ff", WAKE_TRAIL_ALPHA_TEXTURE, 0.16, 0.25);
  const wakeRibbonLeft = new Mesh(
    createWakeStripGeometry(silhouette.hullWidth * 0.2, silhouette.hullWidth * 1.2, silhouette.hullLength * 1.9),
    wakeRibbonLeftMaterial
  );
  wakeRibbonLeft.name = "ship-wake-ribbon-left";
  wakeRibbonLeft.rotation.x = -Math.PI * 0.5;
  wakeRibbonLeft.rotation.z = Math.PI * 0.02;
  wakeRibbonLeft.position.set(-silhouette.hullWidth * 0.42, 0.07, -silhouette.hullLength * 0.42);
  wakeRibbonLeft.visible = false;
  wakeRibbonLeft.userData.baseX = wakeRibbonLeft.position.x;
  wakeRibbonLeft.userData.baseZ = wakeRibbonLeft.position.z;
  group.add(wakeRibbonLeft);

  const wakeRibbonRightMaterial = createWakeMaterial("#d8f6ff", WAKE_TRAIL_ALPHA_TEXTURE, 0.16, 0.25);
  const wakeRibbonRight = new Mesh(
    createWakeStripGeometry(silhouette.hullWidth * 0.2, silhouette.hullWidth * 1.2, silhouette.hullLength * 1.9),
    wakeRibbonRightMaterial
  );
  wakeRibbonRight.name = "ship-wake-ribbon-right";
  wakeRibbonRight.rotation.x = -Math.PI * 0.5;
  wakeRibbonRight.rotation.z = -Math.PI * 0.02;
  wakeRibbonRight.position.set(silhouette.hullWidth * 0.42, 0.07, -silhouette.hullLength * 0.42);
  wakeRibbonRight.visible = false;
  wakeRibbonRight.userData.baseX = wakeRibbonRight.position.x;
  wakeRibbonRight.userData.baseZ = wakeRibbonRight.position.z;
  group.add(wakeRibbonRight);

  const wakeSprayMaterial = createWakeMaterial("#f8fdff", WAKE_FOAM_ALPHA_TEXTURE, 0.26, 0.14);
  const wakeSpray = new Mesh(
    new PlaneGeometry(silhouette.hullWidth * 1.2, silhouette.hullLength * 0.72),
    wakeSprayMaterial
  );
  wakeSpray.name = "ship-wake-spray";
  wakeSpray.rotation.x = -Math.PI * 0.5;
  wakeSpray.position.set(0, 0.11, -silhouette.hullLength * 0.72);
  wakeSpray.userData.baseX = wakeSpray.position.x;
  wakeSpray.userData.baseZ = wakeSpray.position.z;
  wakeSpray.visible = false;
  group.add(wakeSpray);

  const contactShadowMaterial = createContactMaterial("#000000", CONTACT_SHADOW_ALPHA_TEXTURE, 0.27);
  const contactShadow = new Mesh(
    new CircleGeometry(1, 40),
    contactShadowMaterial
  );
  contactShadow.name = "ship-contact-shadow";
  contactShadow.rotation.x = -Math.PI * 0.5;
  contactShadow.position.set(0, 0.028, 0);
  contactShadow.scale.set(silhouette.hullWidth * 1.18, 1, silhouette.hullLength * 0.94);
  contactShadow.renderOrder = 2;
  contactShadow.userData.baseScaleX = contactShadow.scale.x;
  contactShadow.userData.baseScaleZ = contactShadow.scale.z;
  group.add(contactShadow);

  const contactPatchMaterial = createContactMaterial("#0d2235", CONTACT_PATCH_ALPHA_TEXTURE, 0.16);
  const contactPatch = new Mesh(
    new CircleGeometry(1, 34),
    contactPatchMaterial
  );
  contactPatch.name = "ship-contact-patch";
  contactPatch.rotation.x = -Math.PI * 0.5;
  contactPatch.position.set(0, 0.024, -silhouette.hullLength * 0.04);
  contactPatch.scale.set(silhouette.hullWidth * 0.8, 1, silhouette.hullLength * 0.62);
  contactPatch.renderOrder = 1;
  contactPatch.userData.baseScaleX = contactPatch.scale.x;
  contactPatch.userData.baseScaleZ = contactPatch.scale.z;
  group.add(contactPatch);

  const muzzleLeft = createMuzzleFx("ship-muzzle-left", "left");
  muzzleLeft.group.position.set(-silhouette.hullWidth * 0.5 - 0.45, mountY + 0.05, 0);
  presentation.add(muzzleLeft.group);

  const muzzleRight = createMuzzleFx("ship-muzzle-right", "right");
  muzzleRight.group.position.set(silhouette.hullWidth * 0.5 + 0.45, mountY + 0.05, 0);
  presentation.add(muzzleRight.group);

  let flashChannels = registerFlashChannels([hullMaterial, deckMaterial, sailMaterial, accentMaterial, cannonMaterial]);

  if (requestedAssetSource === "gltf") {
    const assetResult = instantiateValidatedShipAsset(definition.modelId);
    const assetRoot = assetResult.instance?.root ?? null;
    if (assetRoot) {
      const oldChildren = [...presentation.children];
      for (const child of oldChildren) {
        if (child === muzzleLeft.group || child === muzzleRight.group) {
          continue;
        }
        presentation.remove(child);
        disposeObjectHierarchy(child);
      }

      presentation.add(assetRoot);
      presentation.updateMatrixWorld(true);

      const anchoredLeftMounts = collectAnchorMounts(assetRoot, SHIP_NODE_NAMES.cannonLeftPrefix, presentation);
      const anchoredRightMounts = collectAnchorMounts(assetRoot, SHIP_NODE_NAMES.cannonRightPrefix, presentation);
      if (anchoredLeftMounts.length > 0 && anchoredRightMounts.length > 0) {
        cannonMountsLeft.length = 0;
        cannonMountsLeft.push(...anchoredLeftMounts);
        cannonMountsRight.length = 0;
        cannonMountsRight.push(...anchoredRightMounts);
      }

      const assetSails = collectSailsFromRoot(assetRoot);
      if (assetSails.length > 0) {
        sails.length = 0;
        sails.push(...assetSails);
      }
      const assetRigs = collectRigsFromRoot(assetRoot);
      rigs.length = 0;
      rigs.push(...assetRigs);

      const sternAnchor = assetRoot.getObjectByName(SHIP_NODE_NAMES.wakeSternAnchor);
      if (sternAnchor) {
        const sternLocal = presentation.worldToLocal(sternAnchor.getWorldPosition(new Vector3()));
        wakeSternOffset = Math.max(0.4, Math.abs(sternLocal.z));
      }

      const presentationBounds = new Box3().setFromObject(assetRoot);
      const presentationSize = presentationBounds.getSize(new Vector3());
      const resolvedHullWidth = Math.max(silhouette.hullWidth * 0.8, presentationSize.x);
      const resolvedHullLength = Math.max(silhouette.hullLength * 0.8, presentationSize.z);
      const resolvedHullHeight = Math.max(silhouette.hullHeight * 0.8, presentationSize.y);

      wakeTrail.position.set(0, 0.06, -wakeSternOffset - resolvedHullLength * 0.08);
      wakeTrail.scale.set(
        Math.max(0.72, resolvedHullWidth / Math.max(1e-5, silhouette.hullWidth)),
        1,
        Math.max(0.72, resolvedHullLength / Math.max(1e-5, silhouette.hullLength))
      );
      wakeTrail.userData.baseX = wakeTrail.position.x;
      wakeTrail.userData.baseZ = wakeTrail.position.z;

      wakeFoam.position.set(0, 0.085, -wakeSternOffset * 0.94);
      wakeFoam.scale.set(
        Math.max(0.86, resolvedHullWidth / Math.max(1e-5, silhouette.hullWidth)) * 1.25,
        0.74,
        1
      );
      wakeFoam.userData.baseX = wakeFoam.position.x;
      wakeFoam.userData.baseZ = wakeFoam.position.z;

      wakeRibbonLeft.position.set(-resolvedHullWidth * 0.42, 0.07, -wakeSternOffset * 0.84);
      wakeRibbonLeft.userData.baseX = wakeRibbonLeft.position.x;
      wakeRibbonLeft.userData.baseZ = wakeRibbonLeft.position.z;

      wakeRibbonRight.position.set(resolvedHullWidth * 0.42, 0.07, -wakeSternOffset * 0.84);
      wakeRibbonRight.userData.baseX = wakeRibbonRight.position.x;
      wakeRibbonRight.userData.baseZ = wakeRibbonRight.position.z;

      wakeSpray.position.set(0, 0.11, -wakeSternOffset - resolvedHullLength * 0.18);
      wakeSpray.userData.baseX = wakeSpray.position.x;
      wakeSpray.userData.baseZ = wakeSpray.position.z;

      contactShadow.scale.set(resolvedHullWidth * 1.18, 1, resolvedHullLength * 0.94);
      contactShadow.userData.baseScaleX = contactShadow.scale.x;
      contactShadow.userData.baseScaleZ = contactShadow.scale.z;

      contactPatch.position.z = -resolvedHullLength * 0.04;
      contactPatch.scale.set(resolvedHullWidth * 0.8, 1, resolvedHullLength * 0.62);
      contactPatch.userData.baseScaleX = contactPatch.scale.x;
      contactPatch.userData.baseScaleZ = contactPatch.scale.z;

      const leftMidMount = cannonMountsLeft[Math.floor(cannonMountsLeft.length * 0.5)];
      if (leftMidMount) {
        muzzleLeft.group.position.set(leftMidMount.x - 0.12, leftMidMount.y + 0.05, leftMidMount.z);
      } else {
        muzzleLeft.group.position.set(-resolvedHullWidth * 0.5 - 0.45, resolvedHullHeight * 0.68 + 0.05, 0);
      }

      const rightMidMount = cannonMountsRight[Math.floor(cannonMountsRight.length * 0.5)];
      if (rightMidMount) {
        muzzleRight.group.position.set(rightMidMount.x + 0.12, rightMidMount.y + 0.05, rightMidMount.z);
      } else {
        muzzleRight.group.position.set(resolvedHullWidth * 0.5 + 0.45, resolvedHullHeight * 0.68 + 0.05, 0);
      }
      if (!muzzleLeft.group.parent) {
        presentation.add(muzzleLeft.group);
      }
      if (!muzzleRight.group.parent) {
        presentation.add(muzzleRight.group);
      }

      const gltfMaterials = getUniqueStandardMaterials(assetRoot);
      if (gltfMaterials.length > 0) {
        tuneShipMaterials(gltfMaterials, definition.role, palette);
        flashChannels = registerFlashChannels(gltfMaterials);
      }
      materialCount = assetResult.instance?.contract.materialCount ?? countStandardMaterials(assetRoot);
      resolvedAssetSource = "gltf";
      group.userData.assetFallback = null;
      group.userData.assetFallbackReason = null;
      group.userData.triangleCount = assetResult.instance?.contract.triangleCount ?? 0;
      group.userData.nodeCount = assetResult.instance?.contract.nodeCount ?? 0;
    } else {
      group.userData.assetFallback = definition.fallbackPolicy;
      group.userData.assetFallbackReason = assetResult.fallback?.reason ?? "template_unavailable";
    }
  }

  if (resolvedAssetSource !== "gltf") {
    materialCount = countStandardMaterials(presentation);
  }

  group.userData.assetSource = resolvedAssetSource;
  group.userData.materialCount = materialCount;
  group.userData.wakeSternOffset = wakeSternOffset;

  return {
    group,
    presentation,
    definition,
    resolvedAssetSource,
    materialCount,
    wakeSternOffset,
    sails,
    rigs,
    contactShadow,
    contactShadowMaterial,
    contactPatch,
    contactPatchMaterial,
    cannonMounts: {
      left: cannonMountsLeft,
      right: cannonMountsRight
    },
    wakeTrail,
    wakeTrailMaterial,
    wakeFoam,
    wakeFoamMaterial,
    wakeRibbonLeft,
    wakeRibbonLeftMaterial,
    wakeRibbonRight,
    wakeRibbonRightMaterial,
    wakeSpray,
    wakeSprayMaterial,
    muzzleLeft,
    muzzleRight,
    flashChannels
  };
}
