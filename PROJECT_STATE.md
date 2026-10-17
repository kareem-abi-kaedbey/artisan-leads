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
- later use AI to summarize/classify leads and assist with replies.

This project is also being used to learn and demonstrate full-stack development, Git/GitHub workflow, CI/CD, cloud services, authentication, databases, storage, and AI integration.

---

## Current Phase

The public site, lead submission flow, PostgreSQL persistence, private image storage, CI, lead dashboard, status workflow, contact actions, and admin authentication are implemented.

The next major milestone is **deployment**, followed by:

1. AI-assisted lead processing
2. database migrations / reproducibility
3. final technical review and CV/interview story

---

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- pnpm
- Node.js 24
- Zod
- Supabase
  - PostgreSQL
  - Storage
  - Auth
- Git / GitHub
- GitHub Actions

Planned:
- Vercel deployment
- LLM/API integration for AI lead processing

---

## Current Architecture

### Public lead flow

Visitor submits quote form:

`QuoteForm -> POST /api/leads -> Zod validation -> PostgreSQL -> private Supabase Storage -> lead_images metadata`

The public quote form remains accessible without authentication.

### Dashboard flow

Admin signs in through Supabase Auth:

`/login -> Supabase Auth -> cookie-based session -> verified user -> ADMIN_USER_ID authorization -> /dashboard`

Dashboard pages are server-rendered and query Supabase from the server.

### Privileged backend client

The existing `src/lib/supabase-server.ts` client uses:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

It is used only for trusted backend database/storage operations.

It remains separate from the Supabase Auth client.

### Auth client

Authentication uses:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Sessions use the Supabase SSR cookie pattern with `src/proxy.ts`.

Authorization compares the verified authenticated user's stable Supabase user ID with:

- `ADMIN_USER_ID`

`ADMIN_USER_ID` is server-only and must never be exposed to the browser.

---

## Implemented

### Frontend

- Atelier Noyer landing page
- Responsive design
- Hero section
- Services
- Project examples
- About section
- CTA
- Quote form
- Footer
- Local/public imagery

### Quote Form

Fields:
- name
- email
- phone
- location
- project type
- budget
- description
- multiple images

Client-side submission uses `fetch()` and stays on the current page.

### Runtime Validation

Zod validates incoming lead data server-side.

Allowed project types and budget ranges are defined in `src/lib/lead-schema.ts`.

Image validation:
- maximum 5 files
- maximum 5 MB each
- JPEG / PNG / WebP only

### PostgreSQL

`public.leads` stores:

- id
- name
- email
- phone
- location
- project_type
- budget
- description
- status
- created_at

Allowed statuses:

- `new`
- `contacted`
- `quote_sent`
- `won`
- `lost`

`public.lead_images` stores:

- id
- lead_id
- storage_path
- original_name
- mime_type
- size_bytes
- created_at

`lead_images.lead_id` references `leads.id` with `ON DELETE CASCADE`.

### Storage

Private Supabase Storage bucket:

`lead-images`

Files are stored using:

`<lead-id>/<random-uuid>.<extension>`

Original filenames are preserved in database metadata.

Uploaded files remain private.

Dashboard image viewing uses temporary signed URLs generated server-side.

### Failure Cleanup

If image upload or metadata persistence fails after a lead is created, the API performs compensating cleanup:

- remove already-uploaded files
- delete image metadata
- delete the lead

This is not a single distributed transaction, because PostgreSQL and object storage are separate systems.

### Dashboard

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

### Lead Detail

`/dashboard/leads/[id]`

Implemented:
- back navigation
- lead name
- status badge
- project type
- location
- budget
- received date
- email
- phone
- full project description
- private uploaded images
- original image filenames
- empty-image state

### Lead Status Management

`PATCH /api/leads/[id]`

Allows:

- `new`
- `contacted`
- `quote_sent`
- `won`
- `lost`

The detail page contains a client-side status control.

Flow:

`status dropdown -> PATCH -> server validation -> PostgreSQL UPDATE -> router refresh`

Response behavior:
- invalid status -> 400
- unauthenticated -> 401
- authenticated non-admin -> 403
- lead not found -> 404
- database failure -> 500

### Contact Actions

Lead detail page includes:

- `Répondre par email`
  - uses `mailto:`
  - pre-fills recipient and subject
- `Appeler`
  - uses `tel:`

No backend email provider is used yet.

### Authentication

Supabase Auth with email/password is implemented.

There is:
- one manually-created admin user
- no public signup UI
- public signup disabled in Supabase project settings
- `/login`
- login Server Action
- logout
- cookie-based Supabase SSR session
- `src/proxy.ts` for session refresh/persistence
- server-side authorization using `ADMIN_USER_ID`

The complete `/dashboard` subtree is protected.

Dashboard pages verify identity server-side before accessing sensitive data.

