# Follow-up evaluations (J4)

This is a small regression suite, not an evaluation platform. `scenarios.json`
contains **18 authored synthetic scenarios**, versioned as `follow-up-eval-v1`.
No real customer records, contact details, images, database IDs or credentials
are copied into the dataset.

Each scenario has an ID, label/tags, the six minimized context fields used by J1,
an optional synthetic V1 analysis, and expectations: forbidden proposed statuses,
clarification topics and whether the location is outside the demo service area.
The cases cover qualified Paris/Île-de-France projects, incomplete/test/spam leads,
high/missing budgets, exact-price requests, urgency, contacted/quote-sent/won/lost
states, existing/absent V1 analysis and a hostile prompt-injection submission.

## Offline checks — no Gemini or database

From the repository root:

```bash
node --test tests/lead-follow-up-eval.test.mjs
```

Tests validate dataset structure/coverage, run all fixtures through the **real
read-only tool implementation** with an in-memory database substitute, and verify
the scoring rules using safe reference responses and deliberately bad responses.
A fake-agent runner test checks aggregation and usage reporting. These tests do
**not** establish that the live model passes the scenarios.

Checks include:

- the production Zod output schema (including non-empty action/reply and valid status);
- scenario-specific forbidden status proposals (notably unsupported won/quote-sent);
- new euro amounts absent from supplied context/analysis;
- a limited set of affirmative price/deadline promises;
- new numerical measurements or explicit numeric dates;
- topic/clarification language when important information is missing;
- service-area/faisability language for outside-area requests.

Exact generated text is deliberately not compared. Different natural French
responses can be equally suitable. Status expectations permit multiple acceptable
values, including null, rather than enforcing one answer.

Text checks are **French lexical heuristics**: they can yield false positives
(negation, paraphrases, equivalent units) and false negatives (unsupported claims
expressed differently). The numerical checks do not prove that all customer facts
are grounded. Novel names, materials, contact history and subtle semantic errors
still require human review. Passing is a warning-check result, not a quality or
safety guarantee. A generic cautious response may pass; this is not a usefulness
ranking or an LLM-as-judge suite.

## Optional live execution — manual only

Start with one scenario:

```bash
node --env-file=.env.local evals/follow-up/run.mjs --live --case exact-price
```

Run the full dataset explicitly:

```bash
node --env-file=.env.local evals/follow-up/run.mjs --live
```

The manual live CLI waits **20 seconds between scenarios**, including after failed
scenarios. There is no wait before the first case or after the last. Override with
a whole number of milliseconds from 0 to 300000:

```bash
FOLLOW_UP_EVAL_DELAY_MS=45000 node --env-file=.env.local evals/follow-up/run.mjs --live
```

A value of 0 explicitly disables pacing. Offline tests/default programmatic runs
have no delay; tests use an injected wait function without sleeping. The report
records `scenarioDelayMs`. Overall duration includes pacing, per-case/model
latency excludes it. Pacing reduces short-window bursts but cannot guarantee
avoidance of 429s (shared quotas and per-scenario model turns still matter).
The evaluator never retries an entire case. It reuses the production agent’s
bounded per-model-request policy: at most one retry for 429, 503 or a recognized
request timeout, with a one-second backoff and a fresh 90-second deadline.

`--live` and a server-side `GEMINI_API_KEY` are required. Without opt-in the command
exits before loading the Gemini SDK or calling the model. No CI workflow or package
script automatically runs live evals. A full run may make up to **144 physical model attempts**
(18 cases × four logical turns × at most two attempts), sequentially, with the production
per-attempt timeouts. There are no additional evaluation retries, fallbacks or quotas.
A timeout retry may incur another provider charge if the earlier request actually
completed remotely; timeouts do not establish that generation never occurred.

`runtime.mjs` uses the existing TypeScript dev dependency to transpile a small
allowlisted module graph for the Node CLI. Only the Next.js `server-only` marker
is stubbed; the actual agent, schemas, tool argument validation, business rules,
loop and J3 tracing are reused. The privileged Supabase module is replaced with a
strict read-only fixture adapter: it accepts only the expected projections and a
fixed synthetic lead scope, and exposes no writes, Auth or Storage. Application
source/configuration is not modified. Never use this harness inside the app.

The current model and prompt-version constants come from production code; no eval
model or prompt is maintained separately. The runner makes exactly one explicit
agent run per case and never calls an application endpoint. Tool choice remains
model-driven, without requiring all tools.

## Report and regression comparison

Stdout is a JSON report: dataset/model/prompt version, passed/total, failures by
criterion, per-case failures and validated generated output for manual review,
model/tool counts, total/case/model-request latency and optional token usage.
Usage counters sum only observed J3 response metadata; `null` means unavailable,
not zero. `usageObservedTurns` indicates partial coverage. Error messages are
sanitized using J3; credentials, raw provider errors and tool contents are not
printed. The validated output contains only generated content for synthetic leads.

Exit codes: 0 = all checks passed, 1 = a criterion or agent run failed,
2 = missing/invalid live opt-in, case selection or API-key configuration.
No reports are persisted unless you deliberately redirect stdout to a file.

After changing the model, prompt or tools: run offline tests first, then manually
run the same dataset and compare failure categories, individual outputs, latency
and observed usage. Keep the previous JSON report outside the source tree if
needed. Results are not guaranteed identical across live runs: model sampling,
provider updates and availability can vary. Record the git revision alongside the
report when comparing code changes; update dataset version when its meaning changes.
