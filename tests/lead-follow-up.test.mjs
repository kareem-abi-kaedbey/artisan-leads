import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
  new Function("require", "exports", "console", code)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports, { error() {} });
  return exports;
}
const schema = load("src/lib/ai/follow-up-schema.ts", { zod: require("zod") });
const v1Schema = load("src/lib/ai/lead-analysis-schema.ts", { zod: require("zod") });
const id = "12345678-1234-1234-1234-123456789abc";
const context = { project_type: "Cuisine", location: "Paris", budget: "À préciser", description: "Un aménagement", status: "new", created_at: "2026-10-24T10:00:00+00:00" };
const analysis = { summary: "Un projet de cuisine.", priority: "medium", priority_reason: "Dimensions à préciser.", missing_information: ["Dimensions ?"], recommended_next_action: "Clarifier.", suggested_reply: "Bonjour, quelles dimensions ?" };
const final = { summary: "Un projet à préciser.", reasoning: "Les dimensions ne sont pas indiquées.", recommendedAction: "Demander les dimensions.", suggestedReply: "Bonjour, quelles sont les dimensions ?", proposedStatus: null };
const names = ["get_lead_context", "get_existing_analysis", "get_business_rules"];
const call = (name, callId = name, args = {}) => ({ type: "function_call", id: callId, name, arguments: args });
const response = (steps, status = "requires_action") => ({ id: "interaction-test", status, steps });
const done = (value = final) => response([{ type: "model_output", content: [{ type: "text", text: JSON.stringify(value) }] }], "completed");

function toolFixture({ missing = false, noAnalysis = false, dbError = false } = {}) {
  const queries = [];
  const client = { from(table) { return { select(columns) {
    queries.push({ table, columns });
    return { eq(column, value) {
      assert.equal(value, id);
      assert.equal(column, table === "leads" ? "id" : "lead_id");
      return { maybeSingle: async () => ({ error: dbError ? Error("private db detail") : null,
        data: table === "leads" ? missing ? null : { ...context, name: "PRIVATE", email: "PRIVATE", phone: "PRIVATE", id: "PRIVATE" } : noAnalysis ? null : { ...analysis, id: "PRIVATE", lead_id: "PRIVATE", model: "PRIVATE" } }) };
    } };
  } }; } };
  const loaded = load("src/lib/ai/follow-up-tools.ts", {
    "server-only": {}, zod: require("zod"), "@/lib/supabase-server": { getSupabaseServer: () => client },
    "./lead-analysis-schema": v1Schema, "./follow-up-schema": schema,
  });
  return { ...loaded, queries };
}

test("tools are bound to route lead and only project six allowed context fields", async () => {
  const fixture = toolFixture();
  const execute = await fixture.createFollowUpTools(id);
  assert.deepEqual(await execute("get_lead_context", {}), context);
  const result = await execute("get_existing_analysis", {});
  assert.deepEqual(Object.keys(result.analysis).sort(), ["summary", "priority", "priorityReason", "missingInformation", "recommendedNextAction", "suggestedReply"].sort());
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  const rules = await execute("get_business_rules", {});
  assert.equal(rules.rules.length, 5);
  assert.match(rules.rules.join(" "), /Île-de-France/);
  assert.equal(fixture.queries.length, 2);
  assert.equal(fixture.queries[0].columns, "project_type, location, budget, description, status, created_at");
  assert.ok(!fixture.queries[1].columns.includes("lead_id"));
});

test("tool arguments and unknown names are rejected before another read", async () => {
  const fixture = toolFixture();
  const execute = await fixture.createFollowUpTools(id);
  for (const args of [{ lead_id: "other-lead" }, { url: "https://example.test" }, null, [], "{}", { filters: {} }]) {
    await assert.rejects(() => execute("get_existing_analysis", args));
  }
  await assert.rejects(() => execute("fetch_url", {}));
  assert.equal(fixture.queries.length, 1);
});

test("missing analysis is explicit; missing or invalid context fails closed", async () => {
  const fixture = toolFixture({ noAnalysis: true });
  const execute = await fixture.createFollowUpTools(id);
  assert.deepEqual(await execute("get_existing_analysis", {}), { found: false, analysis: null });
  const missing = toolFixture({ missing: true });
  await assert.rejects(() => missing.createFollowUpTools(id), missing.FollowUpLeadNotFoundError);
  await assert.rejects(() => toolFixture({ dbError: true }).createFollowUpTools(id));
});

