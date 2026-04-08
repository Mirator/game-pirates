import { defineConfig } from "vitest/config";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const githubPagesBase = repositoryName ? `/${repositoryName}/` : "/";
const base = process.env.GITHUB_ACTIONS === "true" ? githubPagesBase : "/";

export default defineConfig({
  base,
  resolve: {
    alias: {
      three: "three/src/Three.js"
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");

          if (normalizedId.includes("node_modules/three/src/renderers/")) {
            return "three-renderers";
          }
          if (normalizedId.includes("node_modules/three/src/geometries/")) {
            return "three-geometries";
          }
          if (normalizedId.includes("node_modules/three/src/math/")) {
            return "three-math";
          }
          if (normalizedId.includes("node_modules/three/src/materials/")) {
            return "three-materials";
          }
          if (normalizedId.includes("node_modules/three/src/lights/")) {
            return "three-lights";
          }
          if (normalizedId.includes("node_modules/three/src/")) {
            return "three-core";
          }
          if (normalizedId.includes("node_modules")) {
            return "vendor";
          }
          return undefined;
        }
      }
    }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/game/simulation/**/*.ts"]
    }
  }
});
