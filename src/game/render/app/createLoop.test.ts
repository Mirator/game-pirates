import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLoop } from "./createLoop";

type RafCallback = (timestamp: number) => void;

class MockWindowTarget {
  private nextHandle = 1;
  private callbacks = new Map<number, RafCallback>();

  requestAnimationFrame(callback: RafCallback): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancelAnimationFrame(handle: number): void {
    this.callbacks.delete(handle);
  }

  step(timestamp: number): void {
    const pending = [...this.callbacks.entries()];
    this.callbacks.clear();
    for (const [, callback] of pending) {
      callback(timestamp);
    }
  }
}

describe("createLoop", () => {
  let mockWindow: MockWindowTarget;
  const originalWindow = (globalThis as { window?: Window }).window;

  beforeEach(() => {
    mockWindow = new MockWindowTarget();
    Object.defineProperty(globalThis, "window", {
      value: mockWindow as unknown as Window,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        writable: true,
        configurable: true
      });
      return;
    }
    delete (globalThis as { window?: Window }).window;
  });

  it("reports interpolation alpha across uneven frame deltas", () => {
    const renderAlphas: number[] = [];
    const updateDts: number[] = [];

    const loop = createLoop({
      fixedStep: 1 / 60,
      maxFrameDelta: 0.2,
      update: (dt) => {
        updateDts.push(dt);
      },
      render: (_frameDt, alpha) => {
        renderAlphas.push(alpha);
      }
    });

    loop.start();
    mockWindow.step(100);
    mockWindow.step(110);
    mockWindow.step(120);

    expect(renderAlphas[0]).toBeCloseTo(0, 6);
    expect(renderAlphas[1]).toBeCloseTo(0.6, 6);
    expect(renderAlphas[2]).toBeCloseTo(0.2, 6);
    expect(updateDts).toHaveLength(1);
    expect(updateDts[0]).toBeCloseTo(1 / 60, 6);
  });

  it("runs beforeFixedUpdate once per fixed tick during catch-up", () => {
    let beforeCount = 0;
    let updateCount = 0;

    const loop = createLoop({
      fixedStep: 1 / 60,
      maxFrameDelta: 0.2,
      beforeFixedUpdate: () => {
        beforeCount += 1;
      },
      update: () => {
        updateCount += 1;
      },
      render: () => {}
    });

    loop.start();
    mockWindow.step(100);
    mockWindow.step(166);

    expect(updateCount).toBe(3);
    expect(beforeCount).toBe(3);
  });

  it("clamps long frame deltas to maxFrameDelta for stable stepping", () => {
    const frameDts: number[] = [];
    let updateCount = 0;

    const loop = createLoop({
      fixedStep: 1 / 60,
      maxFrameDelta: 1 / 20,
      update: () => {
        updateCount += 1;
      },
      render: (frameDt, alpha) => {
        frameDts.push(frameDt);
        expect(alpha).toBeGreaterThanOrEqual(0);
        expect(alpha).toBeLessThanOrEqual(1);
      }
    });

    loop.start();
    mockWindow.step(100);
    mockWindow.step(300);

    expect(frameDts[1]).toBeCloseTo(1 / 20, 6);
    expect(updateCount).toBe(3);
  });

  it("throttles frame processing when maxFrameRate is set", () => {
    const frameDts: number[] = [];
    let updateCount = 0;

    const loop = createLoop({
      fixedStep: 1 / 60,
      maxFrameDelta: 0.2,
      maxFrameRate: 10,
      update: () => {
        updateCount += 1;
      },
      render: (frameDt) => {
        frameDts.push(frameDt);
      }
    });

    loop.start();
    mockWindow.step(100);
    mockWindow.step(116);
    mockWindow.step(132);
    mockWindow.step(149);
    mockWindow.step(216);

    expect(frameDts).toHaveLength(1);
    expect(frameDts[0]).toBeCloseTo(0.116, 6);
    expect(updateCount).toBe(6);
  });
});
