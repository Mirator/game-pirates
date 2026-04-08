import "./style.css";
import { createAudioSystem } from "./game/audio";
import { createDebugOverlay } from "./game/diagnostics";
import { createInputState } from "./game/input";
import {
  createLoop,
  createRenderer,
  createRenderWorld,
  preloadShipAssetsForBrowser,
  syncRenderFromSimulation,
  type RenderInterpolationContext,
  type RenderPositionSnapshot,
  type RenderPreviousSnapshot,
  type RenderShipSnapshot
} from "./game/render";
import {
  FIXED_TIME_STEP,
  FIXED_TIME_STEP_30,
  MAX_FRAME_DT,
  closePortMenu,
  createInitialWorldState,
  drainSimulationEvents,
  tryPurchaseHullUpgrade,
  trySellCargo,
  updateSimulation
} from "./game/simulation";
import { createHud } from "./game/ui";

const app = document.querySelector<HTMLElement>("#app");
if (!app) {
  throw new Error("Missing #app root element.");
}

const worldState = createInitialWorldState();
const requestedPhysicsHz = Number(import.meta.env.VITE_PHYSICS_TICK_HZ);
const selectedFixedStep = requestedPhysicsHz === 30 ? FIXED_TIME_STEP_30 : FIXED_TIME_STEP;
worldState.physics.tickRateHz = selectedFixedStep === FIXED_TIME_STEP_30 ? 30 : 60;
const shouldExposeDebugHandles =
  import.meta.env.DEV && (import.meta.env.VITE_E2E_DEBUG === "1" || import.meta.env.VITE_DEBUG_WORLD === "1");
const debugWindow = window as Window & {
  __BLACKWAKE_DEBUG__?: {
    worldState: typeof worldState;
    water?: ReturnType<typeof createRenderWorld>["bridge"]["environment"]["water"];
    lighting?: ReturnType<typeof createRenderWorld>["bridge"]["environment"]["lighting"];
    wake?: ReturnType<typeof createRenderWorld>["bridge"]["wakeDebug"];
    bridge?: ReturnType<typeof createRenderWorld>["bridge"];
  };
};
const inputController = createInputState(window);

const rendererContext = createRenderer(app);
await preloadShipAssetsForBrowser();
const renderWorld = createRenderWorld({
  cameraInputTarget: rendererContext.canvas,
  cameraWindowTarget: window
});
const { renderer } = rendererContext;
renderer.toneMappingExposure = renderWorld.bridge.environment.lighting.getCurrentExposure();
if (shouldExposeDebugHandles) {
  debugWindow.__BLACKWAKE_DEBUG__ = {
    worldState,
    water: renderWorld.bridge.environment.water,
    lighting: renderWorld.bridge.environment.lighting,
    wake: renderWorld.bridge.wakeDebug,
    bridge: renderWorld.bridge
  };
}

const debugOverlay = createDebugOverlay(app, window);
const audioSystem = createAudioSystem(window);

let uiLocked = false;
const hud = createHud(app, {
  onUpgradeRequest: () => {
    if (tryPurchaseHullUpgrade(worldState)) {
      audioSystem.handleEvents(drainSimulationEvents(worldState));
    }
  },
  onSellCargoRequest: () => {
    if (trySellCargo(worldState)) {
      audioSystem.handleEvents(drainSimulationEvents(worldState));
    }
  },
  onCloseDockMenu: () => {
    closePortMenu(worldState);
    audioSystem.handleEvents(drainSimulationEvents(worldState));
  },
  onUiLockChange: (locked) => {
    uiLocked = locked;
  }
});

let fpsAccumulator = 0;
let fpsFrameCount = 0;
let fps = 60;
let uiRenderAccumulator = 1 / 30;

const getShipSpeed = (ship: typeof worldState.player): number => {
  const forwardX = Math.sin(ship.heading);
  const forwardZ = Math.cos(ship.heading);
  return ship.linearVelocity.x * forwardX + ship.linearVelocity.z * forwardZ;
};

const getShipDrift = (ship: typeof worldState.player): number => {
  const leftX = -Math.cos(ship.heading);
  const leftZ = Math.sin(ship.heading);
  return ship.linearVelocity.x * leftX + ship.linearVelocity.z * leftZ;
};

const previousSnapshot: RenderPreviousSnapshot = {
  player: {
    x: worldState.player.position.x,
    y: worldState.player.position.y,
    z: worldState.player.position.z,
    heading: worldState.player.heading,
    pitch: worldState.player.pitch,
    roll: worldState.player.roll,
    speed: getShipSpeed(worldState.player),
    drift: getShipDrift(worldState.player),
    throttle: worldState.player.throttle
  },
  enemies: new Map(),
  projectiles: new Map(),
  loot: new Map()
};

const interpolationContext: RenderInterpolationContext = {
  alpha: 0,
  fixedStep: selectedFixedStep,
  previousSnapshot
};

const snapshotSeenIds = {
  enemies: new Set<number>(),
  projectiles: new Set<number>(),
  loot: new Set<number>()
};

const copyShipSnapshot = (target: RenderShipSnapshot, source: typeof worldState.player): void => {
  target.x = source.position.x;
  target.y = source.position.y;
  target.z = source.position.z;
  target.heading = source.heading;
  target.pitch = source.pitch;
  target.roll = source.roll;
  target.speed = getShipSpeed(source);
  target.drift = getShipDrift(source);
  target.throttle = source.throttle;
};

const copyPositionSnapshot = (target: RenderPositionSnapshot, x: number, y: number, z: number): void => {
  target.x = x;
  target.y = y;
  target.z = z;
};

