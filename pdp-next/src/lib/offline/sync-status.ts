type OfflineSyncFailureState = {
  failedOperation: string | null;
  failedError: string | null;
  updatedAt: string | null;
};

type OfflineSyncFailureInput = {
  failedOperation: string;
  failedError: string | null;
};

const STORAGE_KEY = "pdp.offline.lastSyncFailure";
const EVENT_NAME = "pdp-offline-sync-failure-changed";

const EMPTY_FAILURE_STATE: OfflineSyncFailureState = {
  failedOperation: null,
  failedError: null,
  updatedAt: null,
};

const listeners = new Set<(state: OfflineSyncFailureState) => void>();

let lastFailureState: OfflineSyncFailureState = loadStoredFailureState();

export function getOfflineSyncFailureState() {
  return lastFailureState;
}

export function setOfflineSyncFailureState(input: OfflineSyncFailureInput | null) {
  lastFailureState = input
    ? {
        failedOperation: input.failedOperation,
        failedError: input.failedError,
        updatedAt: new Date().toISOString(),
      }
    : EMPTY_FAILURE_STATE;

  persistFailureState(lastFailureState);
  notifyFailureStateListeners(lastFailureState);
  dispatchFailureStateEvent(lastFailureState);
}

export function subscribeOfflineSyncFailureState(listener: (state: OfflineSyncFailureState) => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function formatOfflineOperationLabel(operation: string | null) {
  if (!operation) {
    return "an offline change";
  }

  const normalized = operation
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();

  return normalized.length > 0 ? normalized : "an offline change";
}

function notifyFailureStateListeners(state: OfflineSyncFailureState) {
  listeners.forEach((listener) => {
    listener(state);
  });
}

function dispatchFailureStateEvent(state: OfflineSyncFailureState) {
  if (!isBrowser() || typeof window.dispatchEvent !== "function") {
    return;
  }

  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { state } }));
}

function loadStoredFailureState() {
  if (!hasStorage()) {
    return EMPTY_FAILURE_STATE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return EMPTY_FAILURE_STATE;
    }

    const parsed = JSON.parse(raw) as Partial<OfflineSyncFailureState>;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.failedOperation !== "string" ||
      (parsed.failedError !== null && typeof parsed.failedError !== "string") ||
      typeof parsed.updatedAt !== "string"
    ) {
      return EMPTY_FAILURE_STATE;
    }

    return {
      failedOperation: parsed.failedOperation,
      failedError: parsed.failedError,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return EMPTY_FAILURE_STATE;
  }
}

function persistFailureState(state: OfflineSyncFailureState) {
  if (!hasStorage()) {
    return;
  }

  if (!state.failedOperation) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isBrowser() {
  return typeof window !== "undefined";
}

function hasStorage() {
  return isBrowser() && typeof window.localStorage !== "undefined";
}
