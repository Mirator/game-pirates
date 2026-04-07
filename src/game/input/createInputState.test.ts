import { describe, expect, it } from "vitest";
import { createInputState } from "./createInputState";

interface MockKeyboardEvent {
  code: string;
  key: string;
  repeat: boolean;
  preventDefault: () => void;
}

type Listener = (event: MockKeyboardEvent) => void;

class MockWindowTarget {
  private listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: Omit<MockKeyboardEvent, "preventDefault">): void {
    const payload: MockKeyboardEvent = {
      ...event,
      preventDefault: () => {}
    };
    this.listeners.get(type)?.forEach((listener) => listener(payload));
  }
}

describe("createInputState", () => {
  it("prioritizes physical key codes for movement and broadside fire", () => {
    const target = new MockWindowTarget();
    const controller = createInputState(target as unknown as Window);

    target.dispatch("keydown", { code: "KeyQ", key: "a", repeat: false });
    expect(controller.state.fireLeft).toBe(true);
    expect(controller.state.turn).toBe(0);

    target.dispatch("keyup", { code: "KeyQ", key: "a", repeat: false });
    expect(controller.state.fireLeft).toBe(false);

    target.dispatch("keydown", { code: "KeyA", key: "q", repeat: false });
    expect(controller.state.turn).toBe(1);
    expect(controller.state.fireLeft).toBe(false);

    target.dispatch("keyup", { code: "KeyA", key: "q", repeat: false });
    expect(controller.state.turn).toBe(0);
  });

  it("falls back to non-letter key labels for interaction edge cases", () => {
    const target = new MockWindowTarget();
    const controller = createInputState(target as unknown as Window);

    target.dispatch("keydown", { code: "Unknown", key: "Spacebar", repeat: false });
    expect(controller.state.interact).toBe(true);

    controller.consumeFrameFlags();
    expect(controller.state.interact).toBe(false);
  });

  it("tracks burst on Shift hold", () => {
    const target = new MockWindowTarget();
    const controller = createInputState(target as unknown as Window);

    target.dispatch("keydown", { code: "ShiftLeft", key: "Shift", repeat: false });
    expect(controller.state.burst).toBe(true);

    target.dispatch("keyup", { code: "ShiftLeft", key: "Shift", repeat: false });
    expect(controller.state.burst).toBe(false);
  });

  it("maps A/D to opposite signed turn inputs for mirrored chase-camera steering", () => {
    const target = new MockWindowTarget();
    const controller = createInputState(target as unknown as Window);

    target.dispatch("keydown", { code: "KeyA", key: "a", repeat: false });
    expect(controller.state.turn).toBe(1);

    target.dispatch("keyup", { code: "KeyA", key: "a", repeat: false });
    target.dispatch("keydown", { code: "KeyD", key: "d", repeat: false });
    expect(controller.state.turn).toBe(-1);
  });
});
