import {
  ClampToEdgeWrapping,
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RGBAFormat,
  Shape,
  ShapeGeometry,
  UnsignedByteType,
  Vector3
} from "three";

export type ShipClass = "small" | "medium" | "heavy";
export type ShipVisualRole = "player" | "merchant" | "raider" | "navy";
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

export interface ShipVisual {
  group: Group;
  definition: ShipDefinition;
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
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = byte;
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

const WAKE_TRAIL_ALPHA_TEXTURE = createWakeAlphaTexture("trail");
const WAKE_FOAM_ALPHA_TEXTURE = createWakeAlphaTexture("foam");

function getBaseDefinition(role: ShipVisualRole): ShipDefinition {
  const style = ROLE_STYLES[role];
  const classPreset = SHIP_CLASS_PRESETS[style.shipClass];

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
    assetSource: "procedural",
    assetId: `${role}-procedural-v1`
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

export function createShipMesh(definition: ShipDefinition): ShipVisual {
  const silhouette = definition.silhouette;
  const palette = definition.palette;

  const group = new Group();
  group.name = `ship-${definition.role}`;
  group.userData.shipRole = definition.role;
  group.userData.shipClass = definition.shipClass;
  group.userData.assetId = definition.assetId ?? null;
  group.userData.assetSource = definition.assetSource ?? "procedural";

  if (definition.assetSource === "gltf") {
    group.userData.assetFallback = "procedural-fallback";
  }

  const hullMaterial = createMaterial(palette.hull, { roughness: 0.8, metalness: 0.1 });
  const deckMaterial = createMaterial(palette.deck, { roughness: 0.88, metalness: 0.04 });
  const mastMaterial = createMaterial(palette.mast, { roughness: 0.86, metalness: 0.04 });
  const sailMaterial = createDoubleSidedMaterial(palette.sail, { roughness: 0.76, metalness: 0.02 });
  const accentMaterial = createDoubleSidedMaterial(palette.accent, {
    roughness: 0.42,
    metalness: 0.1,
    emissiveIntensity: 0.08
  });
  const cannonMaterial = createMaterial(palette.cannon, { roughness: 0.38, metalness: 0.32 });

  const hull = enableShadows(
    new Mesh(new BoxGeometry(silhouette.hullWidth, silhouette.hullHeight, silhouette.hullLength), hullMaterial)
  );
  hull.name = "ship-hull";
  hull.position.y = silhouette.hullHeight * 0.58;
  group.add(hull);

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
  group.add(bow);

  const stern = enableShadows(
    new Mesh(
      new ConeGeometry(silhouette.hullWidth * 0.3, silhouette.sternLength, 6),
      hullMaterial
    )
  );
  stern.name = "ship-stern";
  stern.rotation.x = Math.PI * 0.5;
  stern.position.set(0, silhouette.hullHeight * 0.52, -silhouette.hullLength * 0.5 - silhouette.sternLength * 0.28);
  group.add(stern);

  const deck = enableShadows(
    new Mesh(
      new BoxGeometry(silhouette.deckWidth, silhouette.hullHeight * 0.34, silhouette.deckLength),
      deckMaterial
    )
  );
  deck.name = "ship-deck";
  deck.position.set(0, silhouette.hullHeight * 1.18, silhouette.sailOffsetZ * 0.42);
  group.add(deck);

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
  group.add(mast);

  const sail = enableShadows(
    new Mesh(createSailGeometry(silhouette.sailShape, silhouette.sailWidth, silhouette.sailHeight), sailMaterial)
  );
  sail.name = "ship-sail";
  sail.position.set(0, silhouette.sailOffsetY, silhouette.sailOffsetZ);
  sail.rotation.y = silhouette.sailShape === "lateen" ? Math.PI * 0.08 : 0;
  group.add(sail);

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
  group.add(flag);

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
    group.add(leftMount);
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
    group.add(rightMount);
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

  const muzzleLeft = createMuzzleFx("ship-muzzle-left", "left");
  muzzleLeft.group.position.set(-silhouette.hullWidth * 0.5 - 0.45, mountY + 0.05, 0);
  group.add(muzzleLeft.group);

  const muzzleRight = createMuzzleFx("ship-muzzle-right", "right");
  muzzleRight.group.position.set(silhouette.hullWidth * 0.5 + 0.45, mountY + 0.05, 0);
  group.add(muzzleRight.group);

  const flashChannels = registerFlashChannels([hullMaterial, deckMaterial, sailMaterial, accentMaterial, cannonMaterial]);

  return {
    group,
    definition,
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
