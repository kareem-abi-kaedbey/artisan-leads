import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = new URL("../../", import.meta.url);
// Local evaluation only: load the existing TS modules without changing app code,
// installing a loader or importing Next's server-only marker into a Node CLI.
function load(path, dependencies) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, root), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
  }).outputText;
  new Function("require", "exports", "console", code)((name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected eval dependency: ${name}`);
    return dependencies[name];
  }, exports, console);
  return exports;
}
const zod = require("zod");
export const schemas = load("src/lib/ai/follow-up-schema.ts", { zod });
export const analysisSchemas = load("src/lib/ai/lead-analysis-schema.ts", { zod });
export const tracing = load("src/lib/ai/follow-up-trace.ts", { "server-only": {} });

export async function createScenarioTools(scenario) {
  const leadId = "00000000-0000-4000-8000-000000000001";
  // There are intentionally no write methods, Storage, Auth, credentials or network.
  const database = { from(table) {
    if (!["leads", "lead_ai_analysis"].includes(table)) throw new Error("Unexpected eval table");
    return { select(columns) {
      const expected = table === "leads" ? "project_type, location, budget, description, status, created_at" : "summary, priority, priority_reason, missing_information, recommended_next_action, suggested_reply";
      if (columns !== expected) throw new Error("Unexpected eval projection");
      return { eq(column, id) {
        if (id !== leadId || column !== (table === "leads" ? "id" : "lead_id")) throw new Error("Unexpected eval lead scope");
        return { async maybeSingle() {
          const a = scenario.existingAnalysis;
          return { error: null, data: table === "leads" ? structuredClone(scenario.context) : a ? {
            summary: a.summary, priority: a.priority, priority_reason: a.priorityReason,
            missing_information: a.missingInformation, recommended_next_action: a.recommendedNextAction, suggested_reply: a.suggestedReply,
          } : null };
        } };
      } };
    } };
  } };
  const tools = load("src/lib/ai/follow-up-tools.ts", {
    "server-only": {}, zod, "@/lib/supabase-server": { getSupabaseServer: () => database },
    "./follow-up-schema": schemas, "./lead-analysis-schema": analysisSchemas,
  });
  return tools.createFollowUpTools(leadId);
}

export function loadLiveAgent() {
  return load("src/lib/ai/follow-up-agent.ts", {
    "server-only": {}, zod, "@google/genai": require("@google/genai"),
    "./follow-up-schema": schemas, "./follow-up-trace": tracing,
    "./follow-up-retry": load("src/lib/ai/follow-up-retry.ts", { "server-only": {}, "node:timers/promises": require("node:timers/promises") }),
  });
}
