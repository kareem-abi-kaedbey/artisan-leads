# PROJECT_STATE

## Goal

Build a reusable lead-generation and lead-management system for home-improvement businesses.

The current reference business is the fictional carpentry brand **Atelier Noyer**.

The product should help a business:

- present its services professionally,
- collect structured quote requests,
- store and manage incoming leads,
- view private customer-uploaded images,
- track lead status,
- contact leads quickly,
- use AI to summarize and qualify leads,
- identify missing information,
- generate a suggested response.

This project is also being used to learn and demonstrate:

- full-stack web development,
- Git / GitHub workflow,
- CI/CD,
- cloud deployment,
- PostgreSQL,
- object storage,
- authentication and authorization,
- external API integration,
- structured LLM output,
- security and environment-variable management.

---

# Product Completion Layers

## Layer 1 — Technical / CV-ready

Target:

- full-stack lead system
- PostgreSQL persistence
- private image storage
- admin dashboard
- authentication / authorization
- CI
- production deployment
- useful AI workflow
- database migrations / reproducibility
- technical revision
- CV / recruiter / interview explanation

Current status:

- core full-stack workflow complete
- authentication complete
- production deployment complete
- AI V1 implemented and verified locally
- AI production deployment still pending merge
- database migrations / reproducibility still pending
- final technical revision still pending
- CV update still pending
- recruiter/interview preparation still pending

---

## Layer 2 — Sellable

Planned:

- realistic demo content/data
- final design / UX polish
- privacy / GDPR pages and notices
- legal notices
- anti-spam / rate limiting
- new-lead notifications
- stronger production email workflow if useful
- mobile/accessibility/error-state pass
- client-ready commercial offer
- pricing
- legal / micro-entreprise verification before accepting money

---

## Layer 3 — Reusable

Planned:

- extract customer-specific configuration
- business name
- brand
- services
- project types
- form questions
- copy
- imagery
- contact details

Goal:

Reuse the same application engine for different businesses without rewriting the whole product.

---

# Current Phase

The application currently includes:

- public Atelier Noyer website
- quote-request form
- runtime validation
- PostgreSQL persistence
- private image uploads
- authenticated admin dashboard
- lead detail pages
- lead status workflow
- email / phone contact actions
- GitHub CI
- production deployment on Vercel
- Supabase Auth
- Gemini AI lead-analysis workflow

The immediate Layer-1 roadmap is:

1. finish and merge AI V1
2. verify AI in Vercel production
3. add database migrations / reproducible setup
4. perform full technical revision / mental map
5. update CV
6. prepare recruiter and interview explanations

---

# Stack

## Application

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- App Router

## Runtime / Tooling

- Node.js 24
- pnpm
- ESLint

## Validation

- Zod

## Backend / Cloud

Supabase:

- PostgreSQL
- Storage
- Auth

Vercel:

- production hosting
- Next.js server/runtime
- HTTPS
- production environment variables
- automatic deployment from GitHub `main`

## AI

Google Gemini API

Current model:

`gemini-3.8-flash`

SDK:

`@google/genai`

## Version Control / CI

- Git
- GitHub
- GitHub Actions

---

# Repository

GitHub repository:

`kareem-abi-kaedbey/artisan-leads`

Repository is currently private.

Current branch:

`feature/ai-lead-analysis`

Production branch:

`main`

Production URL:

`https://artisan-leads.vercel.app`

---

# High-Level Architecture

```text
                    INTERNET
                       |
                       v
                    VERCEL
              Next.js application
             /         |          \
            /          |           \
     Public site    API routes    Dashboard
         |              |             |
         |              |             |
         |              v             |
         |          SUPABASE          |
         |        DB / Storage        |
         |              |             |
         |              |             |
         |              +-------------+
         |
         +--> Quote submission
```

Authentication:

```text
Browser
  -> Next.js
  -> Supabase Auth
  -> cookie-based session
  -> verified user identity
  -> ADMIN_USER_ID authorization
```

AI:

