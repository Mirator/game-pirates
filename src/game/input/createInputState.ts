import type { InputState } from "../simulation";

interface KeyState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  fireLeft: boolean;
  fireRight: boolean;
  interactQueued: boolean;
  repairQueued: boolean;
}

export interface InputController {
  state: InputState;
  consumeFrameFlags: () => void;
  dispose: () => void;
}

function clampAxis(negative: boolean, positive: boolean): number {
  if (negative === positive) {
    return 0;
  }
  return positive ? 1 : -1;
}

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

function setByLetter(keyState: KeyState, key: string, pressed: boolean, repeat: boolean): boolean {
  switch (key) {
    case "w":
      keyState.forward = pressed;
      return true;
    case "s":
      keyState.backward = pressed;
      return true;
    case "a":
      keyState.left = pressed;
      return true;
    case "d":
      keyState.right = pressed;
      return true;
    case "q":
      keyState.fireLeft = pressed;
      return true;
    case "e":
      keyState.fireRight = pressed;
      return true;
    case "r":
      if (pressed && !repeat) {
        keyState.repairQueued = true;
      }
      return true;
    case " ":
    case "spacebar":
      if (pressed && !repeat) {
        keyState.interactQueued = true;
      }
      return true;
    default:
      return false;
  }
}

function setByCode(keyState: KeyState, code: string, pressed: boolean, repeat: boolean): boolean {
  switch (code) {
    case "KeyW":
      keyState.forward = pressed;
      return true;
    case "KeyS":
      keyState.backward = pressed;
      return true;
    case "KeyA":
      keyState.left = pressed;
      return true;
    case "KeyD":
      keyState.right = pressed;
      return true;
    case "KeyQ":
      keyState.fireLeft = pressed;
      return true;
    case "KeyE":
      keyState.fireRight = pressed;
      return true;
    case "KeyR":
      if (pressed && !repeat) {
        keyState.repairQueued = true;
      }
      return true;
    case "Space":
      if (pressed && !repeat) {
        keyState.interactQueued = true;
      }
      return true;
    default:
      return false;
  }
}

export function createInputState(target: Window = window): InputController {
  const keyState: KeyState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    fireLeft: false,
    fireRight: false,
    interactQueued: false,
    repairQueued: false
  };

  const state: InputState = {
    throttle: 0,
    turn: 0,
    fireLeft: false,
    fireRight: false,
    interact: false,
    repair: false
  };

  const syncState = (): void => {
    state.throttle = clampAxis(keyState.backward, keyState.forward);
    state.turn = clampAxis(keyState.right, keyState.left);
    state.fireLeft = keyState.fireLeft;
    state.fireRight = keyState.fireRight;
    state.interact = keyState.interactQueued;
    state.repair = keyState.repairQueued;
  };

  const setKey = (code: string, key: string, pressed: boolean, repeat: boolean): boolean => {
    const normalizedKey = normalizeKey(key);
    if (setByLetter(keyState, normalizedKey, pressed, repeat)) {
      return true;
    }
    return setByCode(keyState, code, pressed, repeat);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!setKey(event.code, event.key, true, event.repeat)) {
      return;
    }
    event.preventDefault();
    syncState();
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (!setKey(event.code, event.key, false, false)) {
      return;
    }
    event.preventDefault();
    syncState();
  };

  const onBlur = (): void => {
    keyState.forward = false;
    keyState.backward = false;
    keyState.left = false;
    keyState.right = false;
    keyState.fireLeft = false;
    keyState.fireRight = false;
    keyState.interactQueued = false;
    keyState.repairQueued = false;
    syncState();
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);

  return {
    state,
    consumeFrameFlags: () => {
      keyState.interactQueued = false;
      keyState.repairQueued = false;
      syncState();
    },
    dispose: () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
    }
  };
}