const capturePreviousSnapshot = (): void => {
  copyShipSnapshot(previousSnapshot.player, worldState.player);

  snapshotSeenIds.enemies.clear();
  for (const enemy of worldState.enemies) {
    let target = previousSnapshot.enemies.get(enemy.id);
    if (!target) {
      target = {
        x: enemy.position.x,
        y: enemy.position.y,
        z: enemy.position.z,
        heading: enemy.heading,
        pitch: enemy.pitch,
        roll: enemy.roll,
        speed: getShipSpeed(enemy),
        drift: getShipDrift(enemy),
        throttle: enemy.throttle
      };
      previousSnapshot.enemies.set(enemy.id, target);
    } else {
      copyShipSnapshot(target, enemy);
    }
    snapshotSeenIds.enemies.add(enemy.id);
  }
  for (const enemyId of previousSnapshot.enemies.keys()) {
    if (!snapshotSeenIds.enemies.has(enemyId)) {
      previousSnapshot.enemies.delete(enemyId);
    }
  }

  snapshotSeenIds.projectiles.clear();
  for (const projectile of worldState.projectiles) {
    if (!projectile.active) {
      continue;
    }
    let target = previousSnapshot.projectiles.get(projectile.id);
    if (!target) {
      target = {
        x: projectile.position.x,
        y: projectile.position.y,
        z: projectile.position.z
      };
      previousSnapshot.projectiles.set(projectile.id, target);
    } else {
      copyPositionSnapshot(target, projectile.position.x, projectile.position.y, projectile.position.z);
    }
    snapshotSeenIds.projectiles.add(projectile.id);
  }
  for (const projectileId of previousSnapshot.projectiles.keys()) {
    if (!snapshotSeenIds.projectiles.has(projectileId)) {
      previousSnapshot.projectiles.delete(projectileId);
    }
  }

  snapshotSeenIds.loot.clear();
  for (const loot of worldState.loot) {
    if (!loot.active) {
      continue;
    }
    let target = previousSnapshot.loot.get(loot.id);
    if (!target) {
      target = {
        x: loot.position.x,
        y: loot.position.y,
        z: loot.position.z
      };
      previousSnapshot.loot.set(loot.id, target);
    } else {
      copyPositionSnapshot(target, loot.position.x, loot.position.y, loot.position.z);
    }
    snapshotSeenIds.loot.add(loot.id);
  }
  for (const lootId of previousSnapshot.loot.keys()) {
    if (!snapshotSeenIds.loot.has(lootId)) {
      previousSnapshot.loot.delete(lootId);
    }
  }
};

const countAliveEnemies = (): number => {
  let alive = 0;
  for (const enemy of worldState.enemies) {
    if (enemy.status === "alive") {
      alive += 1;
    }
  }
  return alive;
};

capturePreviousSnapshot();

const loop = createLoop({
  fixedStep: selectedFixedStep,
  maxFrameDelta: MAX_FRAME_DT,
  beforeFixedUpdate: capturePreviousSnapshot,
  update: (dt) => {
    if (!uiLocked) {
      updateSimulation(worldState, inputController.state, dt);
    }

    // Avoid queued one-frame actions (Space/R) firing after menus close.
    inputController.consumeFrameFlags();

    audioSystem.syncMusic({
      combatIntensity: worldState.combatIntensity,
      menuOpen: worldState.port.menuOpen || uiLocked,
      activeEvent: worldState.eventDirector.activeKind,
      stormActive: worldState.storm.active
    });

    const events = drainSimulationEvents(worldState);
    audioSystem.handleEvents(events);
  },
  render: (frameDt, alpha) => {
    interpolationContext.alpha = alpha;
    syncRenderFromSimulation(worldState, renderWorld.bridge, frameDt, interpolationContext);
    renderer.toneMappingExposure = renderWorld.bridge.environment.lighting.getCurrentExposure();

    fpsAccumulator += frameDt;
    fpsFrameCount += 1;
    if (fpsAccumulator >= 0.25) {
      fps = fpsFrameCount / fpsAccumulator;
      fpsAccumulator = 0;
      fpsFrameCount = 0;
    }

    uiRenderAccumulator += frameDt;
    if (uiRenderAccumulator >= 1 / 30) {
      uiRenderAccumulator %= 1 / 30;

      debugOverlay.setSnapshot({
        fps,
        playerHp: worldState.player.hp,
        playerMaxHp: worldState.player.maxHp,
        enemiesAlive: countAliveEnemies(),
        lootCount: worldState.loot.length,
        gold: worldState.wallet.gold,
        repairMaterials: worldState.wallet.repairMaterials,
        cargo: worldState.wallet.cargo,
        playerReloadLeft: worldState.player.reload.left,
        playerReloadRight: worldState.player.reload.right,
        burstActive: worldState.burst.active,
        burstCooldown: worldState.burst.cooldown,
        menuOpen: worldState.port.menuOpen || uiLocked,
        activeEvent: worldState.eventDirector.activeKind ?? "none",
        combatIntensity: worldState.combatIntensity,
        stormActive: worldState.storm.active
      });
      hud.update(worldState);
    }

    if (!rendererContext.contextLost) {
      renderer.render(renderWorld.scene, renderWorld.camera);
    }
  }
});

loop.start();

const cleanup = (): void => {
  loop.stop();
  inputController.dispose();
  debugOverlay.dispose();
  hud.dispose();
  audioSystem.dispose();
  renderWorld.dispose();
  rendererContext.dispose();
  if (shouldExposeDebugHandles) {
    delete debugWindow.__BLACKWAKE_DEBUG__;
  }
};

window.addEventListener("beforeunload", cleanup, { once: true });
