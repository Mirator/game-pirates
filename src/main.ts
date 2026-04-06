import "./style.css";
import { createAudioSystem } from "./game/audio";
import { createDebugOverlay } from "./game/diagnostics";
import { createInputState } from "./game/input";
import { createLoop, createRenderer, createRenderWorld, syncRenderFromSimulation } from "./game/render";
import {
  FIXED_TIME_STEP,
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
const debugWindow = window as Window & {
  __BLACKWAKE_DEBUG__?: {
    worldState: typeof worldState;
  };
};
debugWindow.__BLACKWAKE_DEBUG__ = { worldState };
const inputController = createInputState(window);

const rendererContext = createRenderer(app);
const renderWorld = createRenderWorld();
const { renderer } = rendererContext;

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

const loop = createLoop({
  fixedStep: FIXED_TIME_STEP,
  maxFrameDelta: MAX_FRAME_DT,
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
  render: (frameDt) => {
    syncRenderFromSimulation(worldState, renderWorld.bridge, frameDt);

    fpsAccumulator += frameDt;
    fpsFrameCount += 1;
    if (fpsAccumulator >= 0.25) {
      fps = fpsFrameCount / fpsAccumulator;
      fpsAccumulator = 0;
      fpsFrameCount = 0;
    }

    debugOverlay.setSnapshot({
      fps,
      playerHp: worldState.player.hp,
      playerMaxHp: worldState.player.maxHp,
      enemiesAlive: worldState.enemies.filter((enemy) => enemy.status === "alive").length,
      lootCount: worldState.loot.length,
      gold: worldState.wallet.gold,
      repairMaterials: worldState.wallet.repairMaterials,
      cargo: worldState.wallet.cargo,
      treasureMaps: worldState.wallet.treasureMaps,
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
};

window.addEventListener("beforeunload", cleanup, { once: true });
