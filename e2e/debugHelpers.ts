import { expect, type Page } from "@playwright/test";

interface DebugWorldState {
  time: number;
  enemies: Array<unknown>;
}

interface DebugRoot {
  worldState: DebugWorldState;
}

type DebugWindow = Window & {
  __BLACKWAKE_DEBUG__?: DebugRoot;
};

export async function waitForDebugReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    return Boolean((window as DebugWindow).__BLACKWAKE_DEBUG__);
  });
}

export async function readWorldTime(page: Page): Promise<number> {
  return page.evaluate(() => {
    return (window as DebugWindow).__BLACKWAKE_DEBUG__?.worldState.time ?? 0;
  });
}

export async function readEnemyCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    return (window as DebugWindow).__BLACKWAKE_DEBUG__?.worldState.enemies.length ?? 0;
  });
}

export async function expectWorldTimeStable(
  page: Page,
  maxDelta: number,
  durationMs = 700
): Promise<void> {
  const delta = await page.evaluate(async (duration) => {
    const debugState = (window as DebugWindow).__BLACKWAKE_DEBUG__;
    if (!debugState) {
      return Number.POSITIVE_INFINITY;
    }
    const start = debugState.worldState.time;
    await new Promise((resolve) => setTimeout(resolve, duration));
    return debugState.worldState.time - start;
  }, durationMs);
  expect(delta).toBeLessThan(maxDelta);
}

export async function expectWorldTimeAdvance(
  page: Page,
  minDelta: number,
  durationMs = 1200
): Promise<void> {
  const delta = await page.evaluate(async (duration) => {
    const debugState = (window as DebugWindow).__BLACKWAKE_DEBUG__;
    if (!debugState) {
      return 0;
    }
    const start = debugState.worldState.time;
    await new Promise((resolve) => setTimeout(resolve, duration));
    return debugState.worldState.time - start;
  }, durationMs);
  expect(delta).toBeGreaterThan(minDelta);
}
