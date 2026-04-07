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
      VITE_E2E_DEBUG: "1"
    },
    reuseExistingServer: true,
    timeout: 120_000
  }
});
