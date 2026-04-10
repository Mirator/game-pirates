import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SHIP_ASSET_COMPLEXITY_THRESHOLDS } from "./shipAssetComplexity";

interface ParsedGlb {
  accessors: Array<{ count: number }>;
  meshes: Array<{
    primitives: Array<{
      mode?: number;
      indices?: number;
      attributes?: {
        POSITION?: number;
      };
    }>;
  }>;
  nodes?: unknown[];
  materials?: unknown[];
}

function parseGlbJson(buffer: Buffer): ParsedGlb {
  const magic = buffer.readUInt32LE(0);
  const version = buffer.readUInt32LE(4);
  if (magic !== 0x46546c67 || version !== 2) {
    throw new Error("Invalid GLB header.");
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;

    if (offset + chunkLength > buffer.length) {
      throw new Error("Invalid GLB chunk length.");
    }

    if (chunkType === 0x4e4f534a) {
      const jsonText = buffer.toString("utf8", offset, offset + chunkLength).replace(/\u0000+$/g, "");
      return JSON.parse(jsonText) as ParsedGlb;
    }

    offset += chunkLength;
  }

  throw new Error("GLB missing JSON chunk.");
}

function countTriangles(gltf: ParsedGlb): number {
  let triangles = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const mode = primitive.mode ?? 4;
      if (mode !== 4) {
        continue;
      }
      if (typeof primitive.indices === "number") {
        triangles += Math.floor((gltf.accessors[primitive.indices]?.count ?? 0) / 3);
        continue;
      }
      const positionAccessor = primitive.attributes?.POSITION;
      if (typeof positionAccessor === "number") {
        triangles += Math.floor((gltf.accessors[positionAccessor]?.count ?? 0) / 3);
      }
    }
  }
  return triangles;
}

describe("v3 ship GLB complexity metrics", () => {
  const ids = Object.keys(SHIP_ASSET_COMPLEXITY_THRESHOLDS) as Array<keyof typeof SHIP_ASSET_COMPLEXITY_THRESHOLDS>;

  for (const modelId of ids) {
    it(`${modelId} meets triangle/node/material thresholds`, async () => {
      const filePath = path.resolve(process.cwd(), "public/assets/ships", `${modelId}.glb`);
      const glb = await readFile(filePath);
      const gltf = parseGlbJson(glb);
      const threshold = SHIP_ASSET_COMPLEXITY_THRESHOLDS[modelId];

      const triangleCount = countTriangles(gltf);
      const nodeCount = gltf.nodes?.length ?? 0;
      const materialCount = gltf.materials?.length ?? 0;

      expect(triangleCount).toBeGreaterThanOrEqual(threshold.minTriangleCount);
      expect(nodeCount).toBeGreaterThanOrEqual(threshold.minNodeCount);
      expect(materialCount).toBeLessThanOrEqual(3);
    });
  }
});
