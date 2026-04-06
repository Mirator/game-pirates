export const ONBOARDING_STORAGE_KEY = "blackwake_onboarding_state";
export const ONBOARDING_STORAGE_VERSION = 1;

export interface OnboardingState {
  version: number;
  completed: boolean;
  completedAt: string;
}

export interface OnboardingStorage {
  load: () => OnboardingState | null;
  saveCompleted: () => void;
}

function parseStoredState(rawValue: string | null): OnboardingState | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<OnboardingState>;
    if (parsed.version !== ONBOARDING_STORAGE_VERSION) {
      return null;
    }
    if (typeof parsed.completed !== "boolean" || typeof parsed.completedAt !== "string") {
      return null;
    }
    return {
      version: ONBOARDING_STORAGE_VERSION,
      completed: parsed.completed,
      completedAt: parsed.completedAt
    };
  } catch {
    return null;
  }
}

export function createOnboardingStorage(target: Window = window): OnboardingStorage {
  const load = (): OnboardingState | null => {
    try {
      return parseStoredState(target.localStorage.getItem(ONBOARDING_STORAGE_KEY));
    } catch {
      return null;
    }
  };

  const saveCompleted = (): void => {
    const payload: OnboardingState = {
      version: ONBOARDING_STORAGE_VERSION,
      completed: true,
      completedAt: new Date().toISOString()
    };

    try {
      target.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage failures for private mode or blocked storage.
    }
  };

  return {
    load,
    saveCompleted
  };
}