```text
Admin action
  -> protected Next.js endpoint
  -> PostgreSQL lead lookup
  -> Gemini API
  -> structured JSON
  -> Zod validation
  -> PostgreSQL persistence
  -> dashboard display
```

---

# Public Lead Flow

Visitor submits a quote request:

```text
QuoteForm
-> POST /api/leads
-> FormData parsing
-> Zod validation
-> image validation
-> PostgreSQL lead insert
-> private Supabase Storage uploads
-> lead_images metadata
-> success response
```

Public users do **not** need an account.

`POST /api/leads` intentionally remains public.

---

# Frontend

The public Atelier Noyer website includes:

- navigation
- hero section
- services
- project examples
- about section
- CTA
- quote form
- footer
- responsive design
- local/public imagery

Visual direction:

- premium
- minimal
- warm beige / ivory
- carpentry / interior-design style

---

# Quote Form

Fields:

- name
- email
- phone
- location
- project type
- budget
- description
- multiple images

Client-side submission:

- uses `fetch()`
- does not navigate away from the page
- displays success/error feedback
- resets after successful submission

---

# Runtime Validation

Lead data is validated server-side with Zod.

Current project types:

- Agencement sur mesure
- Meuble / rangement
- Cuisine
- Autre

Current budget ranges:

- Moins de 2 000 €
- 2 000 € – 5 000 €
- 5 000 € – 10 000 €
- Plus de 10 000 €
- Je ne sais pas encore

Image rules:

- maximum 5 files
- maximum 5 MB each
- JPEG
- PNG
- WebP

Frontend validation helps the user.

Backend validation is authoritative.

Database constraints provide another protection layer.

---

# PostgreSQL

## `public.leads`

Stores:

- `id`
- `name`
- `email`
- `phone`
- `location`
- `project_type`
- `budget`
- `description`
- `status`
- `created_at`

Allowed statuses:

- `new`
- `contacted`
- `quote_sent`
- `won`
- `lost`

Primary key:

`id uuid`

---

## `public.lead_images`

Stores:

- `id`
- `lead_id`
- `storage_path`
- `original_name`
- `mime_type`
- `size_bytes`
- `created_at`

Relationship:

```text
lead_images.lead_id
        ->
leads.id
```

Foreign key uses:

`ON DELETE CASCADE`

This deletes image metadata when a lead is deleted.

It does **not** automatically delete physical Storage objects.

---

## `public.lead_ai_analysis`

Stores:

- `id`
- `lead_id`
- `summary`
- `priority`
- `priority_reason`
- `missing_information`
- `recommended_next_action`
- `suggested_reply`
- `model`
- `created_at`
- `updated_at`

Relationship:

```text
leads
  |
  | 1
  |
  +---- 0..1 lead_ai_analysis
```

`lead_id` is unique.

There is therefore one current AI analysis per lead.

Priority values:

- `low`
- `medium`
- `high`

`missing_information` is stored as `jsonb`.

---

# Private Storage

Supabase Storage bucket:

`lead-images`

Bucket is private.

Storage layout:

```text
lead-images/
└── <lead-id>/
    └── <random-uuid>.<extension>
```

Example concept:

```text
lead ID
d59339e7-...

image storage filename
c8514cbf-....png
```

Random UUID filenames prevent collisions.

The original uploaded filename is stored separately in PostgreSQL.

---

# Private Image Display

Dashboard pages do not make the Storage bucket public.

The server generates temporary signed URLs.

Flow:

```text
private Storage object
-> server-generated signed URL
-> temporary browser access
```

Signed URLs expire after a limited period.

---

# Failure Cleanup

If a lead is inserted successfully but a later image upload or metadata operation fails, the backend performs compensating cleanup.

Possible cleanup:

- remove already uploaded Storage files
- delete image metadata
- delete lead

This is not a single distributed database transaction because PostgreSQL and object storage are separate systems.

This is a compensating-transaction style approach suitable for the current V1.

---

# Dashboard

Route:

`/dashboard`

Implemented:

