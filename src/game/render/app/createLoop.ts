export interface LoopConfig {
  fixedStep: number;
  maxFrameDelta: number;
  update: (dt: number) => void;
  render: (frameDt: number) => void;
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
      config.update(config.fixedStep);
      accumulator -= config.fixedStep;
    }

    config.render(frameDelta);
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