async function runScript(script, execute = async (name) => ({ tool: name })) {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  const requests = [];
  class GoogleGenAI {
    constructor() { this.interactions = { create: async (params, options) => {
      assert.equal(params.store, false);
      assert.equal(params.stream, false);
      assert.equal(params.model, "gemini-3.8-flash");
      assert.equal(params.generation_config.max_output_tokens, 1200);
      assert.deepEqual(params.tools.map((tool) => tool.name), names);
      assert.deepEqual(options.retries, { strategy: "none" });
      assert.ok(!params.agent && !params.previous_interaction_id);
      requests.push(structuredClone(params));
      assert.ok(script.length, "Unbounded/extra model request");
      const next = script.shift();
      if (next instanceof Error) throw next;
      return next;
    } }; }
  }
  const loaded = load("src/lib/ai/follow-up-agent.ts", {
    "server-only": {}, zod: require("zod"), "@google/genai": { GoogleGenAI }, "./follow-up-schema": schema,
  });
  try {
    return { result: await loaded.runFollowUpAgent(execute), requests };
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous;
  }
}

test("parallel tool calls continue statelessly with matching results and original thought signature", async () => {
  const executed = [];
  const thought = { type: "thought", signature: "opaque-signature", summary: [{ type: "text", text: "opaque" }] };
  const { result, requests } = await runScript([response([thought, ...names.map((name) => call(name))]), done()], async (name) => {
    executed.push(name); return { found: false, analysis: null };
  });
  assert.deepEqual(result, final);
  assert.deepEqual(executed, names);
  assert.equal(requests.length, 2);
  const history = requests[1].input;
  assert.deepEqual(history[1], thought);
  assert.deepEqual(history.slice(2, 5), names.map((name) => call(name)));
  assert.deepEqual(history.slice(5).map((step) => [step.type, step.name, step.call_id]), names.map((name) => ["function_result", name, name]));
  assert.ok(!JSON.stringify(requests).includes(id));
});

for (const selected of [[], [names[0]], [names[1]], [names[2]], [names[0], names[2]]]) {
  test(`agent accepts valid final output after ${selected.length} model-selected tools: ${selected.join(", ") || "none"}`, async () => {
    const executed = [];
    const script = selected.length ? [response(selected.map((name) => call(name))), done()] : [done()];
    const { result, requests } = await runScript(script, async (name) => {
      executed.push(name);
      return { found: false, analysis: null };
    });
    assert.deepEqual(result, final);
    assert.deepEqual(executed, selected);
    assert.equal(requests.length, selected.length ? 2 : 1);
  });
}

test("final output without tool calls still requires Zod validation", async () => {
  await assert.rejects(() => runScript([done({ ...final, proposedStatus: "invalid" })]));
  await assert.rejects(() => runScript([done({ ...final, summary: "" })]));
});

test("sequential tool calls use at most four model requests", async () => {
  const { requests } = await runScript([...names.map((name) => response([call(name)])), done()]);
  assert.equal(requests.length, 4);
});

for (const [label, script] of [
  ["model-supplied lead ID", [response([call(names[0], "a", { lead_id: "other" })])]],
  ["unknown tool", [response([call("fetch_url")])]],
  ["duplicate tool", [response([call(names[0], "a"), call(names[0], "b")])]],
  ["duplicate call ID", [response([call(names[0], "a"), call(names[1], "a")])]],
  ["managed tool step", [response([{ type: "google_search_call", id: "a", arguments: {} }])]],
  ["failed model reply", [response([], "failed")]],
  ["invalid final status", [response(names.map((name) => call(name))), done({ ...final, proposedStatus: "automatic" })]],
  ["fourth turn requests another tool", [...names.map((name) => response([call(name)])), response([call(names[0], "again")])]],
  ["provider error without retry", [Error("provider failure")]],
]) {
  test(`agent rejects ${label}`, async () => {
    await assert.rejects(() => runScript([...script]));
  });
}

test("invalid JSON final is rejected", async () => {
  await assert.rejects(() => runScript([response(names.map((name) => call(name))), response([{ type: "model_output", content: [{ type: "text", text: "not JSON" }] }], "completed")]));
});

