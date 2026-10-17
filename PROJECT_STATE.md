# Project State

## Goal

Build a reusable lead-generation and lead-management system for home-improvement businesses, starting with custom carpentry/menuiserie.

The project should:

- have real sales potential,
- strengthen full-stack engineering skills,
- include a meaningful AI workflow,
- provide a strong CV/interview project,
- remain reusable enough to adapt to other local-service businesses.

## Current phase

Frontend V1 complete.

Validated lead-submission flow complete.

PostgreSQL persistence complete.

Private image storage complete.

GitHub Actions CI is active for pull requests and pushes to `main`.

Next milestone: build the lead dashboard.

## Current stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- pnpm
- Node 24
- Zod
- Git / GitHub
- GitHub Actions
- Supabase
- PostgreSQL
- Supabase Storage

## Current architecture

### Public website

Browser
→ `QuoteForm.tsx`
→ `POST /api/leads`
→ Next.js server route
→ Zod validation
→ PostgreSQL lead insert
→ private image upload to Supabase Storage
→ image metadata saved in `lead_images`

### Lead data

`public.leads`

Stores:

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

### Lead image data

`public.lead_images`

Stores:

- id
- lead_id
- storage_path
- original_name
- mime_type
- size_bytes
- created_at

Relationship:

`lead_images.lead_id`
→ foreign key to
`leads.id`

Actual image files are stored in the private Supabase Storage bucket:

`lead-images/<lead-id>/<unique-filename>`

## Done

### Development setup

- Ubuntu development environment prepared
- Node installed with nvm
- Node version pinned with `.nvmrc`
- pnpm installed
- Next.js project created
- App runs locally
- Git repository initialized
- Private GitHub repository created
- Local repository connected to GitHub
- ChatGPT GitHub integration connected only to `artisan-leads`

### Frontend V1

- Responsive homepage built
- Navigation and hero section built
- Services section built
- Projects section built
- About section built
- Quote section built
- Real project imagery integrated
- Mobile sanity check completed
- Homepage production build passes

### Lead form

- Quote form extracted into `QuoteForm.tsx`
- Form submission handled client-side with `fetch()`
- Submission stays on the homepage
- Loading state implemented
- Success state implemented
- Error state implemented
- Form resets after successful submission
- Native browser validation added
- Images can be selected from the form

### API / backend

- `POST /api/leads` implemented
- FormData parsing implemented
- Server-side lead validation implemented with Zod
- Valid requests return HTTP `201`
- Invalid requests return HTTP `400`
- Database/storage failures return HTTP `500`
- Sensitive backend errors are logged server-side but not exposed to the browser

### Validation

- Reusable `LeadSchema` created
- Required text fields validated
- Email validated
- Project type restricted to allowed values
- Budget restricted to allowed values
- Description length validated
- Maximum 5 uploaded images
- Maximum 5 MB per image
- JPEG, PNG and WebP allowed
- Empty file inputs ignored

### PostgreSQL / Supabase

- Supabase project created
- PostgreSQL `leads` table created
- UUID primary key used for leads
- `status` field created with allowed workflow values
- `created_at` timestamp added
- RLS enabled
- Backend `service_role` permissions configured
- Validated leads persist permanently in PostgreSQL

### Image storage

- Private Supabase Storage bucket `lead-images` created
- `lead_images` table created
- Foreign key from `lead_images.lead_id` to `leads.id`
- Image metadata persisted in PostgreSQL
- Images stored under lead-specific folders
- Unique internal filenames generated using UUIDs
- Original filenames preserved in metadata
- Image upload tested successfully end-to-end

### Failure cleanup

If a submission partially fails:

- uploaded files are removed when possible,
- image metadata is removed,
- newly-created lead is removed,
- cleanup errors are logged.

This is a pragmatic compensating-cleanup approach for the current V1.

### Supabase server client

- `@supabase/supabase-js` installed
- Supabase credentials stored only in `.env.local`
- `.env.local` is ignored by Git
- Supabase secret key is server-side only
- Supabase client initialized lazily at request runtime
- Production build does not require Supabase secrets

### Git workflow

- `main` used as stable branch
- `feature/lead-submission` used for lead pipeline work
- First pull request created:
  `feature/lead-submission` → `main`
- Pull request used to review changes before merge
- No merge conflicts
- Pull request CI checks currently pass

### CI

GitHub Actions workflow created at:

`.github/workflows/ci.yml`

It runs on:

- pull requests targeting `main`
- pushes to `main`

The CI job:

1. checks out the repository,
2. installs pnpm,
3. sets up Node 24,
4. installs dependencies with the lockfile,
5. runs `pnpm lint`,
6. runs `pnpm build`.

The workflow has successfully passed on the current pull request.

## Important design decisions

- The browser does not connect directly to PostgreSQL for lead submission.
- Public lead submissions go through the Next.js backend first.
- Zod performs authoritative backend validation.
- Database constraints provide an additional persistence-level safety layer.
- Supabase Storage is used for files instead of storing image bytes directly in PostgreSQL.
- Image metadata is relationally linked to leads.
- Internal storage filenames use UUIDs for safety and uniqueness.
- Original filenames are kept only for display/use in the future dashboard.
- Production/database secrets must never be committed to Git.
- Business-specific values should gradually move toward a configurable layer instead of being hard-coded everywhere.
- AI should be added only where it creates a useful workflow, not only for CV keywords.

## Not done yet

- Merge current lead-submission PR into `main`
- Lead dashboard
- Lead detail view
- Lead status management UI
- Authentication / admin protection
- Display lead images securely in dashboard
- Public deployment
- Production environment configuration
- Email notifications
- Anti-spam / rate limiting
- Reproducible Supabase database migrations
- Database schema stored fully in Git
- AI lead summarization
- AI lead classification
- AI missing-information detection
- AI suggested reply
- Reusable business configuration layer
- Final client-facing polish
- Final CV bullet / project explanation
- Interview/recruiter presentation
- Final architecture revision / mental map
- Optional release tags/versioning

## Near-term roadmap

1. Merge the current pull request into `main`.
2. Sync local `main`.
3. Delete/close the completed feature branch.
4. Create a new feature branch for the lead dashboard.
5. Build a basic dashboard showing persisted leads.
6. Add lead detail view and image access.
7. Add lead status updates.
8. Add authentication/admin protection.
9. Deploy the application.
10. Add one meaningful AI workflow.
11. Add reproducible database migrations.
12. Prepare CV wording and recruiter/interview explanation.
13. Do a final client-facing polish pass.
14. Extract reusable business configuration.

## Next action

Merge the current pull request after CI passes.

Then start a new feature branch for the lead dashboard.