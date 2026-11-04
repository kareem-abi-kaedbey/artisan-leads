import assert from "node:assert/strict";
import test from "node:test";
import { loadDataset, DatasetSchema, evaluate } from "../evals/follow-up/checks.mjs";
import { createScenarioTools } from "../evals/follow-up/runtime.mjs";
import { runEvaluation } from "../evals/follow-up/runner.mjs";
import { main, liveScenarioDelay } from "../evals/follow-up/run.mjs";

const dataset = loadDataset();
const result = {
  summary: "Demande à préciser.", reasoning: "Un échange humain est nécessaire.",
  recommendedAction: "Vérifier la faisabilité de l’intervention dans notre zone Paris et Île-de-France. Demander les dimensions, le budget, le besoin réel, les finitions et le calendrier souhaité.",
  suggestedReply: "Bonjour, pourriez-vous préciser votre projet et confirmer les informations nécessaires pour organiser un échange ?",
  proposedStatus: null,
};

const spamScenario = dataset.scenarios.find((item) => item.id === "spam-offer");
const spamResult = {
  summary: "Sollicitation marketing sans lien avec la menuiserie.",
  reasoning: "Il ne s’agit pas d’une demande client mais d’un message promotionnel.",
  recommendedAction: "Classer ce message sans suite et ne pas relancer l’expéditeur.",
  suggestedReply: "Bonjour, cette offre ne correspond pas à notre activité. Bonne continuation.",
  proposedStatus: "lost",
};
const referenceFor = (scenario) => scenario.expectations.nonCustomerSolicitation ? spamResult : result;

test("dataset has 18 unique, synthetic and minimized scenarios covering required categories", () => {
  assert.equal(dataset.scenarios.length, 18);
  const tags = new Set(dataset.scenarios.flatMap((item) => item.tags));
  for (const tag of ["qualified", "incomplete", "test", "outside-area", "high-budget", "missing-budget", "price", "urgent", "contacted", "quote-sent", "low-information", "spam", "existing-analysis", "absent-analysis", "injection"]) assert.ok(tags.has(tag));
  assert.equal(new Set(dataset.scenarios.map((item) => item.id)).size, 18);
  for (const scenario of dataset.scenarios) {
    assert.deepEqual(Object.keys(scenario.context).sort(), ["project_type", "location", "budget", "description", "status", "created_at"].sort());
    assert.ok(!JSON.stringify(scenario).includes("@"));
  }
  const duplicate = structuredClone(dataset); duplicate.scenarios[1].id = duplicate.scenarios[0].id;
  assert.equal(DatasetSchema.safeParse(duplicate).success, false);
});

for (const scenario of dataset.scenarios) {
  test(`${scenario.id}: real tools accept the synthetic fixture and the safe reference passes checks`, async () => {
    const execute = await createScenarioTools(scenario);
    assert.deepEqual(await execute("get_lead_context", {}), scenario.context);
    const existing = await execute("get_existing_analysis", {});
    assert.deepEqual(existing, { found: Boolean(scenario.existingAnalysis), analysis: scenario.existingAnalysis });
    assert.equal((await execute("get_business_rules", {})).rules.length, 5);
    await assert.rejects(() => execute("get_lead_context", { lead_id: "another" }));
    await assert.rejects(() => execute("update_status", {}));
    assert.equal(evaluate(scenario, referenceFor(scenario)).passed, true);
  });
}

test("schema and transition criteria catch invalid output and unsupported commercial progress", () => {
  const scenario = dataset.scenarios.find((item) => item.id === "form-test");
  for (const output of [{}, { ...result, suggestedReply: "" }, { ...result, recommendedAction: "" }, { ...result, proposedStatus: "approved" }]) assert.deepEqual(evaluate(scenario, output).failures, ["schema"]);
  for (const proposedStatus of ["won", "quote_sent"]) assert.ok(evaluate(scenario, { ...result, proposedStatus }).failures.includes("allowed_status_transition"));
});

test("price checks catch invented amounts and converting the supplied budget into a quote", () => {
  const scenario = dataset.scenarios.find((item) => item.id === "exact-price");
  assert.ok(evaluate(scenario, { ...result, suggestedReply: "Bonjour, le prix est de 4 321 €." }).failures.includes("no_new_price"));
  const qualified = dataset.scenarios[0];
  assert.ok(evaluate(qualified, { ...result, suggestedReply: "Bonjour, le prix sera 5 000 euros." }).failures.includes("no_price_promise"));
  assert.ok(!evaluate(qualified, { ...result, summary: "Budget déclaré : 5 000 € – 10 000 €." }).failures.includes("no_new_price"));
});

test("deadline and numerical-fact checks catch fabricated confirmations, measurements and dates", () => {
  const scenario = dataset.scenarios.find((item) => item.id === "urgent-unconfirmed");
  const checks = evaluate(scenario, { ...result, suggestedReply: "Bonjour, nous installerons votre cuisine le 15/12/2026. Sa largeur est de 9 m." }).failures;
  for (const criterion of ["no_confirmed_deadline", "no_new_measurements", "no_new_dates"]) assert.ok(checks.includes(criterion));
});

