import { expect, test } from "@playwright/test";
import { waitForDebugReady } from "./debugHelpers";

interface ShotSample {
  inferredProjectileScreenSide: "left" | "right";
  inferredMuzzleScreenSide: "left" | "right" | null;
  reloadLeft: number;
  reloadRight: number;
  muzzleLeftTimer: number;
  muzzleRightTimer: number;
}

interface RegressionResult {
  sideSamples: Array<{
    heading: number;
    qSample: ShotSample | null;
    eSample: ShotSample | null;
  }>;
  minimapStaticDiffRatio: number;
  minimapCenterDiffRatio: number;
  turnDeltaD: number;
  turnDeltaA: number;
  cameraProjectionX: number;
  cameraUpWorldY: number;
  cameraHeadingOffsetAbs: number;
}

test("controls + minimap regression: Q/E side mapping, A/D direction, north-up minimap", async ({ page }) => {
  await page.goto("/");
  await waitForDebugReady(page);

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

    const nextFrame = (): Promise<void> =>
      new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
      });

    const waitForCondition = async (predicate: () => boolean, timeoutMs: number): Promise<boolean> => {
      const startedAt = performance.now();
      while (performance.now() - startedAt < timeoutMs) {
        if (predicate()) {
          return true;
        }
        await nextFrame();
      }
      return predicate();
    };

    const makeVector3 = (x: number, y: number, z: number): any => bridge.camera.position.clone().set(x, y, z);

    const normalizeAngle = (angle: number): number => {
      let wrapped = angle;
      while (wrapped > Math.PI) wrapped -= Math.PI * 2;
      while (wrapped < -Math.PI) wrapped += Math.PI * 2;
      return wrapped;
    };

    const resetPlayerMotion = (): void => {
      world.player.position.x = 0;
      world.player.position.z = 0;
      world.player.speed = 0;
      world.player.drift = 0;
      world.player.throttle = 0;
      world.player.turnInput = 0;
      world.player.angularVelocity = 0;
      world.player.linearVelocity.x = 0;
      world.player.linearVelocity.y = 0;
      world.player.linearVelocity.z = 0;
      world.player.reload.left = 0;
      world.player.reload.right = 0;
      bridge.playerFx.muzzleLeftTimer = 0;
      bridge.playerFx.muzzleRightTimer = 0;
    };

    const classifyLatestShot = (): ShotSample | null => {
      const projectile = world.projectiles[world.projectiles.length - 1];
      if (!projectile) {
        return null;
      }

      const playerMesh = bridge.playerVisual.group;
      const playerScreen = makeVector3(
        playerMesh.position.x,
        playerMesh.position.y + 1.06,
        playerMesh.position.z
      ).project(bridge.camera);
      const projectileScreen = makeVector3(projectile.position.x, 1.06, projectile.position.z).project(bridge.camera);
      const inferredProjectileScreenSide: "left" | "right" =
        projectileScreen.x < playerScreen.x ? "left" : "right";

      const muzzleChoice =
        bridge.playerFx.muzzleLeftTimer > bridge.playerFx.muzzleRightTimer
          ? "left"
          : bridge.playerFx.muzzleRightTimer > 0
            ? "right"
            : null;

      let inferredMuzzleScreenSide: "left" | "right" | null = null;
      if (muzzleChoice) {
        const muzzleGroup = muzzleChoice === "left" ? bridge.playerVisual.muzzleLeft.group : bridge.playerVisual.muzzleRight.group;
        const muzzleWorld = makeVector3(0, 0, 0);
        muzzleGroup.getWorldPosition(muzzleWorld);
        const muzzleScreen = muzzleWorld.project(bridge.camera);
        inferredMuzzleScreenSide = muzzleScreen.x < playerScreen.x ? "left" : "right";
      }

      return {
        inferredProjectileScreenSide,
        inferredMuzzleScreenSide,
        reloadLeft: world.player.reload.left,
        reloadRight: world.player.reload.right,
        muzzleLeftTimer: bridge.playerFx.muzzleLeftTimer,
        muzzleRightTimer: bridge.playerFx.muzzleRightTimer
      };
    };

    const tapAndSample = async (key: string, code: string): Promise<ShotSample | null> => {
      const projectileCountBefore = world.projectiles.length;
      window.dispatchEvent(new KeyboardEvent("keydown", { key, code, bubbles: true }));
      await waitForCondition(
        () =>
          world.projectiles.length > projectileCountBefore ||
          bridge.playerFx.muzzleLeftTimer > 0 ||
          bridge.playerFx.muzzleRightTimer > 0,
        1400
      );

      const sample = classifyLatestShot();
      window.dispatchEvent(new KeyboardEvent("keyup", { key, code, bubbles: true }));
      await waitForCondition(
        () => bridge.playerFx.muzzleLeftTimer <= 0 && bridge.playerFx.muzzleRightTimer <= 0,
        700
      );
      return sample;
    };

    const sampleForHeading = async (
      heading: number
    ): Promise<{ heading: number; qSample: ShotSample | null; eSample: ShotSample | null }> => {
      resetPlayerMotion();
      world.player.heading = heading;
      await nextFrame();

      const qSample = await tapAndSample("q", "KeyQ");
      world.player.reload.left = 0;
      world.player.reload.right = 0;
      bridge.playerFx.muzzleLeftTimer = 0;
      bridge.playerFx.muzzleRightTimer = 0;
      await nextFrame();

      const eSample = await tapAndSample("e", "KeyE");
      return { heading, qSample, eSample };
    };

    const sideSamples = [
      await sampleForHeading(0),
      await sampleForHeading(0.9),
      await sampleForHeading(-1.2),
      await sampleForHeading(2.2)
    ];

    const minimap = document.querySelector<HTMLCanvasElement>(".hud-minimap-canvas");
    if (!minimap) {
      throw new Error("Missing minimap canvas");
    }
    const minimapCtx = minimap.getContext("2d");
    if (!minimapCtx) {
      throw new Error("Missing minimap context");
    }

    const captureMinimap = (): Uint8ClampedArray => minimapCtx.getImageData(0, 0, minimap.width, minimap.height).data;

    resetPlayerMotion();
    world.player.heading = 0;
    await nextFrame();
    const headingBeforeD = world.player.heading;
    const minimapBefore = captureMinimap();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", code: "KeyD", bubbles: true }));
    await waitForCondition(() => Math.abs(normalizeAngle(world.player.heading - headingBeforeD)) > 0.05, 1800);
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "d", code: "KeyD", bubbles: true }));
    await waitForCondition(
      () => Math.abs(normalizeAngle(bridge.cameraSmoothedHeading - world.player.heading)) < 0.03,
      1200
    );
    const headingAfterD = world.player.heading;
    const minimapAfter = captureMinimap();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA", bubbles: true }));
    await waitForCondition(() => Math.abs(normalizeAngle(world.player.heading - headingAfterD)) > 0.05, 1800);
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "a", code: "KeyA", bubbles: true }));
    await waitForCondition(
      () => Math.abs(normalizeAngle(bridge.cameraSmoothedHeading - world.player.heading)) < 0.03,
      1200
    );
    const headingAfterA = world.player.heading;

    const centerX = minimap.width * 0.5;
    const centerY = minimap.height * 0.5;
    let changedOutsideCenter = 0;
    let totalOutsideCenter = 0;
    let changedInsideCenter = 0;
    let totalInsideCenter = 0;
    for (let y = 0; y < minimap.height; y += 1) {
      for (let x = 0; x < minimap.width; x += 1) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq <= 18 * 18) {
          totalInsideCenter += 1;
          const index = (y * minimap.width + x) * 4;
          const dr = Math.abs((minimapAfter[index] ?? 0) - (minimapBefore[index] ?? 0));
          const dg = Math.abs((minimapAfter[index + 1] ?? 0) - (minimapBefore[index + 1] ?? 0));
          const db = Math.abs((minimapAfter[index + 2] ?? 0) - (minimapBefore[index + 2] ?? 0));
          const da = Math.abs((minimapAfter[index + 3] ?? 0) - (minimapBefore[index + 3] ?? 0));
          if (dr + dg + db + da > 40) {
            changedInsideCenter += 1;
          }
        } else {
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
    }

    let cameraHeadingOffset = bridge.cameraSmoothedHeading - world.player.heading;
    while (cameraHeadingOffset > Math.PI) cameraHeadingOffset -= Math.PI * 2;
    while (cameraHeadingOffset < -Math.PI) cameraHeadingOffset += Math.PI * 2;

    const cameraProjectionX = bridge.camera.projectionMatrix.elements[0] ?? 0;
    const cameraUpWorld = makeVector3(0, 1, 0).applyQuaternion(bridge.camera.quaternion);

    return {
      sideSamples,
      minimapStaticDiffRatio: totalOutsideCenter > 0 ? changedOutsideCenter / totalOutsideCenter : 0,
      minimapCenterDiffRatio: totalInsideCenter > 0 ? changedInsideCenter / totalInsideCenter : 0,
      turnDeltaD: normalizeAngle(headingAfterD - headingBeforeD),
      turnDeltaA: normalizeAngle(headingAfterA - headingAfterD),
      cameraProjectionX,
      cameraUpWorldY: cameraUpWorld.y,
      cameraHeadingOffsetAbs: Math.abs(cameraHeadingOffset)
    };
  });

  for (const sample of result.sideSamples) {
    expect(sample.qSample).not.toBeNull();
    expect(sample.qSample?.inferredMuzzleScreenSide).not.toBeNull();
    expect(sample.qSample?.reloadLeft ?? 0).toBeGreaterThan(0);
    expect((sample.qSample?.muzzleLeftTimer ?? 0) + (sample.qSample?.muzzleRightTimer ?? 0)).toBeGreaterThan(0);
    expect(((sample.qSample?.muzzleLeftTimer ?? 0) > 0) !== ((sample.qSample?.muzzleRightTimer ?? 0) > 0)).toBe(true);

    expect(sample.eSample).not.toBeNull();
    expect(sample.eSample?.inferredMuzzleScreenSide).not.toBeNull();
    expect(sample.eSample?.reloadRight ?? 0).toBeGreaterThan(0);
    expect((sample.eSample?.muzzleLeftTimer ?? 0) + (sample.eSample?.muzzleRightTimer ?? 0)).toBeGreaterThan(0);
    expect(((sample.eSample?.muzzleLeftTimer ?? 0) > 0) !== ((sample.eSample?.muzzleRightTimer ?? 0) > 0)).toBe(true);
  }

  expect(result.minimapStaticDiffRatio).toBeLessThan(0.03);
  expect(result.minimapCenterDiffRatio).toBeGreaterThan(0.0015);
  expect(result.turnDeltaD).toBeLessThan(-0.015);
  expect(result.turnDeltaA).toBeGreaterThan(0.002);
  expect(result.cameraHeadingOffsetAbs).toBeLessThan(0.03);
  expect(result.cameraProjectionX).toBeGreaterThan(0);
  expect(result.cameraUpWorldY).toBeGreaterThan(0.2);
});