- real PostgreSQL lead data
- total lead count
- new lead count
- contacted lead count
- responsive lead table
- French status labels
- French date formatting
- clickable lead names
- empty state
- logout action

Example flow:

```text
/dashboard
-> click lead
-> /dashboard/leads/<uuid>
```

---

# Lead Detail

Route:

`/dashboard/leads/[id]`

Displays:

- lead name
- received date
- status
- project type
- location
- budget
- email
- phone
- full project description
- uploaded images
- original image filenames
- AI analysis when available

---

# Lead Status Management

Protected endpoint:

`PATCH /api/leads/[id]`

Allowed values:

- `new`
- `contacted`
- `quote_sent`
- `won`
- `lost`

Flow:

```text
StatusControl
-> PATCH /api/leads/<id>
-> authentication
-> authorization
-> status validation
-> PostgreSQL UPDATE
-> router refresh
```

Response behavior:

- invalid status -> `400`
- unauthenticated -> `401`
- authenticated non-admin -> `403`
- missing lead -> `404`
- server/database failure -> `500`

The detail page remains primarily a Server Component.

The status control is a small Client Component.

---

# Contact Actions

Lead detail page includes:

## Email

`Répondre par email`

Uses:

`mailto:`

The email client / Gmail opens with:

- recipient pre-filled
- subject pre-filled

The application does not directly send the message.

## Phone

`Appeler`

Uses:

`tel:`

On a phone this can open the dialer.

On desktop behavior depends on installed calling applications.

---

# Authentication

Authentication uses Supabase Auth with email/password.

There is currently one manually-created admin account.

No public signup UI exists.

Public signup is disabled in Supabase project settings.

---

# Authentication vs Authorization

Authentication answers:

```text
Who is this user?
```

Authorization answers:

```text
Is this authenticated user allowed to access the dashboard?
```

The application verifies the authenticated Supabase user and compares the stable Auth user ID against:

`ADMIN_USER_ID`

Only the configured admin is authorized.

---

# Auth Architecture

Login flow:

```text
/login
-> email + password
-> Supabase Auth
-> cookie-based session
-> verified user identity
-> ADMIN_USER_ID check
-> /dashboard
```

Supabase SSR cookie handling uses:

`src/proxy.ts`

The proxy is responsible for session refresh / cookie persistence.

It is **not** the only security barrier.

Sensitive pages and API routes also verify authorization server-side.

---

# Dashboard Protection

The full dashboard subtree is protected:

```text
/dashboard
/dashboard/leads/[id]
future /dashboard/... routes
```

Logged-out users are redirected to:

`/login`

---

# Protected API

`PATCH /api/leads/[id]`

performs its own server-side authorization.

It does not rely only on the dashboard being hidden.

Behavior:

- no authenticated user -> `401`
- authenticated non-admin -> `403`
- authorized admin -> continue

The AI endpoint follows the same principle.

---

# Auth Validation Performed

Live authentication flow verified:

- logged-out `/dashboard` access redirects to `/login`
- incorrect password is rejected
- valid admin login succeeds
- dashboard becomes accessible
- protected PATCH status update succeeds
- logout succeeds
- `/dashboard` becomes inaccessible again after logout

This was verified both locally and in production after Vercel deployment.

---

# Supabase Clients

Two conceptual Supabase clients exist.

## Auth Client

Uses:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Purpose:

- authentication
- sessions
- cookies
- verified identity

---

## Privileged Server Client

Existing:

`src/lib/supabase-server.ts`

Uses:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

Purpose:

- trusted server-side PostgreSQL operations
- Storage operations

The secret key is never exposed to browser code.

The auth client and privileged client remain intentionally separate.

---

# AI Lead Analysis

A V1 AI-assisted lead-analysis workflow is implemented using the Gemini API.

Model:

`gemini-3.8-flash`

SDK:

`@google/genai`

The Gemini integration is isolated under:

`src/lib/ai/`

This makes it easier to replace the provider/model later.

---

# AI Architecture

