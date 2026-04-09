import { defineConfig } from "@playwright/test";

function parseWorkerCount(rawValue: string | undefined): number {
  if (!rawValue) {
    return 1;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  workers: parseWorkerCount(process.env.E2E_WORKERS),
  fullyParallel: false,
  expect: {
    timeout: 10_000
  },
  use: {
    headless: true,
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1366, height: 768 }
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    env: {
      ...process.env,
      VITE_E2E_DEBUG: "1",
      VITE_PHYSICS_TICK_HZ: process.env.VITE_PHYSICS_TICK_HZ ?? "30",
      VITE_MAX_RENDER_FPS: process.env.VITE_MAX_RENDER_FPS ?? "8",
      VITE_SKIP_3D_RENDER: process.env.VITE_SKIP_3D_RENDER ?? "1",
      VITE_RENDER_LOW_POWER: process.env.VITE_RENDER_LOW_POWER ?? "1",
      VITE_RENDER_PIXEL_RATIO_CAP: process.env.VITE_RENDER_PIXEL_RATIO_CAP ?? "1"
    },
    reuseExistingServer: true,
    timeout: 120_000
  }
});
