import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from "three";

export interface RendererContext {
  renderer: WebGLRenderer;
  canvas: HTMLCanvasElement;
  contextLost: boolean;
  dispose: () => void;
}

export function createRenderer(root: HTMLElement): RendererContext {
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: false
  });

  const applyRendererDefaults = (): void => {
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
  };

  applyRendererDefaults();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const canvas = renderer.domElement;
  root.appendChild(canvas);

  let contextLost = false;

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      renderer.dispose();
    }
  };
}
