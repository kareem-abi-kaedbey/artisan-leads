import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, dependencies) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
  new Function("require", "exports", source)((name) => { assert.ok(name in dependencies, name); return dependencies[name]; }, exports);
  return exports;
}
const tracing = load("src/lib/ai/follow-up-trace.ts", { "server-only": {} });
const schemas = load("src/lib/ai/follow-up-schema.ts", { zod: require("zod") });
function setup() {
  const waits = [], events = [];
  const retry = load("src/lib/ai/follow-up-retry.ts", { "server-only": {}, "node:timers/promises": { setTimeout: async (ms) => waits.push(ms) } });
  const trace = tracing.createFollowUpTrace("gemini-3.5-flash-lite", (event) => events.push(event));
  return { retry, trace, events, waits };
}
for (const kind of [429, 503, "APIConnectionTimeoutError", "TimeoutError"]) {
  test(`${kind} retries once and succeeds, with safe trace events`, async () => {
    const { retry, trace, events, waits } = setup();
    let calls = 0;
    const failure = Object.assign(Error("PRIVATE_KEY PRIVATE_EMAIL"), typeof kind === "number" ? { status: kind } : { name: kind });
    const response = await retry.requestFollowUpModel(2, trace, async () => {
      if (++calls === 1) throw failure;
      return { status: "completed" };
    });
    trace.finish("completed");
    assert.equal(response.status, "completed"); assert.equal(calls, 2);
    assert.deepEqual(waits, [1000]);
    assert.deepEqual(events.filter((e) => e.event === "follow_up.model_started").map((e) => [e.turn, e.attempt]), [[2, 1], [2, 2]]);
    const scheduled = events.find((e) => e.event === "follow_up.model_retry");
    assert.equal(scheduled.attempt, 2); assert.equal(scheduled.backoffMs, 1000);
    assert.equal(events.at(-1).modelRequests, 2);
    assert.ok(!JSON.stringify(events).includes("PRIVATE"));
  });
}
for (const status of [400, 401, 403, 404, 408, 500, 502, 504]) {
  test(`HTTP ${status} is not retried`, async () => {
    const { retry, trace, waits } = setup(); let calls = 0;
    const error = Object.assign(Error("not eligible"), { status, name: "APIConnectionTimeoutError" });
    await assert.rejects(() => retry.requestFollowUpModel(1, trace, async () => { calls++; throw error; }), (actual) => actual === error);
    assert.equal(calls, 1); assert.deepEqual(waits, []);
  });
}
test("two transient failures stop at two attempts and one backoff", async () => {
  const { retry, trace, waits, events } = setup(); let calls = 0;
  const error = Object.assign(Error("rate limit"), { status: 429 });
  await assert.rejects(() => retry.requestFollowUpModel(1, trace, async () => { calls++; throw error; }));
  trace.finish("failed", error);
  assert.equal(calls, 2); assert.deepEqual(waits, [1000]);
  assert.equal(events.at(-1).modelRequests, 2); assert.equal(events.at(-1).modelTurns, 1);
});
test("each retry receives a fresh non-aborted 90-second signal", async () => {
  const controllers = [];
  const mock = test.mock.method(AbortSignal, "timeout", (ms) => {
    assert.equal(ms, 90000); const controller = new AbortController(); controllers.push(controller); return controller.signal;
  });
  try {
    const { retry, trace } = setup(); let calls = 0;
    await retry.requestFollowUpModel(1, trace, async (signal) => {
      assert.equal(signal.aborted, false);
      if (++calls === 1) {
        controllers[0].abort(new DOMException("expired", "TimeoutError"));
        throw new DOMException("aborted", "AbortError");
      }
      assert.notEqual(signal, controllers[0].signal);
      return { status: "completed" };
    });
    assert.equal(controllers.length, 2); assert.equal(controllers[0].signal.aborted, true);
  } finally { mock.mock.restore(); }
});
test("unclassified connection errors, cancellations and validation errors are not retried", async () => {
  for (const error of [Error("timeout mentioned in business text"), Object.assign(Error("cancelled"), { name: "AbortError" }), Object.assign(Error("invalid schema"), { name: "ZodError" }), Object.assign(Error("invalid schema with status"), { name: "ZodError", status: 429 }), Object.assign(Error("connection"), { name: "APIConnectionError" })]) {
    const { retry, trace, waits } = setup(); let calls = 0;
    await assert.rejects(() => retry.requestFollowUpModel(1, trace, async () => { calls++; throw error; }));
    assert.equal(calls, 1); assert.deepEqual(waits, []);
  }
});

for (const failure of ["unknown_tool", "invalid_output", "tool_failure"]) {
  test(`real agent does not retry ${failure}, even if a tool error has HTTP 429`, async () => {
    const old = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = "test-key";
    const { retry, trace, waits } = setup(); let calls = 0;
    class GoogleGenAI {
      constructor() { this.interactions = { create: async (_params, options) => {
        calls++; assert.equal(options.timeout, 90000); assert.deepEqual(options.retries, { strategy: "none" });
        return failure === "invalid_output" ? { status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: "invalid JSON" }] }] } : {
          status: "requires_action", steps: [{ type: "function_call", id: "a", name: failure === "unknown_tool" ? "update_status" : "get_lead_context", arguments: {} }],
        };
      } }; }
    }
    const agent = load("src/lib/ai/follow-up-agent.ts", { "server-only": {}, zod: require("zod"), "@google/genai": { GoogleGenAI }, "./follow-up-schema": schemas, "./follow-up-trace": tracing, "./follow-up-retry": retry });
    try {
      await assert.rejects(() => agent.runFollowUpAgent(async () => { throw Object.assign(Error("application failure"), { status: 429 }); }, trace));
      assert.equal(calls, 1); assert.deepEqual(waits, []);
    } finally { if (old === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = old; }
  });
}

test("retry of a later turn preserves history and never re-executes successful tools", async () => {
  const old = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = "test-key";
  const { retry, trace, waits, events } = setup(); let calls = 0, tools = 0;
  const histories = [];
  const output = { summary: "Projet", reasoning: "À préciser", recommendedAction: "Clarifier", suggestedReply: "Bonjour, pouvez-vous préciser ?", proposedStatus: null };
  class GoogleGenAI {
    constructor() { this.interactions = { create: async (params) => {
      calls++; histories.push(structuredClone(params.input));
      if (calls === 1) return { status: "requires_action", steps: [{ type: "function_call", id: "a", name: "get_lead_context", arguments: {} }] };
      if (calls === 2) throw Object.assign(Error("busy"), { status: 503 });
      return { status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify(output) }] }] };
    } }; }
  }
  const agent = load("src/lib/ai/follow-up-agent.ts", { "server-only": {}, zod: require("zod"), "@google/genai": { GoogleGenAI }, "./follow-up-schema": schemas, "./follow-up-trace": tracing, "./follow-up-retry": retry });
  try {
    assert.deepEqual(await agent.runFollowUpAgent(async () => { tools++; return {}; }, trace), output);
    trace.finish("completed");
    assert.equal(tools, 1); assert.equal(calls, 3); assert.deepEqual(waits, [1000]);
    assert.deepEqual(histories[1], histories[2]);
    assert.equal(events.at(-1).modelRequests, 3); assert.equal(events.at(-1).modelTurns, 2);
  } finally { if (old === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = old; }
});
