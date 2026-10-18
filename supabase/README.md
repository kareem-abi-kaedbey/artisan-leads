# Supabase Setup

This directory contains the database setup required by Artisan Leads.

## What is reproduced

The initial migration creates:

- `public.leads`
- `public.lead_images`
- `public.lead_ai_analysis`
- Row Level Security on the application tables
- `service_role` privileges used by the trusted Next.js backend
- the private `lead-images` Storage bucket

The migration does **not** contain:

- passwords
- Supabase API keys
- the admin Auth user
- `ADMIN_USER_ID`
- Gemini credentials
- Vercel configuration

Those belong to environment/account configuration, not database schema.

---

## Fresh setup

### 1. Create a Supabase project

Create a new Supabase project.

Do not expose the service-role / secret key to browser code.

---

### 2. Apply the database migration

Open:

`Supabase Dashboard -> SQL Editor`

Then execute:

`supabase/migrations/20261018_initial_schema.sql`

This creates the application's tables, constraints, RLS configuration, grants and private Storage bucket.

The migration is intended for a **fresh project**.

Do not run the initial migration unchanged against the existing production database, because its tables already exist there from the original manual setup.

---

### 3. Create the admin Auth user

In:

`Supabase -> Authentication -> Users`

Create the admin user manually.

Public signup should remain disabled for the current single-admin architecture.

Copy the user's stable Supabase Auth UUID for:

`ADMIN_USER_ID`

---

### 4. Configure local environment variables

Create `.env.local` in the project root.

Required variables:

```text
SUPABASE_URL=
SUPABASE_SECRET_KEY=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

ADMIN_USER_ID=

GEMINI_API_KEY=
```

Never commit `.env.local`.

---

### 5. Install dependencies

Run:

```bash
pnpm install
```

---

### 6. Start local development

Run:

```bash
pnpm dev
```

Open:

`http://localhost:3000`

---

## Architecture

### Public quote submission

```text
QuoteForm
-> POST /api/leads
-> FormData parsing
-> Zod validation
-> PostgreSQL lead insert
-> private Supabase Storage upload
-> lead_images metadata
```

### Admin authentication

```text
/login
-> Supabase Auth
-> cookie-based session
-> verified user identity
-> ADMIN_USER_ID authorization
-> /dashboard
```

### Lead management

```text
/dashboard
-> PostgreSQL lead list
-> lead detail
-> private image signed URLs
-> PATCH status updates
-> email / phone contact actions
```

### AI lead analysis

```text
Admin clicks "Analyser avec l'IA"
-> POST /api/leads/[id]/analyze
-> admin authentication + authorization
-> PostgreSQL lead lookup
-> Gemini API
-> structured JSON
-> Zod validation
-> lead_ai_analysis persistence
-> dashboard refresh
```

---

## Database tables

### `public.leads`

Stores the original customer lead data:

- name
- email
- phone
- location
- project type
- budget
- description
- status
- creation date

Allowed statuses:

- `new`
- `contacted`
- `quote_sent`
- `won`
- `lost`

---

### `public.lead_images`

Stores metadata for customer-uploaded images.

Physical files live in the private Supabase Storage bucket.

Relationship:

```text
lead_images.lead_id
-> leads.id
```

The foreign key uses:

`ON DELETE CASCADE`

This deletes image metadata when the corresponding lead is deleted.

It does not automatically delete physical Storage objects.

---

### `public.lead_ai_analysis`

Stores the current AI-generated analysis for a lead.

It contains:

- summary
- priority
- priority reasoning
- missing information
- recommended next action
- suggested reply
- model name
- timestamps

Relationship:

```text
lead_ai_analysis.lead_id
-> leads.id
```

`lead_id` is unique.

This means the current V1 keeps one AI analysis per lead.

Regeneration replaces the existing current analysis rather than accumulating many versions.

---

## Storage

The migration creates the private Storage bucket:

`lead-images`

Files are organized conceptually as:

```text
lead-images/
└── <lead-id>/
    └── <random-uuid>.<extension>
```

The bucket remains private.

Authenticated dashboard users access images using temporary signed URLs generated server-side.

---

## Security model

Row Level Security is enabled on:

- `public.leads`
- `public.lead_images`
- `public.lead_ai_analysis`

The trusted Next.js backend performs privileged database operations using the server-only Supabase secret/service-role client.

The browser never receives:

- `SUPABASE_SECRET_KEY`
- `ADMIN_USER_ID`
- `GEMINI_API_KEY`

The browser may receive the Supabase publishable key because it is designed for client-side authentication use.

---

## Public vs protected routes

Public:

```text
/
POST /api/leads
/login
```

Protected:

```text
/dashboard
/dashboard/leads/[id]
PATCH /api/leads/[id]
POST /api/leads/[id]/analyze
```

The dashboard requires authentication and authorization.

API routes performing sensitive operations independently verify authorization server-side.

---

## Environment variables

Required local variables:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

ADMIN_USER_ID

GEMINI_API_KEY
```

Local values belong in:

`.env.local`

Production values are configured separately in Vercel.

Secrets must never be committed to Git.

---

## Production

Production currently uses:

- Vercel for the Next.js application
- Supabase for PostgreSQL
- Supabase Storage for private uploaded images
- Supabase Auth for admin authentication
- Gemini API for AI-assisted lead analysis

Production URL:

`https://artisan-leads.vercel.app`

---

## Reproducibility goal

A fresh environment should conceptually be recoverable with:

```text
clone repository
-> pnpm install
-> create Supabase project
-> run database migration
-> create admin Auth user
-> configure environment variables
-> pnpm dev
```

The current migration is the first step toward making the backend infrastructure reproducible from the repository rather than relying on manual memory.

---

## Current limitation

The migration was created after the original production database had already been configured manually.

Therefore:

- production currently contains the correct schema
- the migration represents that schema for fresh environments
- the migration should not be run unchanged against the existing production database because those tables already exist

A future iteration may use the Supabase CLI and versioned incremental migrations from the beginning.

---

## Files

Initial migration:

`supabase/migrations/20261018_initial_schema.sql`

Documentation:

`supabase/README.md`