```text
Admin opens lead
        |
        v
[Analyser avec l'IA]
        |
        v
POST /api/leads/[id]/analyze
        |
        v
Admin authentication + authorization
        |
        v
Load authoritative lead from PostgreSQL
        |
        v
Gemini API
        |
        v
Structured JSON
        |
        v
Zod validation
        |
        v
Upsert public.lead_ai_analysis
        |
        v
router.refresh()
        |
        v
Display saved AI analysis
```

The browser does not send arbitrary lead content directly to Gemini.

The API route loads the authoritative lead from PostgreSQL using the route ID.

---

# AI Data Minimization

Only these fields are sent to Gemini:

- project type
- location
- budget
- project description

The following are intentionally **not** sent:

- name
- email
- phone
- uploaded images
- Supabase IDs
- authentication data
- secret keys

The suggested reply therefore starts generically with:

`Bonjour,`

---

# AI Structured Output

The model returns a structure conceptually equivalent to:

```ts
{
  summary: string,
  priority: "low" | "medium" | "high",
  priorityReason: string,
  missingInformation: string[],
  recommendedNextAction: string,
  suggestedReply: string
}
```

Structured JSON output is requested from Gemini.

The returned JSON is then validated again with Zod.

The application does not blindly trust model output.

---

# AI Output

The dashboard displays:

- Résumé
- Priorité
- Pourquoi
- Informations à préciser
- Prochaine action recommandée
- Réponse suggérée

Priority labels in the French UI:

- low -> Basse
- medium -> Moyenne
- high -> Haute

---

# AI Prompt / Behavior

The model is instructed to assist a French home-improvement / carpentry business.

It should:

- summarize the lead concisely in French
- assess commercial priority
- explain its reasoning
- identify missing information
- recommend the next human action
- draft a natural French reply

It is explicitly instructed:

- not to invent facts
- not to invent dimensions
- not to invent deadlines
- not to invent budgets
- not to invent customer details
- to treat priority as a suggestion rather than an automatic decision
- to identify missing information as questions worth asking the prospect

---

# AI Human-in-the-Loop Design

The AI only assists the business owner.

It does **not** automatically:

- send emails
- call customers
- change lead status
- reject leads
- accept projects
- make final business decisions

The UI explicitly states that the AI output should be verified.

The business owner remains responsible for the final action and response.

---

# AI Cost / Call Control

Each explicit analysis action makes exactly **one** Gemini generation request.

There are no:

- autonomous loops
- background AI calls
- web searches
- code execution
- recursive agents
- automatic AI calls on page load
- repeated AI calls on page refresh

Current output limit:

approximately `1200` output tokens.

Regeneration requires another explicit click.

---

# AI Persistence

AI results are stored in:

`public.lead_ai_analysis`

The saved result is reused on page reload.

Flow:

```text
page reload
-> PostgreSQL
-> existing lead_ai_analysis
-> display saved result
```

Gemini is **not** called again simply because the page was refreshed.

---

# AI Regeneration

If an analysis already exists, the admin sees:

`Régénérer l'analyse`

Regeneration requires an explicit click.

Flow:

```text
explicit click
-> one new Gemini request
-> structured validation
-> upsert using lead_id
-> previous current analysis replaced
```

The database still contains one current analysis for the lead.

---

# AI API Security

Protected endpoint:

`POST /api/leads/[id]/analyze`

The endpoint independently verifies admin authorization.

Behavior:

- unauthenticated -> `401`
- authenticated non-admin -> `403`
- missing lead -> `404`
- Gemini / generation failure -> generic browser error
- internal details logged server-side

The API route does not trust arbitrary lead content coming from the browser.

It retrieves the lead from PostgreSQL itself.

---

# AI Validation Performed

Local end-to-end behavior verified:

- first Gemini generation succeeds
- structured result displays correctly
- AI analysis persists in PostgreSQL
- browser reload does not trigger a new Gemini call
- saved analysis displays immediately
- explicit regeneration performs a new Gemini request
- regenerated result replaces the previous current analysis

