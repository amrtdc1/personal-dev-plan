import { describe, expect, it, vi, beforeEach } from "vitest";

type LocalStorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

type Listener = (event: Event) => void;

function installWindowMock() {
  const storage = new Map<string, string>();
  const listeners = new Map<string, Set<Listener>>();

  const localStorage: LocalStorageMock = {
    getItem(key) {
      return storage.has(key) ? storage.get(key)! : null;
    },
    setItem(key, value) {
      storage.set(key, value);
    },
    removeItem(key) {
      storage.delete(key);
    },
  };

  const addEventListener = vi.fn((name: string, listener: Listener) => {
    const entry = listeners.get(name) ?? new Set<Listener>();
    entry.add(listener);
    listeners.set(name, entry);
  });

  const removeEventListener = vi.fn((name: string, listener: Listener) => {
    const entry = listeners.get(name);
    if (!entry) {
      return;
    }

    entry.delete(listener);
    if (entry.size === 0) {
      listeners.delete(name);
    }
  });

  const dispatchEvent = vi.fn((event: Event) => {
    const entry = listeners.get(event.type);
    if (!entry) {
      return true;
    }

    entry.forEach((listener) => listener(event));
    return true;
  });

  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage,
      addEventListener,
      removeEventListener,
      dispatchEvent,
    },
    configurable: true,
    writable: true,
  });

  Object.defineProperty(globalThis, "CustomEvent", {
    value: class<T> extends Event {
      detail: T;

      constructor(type: string, eventInitDict?: CustomEventInit<T>) {
        super(type);
        this.detail = eventInitDict?.detail as T;
      }
    },
    configurable: true,
    writable: true,
  });

  return {
    storage,
  };
}

describe("offline sync failure state", () => {
  beforeEach(() => {
    vi.resetModules();
    installWindowMock();
  });

  it("starts empty and can store + clear failure state", async () => {
    const syncStatusModule = await import("@/lib/offline/sync-status");

    expect(syncStatusModule.getOfflineSyncFailureState()).toEqual({
      failedOperation: null,
      failedError: null,
      updatedAt: null,
    });

    syncStatusModule.setOfflineSyncFailureState({
      failedOperation: "reorderGoals",
      failedError: "Network request failed",
    });

    const saved = syncStatusModule.getOfflineSyncFailureState();
    expect(saved.failedOperation).toBe("reorderGoals");
    expect(saved.failedError).toBe("Network request failed");
    expect(saved.updatedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);

    syncStatusModule.setOfflineSyncFailureState(null);

    expect(syncStatusModule.getOfflineSyncFailureState()).toEqual({
      failedOperation: null,
      failedError: null,
      updatedAt: null,
    });
  });

  it("persists failure state to localStorage and loads it on module import", async () => {
    const { storage } = installWindowMock();
    const key = "pdp.offline.lastSyncFailure";
    storage.set(
      key,
      JSON.stringify({
        failedOperation: "softDeleteTask",
        failedError: null,
        updatedAt: "2026-05-23T10:00:00.000Z",
      }),
    );

    vi.resetModules();
    const syncStatusModule = await import("@/lib/offline/sync-status");

    expect(syncStatusModule.getOfflineSyncFailureState()).toEqual({
      failedOperation: "softDeleteTask",
      failedError: null,
      updatedAt: "2026-05-23T10:00:00.000Z",
    });
  });

  it("notifies subscribers on state updates and stops after unsubscribe", async () => {
    const syncStatusModule = await import("@/lib/offline/sync-status");
    const listener = vi.fn();

    const unsubscribe = syncStatusModule.subscribeOfflineSyncFailureState(listener);

    syncStatusModule.setOfflineSyncFailureState({
      failedOperation: "updateTaskStatus",
      failedError: "Timeout",
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    syncStatusModule.setOfflineSyncFailureState({
      failedOperation: "restoreGoal",
      failedError: "Server unavailable",
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("formats operation labels into readable text", async () => {
    const syncStatusModule = await import("@/lib/offline/sync-status");

    expect(syncStatusModule.formatOfflineOperationLabel("softDeleteJournalEntry")).toBe("soft delete journal entry");
    expect(syncStatusModule.formatOfflineOperationLabel("restore_task")).toBe("restore task");
    expect(syncStatusModule.formatOfflineOperationLabel(null)).toBe("an offline change");
  });
});