for (const [access, expected] of [["unauthenticated", 401], ["forbidden", 403], ["admin", 200]]) {
  test(`follow-up endpoint handles ${access} without request-body text or mutations`, async () => {
    let toolLoads = 0, runs = 0;
    class FollowUpLeadNotFoundError extends Error {}
    const { POST } = load("src/app/api/leads/[id]/follow-up/route.ts", {
      "@/lib/supabase-auth/admin": { getAdminAccess: async () => access },
      "@/lib/ai/follow-up-tools": { FollowUpLeadNotFoundError, createFollowUpTools: async (routeId) => {
        assert.equal(routeId, id); toolLoads++; return async () => ({});
      } },
      "@/lib/ai/follow-up-agent": { runFollowUpAgent: async () => { runs++; return final; } },
      "@/lib/ai/follow-up-schema": schema,
    });
    const result = await POST({ json: () => assert.fail("Browser text read") }, { params: Promise.resolve({ id }) });
    assert.equal(result.status, expected);
    assert.equal(toolLoads, access === "admin" ? 1 : 0);
    assert.equal(runs, access === "admin" ? 1 : 0);
    if (access === "admin") {
      assert.deepEqual(await result.json(), { success: true, followUp: final });
      assert.equal(result.headers.get("Cache-Control"), "private, no-store");
    }
  });
}

test("installed SDK serializes the current Interactions protocol and does not retry HTTP errors", async () => {
  const { GoogleGenAI } = require("@google/genai");
  const previousFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (url, options) => {
    requests++;
    assert.match(url instanceof Request ? url.url : String(url), /\/interactions/);
    const body = url instanceof Request ? await url.clone().json() : JSON.parse(options.body);
    assert.equal(body.store, false);
    return new Response(JSON.stringify({ error: { message: "test failure", code: 500 } }), { status: 500, headers: { "content-type": "application/json" } });
  };
  try {
    const ai = new GoogleGenAI({ apiKey: "fake-key" });
    await assert.rejects(() => ai.interactions.create({ model: "gemini-3.8-flash", store: false, input: "Test" }, { retries: { strategy: "none" }, timeout: 1000 }), (error) => error.status === 500);
    assert.equal(requests, 1);
  } finally { globalThis.fetch = previousFetch; }
});

for (const [label, failure, status] of [["missing lead", "missing", 404], ["database failure", "database", 500], ["model failure", "model", 502], ["invalid final", "invalid", 502]]) {
  test(`endpoint safely handles ${label}`, async () => {
    class FollowUpLeadNotFoundError extends Error {}
    let runs = 0;
    const { POST } = load("src/app/api/leads/[id]/follow-up/route.ts", {
      "@/lib/supabase-auth/admin": { getAdminAccess: async () => "admin" },
      "@/lib/ai/follow-up-tools": { FollowUpLeadNotFoundError, createFollowUpTools: async () => {
        if (failure === "missing") throw new FollowUpLeadNotFoundError();
        if (failure === "database") throw Error("private database detail");
        return async () => ({});
      } },
      "@/lib/ai/follow-up-agent": { runFollowUpAgent: async () => {
        runs++;
        if (failure === "model") throw Error("private provider detail");
        return { ...final, proposedStatus: "invalid" };
      } },
      "@/lib/ai/follow-up-schema": schema,
    });
    const result = await POST({}, { params: Promise.resolve({ id }) });
    assert.equal(result.status, status);
    assert.ok(!(await result.text()).includes("private"));
    assert.equal(runs, ["missing", "database"].includes(failure) ? 0 : 1);
  });
}

test("installed SDK preserves stateless steps and function results in a complete mocked loop", async () => {
  const { GoogleGenAI } = require("@google/genai");
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "fake-key";
  let requests = 0;
  const replies = [response(names.map((name) => call(name))), done()];
  globalThis.fetch = async (url, options) => {
    const body = url instanceof Request ? await url.clone().json() : JSON.parse(options.body);
    requests++;
    assert.equal(body.store, false);
    assert.equal(body.response_format.mime_type, "application/json");
    assert.equal(body.tools.length, 3);
    if (requests === 2) {
      assert.deepEqual(body.input.filter((step) => step.type === "function_result").map((step) => step.call_id), names);
    }
    assert.ok(replies.length, "Unexpected model request");
    return new Response(JSON.stringify(replies.shift()), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const { runFollowUpAgent } = load("src/lib/ai/follow-up-agent.ts", {
      "server-only": {}, zod: require("zod"), "@google/genai": { GoogleGenAI }, "./follow-up-schema": schema,
    });
    assert.deepEqual(await runFollowUpAgent(async () => ({ found: false, analysis: null })), final);
    assert.equal(requests, 2);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
  }
});
