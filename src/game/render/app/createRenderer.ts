import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, WebGLRenderer } from "three";

export interface RendererContext {
  renderer: WebGLRenderer;
  canvas: HTMLCanvasElement;
  contextLost: boolean;
  dispose: () => void;
}

export function createRenderer(root: HTMLElement): RendererContext {
  const lowPowerMode = import.meta.env.VITE_RENDER_LOW_POWER === "1";
  const requestedPixelRatioCap = Number(import.meta.env.VITE_RENDER_PIXEL_RATIO_CAP);
  const pixelRatioCap =
    Number.isFinite(requestedPixelRatioCap) && requestedPixelRatioCap > 0 ? requestedPixelRatioCap : lowPowerMode ? 1 : 2;
  const renderer = new WebGLRenderer({
    antialias: !lowPowerMode,
    alpha: false,
    powerPreference: lowPowerMode ? "low-power" : "high-performance"
  });

  const applyRendererDefaults = (): void => {
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = !lowPowerMode;
    renderer.shadowMap.type = PCFShadowMap;
  };

  applyRendererDefaults();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const canvas = renderer.domElement;
  root.appendChild(canvas);

  let contextLost = false;
  let disposed = false;

  const onContextLost = (event: Event): void => {
    event.preventDefault();
    contextLost = true;
  };

  const onContextRestored = (): void => {
    contextLost = false;
    applyRendererDefaults();
  };

  canvas.addEventListener("webglcontextlost", onContextLost, false);
  canvas.addEventListener("webglcontextrestored", onContextRestored, false);

  const onResize = (): void => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
    renderer.setSize(window.innerWidth, window.innerHeight);
  };

  window.addEventListener("resize", onResize);

  return {
    renderer,
    canvas,
    get contextLost() {
      return contextLost;
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      canvas.parentElement?.removeChild(canvas);
      renderer.dispose();
    }
  };
}
