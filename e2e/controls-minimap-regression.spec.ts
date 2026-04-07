import { expect, test } from "@playwright/test";

interface ShotSample {
  inferredScreenSide: "left" | "right";
  inferredWorldSide: "left" | "right";
  reloadLeft: number;
  reloadRight: number;
  muzzleLeftTimer: number;
  muzzleRightTimer: number;
}

interface RegressionResult {
  qSample: ShotSample | null;
  eSample: ShotSample | null;
  headingDelta: number;
  bowScreenDelta: number;
  minimapStaticDiffRatio: number;
  minimapArrowTipBeforeX: number;
  minimapArrowTipAfterX: number;
  cameraProjectionX: number;
  cameraUpWorldY: number;
}

test("controls + minimap regression: Q/E side mapping, A/D direction, north-up minimap", async ({ page }) => {
  await page.goto("/");

  const onboarding = page.locator("[data-testid='onboarding-menu']");
  if (await onboarding.isVisible().catch(() => false)) {
    const skip = onboarding.getByRole("button", { name: /Skip|Start Sailing/i });
    if (await skip.first().isVisible().catch(() => false)) {
      await skip.first().click();
    } else {
      await page.keyboard.press("Escape");
    }
  }

  const result = await page.evaluate(async (): Promise<RegressionResult> => {
    const dbg = (window as Window & { __BLACKWAKE_DEBUG__?: { worldState: any; bridge?: any } }).__BLACKWAKE_DEBUG__;
    if (!dbg) {
      throw new Error("Missing debug state");
    }

    const world = dbg.worldState;
    const bridge = dbg.bridge;
    if (!bridge?.camera || !bridge?.playerVisual?.group) {
      throw new Error("Missing render bridge debug handles");
    }

    world.spawnDirector.maxActive = 0;
    world.spawnDirector.timer = 999;
    world.eventDirector.timer = 999;
    world.eventDirector.activeKind = null;
    world.eventDirector.remaining = 0;
    world.storm.active = false;
    world.enemies.length = 0;
    world.projectiles.length = 0;
    world.nextProjectileId = 1;
    world.port.menuOpen = false;

    world.player.position.x = 0;
    world.player.position.z = 0;
    world.player.heading = 0;
    world.player.speed = 0;
    world.player.drift = 0;
    world.player.throttle = 0;
    world.player.reload.left = 0;
    world.player.reload.right = 0;

    const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

    const makeVector3 = (x: number, y: number, z: number): any => {
      return bridge.camera.position.clone().set(x, y, z);
    };

    const classifyLatestShot = (): ShotSample | null => {
      const projectile = world.projectiles[world.projectiles.length - 1];
      if (!projectile) {
        return null;
      }

      const heading = world.player.heading;
      const left = { x: -Math.cos(heading), z: Math.sin(heading) };
      const relX = projectile.position.x - world.player.position.x;
      const relZ = projectile.position.z - world.player.position.z;
      const sideDot = relX * left.x + relZ * left.z;
      const inferredWorldSide: "left" | "right" = sideDot >= 0 ? "left" : "right";

      const playerMesh = bridge.playerVisual.group;
      const playerScreen = makeVector3(playerMesh.position.x, playerMesh.position.y + 1.06, playerMesh.position.z).project(bridge.camera);
      const projectileScreen = makeVector3(projectile.position.x, 1.06, projectile.position.z).project(bridge.camera);
      const inferredScreenSide: "left" | "right" = projectileScreen.x < playerScreen.x ? "left" : "right";

      return {
        inferredScreenSide,
        inferredWorldSide,
        reloadLeft: world.player.reload.left,
        reloadRight: world.player.reload.right,
        muzzleLeftTimer: bridge.playerFx.muzzleLeftTimer,
        muzzleRightTimer: bridge.playerFx.muzzleRightTimer
      };
    };

    const tapAndSample = async (key: string, code: string): Promise<ShotSample | null> => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key, code, bubbles: true }));
      await wait(40);
      const sample = classifyLatestShot();
      window.dispatchEvent(new KeyboardEvent("keyup", { key, code, bubbles: true }));
      await wait(120);
      return sample;
    };

    const qSample = await tapAndSample("q", "KeyQ");

    world.player.reload.left = 0;
    world.player.reload.right = 0;

    const eSample = await tapAndSample("e", "KeyE");

    const projectBowX = (): number => {
      const heading = world.player.heading;
      const bowX = world.player.position.x + Math.sin(heading) * 6;
      const bowZ = world.player.position.z + Math.cos(heading) * 6;
      return makeVector3(bowX, 1.2, bowZ).project(bridge.camera).x;
    };

    const minimap = document.querySelector<HTMLCanvasElement>(".hud-minimap-canvas");
    if (!minimap) {
      throw new Error("Missing minimap canvas");
    }
    const minimapCtx = minimap.getContext("2d");
    if (!minimapCtx) {
      throw new Error("Missing minimap context");
    }

    const captureMinimap = (): Uint8ClampedArray => minimapCtx.getImageData(0, 0, minimap.width, minimap.height).data;

    const findArrowTipX = (image: Uint8ClampedArray): number => {
      const centerX = minimap.width * 0.5;
      const centerY = minimap.height * 0.5;
      let bestX = centerX;
      let bestY = Number.POSITIVE_INFINITY;

      for (let y = 0; y < minimap.height; y += 1) {
        for (let x = 0; x < minimap.width; x += 1) {
          const dx = x - centerX;
          const dy = y - centerY;
          const distanceSq = dx * dx + dy * dy;
          if (distanceSq < 9 || distanceSq > 225) {
            continue;
          }

          const index = (y * minimap.width + x) * 4;
          const r = image[index] ?? 0;
          const g = image[index + 1] ?? 0;
          const b = image[index + 2] ?? 0;
          const a = image[index + 3] ?? 0;
          if (a < 200 || r < 210 || g < 210 || b < 210) {
            continue;
          }

          if (y < bestY) {
            bestY = y;
            bestX = x;
          }
        }
      }

      return bestX;
    };

    const minimapBefore = captureMinimap();
    const minimapArrowTipBeforeX = findArrowTipX(minimapBefore);
    const bowBefore = projectBowX();
    const headingBefore = world.player.heading;

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", code: "KeyD", bubbles: true }));
    await wait(320);
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "d", code: "KeyD", bubbles: true }));
    await wait(120);

    const minimapAfter = captureMinimap();
    const minimapArrowTipAfterX = findArrowTipX(minimapAfter);
    const bowAfter = projectBowX();
    const headingAfter = world.player.heading;

    const centerX = minimap.width * 0.5;
    const centerY = minimap.height * 0.5;
    let changedOutsideCenter = 0;
    let totalOutsideCenter = 0;

    for (let y = 0; y < minimap.height; y += 1) {
      for (let x = 0; x < minimap.width; x += 1) {
        const dx = x - centerX;
        const dy = y - centerY;
        if (dx * dx + dy * dy <= 18 * 18) {
          continue;
        }

        totalOutsideCenter += 1;
        const index = (y * minimap.width + x) * 4;
        const dr = Math.abs((minimapAfter[index] ?? 0) - (minimapBefore[index] ?? 0));
        const dg = Math.abs((minimapAfter[index + 1] ?? 0) - (minimapBefore[index + 1] ?? 0));
        const db = Math.abs((minimapAfter[index + 2] ?? 0) - (minimapBefore[index + 2] ?? 0));
        const da = Math.abs((minimapAfter[index + 3] ?? 0) - (minimapBefore[index + 3] ?? 0));
        if (dr + dg + db + da > 40) {
          changedOutsideCenter += 1;
        }
      }
    }

    const minimapStaticDiffRatio = totalOutsideCenter > 0 ? changedOutsideCenter / totalOutsideCenter : 0;

    const cameraProjectionX = bridge.camera.projectionMatrix.elements[0] ?? 0;
    const cameraUpWorld = makeVector3(0, 1, 0).applyQuaternion(bridge.camera.quaternion);

    return {
      qSample,
      eSample,
      headingDelta: headingAfter - headingBefore,
      bowScreenDelta: bowAfter - bowBefore,
      minimapStaticDiffRatio,
      minimapArrowTipBeforeX,
      minimapArrowTipAfterX,
      cameraProjectionX,
      cameraUpWorldY: cameraUpWorld.y
    };
  });

  expect(result.qSample).not.toBeNull();
  expect(result.qSample?.inferredScreenSide).toBe("left");
  expect(result.qSample?.reloadLeft ?? 0).toBeGreaterThan(0);
  expect(result.qSample?.muzzleLeftTimer ?? 0).toBeGreaterThan(0);

  expect(result.eSample).not.toBeNull();
  expect(result.eSample?.inferredScreenSide).toBe("right");
  expect(result.eSample?.reloadRight ?? 0).toBeGreaterThan(0);
  expect(result.eSample?.muzzleRightTimer ?? 0).toBeGreaterThan(0);

  expect(Math.abs(result.headingDelta)).toBeGreaterThan(0.01);
  expect(result.bowScreenDelta).toBeGreaterThan(0.005);

  expect(result.minimapStaticDiffRatio).toBeLessThan(0.02);
  expect(result.minimapArrowTipAfterX).toBeGreaterThan(result.minimapArrowTipBeforeX + 0.5);
  expect(result.cameraProjectionX).toBeGreaterThan(0);
  expect(result.cameraUpWorldY).toBeGreaterThan(0.2);
});
