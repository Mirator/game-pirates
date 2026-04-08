import { describe, expect, it } from "vitest";
import { createCamera } from "./createCamera";

interface MockEventPayload {
  button: number;
  clientX: number;
  clientY: number;
  defaultPrevented: boolean;
  preventDefault: () => void;
}

type Listener = (event: MockEventPayload) => void;

class MockEventTarget {
  listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: Partial<Pick<MockEventPayload, "button" | "clientX" | "clientY">> = {}): MockEventPayload {
    const payload: MockEventPayload = {
      button: event.button ?? 0,
      clientX: event.clientX ?? 0,
      clientY: event.clientY ?? 0,
      defaultPrevented: false,
      preventDefault: () => {
        payload.defaultPrevented = true;
      }
    };

    this.listeners.get(type)?.forEach((listener) => listener(payload));
    return payload;
  }
}

class MockWindowTarget extends MockEventTarget {
  innerWidth = 1280;
  innerHeight = 720;
}

describe("createCamera", () => {
  it("updates aspect on resize and unregisters listeners on dispose", () => {
    const windowTarget = new MockWindowTarget();
    const inputTarget = new MockEventTarget();
    const controller = createCamera({
      windowTarget: windowTarget as unknown as Window,
      inputTarget: inputTarget as unknown as EventTarget
    });

    expect(controller.camera.aspect).toBeCloseTo(1280 / 720, 6);
    expect(windowTarget.listeners.get("resize")?.size ?? 0).toBe(1);
    expect(windowTarget.listeners.get("mousemove")?.size ?? 0).toBe(1);
    expect(windowTarget.listeners.get("mouseup")?.size ?? 0).toBe(1);
    expect(windowTarget.listeners.get("blur")?.size ?? 0).toBe(1);
    expect(inputTarget.listeners.get("mousedown")?.size ?? 0).toBe(1);
    expect(inputTarget.listeners.get("contextmenu")?.size ?? 0).toBe(1);

    windowTarget.innerWidth = 1000;
    windowTarget.innerHeight = 1000;
    windowTarget.dispatch("resize");
    expect(controller.camera.aspect).toBeCloseTo(1, 6);

    controller.dispose();
    expect(windowTarget.listeners.get("resize")?.size ?? 0).toBe(0);
    expect(windowTarget.listeners.get("mousemove")?.size ?? 0).toBe(0);
    expect(windowTarget.listeners.get("mouseup")?.size ?? 0).toBe(0);
    expect(windowTarget.listeners.get("blur")?.size ?? 0).toBe(0);
    expect(inputTarget.listeners.get("mousedown")?.size ?? 0).toBe(0);
    expect(inputTarget.listeners.get("contextmenu")?.size ?? 0).toBe(0);
  });

  it("updates orbit yaw and pitch while right-mouse dragging", () => {
    const windowTarget = new MockWindowTarget();
    const inputTarget = new MockEventTarget();
    const controller = createCamera({
      windowTarget: windowTarget as unknown as Window,
      inputTarget: inputTarget as unknown as EventTarget
    });

    inputTarget.dispatch("mousedown", { button: 2, clientX: 100, clientY: 100 });
    expect(controller.orbit.dragging).toBe(true);

    windowTarget.dispatch("mousemove", { clientX: 130, clientY: 80 });
    expect(controller.orbit.yawOffset).toBeCloseTo(-0.15, 6);
    expect(controller.orbit.pitchOffset).toBeCloseTo(0.07, 6);

    const yawAfterDrag = controller.orbit.yawOffset;
    const pitchAfterDrag = controller.orbit.pitchOffset;
    windowTarget.dispatch("mouseup", { button: 2 });

    expect(controller.orbit.dragging).toBe(false);
    expect(controller.orbit.yawOffset).toBeCloseTo(yawAfterDrag, 6);
    expect(controller.orbit.pitchOffset).toBeCloseTo(pitchAfterDrag, 6);
  });

  it("clamps orbit pitch within configured bounds", () => {
    const windowTarget = new MockWindowTarget();
    const inputTarget = new MockEventTarget();
    const controller = createCamera({
      windowTarget: windowTarget as unknown as Window,
      inputTarget: inputTarget as unknown as EventTarget
    });

    inputTarget.dispatch("mousedown", { button: 2, clientX: 0, clientY: 0 });
    windowTarget.dispatch("mousemove", { clientX: 0, clientY: -1000 });
    expect(controller.orbit.pitchOffset).toBeCloseTo(0.45, 6);

    windowTarget.dispatch("mousemove", { clientX: 0, clientY: 2000 });
    expect(controller.orbit.pitchOffset).toBeCloseTo(-0.35, 6);
  });

  it("stops dragging on blur without resetting orbit offsets", () => {
    const windowTarget = new MockWindowTarget();
    const inputTarget = new MockEventTarget();
    const controller = createCamera({
      windowTarget: windowTarget as unknown as Window,
      inputTarget: inputTarget as unknown as EventTarget
    });

    inputTarget.dispatch("mousedown", { button: 2, clientX: 40, clientY: 30 });
    windowTarget.dispatch("mousemove", { clientX: 80, clientY: 10 });
    const yawBeforeBlur = controller.orbit.yawOffset;
    const pitchBeforeBlur = controller.orbit.pitchOffset;

    windowTarget.dispatch("blur");
    expect(controller.orbit.dragging).toBe(false);
    expect(controller.orbit.yawOffset).toBeCloseTo(yawBeforeBlur, 6);
    expect(controller.orbit.pitchOffset).toBeCloseTo(pitchBeforeBlur, 6);
  });

  it("suppresses context menu on camera input target", () => {
    const windowTarget = new MockWindowTarget();
    const inputTarget = new MockEventTarget();
    createCamera({
      windowTarget: windowTarget as unknown as Window,
      inputTarget: inputTarget as unknown as EventTarget
    });

    const event = inputTarget.dispatch("contextmenu");
    expect(event.defaultPrevented).toBe(true);
  });
});
