import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
  new Function("require", "exports", code)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports);
  return exports;
}
const tracing = load("src/lib/ai/follow-up-trace.ts", { "server-only": {} });
const schema = load("src/lib/ai/follow-up-schema.ts", { zod: require("zod") });
const final = { summary: "PRIVATE_DESCRIPTION", reasoning: "PRIVATE_REASON", recommendedAction: "Contacter", suggestedReply: "PRIVATE_REPLY", proposedStatus: null };
const model = "gemini-3.5-flash-lite";
function fixture() {
  const events = [];
  return { events, trace: tracing.createFollowUpTrace(model, (event) => events.push(event)) };
}

test("traces have unique request-local UUIDs, version, timestamps and a single terminal event", () => {
  const first = fixture(), second = fixture();
  assert.match(first.events[0].runId, /^[0-9a-f-]{36}$/);
  assert.notEqual(first.events[0].runId, second.events[0].runId);
  assert.equal(first.events[0].model, model);
  assert.equal(first.events[0].version, "follow-up-v1");
  assert.ok(!Number.isNaN(Date.parse(first.events[0].startedAt)));
  first.trace.finish("completed");
  first.trace.finish("failed", Error("not emitted"));
  assert.equal(first.events.length, 2);
  assert.equal(first.events[1].modelRequests, 0);
  assert.equal(first.events[1].toolExecutions, 0);
  assert.ok(first.events[1].totalDurationMs >= 0);
});

test("model and tool events count executions, duration, actual usage and safe argument shapes", async () => {
  const { events, trace } = fixture();
  const response = { status: "requires_action", usage: { total_input_tokens: 10, total_output_tokens: 4, total_tokens: 14, total_thought_tokens: 2, extra: "SECRET", total_cached_tokens: -1 } };
  assert.equal(await trace.modelRequest(1, async () => response), response);
  trace.toolRequested(1, "get_lead_context", { "PRIVATE_EMAIL": "SECRET_KEY", description: "PRIVATE_DESCRIPTION" });
  const toolResult = { name: "PRIVATE_NAME", email: "PRIVATE_EMAIL", description: "PRIVATE_DESCRIPTION", token: "SECRET_KEY" };
  assert.equal(await trace.toolExecution(1, "get_lead_context", async () => toolResult), toolResult);
  await trace.modelRequest(2, async () => ({ status: "completed" }));
  trace.phase("final_validation"); trace.finish("completed");
  const finish = events.at(-1);
  assert.equal(finish.modelRequests, 2); assert.equal(finish.toolExecutions, 1);
  assert.equal(finish.phase, "final_validation"); assert.equal(finish.outcome, "completed");
  assert.deepEqual(events.find((e) => e.event === "follow_up.model_finished").usage, { total_input_tokens: 10, total_output_tokens: 4, total_thought_tokens: 2, total_tokens: 14 });
  const noUsage = events.filter((e) => e.event === "follow_up.model_finished")[1];
  assert.ok(!("usage" in noUsage));
  const requested = events.find((e) => e.event === "follow_up.tool_requested");
  assert.deepEqual(requested.argumentsShape, { type: "object", keyCount: 2, valueTypes: ["string"] });
  for (const secret of ["PRIVATE_EMAIL", "PRIVATE_NAME", "PRIVATE_DESCRIPTION", "SECRET_KEY"]) assert.ok(!JSON.stringify(events).includes(secret));
  for (const e of events.filter((event) => event.durationMs !== undefined)) assert.ok(e.durationMs >= 0);
});

test("timeouts and provider errors are sanitized and preserve the original thrown error", async () => {
  for (const [name, status, expected] of [["APIConnectionTimeoutError", undefined, "timeout"], ["APIError", 429, "provider_error"]]) {
    const { events, trace } = fixture();
    const error = Object.assign(Error("PRIVATE_EMAIL SECRET_KEY cookie=SECRET_TOKEN"), { name, status, headers: { authorization: "SECRET_TOKEN" }, body: "PRIVATE_DESCRIPTION" });
    await assert.rejects(() => trace.modelRequest(1, async () => { throw error; }), (actual) => actual === error);
    trace.finish("failed", error);
    const end = events.find((e) => e.event === "follow_up.model_finished");
    assert.equal(end.result, expected);
    assert.equal(end.error.name, name);
    assert.equal(end.error.status, status);
    assert.equal(events.at(-1).phase, "model_request");
    assert.equal(events.at(-1).modelRequests, 1);
    for (const secret of ["PRIVATE_EMAIL", "SECRET_KEY", "SECRET_TOKEN", "PRIVATE_DESCRIPTION"]) assert.ok(!JSON.stringify(events).includes(secret));
  }
});

test("tool failures are timed and classified without logging results or raw errors", async () => {
  const { events, trace } = fixture();
  const error = Error("PRIVATE_DESCRIPTION");
  await assert.rejects(() => trace.toolExecution(2, "get_existing_analysis", async () => { throw error; }));
  trace.finish("failed", error);
  assert.equal(events.at(-1).phase, "tool_execution");
  assert.equal(events.at(-1).toolExecutions, 1);
  assert.equal(events.find((e) => e.event === "follow_up.tool_finished").result, "failed");
  assert.ok(!JSON.stringify(events).includes("PRIVATE_DESCRIPTION"));
});

