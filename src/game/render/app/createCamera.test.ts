import { describe, expect, it } from "vitest";
import { createCamera } from "./createCamera";

type ResizeListener = () => void;

class MockWindowTarget {
  innerWidth = 1280;
  innerHeight = 720;
  listeners = new Map<string, Set<ResizeListener>>();

  addEventListener(type: string, listener: ResizeListener): void {
    const set = this.listeners.get(type) ?? new Set<ResizeListener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: ResizeListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchResize(): void {
    this.listeners.get("resize")?.forEach((listener) => listener());
  }
}

describe("createCamera", () => {
  it("updates aspect on resize and unregisters listener on dispose", () => {
    const target = new MockWindowTarget();
    const controller = createCamera(target as unknown as Window);

    expect(controller.camera.aspect).toBeCloseTo(1280 / 720, 6);
    expect(target.listeners.get("resize")?.size ?? 0).toBe(1);

    target.innerWidth = 1000;
    target.innerHeight = 1000;
    target.dispatchResize();
    expect(controller.camera.aspect).toBeCloseTo(1, 6);

    controller.dispose();
    expect(target.listeners.get("resize")?.size ?? 0).toBe(0);
  });
});