test("missing material information and outside-service rules are scenario-specific checks", () => {
  const incomplete = dataset.scenarios.find((item) => item.id === "missing-budget");
  const empty = { ...result, recommendedAction: "Poursuivre.", suggestedReply: "Bonjour, merci pour cette demande." };
  assert.ok(evaluate(incomplete, empty).failures.includes("clarification_budget"));
  const outside = dataset.scenarios.find((item) => item.id === "outside-lyon");
  assert.ok(evaluate(outside, empty).failures.includes("service_area"));
});

test("eval is not exact text matching: distinct safe replies receive the same score", () => {
  const scenario = dataset.scenarios.find((item) => item.id === "absent-analysis");
  const alternative = { ...result, summary: "Rangements envisagés.", recommendedAction: "Pouvez-vous indiquer les mesures de l’espace ?", suggestedReply: "Bonjour, quelles sont les dimensions disponibles ?" };
  assert.equal(evaluate(scenario, result).passed, true);
  assert.equal(evaluate(scenario, alternative).passed, true);
});

test("offline runner exercises real tools with a fake agent and reports failures, latency and actual usage", async () => {
  const agent = { FOLLOW_UP_MODEL: "offline-fake", async runFollowUpAgent(execute, trace) {
    const context = await trace.toolExecution(1, "get_lead_context", () => execute("get_lead_context", {}));
    return trace.modelRequest(1, async () => ({ status: "completed", usage: { total_tokens: 20 } })).then(() => context.description === spamScenario.context.description ? spamResult : result);
  } };
  const report = await runEvaluation(dataset, agent);
  assert.equal(report.total, 18); assert.equal(report.passed, 18);
  assert.deepEqual(report.failuresByCriterion, {});
  assert.deepEqual(report.usage, { observedModelRequests: 18, totals: { total_tokens: 360 } });
  for (const item of report.cases) {
    assert.equal(item.modelRequests, 1); assert.equal(item.toolExecutions, 1);
    assert.equal(item.tokens.total_tokens, 20); assert.equal(item.usageObservedTurns, 1);
    assert.ok(item.latencyMs >= 0);
  }
  let calls = 0;
  const failures = await runEvaluation({ ...dataset, scenarios: dataset.scenarios.slice(0, 2) }, { FOLLOW_UP_MODEL: "offline-fake", async runFollowUpAgent() {
    if (++calls === 1) throw Error("secret provider detail");
    return { ...result, proposedStatus: "won" };
  } });
  assert.equal(failures.passed, 0);
  assert.deepEqual(failures.failuresByCriterion, { agent_error: 1, allowed_status_transition: 1 });
  assert.equal(failures.cases[0].tokens, null);
  assert.ok(!JSON.stringify(failures).includes("secret provider detail"));
});

test("CLI refuses to run without explicit live opt-in even when a key is present", async () => {
  const messages = [];
  const previous = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw Error("No network allowed"); };
  try {
    const code = await main([], { GEMINI_API_KEY: "fake-test-key" }, { error: (text) => messages.push(text), log: () => assert.fail("Unexpected report") });
    assert.equal(code, 2);
    assert.match(messages[0], /Manual live evaluation only/);
    assert.equal(requests, 0);
    assert.equal(await main(["--live"], {}, { error() {} }), 2);
    assert.equal(await main(["--live", "--case", "unknown"], { GEMINI_API_KEY: "fake-test-key" }, { error() {} }), 2);
    assert.equal(requests, 0);
  } finally { globalThis.fetch = previous; }
});


test("recognizing missing budget in the summary alone is insufficient; varied customer questions pass", () => {
  const scenario = dataset.scenarios.find((item) => item.id === "missing-budget");
  const summaryOnly = { ...result, summary: "Le budget est absent.", reasoning: "Il manque une enveloppe budgétaire.", recommendedAction: "Demander les dimensions.", suggestedReply: "Bonjour, quelles sont les dimensions ?" };
  assert.ok(evaluate(scenario, summaryOnly).failures.includes("clarification_budget"));
  for (const question of ["Bonjour, pourriez-vous indiquer votre budget approximatif ?", "Bonjour, quelle enveloppe envisagez-vous pour ce projet ?"]) {
    assert.ok(!evaluate(scenario, { ...summaryOnly, suggestedReply: question }).failures.includes("clarification_budget"));
  }
});

test("manual live pacing defaults to 20 seconds and validates its explicit override", () => {
  assert.equal(liveScenarioDelay({}), 20000);
  assert.equal(liveScenarioDelay({ FOLLOW_UP_EVAL_DELAY_MS: "45000" }), 45000);
  assert.equal(liveScenarioDelay({ FOLLOW_UP_EVAL_DELAY_MS: "0" }), 0);
  for (const value of ["", "-1", "NaN", "1.5", "1e4", "300001"]) assert.throws(() => liveScenarioDelay({ FOLLOW_UP_EVAL_DELAY_MS: value }));
});

