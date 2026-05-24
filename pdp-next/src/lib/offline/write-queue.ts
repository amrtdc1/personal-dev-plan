export type OfflineMutation = {
  id: string;
  operation: string;
  payload: unknown;
  createdAt: string;
};

export type OfflineFlushResult = {
  processed: number;
  failed: number;
  remaining: number;
  failedOperation: string | null;
  failedError: string | null;
};

const STORAGE_KEY = "pdp.offline.writeQueue";
const QUEUE_EVENT = "pdp-offline-queue-changed";

export function getOfflineMutationQueue(): OfflineMutation[] {
  if (!hasStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isOfflineMutation);
  } catch {
    return [];
  }
}

export function getOfflineMutationCount() {
  return getOfflineMutationQueue().length;
}

export function enqueueOfflineMutation(operation: string, payload: unknown) {
  if (!hasStorage()) {
    return 0;
  }

  const queue = getOfflineMutationQueue();
  queue.push({
    id: createMutationId(),
    operation,
    payload,
    createdAt: new Date().toISOString(),
  });

  persistQueue(queue);
  return queue.length;
}

export function clearOfflineMutationQueue() {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  dispatchQueueEvent(0);
}

export function subscribeOfflineMutationCount(listener: (count: number) => void) {
  if (!isBrowser() || typeof window.addEventListener !== "function") {
    return () => undefined;
  }

  const wrapped = (event: Event) => {
    const customEvent = event as CustomEvent<{ count?: number }>;
    const eventCount = customEvent.detail?.count;
    listener(typeof eventCount === "number" ? eventCount : getOfflineMutationCount());
  };

  window.addEventListener(QUEUE_EVENT, wrapped);

  return () => {
    window.removeEventListener(QUEUE_EVENT, wrapped);
  };
}

export async function flushOfflineMutationQueue(
  processor: (mutation: OfflineMutation) => Promise<void>,
): Promise<OfflineFlushResult> {
  if (!hasStorage()) {
    return {
      processed: 0,
      failed: 0,
      remaining: 0,
      failedOperation: null,
      failedError: null,
    };
  }

  const queue = getOfflineMutationQueue();
  let processed = 0;
  let failed = 0;
  let failedOperation: string | null = null;
  let failedError: string | null = null;

  while (queue.length > 0) {
    const next = queue[0];

    try {
      await processor(next);
      queue.shift();
      processed += 1;
      persistQueue(queue);
    } catch (error) {
      failed += 1;
      failedOperation = next.operation;
      failedError = error instanceof Error ? error.message : "Unknown offline replay error.";
      break;
    }
  }

  return {
    processed,
    failed,
    remaining: queue.length,
    failedOperation,
    failedError,
  };
}

function persistQueue(queue: OfflineMutation[]) {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  dispatchQueueEvent(queue.length);
}

function dispatchQueueEvent(count: number) {
  if (typeof window.dispatchEvent !== "function") {
    return;
  }

  window.dispatchEvent(new CustomEvent(QUEUE_EVENT, { detail: { count } }));
}

function isBrowser() {
  return typeof window !== "undefined";
}

function hasStorage() {
  return isBrowser() && typeof window.localStorage !== "undefined";
}

function createMutationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isOfflineMutation(value: unknown): value is OfflineMutation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<OfflineMutation>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.operation === "string" &&
    "payload" in candidate &&
    typeof candidate.createdAt === "string"
  );
}
