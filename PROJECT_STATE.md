# Project State

## Goal
Build a reusable lead-generation and lead-management system for home-improvement businesses, starting with custom carpentry/menuiserie.

The project should:
- have real sales potential,
- strengthen full-stack engineering skills,
- include a meaningful AI workflow,
- provide a strong CV/interview project.

## Current phase
Frontend V1 complete.
Validated lead-submission flow complete.
Next milestone: persistent PostgreSQL storage.

## Stack
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- pnpm
- Node 24
- Zod
- Git / GitHub
- PostgreSQL via Supabase planned

## Done
- Ubuntu development environment
- Git/GitHub repository
- Responsive homepage V1
- Real project imagery
- Quote-request form UI
- Client-side form submission with fetch()
- Next.js API route: POST /api/leads
- Success/error UX without page navigation
- Zod LeadSchema
- Frontend validation
- Server-side validation
- Valid request -> HTTP 201
- Invalid request -> HTTP 400
- feature/lead-submission pushed to GitHub

## Current architecture

Browser
→ QuoteForm.tsx
→ POST /api/leads
→ Next.js server route
→ Zod validation
→ database next

## Not done yet
- PostgreSQL persistence
- Lead dashboard
- Deployment
- Photo storage
- Email notifications
- Lead workflow/statuses
- AI lead processing
- Authentication
- Reusable business configuration layer
- CI/CD

## Next action
Create the PostgreSQL database and leads table using Supabase, then persist validated leads from POST /api/leads.