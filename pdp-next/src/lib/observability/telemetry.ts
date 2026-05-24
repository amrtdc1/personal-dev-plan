import { getOfflineSyncDiagnosticCode } from "@/lib/offline/sync-status";

type SyncReplayFailureInput = {
  operation: string | null;
  error: string | null;
  remaining: number;
  processed: number;
  failed: number;
};

type ApiFailureInput = {
  route?: string;
  method?: string;
  phase?: string;
  status: number;
  error: unknown;
};

export function logSyncReplayFailure(input: SyncReplayFailureInput) {
  const payload = {
    event: "sync_replay_failure",
    operation: input.operation,
    diagnosticCode: getOfflineSyncDiagnosticCode(getErrorMessage(input.error)),
    error: sanitizeTelemetryMessage(getErrorMessage(input.error)),
    remaining: input.remaining,
    processed: input.processed,
    failed: input.failed,
    timestamp: new Date().toISOString(),
  };

  console.error("[telemetry]", payload);
}

export function logApiFailure(input: ApiFailureInput) {
  const message = getErrorMessage(input.error);
  const payload = {
    event: "api_failure",
    route: input.route ?? "unknown",
    method: input.method ?? "unknown",
    phase: input.phase ?? "request",
    status: input.status,
    error: sanitizeTelemetryMessage(message),
    timestamp: new Date().toISOString(),
  };

  if (input.status >= 500) {
    console.error("[telemetry]", payload);
    return;
  }

  console.warn("[telemetry]", payload);
}

function getErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return null;
}

function sanitizeTelemetryMessage(message: string | null) {
  if (!message) {
    return "unknown";
  }

  const compact = message.replace(/\s+/g, " ").trim();
  const redactedEmail = compact.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]");
  const redactedToken = redactedEmail.replace(/\b(?:token|apikey|api_key|secret)\b\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]");

  return redactedToken.slice(0, 220);
}
