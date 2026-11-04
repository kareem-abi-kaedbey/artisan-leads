import "server-only";

export const FOLLOW_UP_AGENT_VERSION = "follow-up-v1";
type Phase = "authorization" | "context" | "configuration" | "model_request" | "model_validation" | "tool_validation" | "tool_execution" | "final_validation";
type RecordData = Record<string, unknown>;
const toolNames = new Set(["get_lead_context", "get_existing_analysis", "get_business_rules"]);
const usageKeys = ["total_input_tokens", "total_output_tokens", "total_thought_tokens", "total_cached_tokens", "total_tool_use_tokens", "total_tokens"];

function object(value: unknown): RecordData {
  return value && typeof value === "object" ? value as RecordData : {};
}

// Deliberate allowlists: never serialize Error, headers, bodies, prompts or raw messages.
export function safeTraceError(error: unknown) {
  const item = object(error);
  const cause = object(item.cause);
  const knownNames = new Set(["Error", "APIError", "ClientError", "ServerError", "APIConnectionError", "APIConnectionTimeoutError", "AbortError", "TimeoutError", "ZodError", "FollowUpProtocolError", "FollowUpLeadNotFoundError"]);
  const name = typeof item.name === "string" && knownNames.has(item.name) ? item.name : "Error";
  const timedOut = [item.name, cause.name].some((value) => value === "TimeoutError" || value === "APIConnectionTimeoutError") || /timed? out|timeout/i.test(typeof item.message === "string" ? item.message : "");
  const aborted = item.name === "AbortError";
  const rawStatus = item.status ?? item.statusCode;
  const status = typeof rawStatus === "number" && Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599 ? rawStatus : undefined;
  const message = timedOut ? "Request timed out." : aborted ? "Request aborted." : status === 429 ? "Provider quota or rate limit exceeded." : status === 401 || status === 403 ? "Provider authorization failed." : status && status >= 500 ? "Provider server error." : status && status >= 400 ? "Provider rejected request." : "Operation failed; raw message omitted.";
  return { name, ...(status === undefined ? {} : { status }), message, messageSource: "safe_classification", kind: timedOut ? "timeout" : aborted ? "aborted" : "error" };
}

function safeUsage(value: unknown) {
  const usage = object(value);
  const entries = usageKeys.flatMap((key) => typeof usage[key] === "number" && Number.isFinite(usage[key]) && (usage[key] as number) >= 0 ? [[key, usage[key]]] : []);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function argumentsShape(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { type: value === null ? "null" : Array.isArray(value) ? "array" : typeof value };
  const values = Object.values(value);
  return { type: "object", keyCount: values.length, valueTypes: [...new Set(values.map((entry) => entry === null ? "null" : Array.isArray(entry) ? "array" : typeof entry))] };
}

export function createFollowUpTrace(model: string, sink: (event: RecordData) => void = (event) => console.info(event)) {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const started = performance.now();
  let phase: Phase = "authorization", modelRequests = 0, modelTurns = 0, toolExecutions = 0, finished = false;
  function emit(event: string, data: RecordData = {}) {
    // Logging must never change success/failure behavior of the workflow.
    try { sink({ event, runId, model, version: FOLLOW_UP_AGENT_VERSION, startedAt, timestamp: new Date().toISOString(), ...data }); } catch { /* best effort */ }
  }
  emit("follow_up.run_started");
  return {
    phase(next: Phase) { phase = next; },
    toolRequested(turn: number, name: unknown, args: unknown) {
      emit("follow_up.tool_requested", { turn, tool: typeof name === "string" && toolNames.has(name) ? name : "unknown", argumentsShape: argumentsShape(args) });
    },
    retryScheduled(turn: number, attempt: number, backoffMs: number, error: unknown) {
      emit("follow_up.model_retry", { turn, attempt, backoffMs, error: safeTraceError(error) });
    },
    async modelRequest<T extends { status?: unknown; usage?: unknown }>(turn: number, operation: () => Promise<T>, attempt = 1): Promise<T> {
      phase = "model_request";
      modelRequests++;
      modelTurns = Math.max(modelTurns, turn);
      const start = performance.now();
      emit("follow_up.model_started", { turn, attempt });
      try {
        const result = await operation();
        const allowedStatuses = ["completed", "requires_action", "in_progress", "failed", "cancelled", "incomplete", "budget_exceeded", "queued"];
        const usage = safeUsage(result.usage);
        emit("follow_up.model_finished", { turn, attempt, durationMs: Math.round(performance.now() - start), result: typeof result.status === "string" && allowedStatuses.includes(result.status) ? result.status : "unknown", ...(usage ? { usage } : {}) });
        return result;
      } catch (error) {
        const detail = safeTraceError(error);
        emit("follow_up.model_finished", { turn, attempt, durationMs: Math.round(performance.now() - start), result: detail.kind === "timeout" ? "timeout" : "provider_error", error: detail });
        throw error;
      }
    },
    async toolExecution<T>(turn: number, tool: string, operation: () => Promise<T>): Promise<T> {
      phase = "tool_execution";
      toolExecutions++;
      const start = performance.now();
      const name = toolNames.has(tool) ? tool : "unknown";
      emit("follow_up.tool_started", { turn, tool: name });
      try {
        const result = await operation();
        emit("follow_up.tool_finished", { turn, tool: name, durationMs: Math.round(performance.now() - start), result: "success" });
        return result;
      } catch (error) {
        emit("follow_up.tool_finished", { turn, tool: name, durationMs: Math.round(performance.now() - start), result: "failed", error: safeTraceError(error) });
        throw error;
      }
    },
    finish(outcome: "completed" | "failed" | "unauthenticated" | "forbidden" | "not_found", error?: unknown) {
      if (finished) return;
      finished = true;
      emit("follow_up.run_finished", { outcome, phase, totalDurationMs: Math.round(performance.now() - started), modelRequests, modelTurns, toolExecutions, ...(error === undefined ? {} : { error: safeTraceError(error) }) });
    },
  };
}

export type FollowUpTrace = ReturnType<typeof createFollowUpTrace>;