The PATCH endpoint independently verifies authentication and authorization before updating a lead.

The public `POST /api/leads` route remains public.

Manual auth flow verified successfully:

- logged-out user opening `/dashboard` is redirected to `/login`
- wrong password is rejected
- valid admin login reaches `/dashboard`
- authorized PATCH status update works
- logout works
- `/dashboard` is blocked again after logout

### Git / GitHub

Private repository:

`kareem-abi-kaedbey/artisan-leads`

Completed feature work includes:
- homepage
- lead submission
- PostgreSQL persistence
- private image storage
- CI
- dashboard
- lead detail
- status workflow
- contact actions
- authentication

Current branch:

`feature/dashboard-auth`

### CI

GitHub Actions workflow runs:

1. checkout
2. pnpm setup
3. Node 24 setup
4. `pnpm install --frozen-lockfile`
5. `pnpm lint`
6. `pnpm build`

The Supabase client is lazily initialized so CI can build without runtime secrets.

---

## Environment Variables

Local `.env.local` contains values for:

SUPABASE_URL
SUPABASE_SECRET_KEY

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

ADMIN_USER_ID

Rules:

- never commit `.env.local`
- never expose `SUPABASE_SECRET_KEY`
- never expose `ADMIN_USER_ID`
- the publishable key may be used by browser/auth code
- production values must later be configured in the hosting environment

---

## Important Concepts Learned

- browser vs server
- localhost and ports
- frontend vs backend
- Next.js file-based routing
- dynamic `[id]` routes
- GET / POST / PATCH
- HTTP status codes
- `fetch()`
- Client Components vs Server Components
- TypeScript vs runtime validation
- Zod
- SQL vs PostgreSQL
- relational modeling
- primary keys
- foreign keys
- normalization
- database vs object storage
- Supabase Storage
- signed URLs
- environment variables
- publishable vs secret keys
- RLS vs table grants
- compensating cleanup
- lazy initialization
- build time vs runtime
- Git branches
- pull requests
- squash merge
- CI
- Supabase Auth
- cookie-based sessions
- authentication vs authorization
- server-side route protection

---

## Not Yet Implemented

### Deployment

- Vercel deployment
- production environment variables
- production URL
- production smoke tests
- deployment/CD workflow verification

### AI Workflow

Planned useful AI functionality:

- summarize a lead
- classify/project-type refinement
- identify missing information
- draft a suggested reply

The AI should provide real business value, not exist only as a CV buzzword.

### Database Reproducibility

The Supabase tables were created manually.

Need:
- SQL migration files or equivalent reproducible schema
- repository-based database setup instructions
- clean clone -> install -> configure -> migrate -> run workflow

### Production / Sellable Polish

Still needed later:

- realistic demo data
- replace fake test leads
- final copy/content
- email notifications
- anti-spam / rate limiting
- stronger upload UX
- loading/error states review
- mobile/accessibility/security review
- archive workflow if useful
- possible email-provider integration later

### Reusability

Still needed:

- extract business name
- brand/copy
- services
- project types
- form questions
- imagery
- contact information

into reusable configuration rather than hard-coding everything for Atelier Noyer.

---

## Product Completion Layers

### Layer 1 — Technical / CV-ready

Target:
- full-stack lead system
- auth
- deployment
- AI workflow
- CI
- migrations/reproducibility
- final revision
- CV/interview explanation

Current status:
- dashboard/auth/core workflow complete
- deployment next
- AI + migrations still pending

### Layer 2 — Sellable

Add:
- realistic presentation
- production polish
- notifications
- anti-spam
- stronger UX
- client-ready content

### Layer 3 — Reusable

Extract customer-specific configuration so the same engine can be adapted quickly to another business.

---

## Next Roadmap

1. Finish and merge `feature/dashboard-auth`
2. Deploy the application
3. Configure production environment variables
4. Test production auth + quote submission + dashboard + image flow
5. Add one meaningful AI-assisted lead workflow
6. Add database migrations / reproducible setup
7. Final technical review / mental map
8. Prepare CV bullet
9. Prepare recruiter pitch
10. Prepare deeper technical interview explanation
11. Move into Layer 2 sellable polish
12. Extract reusable configuration for Layer 3

---

## Security Notes

Before public deployment:

- dashboard must remain protected
- PATCH must remain independently protected
- secret key must remain server-only
- admin user ID must remain server-only
- public signup must remain disabled
- private images must stay private
- signed URLs should be generated server-side
- public quote submission must remain possible

Later production hardening should include:
- rate limiting
- anti-spam
- stricter operational monitoring
- possibly email verification / password recovery flow depending client needs

---

## Immediate Next Step

Finish the authentication branch:

1. review `git status`
2. stage auth changes + this file
3. commit
4. push
5. open PR
6. let CI run
7. squash merge into `main`

Then start the deployment milestone.