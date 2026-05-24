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

export function getOfflineSyncDiagnosticCode(error: string | null) {
  const category = classifyOfflineSyncFailure(error);

  switch (category) {
    case "network":
      return "SYNC-NET";
    case "access":
      return "SYNC-AUTH";
    case "schema":
      return "SYNC-SCHEMA";
    case "conflict":
      return "SYNC-CONFLICT";
    case "restore-window":
      return "SYNC-RESTORE";
    case "stale":
      return "SYNC-STALE";
    default:
      return "SYNC-UNKNOWN";
  }
}

export function getFriendlySyncFailureReason(error: string | null) {
  const category = classifyOfflineSyncFailure(error);

  switch (category) {
    case "network":
      return "Connection issue. Reconnect and retry.";
    case "access":
      return "Access issue. Sign in again, then retry.";
    case "schema":
      return "Data schema mismatch. Refresh the app and retry.";
    case "conflict":
      return "Conflict detected. Refresh to review latest server changes, then retry.";
    case "restore-window":
      return "Restore window expired for this item.";
    case "stale":
      return "The item changed on another device. Refresh and retry.";
    default:
      return "Unexpected sync issue. Try syncing again.";
  }
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

type OfflineSyncFailureCategory =
  | "network"
  | "access"
  | "schema"
  | "conflict"
  | "restore-window"
  | "stale"
  | "unknown";

function classifyOfflineSyncFailure(error: string | null): OfflineSyncFailureCategory {
  if (!error) {
    return "unknown";
  }

  const normalized = error.toLowerCase();

  if (normalized.includes("offline conflict") || normalized.includes("conflict")) {
    return "conflict";
  }

  if (
    normalized.includes("network") ||
    normalized.includes("fetch") ||
    normalized.includes("offline") ||
    normalized.includes("timeout")
  ) {
    return "network";
  }

  if (
    normalized.includes("permission") ||
    normalized.includes("forbidden") ||
    normalized.includes("unauthorized")
  ) {
    return "access";
  }

  if (
    normalized.includes("schema") ||
    normalized.includes("attribute") ||
    normalized.includes("missing in your schema")
  ) {
    return "schema";
  }

  if (normalized.includes("restore window") && normalized.includes("expired")) {
    return "restore-window";
  }

  if (normalized.includes("not loaded") || normalized.includes("not found")) {
    return "stale";
  }

  return "unknown";
}