test("untrusted tool names, argument keys, unknown error names and invalid usage do not leak", async () => {
  const { events, trace } = fixture();
  trace.toolRequested(1, "SECRET_KEY", { "PRIVATE_EMAIL": "PRIVATE_NAME" });
  await trace.modelRequest(1, async () => ({ status: "PRIVATE_EMAIL", usage: { total_tokens: "SECRET_KEY", output_tokens_by_modality: [{ value: "PRIVATE_EMAIL" }] } }));
  trace.finish("failed", { name: "SECRET_TOKEN", message: "PRIVATE_DESCRIPTION", status: "PRIVATE_EMAIL" });
  const serialized = JSON.stringify(events);
  for (const secret of ["SECRET_KEY", "PRIVATE_EMAIL", "PRIVATE_NAME", "SECRET_TOKEN", "PRIVATE_DESCRIPTION"]) assert.ok(!serialized.includes(secret));
  assert.equal(events[1].tool, "unknown");
});

test("a failed log sink does not change model or tool execution", async () => {
  const trace = tracing.createFollowUpTrace(model, () => { throw Error("logging failed"); });
  assert.equal((await trace.modelRequest(1, async () => ({ status: "completed" }))).status, "completed");
  assert.equal(await trace.toolExecution(1, "get_lead_context", async () => 42), 42);
  trace.finish("completed");
});

for (const scenario of ["success", "timeout", "validation", "tool_failure"]) {
  test(`actual agent trace records ${scenario} lifecycle without model/tool contents`, async () => {
    const previous = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "SECRET_KEY";
    const { trace, events } = fixture();
    let turn = 0;
    class GoogleGenAI {
      constructor() { this.interactions = { create: async () => {
        turn++;
        if (scenario === "timeout") throw Object.assign(Error("SECRET_KEY PRIVATE_EMAIL"), { name: "APIConnectionTimeoutError" });
        if (turn === 1) return { status: "requires_action", steps: [{ type: "function_call", id: "call", name: "get_lead_context", arguments: {} }] };
        return { status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify(scenario === "validation" ? { ...final, proposedStatus: "invalid" } : final) }] }] };
      } }; }
    }
    const { runFollowUpAgent } = load("src/lib/ai/follow-up-agent.ts", {
      "server-only": {}, "@google/genai": { GoogleGenAI }, zod: require("zod"), "./follow-up-schema": schema, "./follow-up-trace": tracing,
    });
    try {
      const operation = () => runFollowUpAgent(async () => { if (scenario === "tool_failure") throw Error("PRIVATE_EMAIL"); return { description: "PRIVATE_DESCRIPTION" }; }, trace);
      if (scenario === "success") { assert.deepEqual(await operation(), final); trace.finish("completed"); }
      else { try { await operation(); assert.fail("Expected failure"); } catch (error) { trace.finish("failed", error); } }
      const finish = events.at(-1);
      assert.equal(finish.outcome, scenario === "success" ? "completed" : "failed");
      assert.equal(finish.phase, scenario === "timeout" ? "model_request" : scenario === "tool_failure" ? "tool_execution" : "final_validation");
      assert.equal(finish.modelRequests, ["timeout", "tool_failure"].includes(scenario) ? 1 : 2);
      assert.equal(finish.toolExecutions, scenario === "timeout" ? 0 : 1);
      for (const secret of ["SECRET_KEY", "PRIVATE_EMAIL", "PRIVATE_DESCRIPTION", "PRIVATE_REPLY", "PRIVATE_REASON"]) assert.ok(!JSON.stringify(events).includes(secret));
    } finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
  });
}

for (const [access, outcome, expectedStatus] of [["unauthenticated", "unauthenticated", 401], ["forbidden", "forbidden", 403], ["admin", "completed", 200]]) {
  test(`endpoint owns one trace from authorization through ${outcome}`, async () => {
    const { trace, events } = fixture();
    class FollowUpLeadNotFoundError extends Error {}
    const { POST } = load("src/app/api/leads/[id]/follow-up/route.ts", {
      "@/lib/ai/follow-up-trace": { createFollowUpTrace: (actualModel) => { assert.equal(actualModel, model); return trace; } },
      "@/lib/supabase-auth/admin": { getAdminAccess: async () => access },
      "@/lib/ai/follow-up-tools": { FollowUpLeadNotFoundError, createFollowUpTools: async () => { assert.equal(access, "admin"); return async () => ({}); } },
      "@/lib/ai/follow-up-agent": { FOLLOW_UP_MODEL: model, runFollowUpAgent: async (_execute, actualTrace) => {
        assert.equal(actualTrace, trace);
        await trace.modelRequest(1, async () => ({ status: "completed" }));
        trace.phase("final_validation"); return final;
      } },
      "@/lib/ai/follow-up-schema": schema,
    });
    const response = await POST({}, { params: Promise.resolve({ id: "12345678-1234-1234-1234-123456789abc" }) });
    assert.equal(response.status, expectedStatus);
    assert.equal(events.filter((event) => event.event === "follow_up.run_finished").length, 1);
    assert.equal(events.at(-1).outcome, outcome);
    assert.equal(events.at(-1).modelRequests, access === "admin" ? 1 : 0);
    assert.ok(!(await response.text()).includes(events[0].runId));
  });
}