A temporary Gemini `401` occurred once during Google account verification.

Independent API-key validation returned:

`HTTP 200`

Subsequent regeneration succeeded.

No application-code change was required.

---

# AI Environment Variable

Local:

`GEMINI_API_KEY`

stored in:

`.env.local`

Production:

`GEMINI_API_KEY`

has been added to Vercel Production environment variables.

It is server-only.

It must never use a `NEXT_PUBLIC_` prefix.

The environment variable will become active in production after the next deployment containing the AI feature.

---

# Gemini Account / Project

Gemini infrastructure is owned through the ForgePilot Google account.

A dedicated Gemini project exists:

`artisan-leads`

Dedicated API key:

`artisan-leads-server`

The secret value is not committed to Git.

---

# Gemini Free-Tier Note

Gemini is currently being used on the free tier for development/demo purposes.

For now:

- use demo/test lead data
- do not intentionally process real customer PII through the free tier

Before selling and processing real customer data, revisit:

- provider terms
- paid API tier
- privacy / data-processing behavior
- client data policy
- cost controls

---

# Deployment

The application is deployed on Vercel.

Production URL:

`https://artisan-leads.vercel.app`

The application remains available even when the local development computer is off.

---

# Deployment Meaning

Deployment means taking the application from:

```text
local laptop
localhost:3000
```

to:

```text
internet-accessible infrastructure
Vercel
HTTPS production URL
```

A custom domain is separate from deployment.

The project currently uses the free Vercel production domain.

A custom domain can be connected later.

---

# Deployment Architecture

```text
GitHub main
    |
    v
Vercel
    |
    +--> install dependencies
    |
    +--> build Next.js
    |
    +--> run server-side code
    |
    +--> expose HTTPS production URL
    |
    +--> use production environment variables
```

Supabase remains responsible for:

- PostgreSQL
- Storage
- Auth

Vercel is responsible for:

- hosting / executing Next.js
- serving the website
- running API routes / server code
- HTTPS
- deployment infrastructure

---

# Production Environment Variables

Vercel Production contains:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

ADMIN_USER_ID

GEMINI_API_KEY
```

Rules:

- never commit secrets
- never expose `SUPABASE_SECRET_KEY`
- never expose `ADMIN_USER_ID`
- never expose `GEMINI_API_KEY`
- only the publishable Supabase key may be public
- production variables live in Vercel
- local variables live in `.env.local`

---

# Production Verification

Production deployment was tested successfully.

Verified:

- public homepage loads
- public quote form submits
- PostgreSQL receives production lead
- image upload reaches private Storage
- `/dashboard` redirects logged-out user to `/login`
- admin login works
- new production lead appears in dashboard
- uploaded private image displays through signed URL
- status update works in production
- logout works
- dashboard becomes inaccessible again after logout

AI production verification is still pending merge/redeployment.

---

# Vercel Deployment Protection

Production domain:

`https://artisan-leads.vercel.app`

is public.

Generated preview/deployment URLs may be protected by Vercel authentication.

This is separate from application authentication.

Application-level protection still controls:

`/dashboard`

through Supabase Auth.

---

# CI / CD

## CI — Continuous Integration

GitHub Actions workflow runs:

1. checkout repository
2. install pnpm
3. configure Node 24
4. `pnpm install --frozen-lockfile`
5. `pnpm lint`
6. `pnpm build`

CI runs on:

- pull requests to `main`
- pushes to `main`

Purpose:

Verify that code integrates correctly before / after merge.

---

## CD — Continuous Deployment

Vercel is connected to the GitHub repository.

Flow:

```text
feature branch
-> commit
-> push
-> pull request
-> GitHub Actions CI
-> merge into main
-> Vercel detects main changed
-> Vercel builds production application
-> new version deployed automatically
```

This is the project's current Continuous Deployment workflow.

---

# Git Workflow

Typical feature workflow:

```text
main
-> create feature branch
-> implement
-> test locally
-> commit
-> push
-> pull request
-> CI
-> squash and merge
-> Vercel deploys main
-> delete feature branch
-> sync local main
```

