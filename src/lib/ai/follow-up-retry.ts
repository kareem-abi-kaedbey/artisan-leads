import "server-only";
import { setTimeout as sleep } from "node:timers/promises";
import type { FollowUpTrace } from "./follow-up-trace";

export const FOLLOW_UP_RETRY_DELAY_MS = 1000;

function retryable(error: unknown, signal: AbortSignal) {
  if (!error || typeof error !== "object") return false;
  const detail = error as { status?: unknown; statusCode?: unknown; name?: unknown; cause?: unknown };
  if (detail.name === "ZodError" || detail.name === "FollowUpProtocolError") return false;
  const status = detail.status ?? detail.statusCode;
  // A definite HTTP response takes precedence over any timeout-looking name.
  if (status !== undefined) return status === 429 || status === 503;
  let cause: unknown = error;
  for (let depth = 0; depth < 3 && cause && typeof cause === "object"; depth++) {
    const item = cause as { name?: unknown; cause?: unknown };
    if (item.name === "APIConnectionTimeoutError" || item.name === "TimeoutError") return true;
    cause = item.cause;
  }
  return detail.name === "AbortError" && signal.aborted && signal.reason?.name === "TimeoutError";
}

// Only the SDK operation belongs inside this boundary, never parsing or tools.
export async function requestFollowUpModel<T extends { status?: unknown; usage?: unknown }>(
  turn: number,
  trace: FollowUpTrace,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const signal = AbortSignal.timeout(90_000);
    try {
      return await trace.modelRequest(turn, () => operation(signal), attempt);
    } catch (error) {
      if (attempt === 2 || !retryable(error, signal)) throw error;
      trace.retryScheduled(turn, 2, FOLLOW_UP_RETRY_DELAY_MS, error);
      await sleep(FOLLOW_UP_RETRY_DELAY_MS);
    }
  }
  throw new Error("Model attempt limit exceeded");
}
