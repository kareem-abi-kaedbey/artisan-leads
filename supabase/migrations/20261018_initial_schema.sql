-- ============================================================
-- Artisan Leads - Initial Database Schema
-- ============================================================
--
-- Creates:
--   - public.leads
--   - public.lead_images
--   - public.lead_ai_analysis
--   - private Supabase Storage bucket: lead-images
--
-- Security model:
--   - RLS enabled on application tables
--   - trusted Next.js backend uses service_role
--   - browser does not receive direct privileged table access
--
-- Secrets, Auth users, ADMIN_USER_ID, API keys and Vercel
-- configuration do NOT belong in database migrations.
-- ============================================================


-- ============================================================
-- 1. LEADS
-- ============================================================

create table public.leads (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  email text not null,
  phone text not null,
  location text not null,

  project_type text not null,
  budget text not null,

  description text not null,

  status text not null default 'new'
    constraint leads_status_check
    check (
      status in (
        'new',
        'contacted',
        'quote_sent',
        'won',
        'lost'
      )
    ),

  created_at timestamptz not null default now()
);


-- Most dashboard views display newest leads first.
create index leads_created_at_idx
  on public.leads (created_at desc);


-- ============================================================
-- 2. LEAD IMAGE METADATA
-- ============================================================
--
-- Physical files live in Supabase Storage.
-- This table stores the relational metadata that links each
-- Storage object to a lead.
-- ============================================================

create table public.lead_images (
  id uuid primary key default gen_random_uuid(),

  lead_id uuid not null
    references public.leads(id)
    on delete cascade,

  storage_path text not null unique,

  original_name text,
  mime_type text,
  size_bytes bigint,

  created_at timestamptz not null default now()
);


create index lead_images_lead_id_idx
  on public.lead_images (lead_id);


-- ============================================================
-- 3. AI LEAD ANALYSIS
-- ============================================================
--
-- The customer's submitted lead data remains in public.leads.
-- AI-generated interpretation is stored separately here.
--
-- lead_id is UNIQUE because V1 keeps one current analysis
-- per lead. Regeneration updates/replaces that current result.
-- ============================================================

create table public.lead_ai_analysis (
  id uuid primary key default gen_random_uuid(),

  lead_id uuid not null unique
    references public.leads(id)
    on delete cascade,

  summary text not null,

  priority text not null
    constraint lead_ai_analysis_priority_check
    check (
      priority in (
        'low',
        'medium',
        'high'
      )
    ),

  priority_reason text not null,

  missing_information jsonb not null default '[]'::jsonb
    constraint lead_ai_analysis_missing_information_check
    check (
      jsonb_typeof(missing_information) = 'array'
    ),

  recommended_next_action text not null,

  suggested_reply text not null,

  model text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================
--
-- The application currently performs trusted database access
-- through the server-side service_role client.
--
-- No public browser policies are intentionally created here.
-- ============================================================

alter table public.leads
  enable row level security;

alter table public.lead_images
  enable row level security;

alter table public.lead_ai_analysis
  enable row level security;


-- ============================================================
-- 5. SERVICE ROLE PRIVILEGES
-- ============================================================
--
-- Used by the trusted Next.js backend.
-- The service-role key must never be exposed to browser code.
-- ============================================================

grant select, insert, update, delete
on table public.leads
to service_role;

grant select, insert, update, delete
on table public.lead_images
to service_role;

grant select, insert, update, delete
on table public.lead_ai_analysis
to service_role;


-- ============================================================
-- 6. PRIVATE STORAGE BUCKET
-- ============================================================
--
-- Uploaded customer images are stored here.
-- public = false keeps the bucket private.
--
-- Images are displayed to the authenticated admin using
-- temporary signed URLs generated server-side.
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public
)
values (
  'lead-images',
  'lead-images',
  false
)
on conflict (id) do nothing;