Feature branches completed so far include work for:

- homepage
- lead submission
- dashboard
- authentication
- AI analysis

---

# Git Concepts Learned

- branch
- remote branch
- tracking branch
- `git switch`
- `git switch -c`
- `git add`
- `git status`
- `git commit`
- `git push`
- `git push -u`
- pull request
- CI checks
- squash merge
- deleting stale branches
- `git fetch --prune`
- syncing `main`

---

# CI Build Behavior

The Supabase privileged client is lazily initialized.

This prevents build-time failures when runtime secrets are unavailable.

Important distinction:

```text
build time
!=
runtime
```

CI can verify the application without actually submitting leads or calling production services.

---

# pnpm Dependency Policy

Current relevant dependencies include:

- `@supabase/supabase-js`
- `@supabase/ssr`
- `@google/genai`
- `zod`

`pnpm-workspace.yaml` explicitly disables dependency lifecycle build scripts for selected packages, including:

- `sharp`
- `unrs-resolver`
- `@google/genai`
- `protobufjs`

Current builds/tests succeed without those lifecycle scripts.

---

# Environment Variables

Local `.env.local` contains:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

ADMIN_USER_ID

GEMINI_API_KEY
```

Rules:

- `.env.local` must remain ignored by Git
- secrets must never be committed
- secrets must never be pasted into public logs or documentation
- production values are configured separately in Vercel

---

# Security Model

Public:

```text
/
POST /api/leads
```

Protected:

```text
/dashboard
/dashboard/leads/[id]
PATCH /api/leads/[id]
POST /api/leads/[id]/analyze
```

Security principles:

- authentication is verified server-side
- authorization is verified server-side
- privileged Supabase secret remains server-only
- Gemini key remains server-only
- private Storage stays private
- signed URLs provide temporary access
- public users cannot access dashboard data
- public users cannot change lead statuses
- public users cannot invoke admin AI analysis

---

# RLS and Grants

Supabase tables use Row Level Security.

RLS and SQL grants are separate concepts.

The trusted backend uses the Supabase secret/service role.

Tables required explicit privileges for trusted backend operations.

The browser does not directly receive the privileged Supabase secret.

---

# Important Concepts Learned

## Web Fundamentals

- browser
- server
- localhost
- ports
- frontend
- backend
- HTTP requests
- GET
- POST
- PATCH
- status codes
- `fetch()`

## Next.js

- App Router
- file-based routing
- Server Components
- Client Components
- route handlers
- dynamic `[id]` routes
- `proxy.ts`
- server-side rendering
- router refresh

## Validation

- TypeScript static types
- runtime validation
- Zod
- frontend vs backend validation
- database constraints

## Database

- SQL
- PostgreSQL
- primary keys
- foreign keys
- UUIDs
- normalization
- joins
- one-to-many relationships
- one-to-zero-or-one relationships
- JSONB
- upsert
- source-of-truth data vs derived data

## Storage

- object storage
- private buckets
- storage paths
- original filenames
- signed URLs
- metadata vs physical files

## Authentication / Security

- authentication
- authorization
- sessions
- cookies
- publishable key
- secret key
- server-only environment variables
- RLS
- table grants
- defense in depth
- 401 vs 403

## Reliability

- compensating cleanup
- distributed side effects
- lazy initialization
- build-time vs runtime
- bounded external calls

## AI

- external LLM API
- server-side AI integration
- prompt design
- structured output
- Zod validation of AI output
- data minimization
- human-in-the-loop design
- persistence of generated results
- explicit regeneration
- bounded token/output usage
- probabilistic model vs deterministic application logic

## DevOps

- deployment
- hosting
- cloud runtime
- environment variables
- production vs local configuration
- CI
- CD
- Vercel
- deployment protection
- rollback concept

---

# Mental Model — Entire Application

```text
PUBLIC USER
    |
    v
