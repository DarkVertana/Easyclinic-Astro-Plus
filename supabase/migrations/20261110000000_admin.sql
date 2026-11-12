-- Blog admin on Supabase. Only the server (secret key) touches these; RLS is on with no policies,
-- so the publishable key in a browser can read or write nothing.

-- Work in progress: drafts, uploaded images waiting to publish, schedules, AI jobs, categories, history.
-- `data` holds { updatedAt, json, activeSlug? }; `json` is text so field order survives (src/lib/admin/store.ts).
create table if not exists public.admin_docs (
  kind text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (kind, id)
);
create unique index if not exists admin_docs_active_slug
  on public.admin_docs ((data->>'activeSlug'))
  where kind = 'submission' and data ? 'activeSlug';
create index if not exists admin_docs_kind_updated on public.admin_docs (kind, updated_at desc);
alter table public.admin_docs enable row level security;

-- Published content: every post file, featured image and admin rule file, at its repository path.
-- The build downloads this bucket into the working tree before `astro build` (scripts/content-sync.ts).
insert into storage.buckets (id, name, public)
values ('content', 'content', false)
on conflict (id) do nothing;
