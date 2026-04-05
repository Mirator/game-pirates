import "./style.css";
import { createDebugOverlay } from "./game/diagnostics";
import { createInputState } from "./game/input";
import { createLoop, createRenderer, createRenderWorld, syncRenderFromSimulation } from "./game/render";
import { FIXED_TIME_STEP, MAX_FRAME_DT, createInitialWorldState, updateSimulation } from "./game/simulation";

const app = document.querySelector<HTMLElement>("#app");
if (!app) {
  throw new Error("Missing #app root element.");
}

const worldState = createInitialWorldState();
const inputController = createInputState(window);

const rendererContext = createRenderer(app);
const renderWorld = createRenderWorld();
const { renderer } = rendererContext;

const debugOverlay = createDebugOverlay(app, window);

let fpsAccumulator = 0;
let fpsFrameCount = 0;
let fps = 60;

const loop = createLoop({
  fixedStep: FIXED_TIME_STEP,
  maxFrameDelta: MAX_FRAME_DT,
  update: (dt) => {
    updateSimulation(worldState, inputController.state, dt);
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
      enemyHp: worldState.enemy.hp,
      playerReloadLeft: worldState.player.reload.left,
      playerReloadRight: worldState.player.reload.right,
      enemyState: worldState.enemy.aiState
    });

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
  rendererContext.dispose();
};

window.addEventListener("beforeunload", cleanup, { once: true });