VERCEL / NEXT.JS
    |
    +--> Homepage
    |
    +--> QuoteForm
            |
            v
      POST /api/leads
            |
            +--> Zod validation
            |
            +--> PostgreSQL
            |
            +--> private Storage

ADMIN
    |
    v
/login
    |
    v
Supabase Auth
    |
    v
verified cookie/session
    |
    v
ADMIN_USER_ID authorization
    |
    v
/dashboard
    |
    +--> read leads from PostgreSQL
    |
    +--> lead detail
            |
            +--> private image signed URLs
            |
            +--> PATCH status
            |
            +--> mailto / tel actions
            |
            +--> AI analysis
                    |
                    v
              protected endpoint
                    |
                    v
              Gemini API
                    |
                    v
              structured JSON
                    |
                    v
              Zod validation
                    |
                    v
              lead_ai_analysis
                    |
                    v
              dashboard display
```

---

# What Is Not Yet Implemented

## Database Reproducibility

Current database tables were created manually in Supabase SQL Editor.

Need:

- migration files
- schema tracked in Git
- reproducible database setup
- documented clean setup process

Target workflow:

```text
clone repo
-> install dependencies
-> create/configure Supabase project
-> apply migrations
-> configure environment variables
-> run application
```

---

## Production / Sellable Polish

Still pending for Layer 2:

- realistic demo leads
- remove ugly/random test data
- final website copy
- stronger upload UX
- loading states review
- error states review
- mobile review
- accessibility review
- anti-spam
- rate limiting
- new-lead notifications
- privacy information
- GDPR-related notices
- legal notices
- client-ready onboarding
- commercial pricing / offer
- archive workflow if useful

---

## Email

Current implementation:

`mailto:`

The application does not yet send email directly.

Possible later improvement:

- new-lead notification
- email provider
- assisted response workflow
- optional direct sending with explicit confirmation

---

## AI Future Ideas

Not part of V1:

- image analysis
- multimodal project understanding
- automatic WhatsApp integration
- automatic email sending
- autonomous agent workflows
- background AI jobs
- client usage quota system
- multiple AI providers
- automatic status changes

These should only be added when justified by business/customer needs.

---

## Reusability

Still pending:

- centralized configuration
- business identity
- services
- form options
- content
- images
- colors
- contact details

Do not overbuild multi-tenancy before validating sales.

---

# Business Direction

Primary target:

High-ticket local home-improvement businesses.

Initial reference vertical:

Custom carpentry / menuiserie / interior fitting.

Reason:

- visual work
- high-ticket projects
- quote-driven workflow
- customer photos useful
- qualification useful
- one extra converted customer can justify the product cost

---

# Commercial Positioning

Do not sell:

`AI website`

Prefer selling:

```text
Professional website
+
structured quote intake
+
customer photo upload
+
lead dashboard
+
follow-up workflow
+
AI-assisted qualification and replies
```

Possible commercial structure later:

```text
one-time setup fee
+
monthly managed-service fee
```

AI usage should be explained to customers in business terms such as:

`AI-assisted analysis for up to X leads per month`

not in raw tokens.

---

# Sales Strategy

Possible entry offer:

```text
Website redesign
```

Possible premium / differentiated offer:

```text
Website
+ quote funnel
+ lead dashboard
+ private photos
+ AI assistance
+ maintenance
```

The simpler website offer may be easier to cold-call.

The richer lead-management product can become the differentiation / upsell.

---

# Legal / Admin Checkpoint

Before accepting real paid client work:

- verify micro-entreprise activity declaration
- verify compatibility with student residence/work status
- verify invoice requirements
- verify VAT/tax situation
- verify privacy/GDPR responsibilities
- prepare legal notices
- determine data-controller / processor responsibilities

This legal/admin check should happen after Layer 1 and sellable polish, but before accepting money or handling real customer data commercially.

---

# CV / Interview Goal

After Layer 1, the project should support a truthful CV bullet similar to:

> Built and deployed a full-stack lead-management platform for home-improvement businesses using Next.js, TypeScript, PostgreSQL/Supabase and AI-assisted lead processing, including validated quote intake, private image storage, authenticated lead management, CI/CD and structured LLM-based lead analysis.

Only include claims that remain implemented and verified.

---

# Recruiter Explanation Target

Need to prepare:

## 30-second version

Problem + product + stack + outcome.

## 2-minute version

Explain:

- public quote flow
- backend validation
- PostgreSQL
- private Storage
- dashboard
- auth
- deployment
- AI workflow
- CI/CD

## Deep technical version

Be able to explain:

- browser/server separation
- Next.js routing
- Server vs Client Components
- Zod vs TypeScript
- PostgreSQL schema
- private Storage
- signed URLs
- Supabase Auth
- authentication vs authorization
- environment variables
- Git / PR / CI
- Vercel deployment
- structured Gemini output
- why AI result is persisted
- why model output is validated again with Zod
- why AI is human-in-the-loop
- how costs/calls are bounded

---

# Technical Revision Session

After Layer 1 is finished, create dedicated revision materials covering:

1. Browser / server / localhost
2. Frontend / backend
3. Next.js routing
4. Server vs Client Components
5. HTTP methods / status codes
6. `fetch`
7. TypeScript vs Zod
8. PostgreSQL
9. PK / FK / normalization
10. Supabase
11. Database vs object storage
12. Storage paths / signed URLs
13. RLS vs grants
14. Publishable vs secret keys
15. Environment variables
16. Authentication vs authorization
17. Cookies / sessions
18. API security
19. Failure cleanup / compensating transactions
20. Git branches / PRs / squash merge
21. CI vs CD
22. Vercel / deployment
23. Build time vs runtime
24. External API integration
25. LLM structured outputs
26. AI validation
27. AI persistence
28. Human-in-the-loop AI
29. Data minimization
30. Cost / call bounding

For each topic:

- mental model
- project example
- common confusion
- interview explanation
- important commands / code patterns if relevant

---

# Immediate Next Steps

## 1. Finish AI branch

Current branch:

`feature/ai-lead-analysis`

Before commit:

- update this `PROJECT_STATE.md`
- verify `pnpm lint`
- verify `pnpm build`
- inspect `git status`
- stage expected AI changes
- commit
- push
- open PR
- wait for CI
- squash merge into `main`

---

## 2. Production AI Verification

After merge:

Vercel should automatically redeploy `main`.

Then verify on:

`https://artisan-leads.vercel.app`

