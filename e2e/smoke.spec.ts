import { expect, test } from "@playwright/test";

function parseReloadValue(text: string, side: "L" | "R"): number {
  const pattern = side === "L" ? /Reload L ([0-9]+\.[0-9]+)s/ : /\| R ([0-9]+\.[0-9]+)s/;
  const match = text.match(pattern);
  if (!match) {
    return 0;
  }
  return Number.parseFloat(match[1] ?? "0");
}

test("smoke: controls, dock flow, burst, hud, minimap, resize", async ({ page }) => {
  await page.goto("/");

  const canvas = page.locator("canvas").first();
  const hudPrimary = page.locator(".hud-panel-primary");
  const hudMinimap = page.locator(".hud-panel-minimap");
  const dockMenu = page.locator(".dock-menu");
  const debug = page.locator("[aria-label='Phase 1 debug readout']");

  await expect(canvas).toBeVisible();
  await expect(hudPrimary).toBeVisible();
  await expect(hudMinimap).toBeVisible();

  await page.keyboard.press("F3");
  await expect(debug).toBeVisible();

  await page.keyboard.down("Shift");
  await page.waitForTimeout(150);
  await expect(debug).toContainText("Burst ON");
  await page.keyboard.up("Shift");

  await page.keyboard.down("KeyQ");
  await page.waitForTimeout(220);
  await page.keyboard.up("KeyQ");
  await page.waitForTimeout(120);
  const afterPortShot = await debug.innerText();
  expect(parseReloadValue(afterPortShot, "L")).toBeGreaterThan(0);

  await page.keyboard.down("KeyE");
  await page.waitForTimeout(220);
  await page.keyboard.up("KeyE");
  await page.waitForTimeout(120);
  const afterStarboardShot = await debug.innerText();
  expect(parseReloadValue(afterStarboardShot, "R")).toBeGreaterThan(0);

  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(1200);
  await page.keyboard.up("KeyA");
  await page.keyboard.up("KeyW");

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
  await page.waitForTimeout(200);

  await page.keyboard.press("Space");
  await expect(dockMenu).toBeVisible();

  await page.keyboard.press("Space");
  await expect(dockMenu).toBeHidden();

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
