# Project state

Updated: 4 November 2026. V1 and V2 implementation is complete. This file records
the repository's current scope, rather than a historical branch or personal CV task list.

## Product and stack

Artisan Leads is a production lead-management application for **Atelier Noyer**, a
fictional carpentry business. Production hosting is Vercel at
`https://artisan-leads.vercel.app`, with Supabase PostgreSQL, private Storage, and Auth.

The application uses **Next.js 16.4.5**, React 19, TypeScript, Tailwind CSS, Zod,
and `@google/genai`. Tooling uses Node.js 24 and pnpm 12.10.1.

## Completed V1

- Public website and validated quote intake through `POST /api/leads`.
- PostgreSQL lead persistence, private image uploads and metadata, temporary signed
  URLs for dashboard image access, and compensating cleanup after upload failures.
- Supabase login, cookie refresh, server-verified identity, and `ADMIN_USER_ID`
  authorization on dashboard pages and protected APIs.
- Admin lead list/details, explicit manual status updates, email/phone contact links.
- Gemini structured lead analysis using `gemini-3.8-flash`, server-side Zod validation,
  one saved analysis per lead, and explicit regeneration. Page reads reuse saved results.
- GitHub Actions CI (frozen install, lint, build) and Vercel deployment from `main`.
- Version-controlled Supabase initial migration for tables, constraints, RLS, grants,
  and the private bucket, with [fresh-environment setup](supabase/README.md).
  Admin accounts, credentials, and hosted settings are configured separately.

## Completed V2

The lead-detail panel prepares a follow-up through the admin-protected
`POST /api/leads/[id]/follow-up` endpoint. The interactive agent uses
**`gemini-3.5-flash-lite`**, Gemini Interactions tool/function calling, and a bounded
server-controlled loop. No LangChain, LangGraph, or RAG is used.

Three least-privilege read-only tools accept no arguments:

- `get_lead_context`: six minimized fields for the route's lead.
- `get_existing_analysis`: the same lead's six V1 analysis fields, if present.
- `get_business_rules`: five deterministic business rules.

The server validates tool names, call IDs, arguments, and protocol shape, then
executes allowlisted operations. Gemini has no direct database access or credentials
and cannot choose another lead, query arbitrary data, or invoke a mutation.
Each tool runs at most once; a run allows four logical model turns, three tool
executions, and 1,200 output tokens per request. A model may finish without using
all tools. Final summary, justification, recommended action, suggested reply, and
optional proposed status are validated with Zod.

Human-in-the-loop status changes are implemented: preparing a proposal does not
write anything. An admin explicitly approves a proposed change in the UI, which
calls the existing independently authorized and validated PATCH endpoint. Refusal
performs no update. The agent itself remains advisory/read-only.

Structured tracing emits run IDs, model/version, model turns and attempts, tool
calls, latency, optional provider token usage, and sanitized provider errors.
Raw prompts, lead content, tool results, credentials, and raw provider error messages
are excluded from traces.

Transient HTTP 429, 503, and recognized timeout failures receive at most one retry
per model request, with a fixed one-second backoff and fresh 90-second timeout per
attempt. SDK retries are disabled. Runs allow at most eight physical model attempts;
tools and output validation are not retried. A timeout does not prove the remote
request failed to complete.

## Implementation map

| Area | Repository location |
| --- | --- |
| Public intake and protected APIs | `src/app/api/leads/` |
| Dashboard and lead details | `src/app/dashboard/` |
| Auth/session checks | `src/lib/supabase-auth/`, `src/proxy.ts` |
| Privileged server-only client | `src/lib/supabase-server.ts` |
| V1 structured analysis | `src/lib/ai/gemini.ts`, `lead-analysis-schema.ts` |
| V2 loop, tools, schemas | `src/lib/ai/follow-up-agent.ts`, `follow-up-tools.ts`, `follow-up-schema.ts` |
| V2 tracing and retries | `src/lib/ai/follow-up-trace.ts`, `follow-up-retry.ts` |
| Human review and approval | `src/components/LeadFollowUpPanel.tsx` |
| Database schema | `supabase/migrations/20261018_initial_schema.sql` |
| Offline regression tests | `tests/*.test.mjs` |
| Synthetic evaluation | `evals/follow-up/` |
| CI | `.github/workflows/ci.yml` |

## Evaluation and release validation

The J4 suite contains **18 authored synthetic scenarios**. Offline checks exercise
schemas, real read-only tools against fixtures, scoring rules, and runner aggregation.
The checks are lightweight deterministic French lexical/numeric heuristics, with
false positives and false negatives; they are not semantic LLM-as-judge evaluation
or proof that a live model is useful or fully grounded.

Manual live evaluation uses the production agent with synthetic fixture tools and
requires `--live` plus `GEMINI_API_KEY`. Default pacing is 20 seconds between
scenarios, configurable through `FOLLOW_UP_EVAL_DELAY_MS` (0–300000 ms). It reuses
bounded per-request retries and does not retry whole scenarios. See the
[evaluation guide](evals/follow-up/README.md) for commands and report interpretation.

Release validation commands are documented in [README.md](README.md). The Next.js
16.4.5 maintenance validation passed all seven offline test files (auth, V1 analysis,
J1/J2/J3/J4, retry), lint, standalone TypeScript, and production build with Webpack.
Turbopack still encountered the sandbox port-binding restriction; the Webpack build
passed without warnings. Installation reported existing deprecations for
`eslint@9.39.5` and `node-domexception@1.0.0`.

CI currently runs lint and build, not the offline test suite or manual live evals.
Repository checks do not independently establish the latest hosted deployment's
revision or live provider availability.

## Limits and operational boundaries

- No autonomous status mutation. Approval invokes an ordinary admin status update;
  there is no persisted approval audit trail or server-side proposal binding.
- The UI detects status changes visible in its current props before approval;
  the PATCH endpoint does not implement compare-and-swap concurrency control.
- No automatic email sending. Contact links open external clients; suggested
  replies require human review and sending.
- Follow-up proposals and decisions live only in UI state and are not persisted.
  V1 analyses are persisted separately. Agent history is request-local with `store: false`.
- Data minimization excludes dedicated contact fields and images, but free-text
  descriptions or saved analyses can still contain personal information.
- No background agent jobs, provider fallback, cross-tab deduplication, or usage quotas.
- The initial migration targets fresh databases. Do not apply it unchanged over
  the original production schema. Deleting image metadata does not automatically
  delete physical Storage objects.
- Single-admin reference application; multi-tenant configuration, automatic
  notifications, anti-spam/rate limiting, and commercial/legal polish are outside
  this completed release's scope.

AI analysis, agent work, and version-controlled database setup are implemented;
there are no remaining implementation TODOs for them. Personal CV/interview tasks
are outside this repository's release checklist.
