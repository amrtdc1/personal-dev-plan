import { beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: Event) => void;

function installWindowMock() {
  const storage = new Map<string, string>();
  const listeners = new Map<string, Set<Listener>>();

  const localStorage = {
    getItem(key: string) {
      return storage.has(key) ? storage.get(key)! : null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
  };

  const addEventListener = vi.fn((name: string, listener: Listener) => {
    const bucket = listeners.get(name) ?? new Set<Listener>();
    bucket.add(listener);
    listeners.set(name, bucket);
  });

  const removeEventListener = vi.fn((name: string, listener: Listener) => {
    const bucket = listeners.get(name);
    if (!bucket) {
      return;
    }

    bucket.delete(listener);
  });

  const dispatchEvent = vi.fn((event: Event) => {
    const bucket = listeners.get(event.type);
    if (!bucket) {
      return true;
    }

    bucket.forEach((listener) => listener(event));
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

  return { storage };
}

describe("write queue replay retries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    installWindowMock();
  });

  it("retries transient replay errors and succeeds", async () => {
    const writeQueueModule = await import("@/lib/offline/write-queue");

    writeQueueModule.enqueueOfflineMutation("saveGoal", { goalId: "g-1" });

    let attempts = 0;
    const processor = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("Network request failed");
      }
    });

    const flushPromise = writeQueueModule.flushOfflineMutationQueue(processor);
    await vi.advanceTimersByTimeAsync(2000);
    const result = await flushPromise;

    expect(processor).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      processed: 1,
      failed: 0,
      remaining: 0,
      failedOperation: null,
      failedError: null,
    });
  });

  it("does not retry non-transient errors", async () => {
    const writeQueueModule = await import("@/lib/offline/write-queue");

    writeQueueModule.enqueueOfflineMutation("saveGoal", { goalId: "g-2" });

    const processor = vi.fn(async () => {
      throw new Error("Validation failed: title is required");
    });

    const result = await writeQueueModule.flushOfflineMutationQueue(processor);

    expect(processor).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      processed: 0,
      failed: 1,
      remaining: 1,
      failedOperation: "saveGoal",
      failedError: "Validation failed: title is required",
    });
  });
});
