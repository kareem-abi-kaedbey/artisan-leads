import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("require", "exports", "console", code)((name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports, { error() {} });
  return exports;
}
const schema = load("src/lib/ai/lead-analysis-schema.ts", { zod: require("zod") });
const analysis = {
  summary: "Un projet de cuisine à préciser.", priority: "medium", priorityReason: "Le besoin est décrit mais les dimensions manquent.",
  missingInformation: ["Quelles sont les dimensions de la pièce ?"], recommendedNextAction: "Appeler pour préciser les dimensions.", suggestedReply: "Bonjour, pouvez-vous préciser les dimensions de votre pièce ?",
};
const id = "12345678-1234-1234-1234-123456789abc";

test("analysis schema rejects missing, oversized, extra or invalid fields", () => {
  assert.ok(schema.LeadAnalysisSchema.safeParse(analysis).success);
  for (const value of [{}, { ...analysis, priority: "urgent" }, { ...analysis, summary: " " }, { ...analysis, suggestedReply: "x".repeat(1601) }, { ...analysis, extra: "unexpected" }, { ...analysis, missingInformation: [42] }]) {
    assert.equal(schema.LeadAnalysisSchema.safeParse(value).success, false);
  }
});

test("Gemini helper makes one bounded request with only approved input and validates output", async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "fake-test-key";
  let calls = 0, text = JSON.stringify(analysis);
  class GoogleGenAI {
    constructor(options) {
      assert.equal(options.apiKey, "fake-test-key");
      assert.equal(options.httpOptions.retryOptions.attempts, 1);
      this.models = { generateContent: async (request) => {
        calls++;
        assert.equal(request.model, "gemini-3.8-flash");
        assert.equal(request.config.maxOutputTokens, 1200);
        assert.equal(request.config.responseMimeType, "application/json");
        assert.deepEqual(request.config.responseJsonSchema.required.sort(), Object.keys(analysis).sort());
        assert.deepEqual(JSON.parse(request.contents), { project_type: "Cuisine", location: "Paris", budget: "À préciser", description: "Un projet de cuisine" });
        return { text };
      } };
    }
  }
  try {
    const { analyzeLead } = load("src/lib/ai/gemini.ts", { "server-only": {}, "@google/genai": { GoogleGenAI }, "./lead-analysis-schema": schema });
    const lead = { project_type: "Cuisine", location: "Paris", budget: "À préciser", description: "Un projet de cuisine", email: "private@example.test", phone: "private", id };
    assert.deepEqual(await analyzeLead(lead), analysis);
    assert.equal(calls, 1);
    text = "not JSON";
    await assert.rejects(() => analyzeLead(lead));
    assert.equal(calls, 2); // Exactly one attempt even on invalid JSON.
    text = JSON.stringify({ ...analysis, priority: "urgent" });
    await assert.rejects(() => analyzeLead(lead));
    assert.equal(calls, 3);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous;
  }
});

function endpoint({ access = "admin", missing = false, invalid = false, saveError = false } = {}) {
  let generations = 0, saves = 0;
  const db = {
    from(table) {
      if (table === "leads") return { select(columns) {
        assert.equal(columns, "project_type, location, budget, description");
        return { eq(column, value) { assert.equal(column, "id"); assert.equal(value, id); return { maybeSingle: async () => ({ data: missing ? null : { project_type: "Cuisine", location: "Paris", budget: "À préciser", description: "Données enregistrées" }, error: null }) }; } };
      } };
      assert.equal(table, "lead_ai_analysis");
      return { upsert(row, options) {
        saves++;
        assert.deepEqual(options, { onConflict: "lead_id" });
        assert.equal(row.lead_id, id);
        assert.equal(row.priority_reason, analysis.priorityReason);
        assert.deepEqual(row.missing_information, analysis.missingInformation);
        assert.equal(row.model, "gemini-3.8-flash");
        assert.ok(!Number.isNaN(Date.parse(row.updated_at)));
        return { select: () => ({ single: async () => ({ data: row, error: saveError ? new Error("private database detail") : null }) }) };
      } };
    },
  };
  const route = load("src/app/api/leads/[id]/analyze/route.ts", {
    "@/lib/supabase-auth/admin": { getAdminAccess: async () => access },
    "@/lib/supabase-server": { getSupabaseServer: () => { assert.equal(access, "admin"); return db; } },
    "@/lib/ai/lead-analysis-schema": schema,
    "@/lib/ai/gemini": { LEAD_ANALYSIS_MODEL: "gemini-3.8-flash", analyzeLead: async (lead) => {
      generations++;
      assert.equal(lead.description, "Données enregistrées");
      return invalid ? { ...analysis, priority: "invalid" } : analysis;
    } },
  });
  return { route, counts: () => ({ generations, saves }) };
}
async function invoke(route) {
  return route.POST({ json: () => assert.fail("Browser text must not be read") }, { params: Promise.resolve({ id }) });
}
for (const [access, status] of [["unauthenticated", 401], ["forbidden", 403]]) {
  test(`analyze rejects ${access} without generation or persistence`, async () => {
    const instance = endpoint({ access });
    assert.equal((await invoke(instance.route)).status, status);
    assert.deepEqual(instance.counts(), { generations: 0, saves: 0 });
  });
}
test("missing lead returns 404 without generation", async () => {
  const instance = endpoint({ missing: true });
  assert.equal((await invoke(instance.route)).status, 404);
  assert.deepEqual(instance.counts(), { generations: 0, saves: 0 });
});
test("analysis and explicit regeneration upsert one current row", async () => {
  const instance = endpoint();
  for (let count = 1; count <= 2; count++) {
    const response = await invoke(instance.route);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).analysis.lead_id, id);
    assert.deepEqual(instance.counts(), { generations: count, saves: count });
  }
});
test("invalid model output is not saved and returns a generic 502", async () => {
  const instance = endpoint({ invalid: true });
  const response = await invoke(instance.route);
  assert.equal(response.status, 502);
  assert.deepEqual(instance.counts(), { generations: 1, saves: 0 });
});
test("persistence failure returns generic 500 and does not retry generation", async () => {
  const instance = endpoint({ saveError: true });
  const response = await invoke(instance.route);
  assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes("private database detail"));
  assert.deepEqual(instance.counts(), { generations: 1, saves: 1 });
});
