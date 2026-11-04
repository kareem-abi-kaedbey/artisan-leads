# Artisan Leads — Atelier Noyer

A production Next.js lead-management application for a fictional carpentry business,
with validated quote intake, private customer images, an authenticated admin dashboard,
and Gemini-assisted analysis and follow-up.

Stack: **Next.js 16.4.5**, React 19, TypeScript, Tailwind CSS, Zod,
Supabase (PostgreSQL, Storage, Auth), and the Google `@google/genai` SDK.
Node.js 24 and pnpm 12.10.1 are used for development and CI.

## V1: lead intake and management

- Public quote form and `POST /api/leads`, with server-side Zod validation and
  image checks (up to five JPEG/PNG/WebP files, 5 MB each).
- PostgreSQL stores leads, image metadata, and one current AI analysis per lead.
  Failed upload operations trigger compensating cleanup across database and storage.
- Images live in the private `lead-images` Supabase Storage bucket. The server
  generates temporary signed URLs for dashboard display.
- Supabase email/password login and server-side `ADMIN_USER_ID` authorization
  protect dashboard pages and sensitive API routes. There is no public signup UI.
- Admin lead list/detail pages, manual status changes, and `mailto:`/`tel:` contact actions.
- Explicit **Analyser avec l’IA** / **Régénérer l’analyse** actions call
  `POST /api/leads/[id]/analyze` using `gemini-3.8-flash`. Structured JSON is
  validated with Zod before an upsert into `lead_ai_analysis`. Reloads reuse the
  saved analysis and do not call Gemini. Each generation has a 1,200-token ceiling,
  a 60-second timeout, and no SDK retries.
- Version-controlled [Supabase migration and setup instructions](supabase/README.md)
  cover tables, constraints, RLS, backend grants, and the private bucket.

## V2: interactive follow-up agent

The lead-detail **Préparer le suivi** panel calls the admin-only
`POST /api/leads/[id]/follow-up` endpoint. The agent uses **`gemini-3.5-flash-lite`**
through the Gemini Interactions API with tool/function calling. The server validates
and executes exactly three available least-privilege, read-only tools:

| Tool | Scope |
| --- | --- |
| `get_lead_context` | Current lead's project type, location, budget, description, status, and received date. |
| `get_existing_analysis` | Current lead's six V1 analysis fields, or an explicit absent result. |
| `get_business_rules` | Five deterministic business rules, including service area and human decisions. |

Tools accept no arguments. The route binds the lead ID on the server; Gemini
never receives direct database access, credentials, or arbitrary query capability.
Names, contact fields, and images are excluded from tool projections. Free text
may still contain personal information; field minimization is not redaction.

The request-local loop permits four logical model turns, three tool executions
(each tool at most once), and 1,200 output tokens per request. Tool selection is
model-driven; no particular tool is mandatory. The server rejects invalid names,
arguments, repeated calls, malformed protocol steps, and invalid final output.
The final `{ summary, reasoning, recommendedAction, suggestedReply, proposedStatus }`
object is validated with Zod. Interactions use `store: false` without background tasks.

The agent is **advisory/read-only**. Preparing a proposal performs no mutation.
An admin must explicitly click **Approuver** before a proposed status is sent to
`PATCH /api/leads/[id]`, which independently checks authorization and validates
status. **Refuser** performs no update. The UI blocks approval if its current
status prop has changed since preparation; this is not a database concurrency lock.
Follow-up proposals and approval decisions are local UI state and are not persisted.

## Observability and reliability

Server-side structured `follow_up.*` events correlate runs using a generated run ID
and record model/version, logical turns, physical attempts, requested/executed tool
calls, model/tool/total latency, and token usage when supplied by the provider.
Errors use sanitized classifications; traces omit raw provider messages, credentials,
lead content, prompts, and tool results. Logging is best effort.

SDK retries are disabled. The follow-up wrapper retries an individual model request
at most once for HTTP **429**, **503**, or a recognized request timeout, after a
fixed **one-second backoff**, with a fresh **90-second deadline** per attempt.
That bounds a run to eight physical model attempts. Parsing, validation, and tools
are outside the retry boundary. There is no whole-agent retry or provider fallback;
a timed-out request may have completed remotely and a retry may incur another charge.

## Setup and operation

Follow [Supabase setup](supabase/README.md) for a fresh project. The initial migration
is for fresh databases; do not apply it unchanged to the existing production schema.
Create the admin Auth user separately and disable public signup in Supabase settings.

Configure `.env.local` locally and the corresponding Vercel environment variables:

```text
SUPABASE_URL=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
ADMIN_USER_ID=
GEMINI_API_KEY=
```

Only the `NEXT_PUBLIC_` values are browser configuration. Keep the secret key,
admin UUID, and Gemini key server-only; never commit `.env.local`. Supabase and
Gemini clients initialize lazily, so builds do not require live service credentials.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`; admins sign in at `/login`.

## Validation and evaluation

Run all offline auth, V1 analysis, J1 agent/tools, J2 UI, J3 tracing, J4 evaluation,
and retry regression tests, plus release checks:

```bash
node --test tests/*.test.mjs
pnpm lint
pnpm exec next typegen
pnpm exec tsc --noEmit
pnpm build
```

Use `pnpm build --webpack` if the known Turbopack sandbox port-binding restriction
applies. Builds fetch the existing Google Fonts and need network access.

The [18-scenario synthetic evaluation suite](evals/follow-up/README.md) checks schema,
status constraints, missing-information topics, service area, and selected unsupported
claims. These are lightweight deterministic French lexical/numeric heuristics, with
false positives and false negatives; they are not semantic LLM-as-judge evaluation.
Offline tests use fixtures/mocks and do not establish live model quality.

Live evaluation is manual and opt-in, uses synthetic fixtures rather than production
records, and waits **20 seconds between scenarios** by default:

```bash
node --env-file=.env.local evals/follow-up/run.mjs --live --case exact-price
node --env-file=.env.local evals/follow-up/run.mjs --live
```

`FOLLOW_UP_EVAL_DELAY_MS` overrides pacing (0–300000 ms). The runner reuses production
retry limits and reports results, latency, and observed usage; it never retries an
entire scenario. Live evaluation is not run automatically by CI.

## Deployment and scope

Production: [artisan-leads.vercel.app](https://artisan-leads.vercel.app).
GitHub Actions runs frozen-lockfile installation, lint, and production build for PRs
and pushes to `main`. Vercel provides hosting and deployment from GitHub `main`;
Supabase provides database, storage, and authentication. Offline tests and standalone
TypeScript checking are explicit release commands above, not separate CI steps.

No autonomous status mutation or automatic email sending is implemented. Suggested
replies require human review and sending outside the application. Follow-up proposals
are not saved; V1 analyses are. This workflow adds no LangChain, LangGraph, or RAG.
See [PROJECT_STATE.md](PROJECT_STATE.md) for the implementation map and limitations.
