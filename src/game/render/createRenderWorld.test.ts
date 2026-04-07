import { describe, expect, it } from "vitest";
import { createRenderWorld } from "./createRenderWorld";

describe("createRenderWorld", () => {
  it("supports idempotent disposal", () => {
    const originalWindow = (globalThis as { window?: Window }).window;
    const fakeWindow = {
      innerWidth: 1366,
      innerHeight: 768,
      addEventListener: () => {},
      removeEventListener: () => {}
    } as unknown as Window;
    (globalThis as { window?: Window }).window = fakeWindow;

    try {
      const renderWorld = createRenderWorld();
      expect(() => renderWorld.dispose()).not.toThrow();
      expect(() => renderWorld.dispose()).not.toThrow();
    } finally {
      if (originalWindow) {
        (globalThis as { window?: Window }).window = originalWindow;
      } else {
        delete (globalThis as { window?: Window }).window;
      }
    }
  });
});