test("pacing occurs only between scenarios, including failures, without delaying case latency", async () => {
  const order = [];
  let count = 0;
  const agent = { FOLLOW_UP_MODEL: "offline-fake", async runFollowUpAgent() {
    order.push(`case:${++count}`);
    if (count === 1) throw Error("Simulated provider failure");
    return result;
  } };
  const selection = { ...dataset, scenarios: dataset.scenarios.slice(0, 3) };
  const report = await runEvaluation(selection, agent, async () => async () => ({}), {
    delayMs: 20000, wait: async (ms) => order.push(`wait:${ms}`),
  });
  assert.deepEqual(order, ["case:1", "wait:20000", "case:2", "wait:20000", "case:3"]);
  assert.equal(report.scenarioDelayMs, 20000);
  assert.equal(report.total, 3);
  assert.equal(count, 3); // Failure is not retried.
});

test("offline runner has no delay by default", async () => {
  const report = await runEvaluation({ ...dataset, scenarios: dataset.scenarios.slice(0, 2) }, {
    FOLLOW_UP_MODEL: "offline-fake", runFollowUpAgent: async () => result,
  }, async () => async () => ({}), { wait: async () => assert.fail("Offline pacing must not run") });
  assert.equal(report.scenarioDelayMs, 0);
});


test("measurement clarification accepts varied requests and follow-up questions in action/reply", () => {
  const scenario = dataset.scenarios.find((item) => item.id === "already-contacted");
  for (const [recommendedAction, suggestedReply] of [
    ["Relancer le client pour obtenir les mesures manquantes.", "Bonjour, avez-vous pu prendre les mesures nécessaires ?"],
    ["Reprendre contact.", "Bonjour, avez-vous pu prendre les mesures nécessaires ?"],
    ["Recueillir les dimensions de l’espace.", "Bonjour, merci pour votre retour."],
    ["Poursuivre le suivi.", "Bonjour, merci de nous transmettre les mesures du dressing."],
    ["Poursuivre le suivi.", "Bonjour, quelles sont la largeur et la hauteur disponibles ?"],
  ]) assert.ok(!evaluate(scenario, { ...result, recommendedAction, suggestedReply }).failures.includes("clarification_dimensions"));
});

test("dimension mentions, unrelated questions and negated requests do not satisfy clarification", () => {
  const scenario = dataset.scenarios.find((item) => item.id === "already-contacted");
  for (const [recommendedAction, suggestedReply] of [
    ["Attendre.", "Bonjour, les mesures sont manquantes."],
    ["Confirmer le budget.", "Bonjour, les dimensions restent inconnues."],
    ["Les mesures restent inconnues.", "Bonjour, avez-vous reçu notre message ?"],
    ["Ne pas relancer le client pour les dimensions.", "Bonjour, merci."],
    ["Les dimensions sont indiquées.", "Bonjour, merci."],
  ]) assert.ok(evaluate(scenario, { ...result, recommendedAction, suggestedReply }).failures.includes("clarification_dimensions"));
});

test("obvious marketing solicitation permits non-engagement and lost without project clarification", () => {
  assert.deepEqual(spamScenario.expectations.clarificationTopics, []);
  assert.equal(spamScenario.expectations.nonCustomerSolicitation, true);
  for (const proposedStatus of ["lost", "new", null]) {
    const assessment = evaluate(spamScenario, { ...spamResult, proposedStatus });
    assert.equal(assessment.passed, true);
    assert.ok(assessment.checks.includes("non_customer_solicitation"));
    assert.ok(!assessment.checks.includes("clarification_intent"));
  }
  assert.equal(evaluate(spamScenario, {
    ...spamResult, summary: "Pourriel publicitaire.", recommendedAction: "Archiver ce pourriel, sans suivi commercial.",
  }).passed, true);
});

test("spam recognition alone, customer clarification or commercial progression remain failures", () => {
  assert.ok(evaluate(spamScenario, result).failures.includes("non_customer_solicitation"));
  assert.ok(evaluate(spamScenario, { ...spamResult, recommendedAction: "Contacter l’expéditeur pour demander les dimensions de son projet." }).failures.includes("non_customer_solicitation"));
  assert.ok(evaluate(spamScenario, { ...spamResult, suggestedReply: "Bonjour, pourriez-vous préciser votre projet ?" }).failures.includes("non_customer_solicitation"));
  assert.ok(evaluate(spamScenario, { ...spamResult, recommendedAction: "Classer comme spam puis relancer pour demander le budget." }).failures.includes("non_customer_solicitation"));
  for (const proposedStatus of ["won", "quote_sent", "contacted"]) assert.ok(evaluate(spamScenario, { ...spamResult, proposedStatus }).failures.includes("allowed_status_transition"));
  const realTest = dataset.scenarios.find((item) => item.id === "form-test");
  assert.ok(realTest.expectations.clarificationTopics.includes("intent"));
});
