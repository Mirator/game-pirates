import { expect, test, type Page } from "@playwright/test";
import { expectWorldTimeAdvance, expectWorldTimeStable, readEnemyCount, waitForDebugReady } from "./debugHelpers";

type ReloadSide = "left" | "right";

async function readReloadTimer(page: Page, side: ReloadSide): Promise<number> {
  return page.evaluate((activeSide) => {
    const debugState = (window as Window & {
      __BLACKWAKE_DEBUG__?: {
        worldState?: {
          player?: {
            reload?: {
              left: number;
              right: number;
            };
          };
        };
      };
    }).__BLACKWAKE_DEBUG__;
    if (!debugState?.worldState?.player?.reload) {
      return 0;
    }
    return activeSide === "left" ? debugState.worldState.player.reload.left : debugState.worldState.player.reload.right;
  }, side);
}

async function fireUntilReloadStarts(page: Page, keyCode: "KeyQ" | "KeyE", side: ReloadSide): Promise<number> {
  let observed = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.keyboard.press(keyCode, { delay: 170 });
    try {
      await expect
        .poll(
          async () => {
            observed = await readReloadTimer(page, side);
            return observed;
          },
          {
            timeout: 900,
            intervals: [80, 120, 160]
          }
        )
        .toBeGreaterThan(0);
      return observed;
    } catch {
      await page.keyboard.press("KeyA", { delay: 130 });
    }
  }

  return observed;
}

async function setupShipReadabilityScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const debugState = (window as Window & {
      __BLACKWAKE_DEBUG__?: {
        worldState: {
          spawnDirector: {
            maxActive: number;
            timer: number;
            initialSpawnDelay: number;
            staggerDelay: number;
          };
          eventDirector: {
            timer: number;
          };
          storm: {
            active: boolean;
          };
        };
      };
    }).__BLACKWAKE_DEBUG__;
    if (!debugState) {
      return;
    }

    debugState.worldState.spawnDirector.maxActive = 3;
    debugState.worldState.spawnDirector.timer = 0;
    debugState.worldState.spawnDirector.initialSpawnDelay = 0;
    debugState.worldState.spawnDirector.staggerDelay = 0.06;
    debugState.worldState.eventDirector.timer = 999;
    debugState.worldState.storm.active = false;
  });

  await page.waitForFunction(() => {
    const debugState = (window as Window & {
      __BLACKWAKE_DEBUG__?: {
        worldState: {
          enemies: Array<unknown>;
        };
      };
    }).__BLACKWAKE_DEBUG__;
    return (debugState?.worldState.enemies.length ?? 0) >= 3;
  });

  await page.evaluate(() => {
    const debugState = (window as Window & {
      __BLACKWAKE_DEBUG__?: {
        worldState: {
          player: {
            position: { x: number; z: number };
            heading: number;
            speed: number;
            drift: number;
            throttle: number;
          };
          enemies: Array<{
            archetype: "merchant" | "raider" | "navy";
            position: { x: number; z: number };
            heading: number;
            speed: number;
            drift: number;
            throttle: number;
            status: "alive" | "sinking";
          }>;
        };
      };
    }).__BLACKWAKE_DEBUG__;
    if (!debugState) {
      return;
    }

    const world = debugState.worldState;
    world.player.position.x = 0;
    world.player.position.z = -10;
    world.player.heading = 0;
    world.player.speed = 0;
    world.player.drift = 0;
    world.player.throttle = 0;

    const placements = [
      { archetype: "merchant" as const, x: -13, z: 8, heading: Math.PI * 1.28 },
      { archetype: "raider" as const, x: 0, z: 13, heading: Math.PI * 1.02 },
      { archetype: "navy" as const, x: 14, z: 9, heading: Math.PI * 1.35 }
    ];

    for (let i = 0; i < placements.length; i += 1) {
      const enemy = world.enemies[i];
      const placement = placements[i];
      if (!enemy || !placement) {
        continue;
      }
      enemy.archetype = placement.archetype;
      enemy.position.x = placement.x;
      enemy.position.z = placement.z;
      enemy.heading = placement.heading;
      enemy.speed = 0;
      enemy.drift = 0;
      enemy.throttle = 0;
      enemy.status = "alive";
    }
  });
}

test("smoke: pause flow, esc precedence, combat, and responsive hud", async ({ page }) => {
  await page.goto("/");
  await waitForDebugReady(page);

  const canvas = page.locator("canvas").first();
  const hudPrimary = page.locator(".hud-panel-primary");
  const hudMinimap = page.locator(".hud-panel-minimap");
  const dockMenu = page.locator("[data-testid='dock-menu']");
  const pauseMenu = page.locator("[data-testid='pause-menu']");
  const debug = page.locator("[aria-label='Debug readout']");

  await expect(canvas).toBeVisible();
  await expect(hudPrimary).toBeVisible();
  await expect(hudMinimap).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(pauseMenu).toBeVisible();

  await expectWorldTimeStable(page, 0.06, 1200);

  await page.keyboard.press("Escape");
  await expect(pauseMenu).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(pauseMenu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(pauseMenu).toBeHidden();

  await expectWorldTimeAdvance(page, 0.11, 1400);

  await page.keyboard.press("F3");
  await expect(debug).toBeVisible();

  await page.keyboard.press("Shift", { delay: 180 });

  expect(await fireUntilReloadStarts(page, "KeyQ", "left")).toBeGreaterThan(0);
  expect(await fireUntilReloadStarts(page, "KeyE", "right")).toBeGreaterThan(0);

  await setupShipReadabilityScene(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect
    .poll(
      async () => {
        return readEnemyCount(page);
      },
      {
        timeout: 2500,
        intervals: [100, 150, 200]
      }
    )
    .toBeGreaterThanOrEqual(3);

  const shipAssetSources = await page.evaluate(() => {
    const debugState = (window as Window & {
      __BLACKWAKE_DEBUG__?: {
        bridge?: {
          playerVisual?: {
            group?: {
              userData?: Record<string, unknown>;
            };
          };
          enemyVisuals?: Map<number, { group: { userData?: Record<string, unknown> } }>;
        };
      };
    }).__BLACKWAKE_DEBUG__;
    const playerAssetSource = String(debugState?.bridge?.playerVisual?.group?.userData?.assetSource ?? "missing");
    const enemyAssetSources = Array.from(debugState?.bridge?.enemyVisuals?.values?.() ?? []).map((visual) =>
      String(visual.group.userData?.assetSource ?? "missing")
    );
    return { playerAssetSource, enemyAssetSources };
  });
  expect(shipAssetSources.playerAssetSource).toBe("gltf");
  expect(shipAssetSources.enemyAssetSources.every((source) => source === "gltf")).toBe(true);

  await page.screenshot({ path: "test-results/ship-readability-desktop.png" });

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
  await page.screenshot({ path: "test-results/ship-readability-mobile.png" });

  const minimapBox = await hudMinimap.boundingBox();
  expect(minimapBox).toBeTruthy();
  if (minimapBox) {
    expect(minimapBox.x).toBeGreaterThanOrEqual(0);
    expect(minimapBox.y).toBeGreaterThanOrEqual(0);
    expect(minimapBox.x + minimapBox.width).toBeLessThanOrEqual(390);
    expect(minimapBox.y + minimapBox.height).toBeLessThanOrEqual(844);
  }
});
