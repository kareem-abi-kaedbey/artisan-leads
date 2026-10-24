This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Admin access

The existing `src/lib/supabase-server.ts` remains the trusted database/storage client
using `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. It is never used to authenticate a
browser session.

Authentication uses `@supabase/ssr`, `NEXT_PUBLIC_SUPABASE_URL`, and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Set `ADMIN_USER_ID` to the existing admin's
Supabase Auth user UUID on the server. These three variables are required alongside
the existing backend configuration. Never prefix `ADMIN_USER_ID` or the secret key
with `NEXT_PUBLIC_`.

Visit `/login` to sign in with the existing admin account. There is no signup flow.
Disable **Allow new users to sign up** in Supabase Auth's settings if it is enabled;
this repository does not change the hosted project's Auth configuration.

`src/proxy.ts` refreshes session cookies only for login, dashboard, and lead-detail
API requests. The dashboard layout verifies admin access. Both existing dashboard
pages also verify before querying privileged data, since layouts and pages can
render in parallel. Future dashboard pages that load privileged data should call
`requireAdmin()` before their queries as well. The PATCH endpoint independently
checks the verified user and returns 401 or 403 before doing any database work.
Public quote submissions (`POST /api/leads`) remain public.

Logout in the dashboard clears the current session and returns to `/login`.

Run the isolated authorization checks with:

```bash
node --test tests/admin-auth.test.mjs
```

## Explicit AI lead analysis

Set `GEMINI_API_KEY` on the server. The Gemini client is created only inside an
explicit analysis request, so builds and page reads do not require this key.
The configured model is `gemini-3.8-flash`.

On a lead detail page, **Analyser avec l’IA** calls the admin-protected
`POST /api/leads/[id]/analyze` endpoint. The endpoint loads only `project_type`,
`location`, `budget`, and `description` from PostgreSQL. It does not read lead text
from the request body or send name, email, phone, images, IDs, or session data to
Gemini. Contact information embedded by a prospect in the free-text description
is part of that description; field minimization is not free-text redaction.

One generation request is made with a 1,200-token output ceiling, a 60-second
HTTP timeout, structured JSON, and SDK retries disabled. The JSON schema is derived
from Zod and the response is parsed and validated again before persistence.
Invalid or failed outputs are never saved. No tools or automatic follow-up calls
are enabled.

The existing `lead_ai_analysis` table stores one current result per lead via
`upsert(..., { onConflict: "lead_id" })`, including the model and updated timestamp.
Detail-page reads use the stored result and never call Gemini. Only clicking
**Régénérer l’analyse** replaces it. Buttons are disabled while saving/refreshing;
there is no cross-tab request deduplication or usage quota in this V1. If saving
fails after generation, the model request has already occurred; retrying manually
will make another request.

SDK dependency lifecycle scripts are explicitly disabled in `pnpm-workspace.yaml`;
the published SDK distribution is used directly.

Run isolated auth and AI checks (no live provider or database calls):

```bash
node --test tests/admin-auth.test.mjs tests/lead-analysis.test.mjs
```

## V2: read-only follow-up endpoint

`POST /api/leads/[id]/follow-up` is admin-only and currently has no UI. It returns
`{ success: true, followUp: { summary, reasoning, recommendedAction, suggestedReply,
proposedStatus } }`. It neither persists this result nor changes a lead/status or
sends a message. V1 `/analyze` is unchanged.

The server uses the installed `@google/genai` Interactions API with model
`gemini-3.8-flash`, not a managed agent. Conversation history is request-local:
`store: false`, no previous interaction ID, no background tasks or retries.

The explicit loop is:

1. Send a generic request plus exactly three custom function declarations.
2. Validate returned function names, unique call IDs and strictly empty arguments.
3. Execute approved read-only tools on the route's lead and append matching
   `function_result` steps. Preserve returned thought signatures/call steps when
   continuing the stateless conversation; do not log or return them to the browser.
4. Continue until one final JSON response is returned and validate it with Zod.

Tool selection is model-driven: sufficient context gathering is strongly encouraged,
but a valid final response is accepted after zero, some, or all tools. Each tool
may run at most once, together with other tools or sequentially. Limits: four model requests, three tool
executions total, 1,200 output tokens per model request, 30-second request timeout
and a 90-second overall model-loop deadline. Repeated calls, unexpected/managed
tools, supplied arguments, incomplete replies and invalid output fail safely.

Tool scope:

- `get_lead_context()` exposes only project type, location, budget, description,
  status and received date. A minimized snapshot is loaded before any paid call.
- `get_existing_analysis()` reads only the same lead's six V1 analysis fields,
  returning `{ found: false, analysis: null }` if absent. No IDs or model metadata.
- `get_business_rules()` returns five deterministic demo rules from server code.

The model cannot choose a lead ID, filter a query, fetch a URL or invoke mutation
methods. Customer names/contact fields/images/credentials are not selected or
sent. As with V1, existing free text can contain personal information; this is
field minimization, not automatic redaction. `proposedStatus` is a recommendation
only. No approval or status-mutation flow is added in this iteration.

The Interactions API protocol (`steps`, function steps, structured response format)
is checked against SDK 2.30.0 with mocked HTTP transport. Verify actual model access
and provider-side tool/structured-output support manually in the target project;
tests do not call Gemini or Supabase. Strict protocol checks intentionally fail
closed if the provider changes its response shape.

```bash
node --test tests/admin-auth.test.mjs tests/lead-analysis.test.mjs tests/lead-follow-up.test.mjs
```
