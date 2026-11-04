import { pathToFileURL } from "node:url";
import { loadDataset } from "./checks.mjs";
import { loadLiveAgent } from "./runtime.mjs";
import { runEvaluation } from "./runner.mjs";

export function liveScenarioDelay(env) {
  const raw = env.FOLLOW_UP_EVAL_DELAY_MS ?? "20000";
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > 300000) {
    throw new Error("FOLLOW_UP_EVAL_DELAY_MS must be an integer from 0 to 300000.");
  }
  return Number(raw);
}

export async function main(args, env = process.env, output = console) {
  const caseIndex = args.indexOf("--case");
  const selected = caseIndex >= 0 ? args[caseIndex + 1] : null;
  const validArgs = args.length === 1 && args[0] === "--live" || args.length === 3 && args.includes("--live") && caseIndex >= 0 && selected && selected !== "--live";
  if (!validArgs) {
    output.error("Manual live evaluation only: node --env-file=.env.local evals/follow-up/run.mjs --live [--case scenario-id]");
    return 2;
  }
  if (!env.GEMINI_API_KEY) {
    output.error("GEMINI_API_KEY is required for live evaluation.");
    return 2;
  }
  let delayMs;
  try { delayMs = liveScenarioDelay(env); }
  catch { output.error("FOLLOW_UP_EVAL_DELAY_MS must be an integer from 0 to 300000."); return 2; }
  const dataset = loadDataset();
  if (selected && !dataset.scenarios.some((item) => item.id === selected)) {
    output.error("Unknown scenario ID.");
    return 2;
  }
  if (selected) dataset.scenarios = dataset.scenarios.filter((item) => item.id === selected);
  const report = await runEvaluation(dataset, loadLiveAgent(), undefined, { delayMs });
  output.log(JSON.stringify(report, null, 2));
  return report.passed === report.total ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch { console.error("Evaluation runner failed; check local configuration and dataset."); process.exitCode = 1; }
}