Test:

- login
- open demo/test lead
- run AI analysis
- verify result appears
- reload page
- verify no regeneration
- regenerate once
- verify updated result
- logout

---

## 3. Database Migrations / Reproducibility

Add repository-tracked database setup.

Need migrations for:

- `leads`
- `lead_images`
- `lead_ai_analysis`
- RLS
- required grants
- Storage bucket setup if practical/documented

Then test/document a clean setup process.

---

## 4. Finish Layer 1

After migrations:

- final architecture review
- mental maps
- revision sheets
- update CV
- prepare 30-second pitch
- prepare 2-minute technical explanation
- prepare deeper interview answers

Goal:

Be ready to discuss the project confidently at company/recruiting events and interviews.

---

# Current Exact Checkpoint

Date:

October 18, 2026

Current branch:

`feature/ai-lead-analysis`

AI status:

- Gemini API project created
- API key configured locally
- Gemini free tier used
- dedicated `artisan-leads` Gemini project exists
- `lead_ai_analysis` table exists
- AI endpoint implemented
- structured output implemented
- Zod validation implemented
- local first generation verified
- local persistence verified
- local reload behavior verified
- local regeneration verified
- `GEMINI_API_KEY` added to Vercel Production
- production AI not yet deployed because AI branch has not yet been merged

Production app currently contains everything merged through the authentication/dashboard version.

Next action:

```text
Save this PROJECT_STATE.md
-> git status
-> stage AI feature
-> commit
-> push
-> PR
-> CI
-> squash merge
-> Vercel automatic deployment
-> production AI smoke test
```