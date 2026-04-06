import { expect, test, type Locator, type Page } from "@playwright/test";

const ONBOARDING_STORAGE_KEY = "blackwake_onboarding_state";

function parseReloadValue(text: string, side: "L" | "R"): number {
  const pattern = side === "L" ? /Reload L ([0-9]+\.[0-9]+)s/ : /\| R ([0-9]+\.[0-9]+)s/;
  const match = text.match(pattern);
  if (!match) {
    return 0;
  }
  return Number.parseFloat(match[1] ?? "0");
}

async function fireUntilReloadStarts(
  page: Page,
  debug: Locator,
  keyCode: "KeyQ" | "KeyE",
  side: "L" | "R"
): Promise<number> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.keyboard.down(keyCode);
    await page.waitForTimeout(220);
    await page.keyboard.up(keyCode);
    await page.waitForTimeout(120);

    const debugText = await debug.innerText();
    const reloadValue = parseReloadValue(debugText, side);
    if (reloadValue > 0) {
      return reloadValue;
    }

    await page.keyboard.down("KeyA");
    await page.waitForTimeout(180);
    await page.keyboard.up("KeyA");
  }

  return 0;
}

test("smoke: onboarding, pause flow, esc precedence, combat, and responsive hud", async ({ page }) => {
  await page.goto("/");

  await page.evaluate((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, ONBOARDING_STORAGE_KEY);
  await page.reload();

  const canvas = page.locator("canvas").first();
  const hudPrimary = page.locator(".hud-panel-primary");
  const hudMinimap = page.locator(".hud-panel-minimap");
  const dockMenu = page.locator("[data-testid='dock-menu']");
  const pauseMenu = page.locator("[data-testid='pause-menu']");
  const onboardingMenu = page.locator("[data-testid='onboarding-menu']");
  const replayTutorial = page.locator("[data-testid='replay-tutorial']");
  const debug = page.locator("[aria-label='Phase 1 debug readout']");

  await expect(canvas).toBeVisible();
  await expect(hudPrimary).toBeVisible();
  await expect(hudMinimap).toBeVisible();

  await expect(onboardingMenu).toBeVisible();

  const onboardingTimeBefore = await page.evaluate(() => {
    return (window as Window & { __BLACKWAKE_DEBUG__?: { worldState: { time: number } } }).__BLACKWAKE_DEBUG__?.worldState.time ?? 0;
  });
  await page.waitForTimeout(350);
  const onboardingTimeAfter = await page.evaluate(() => {
    return (window as Window & { __BLACKWAKE_DEBUG__?: { worldState: { time: number } } }).__BLACKWAKE_DEBUG__?.worldState.time ?? 0;
  });
  expect(onboardingTimeAfter - onboardingTimeBefore).toBeLessThan(0.02);

  await onboardingMenu.getByRole("button", { name: "Next" }).click();
  await onboardingMenu.getByRole("button", { name: "Next" }).click();
  await onboardingMenu.getByRole("button", { name: "Start Sailing" }).click();
  await expect(onboardingMenu).toBeHidden();

  await page.reload();
  await expect(onboardingMenu).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(pauseMenu).toBeVisible();

  const pausedTimeBefore = await page.evaluate(() => {
    return (window as Window & { __BLACKWAKE_DEBUG__?: { worldState: { time: number } } }).__BLACKWAKE_DEBUG__?.worldState.time ?? 0;
  });
  await page.waitForTimeout(450);
  const pausedTimeAfter = await page.evaluate(() => {
    return (window as Window & { __BLACKWAKE_DEBUG__?: { worldState: { time: number } } }).__BLACKWAKE_DEBUG__?.worldState.time ?? 0;
  });
  expect(pausedTimeAfter - pausedTimeBefore).toBeLessThan(0.02);

  await replayTutorial.click();
  await expect(onboardingMenu).toBeVisible();
  await expect(pauseMenu).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(onboardingMenu).toBeHidden();
  await expect(pauseMenu).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(pauseMenu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(pauseMenu).toBeHidden();

  const resumedTimeBefore = await page.evaluate(() => {
    return (window as Window & { __BLACKWAKE_DEBUG__?: { worldState: { time: number } } }).__BLACKWAKE_DEBUG__?.worldState.time ?? 0;
  });
  await page.waitForTimeout(320);
  const resumedTimeAfter = await page.evaluate(() => {
    return (window as Window & { __BLACKWAKE_DEBUG__?: { worldState: { time: number } } }).__BLACKWAKE_DEBUG__?.worldState.time ?? 0;
  });
  expect(resumedTimeAfter).toBeGreaterThan(resumedTimeBefore + 0.12);

  await page.keyboard.press("F3");
  await expect(debug).toBeVisible();

  await page.keyboard.down("Shift");
  await page.waitForTimeout(150);
  await expect(debug).toContainText("Burst ON");
  await page.keyboard.up("Shift");

  expect(await fireUntilReloadStarts(page, debug, "KeyQ", "L")).toBeGreaterThan(0);
  expect(await fireUntilReloadStarts(page, debug, "KeyE", "R")).toBeGreaterThan(0);

  await page.evaluate(() => {
    const debugState = (window as Window & {
      __BLACKWAKE_DEBUG__?: {
        worldState: {
          player: { position: { x: number; z: number } };
          port: { position: { x: number; z: number } };
        };
      };
    }).__BLACKWAKE_DEBUG__;
    if (!debugState) {
      return;
    }
    debugState.worldState.player.position.x = debugState.worldState.port.position.x;
    debugState.worldState.player.position.z = debugState.worldState.port.position.z;
  });
  await page.waitForTimeout(220);

  await page.evaluate(() => {
    const debugState = (window as Window & {
      __BLACKWAKE_DEBUG__?: {
        worldState: {
          player: { position: { x: number; z: number } };
          port: {
            position: { x: number; z: number };
            playerInRange: boolean;
            playerNearPort: boolean;
            menuOpen: boolean;
          };
        };
      };
    }).__BLACKWAKE_DEBUG__;
    if (!debugState) {
      return;
    }
    debugState.worldState.player.position.x = debugState.worldState.port.position.x;
    debugState.worldState.player.position.z = debugState.worldState.port.position.z;
    debugState.worldState.port.playerInRange = true;
    debugState.worldState.port.playerNearPort = true;
    debugState.worldState.port.menuOpen = true;
  });
  await page.waitForTimeout(180);
  await expect(dockMenu).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dockMenu).toBeHidden();
  await expect(pauseMenu).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(pauseMenu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(pauseMenu).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(hudPrimary).toBeVisible();
  await expect(hudMinimap).toBeVisible();

  const minimapBox = await hudMinimap.boundingBox();
  expect(minimapBox).toBeTruthy();
  if (minimapBox) {
    expect(minimapBox.x).toBeGreaterThanOrEqual(0);
    expect(minimapBox.y).toBeGreaterThanOrEqual(0);
    expect(minimapBox.x + minimapBox.width).toBeLessThanOrEqual(390);
    expect(minimapBox.y + minimapBox.height).toBeLessThanOrEqual(844);
  }
});
