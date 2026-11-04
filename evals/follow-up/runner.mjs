import { setTimeout as sleep } from "node:timers/promises";
import { performance } from "node:perf_hooks";
import { evaluate } from "./checks.mjs";
import { createScenarioTools, tracing, schemas } from "./runtime.mjs";

export async function runEvaluation(dataset, agent, makeTools = createScenarioTools, { delayMs = 0, wait = sleep } = {}) {
  const started = performance.now();
  const cases = [];
  const failuresByCriterion = {};
  for (const [index, scenario] of dataset.scenarios.entries()) {
    if (index > 0 && delayMs > 0) await wait(delayMs);
    const start = performance.now();
    const events = [];
    const trace = tracing.createFollowUpTrace(agent.FOLLOW_UP_MODEL, (event) => events.push(event));
    let assessment, error, output;
    try {
      trace.phase("context");
      const executeTool = await makeTools(scenario);
      const result = await agent.runFollowUpAgent(executeTool, trace);
      assessment = evaluate(scenario, result);
      const validated = schemas.FollowUpSchema.safeParse(result);
      if (validated.success) output = validated.data;
      trace.finish("completed");
    } catch (failure) {
      error = tracing.safeTraceError(failure);
      assessment = { passed: false, failures: ["agent_error"], checks: ["agent_error"] };
      trace.finish("failed", failure);
    }
    const modelEvents = events.filter((event) => event.event === "follow_up.model_finished");
    const observedUsage = modelEvents.filter((event) => event.usage);
    const tokens = observedUsage.length ? {} : null;
    for (const event of observedUsage) {
      for (const [key, value] of Object.entries(event.usage)) tokens[key] = (tokens[key] ?? 0) + value;
    }
    for (const criterion of assessment.failures) failuresByCriterion[criterion] = (failuresByCriterion[criterion] ?? 0) + 1;
    const terminal = events.findLast((event) => event.event === "follow_up.run_finished");
    cases.push({
      id: scenario.id, ...assessment, latencyMs: Math.round(performance.now() - start),
      modelRequests: terminal?.modelRequests ?? 0, toolExecutions: terminal?.toolExecutions ?? 0,
      modelLatenciesMs: modelEvents.map((event) => event.durationMs),
      usageObservedTurns: observedUsage.length, tokens, ...(output ? { output } : {}), ...(error ? { error } : {}),
    });
  }
  const latencies = cases.map((item) => item.latencyMs).sort((a, b) => a - b);
  const totals = {};
  for (const item of cases) for (const [key, value] of Object.entries(item.tokens ?? {})) totals[key] = (totals[key] ?? 0) + value;
  return {
    usage: { observedModelRequests: cases.reduce((sum, item) => sum + item.usageObservedTurns, 0), totals: Object.keys(totals).length ? totals : null },
    datasetVersion: dataset.version, model: agent.FOLLOW_UP_MODEL, agentVersion: tracing.FOLLOW_UP_AGENT_VERSION,
    scenarioDelayMs: delayMs,
    total: cases.length, passed: cases.filter((item) => item.passed).length, failuresByCriterion,
    totalDurationMs: Math.round(performance.now() - started),
    latencyMs: { mean: cases.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / cases.length) : null, p95: latencies[Math.ceil(latencies.length * 0.95) - 1] ?? null },
    cases,
  };
}
