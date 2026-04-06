export interface LoopConfig {
  fixedStep: number;
  maxFrameDelta: number;
  beforeFixedUpdate?: () => void;
  update: (dt: number) => void;
  render: (frameDt: number, alpha: number) => void;
}

export interface LoopController {
  start: () => void;
  stop: () => void;
}

export function createLoop(config: LoopConfig): LoopController {
  let running = false;
  let frameHandle = 0;
  let lastTimestamp = 0;
  let accumulator = 0;

  const clamp01 = (value: number): number => {
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
  };

  const frame = (timestamp: number): void => {
    if (!running) {
      return;
    }

    if (lastTimestamp === 0) {
      lastTimestamp = timestamp;
    }

    const rawDelta = (timestamp - lastTimestamp) / 1000;
    const frameDelta = Math.min(rawDelta, config.maxFrameDelta);
    lastTimestamp = timestamp;

    accumulator += frameDelta;
    while (accumulator >= config.fixedStep) {
      config.beforeFixedUpdate?.();
      config.update(config.fixedStep);
      accumulator -= config.fixedStep;
    }

    const alpha = clamp01(accumulator / config.fixedStep);
    config.render(frameDelta, alpha);
    frameHandle = window.requestAnimationFrame(frame);
  };

  return {
    start: () => {
      if (running) {
        return;
      }
      running = true;
      lastTimestamp = 0;
      accumulator = 0;
      frameHandle = window.requestAnimationFrame(frame);
    },
    stop: () => {
      if (!running) {
        return;
      }
      running = false;
      window.cancelAnimationFrame(frameHandle);
    }
  };
}
