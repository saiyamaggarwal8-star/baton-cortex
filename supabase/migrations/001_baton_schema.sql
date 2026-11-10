-- Baton: ledger schema with row-level security (Round 2).
--
-- Security model (matches the Round 1 plan, section 7):
--   * RLS is enabled on every table; the browser only ever holds the publishable (anon) key.
--     The service-role key is never deployed.
--   * Each browser session works in its own workspace (a random UUID sent as the
--     x-baton-workspace header), so judges never see each other's data.
--   * The current reader is a seeded DEMO persona sent as the x-baton-persona header.
--     This is for demonstration only, not production authentication (Supabase Auth would
--     replace the header in production). What it demonstrates is that Postgres, not the UI,
--     decides which rows a reader receives: a reader's query can never return a restricted
--     row, and readers cannot read sources or the raw claim ledger at all.
--   * Readers read their handover through a security_invoker view, so the view cannot
--     bypass RLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Request context helpers (read the PostgREST request headers)
-- ---------------------------------------------------------------------------
create or replace function public.baton_header(name text)
returns text language sql stable set search_path = '' as $$
  select coalesce((nullif(current_setting('request.headers', true), '')::json ->> name), '')
$$;

create or replace function public.baton_ws()
returns uuid language plpgsql stable set search_path = '' as $$
declare v text := public.baton_header('x-baton-workspace');
begin
  if v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return v::uuid; end if;
  return null;
end $$;

create or replace function public.baton_persona()
returns text language sql stable set search_path = '' as $$
  select public.baton_header('x-baton-persona')
$$;

-- ---------------------------------------------------------------------------
-- Demo personas (global, read-only for clients)
-- ---------------------------------------------------------------------------
create table public.personas (
  id text primary key,
  name text not null,
  role text not null,
  tags text[] not null default '{}',
  is_staff boolean not null default false
);
alter table public.personas enable row level security;
create policy personas_read on public.personas for select to anon, authenticated using (true);

insert into public.personas (id, name, role, tags, is_staff) values
  ('owner',    'Priya',     'Data owner',                 array['all_members','core_team','treasurer_only'], true),
  ('reviewer', 'Prof. Rao', 'Reviewer',                   array['all_members','core_team','treasurer_only'], true),
  ('leaver',   'Aarav',     'Departing lead',             array['all_members','core_team'],                  false),
  ('meera',    'Meera',     'Incoming lead · core team',  array['all_members','core_team'],                  false),
  ('rohan',    'Rohan',     'Member · all members',       array['all_members'],                              false),
  ('kavya',    'Kavya',     'Treasurer',                  array['all_members','treasurer_only'],             false);

create or replace function public.baton_is_staff()
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.personas p where p.id = public.baton_persona() and p.is_staff)
$$;

create or replace function public.baton_can_read(tag text)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.personas p where p.id = public.baton_persona() and tag = any (p.tags))
$$;

-- ---------------------------------------------------------------------------
-- Workspaces: one per browser session
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id uuid primary key,
  created_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
create policy ws_insert on public.workspaces for insert to anon, authenticated with check (id = public.baton_ws());
create policy ws_read on public.workspaces for select to anon, authenticated using (id = public.baton_ws());

-- ---------------------------------------------------------------------------
-- Sources (masked text) and the claim ledger: staff only
-- ---------------------------------------------------------------------------
create table public.sources (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ext_id text not null,
  title text not null check (char_length(title) <= 300),
  kind text not null check (kind in ('notes','chat','tasks','github','commits')),
  access text not null check (access in ('all_members','core_team','treasurer_only')),
  author text,
  source_date date,
  body text not null check (char_length(body) <= 200000),
  masked text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (workspace_id, ext_id)
);
alter table public.sources enable row level security;
create policy sources_staff on public.sources for all to anon, authenticated
  using (workspace_id = public.baton_ws() and public.baton_is_staff())
  with check (workspace_id = public.baton_ws() and public.baton_is_staff());

create table public.claims (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ext_id text not null,
  type text not null,
  statement text not null check (char_length(statement) <= 4000),
  label text not null,
  access text not null check (access in ('all_members','core_team','treasurer_only')),
  origin text not null check (origin in ('extracted','derived','leaver','reviewer')),
  review_state text not null check (review_state in ('proposed','accepted','edited','rejected')),
  decided_by text,
  source_ext_id text,
  quote text check (char_length(quote) <= 4000),
  claim_date date,
  dispute jsonb,
  withheld_from text[] not null default '{}',
  version int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, ext_id)
);
alter table public.claims enable row level security;
create policy claims_staff on public.claims for all to anon, authenticated
  using (workspace_id = public.baton_ws() and public.baton_is_staff())
  with check (workspace_id = public.baton_ws() and public.baton_is_staff());

-- ---------------------------------------------------------------------------
-- Published versions and the per-reader handover items
-- ---------------------------------------------------------------------------
create table public.versions (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ver text not null,
  state text not null check (state in ('approved','retracted')),
  approved_by text not null,
  approved_at timestamptz not null default now(),
  content_hash text not null,
  primary key (workspace_id, ver)
);
alter table public.versions enable row level security;
create policy versions_read on public.versions for select to anon, authenticated using (workspace_id = public.baton_ws());
create policy versions_write on public.versions for insert to anon, authenticated with check (workspace_id = public.baton_ws() and public.baton_is_staff());
create policy versions_update on public.versions for update to anon, authenticated
  using (workspace_id = public.baton_ws() and public.baton_is_staff())
  with check (workspace_id = public.baton_ws() and public.baton_is_staff());

create table public.handover_items (
  workspace_id uuid not null,
  ver text not null,
  claim_ext_id text not null,
  type text not null,
  statement text not null,
  label text not null,
  access text not null check (access in ('all_members','core_team','treasurer_only')),
  claim_date date,
  slot jsonb,
  author text,
  gap_key text,
  withheld_from text[] not null default '{}',
  primary key (workspace_id, ver, claim_ext_id),
  foreign key (workspace_id, ver) references public.versions(workspace_id, ver) on delete cascade
);
alter table public.handover_items enable row level security;
-- The heart of permission-first delivery: a reader gets only rows whose access tag they hold,
-- that were not withheld from them, from an approved (not retracted) version.
create policy items_read on public.handover_items for select to anon, authenticated using (
  workspace_id = public.baton_ws()
  and (
    public.baton_is_staff()
    or (
      public.baton_can_read(access)
      and not (public.baton_persona() = any (withheld_from))
      and exists (select 1 from public.versions v where v.workspace_id = handover_items.workspace_id and v.ver = handover_items.ver and v.state = 'approved')
    )
  )
);
create policy items_write on public.handover_items for insert to anon, authenticated
  with check (workspace_id = public.baton_ws() and public.baton_is_staff());

-- Readers query this view; security_invoker keeps the caller's RLS in force.
create view public.reader_handover with (security_invoker = true) as
  select workspace_id, ver, claim_ext_id, type, statement, label, access, claim_date, slot, author, gap_key, withheld_from
  from public.handover_items;
grant select on public.reader_handover to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Receipts, access requests, audit log
-- ---------------------------------------------------------------------------
create table public.receipts (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ver text not null,
  reader text not null references public.personas(id),
  claim_ext_id text not null,
  acknowledged_at timestamptz not null default now(),
  primary key (workspace_id, ver, reader, claim_ext_id)
);
alter table public.receipts enable row level security;
create policy receipts_own on public.receipts for all to anon, authenticated
  using (workspace_id = public.baton_ws() and (reader = public.baton_persona() or public.baton_is_staff()))
  with check (workspace_id = public.baton_ws() and reader = public.baton_persona());

create table public.access_requests (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  req_id text not null,
  reader text not null references public.personas(id),
  gap_key text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  primary key (workspace_id, req_id)
);
alter table public.access_requests enable row level security;
create policy requests_read on public.access_requests for select to anon, authenticated
  using (workspace_id = public.baton_ws() and (reader = public.baton_persona() or public.baton_is_staff()));
create policy requests_insert on public.access_requests for insert to anon, authenticated
  with check (workspace_id = public.baton_ws() and reader = public.baton_persona());
create policy requests_reply on public.access_requests for update to anon, authenticated
  using (workspace_id = public.baton_ws() and public.baton_is_staff())
  with check (workspace_id = public.baton_ws() and public.baton_is_staff());

create table public.audit_log (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor text not null check (char_length(actor) <= 120),
  action text not null check (char_length(action) <= 600),
  at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create policy audit_insert on public.audit_log for insert to anon, authenticated with check (workspace_id = public.baton_ws());
create policy audit_read on public.audit_log for select to anon, authenticated using (workspace_id = public.baton_ws() and public.baton_is_staff());

-- Table privileges for the API roles (RLS still decides which rows).
grant select on public.personas to anon, authenticated;
grant select, insert on public.workspaces to anon, authenticated;
grant select, insert, update, delete on public.sources, public.claims to anon, authenticated;
grant select, insert, update on public.versions to anon, authenticated;
grant select, insert on public.handover_items to anon, authenticated;
grant select, insert, delete on public.receipts to anon, authenticated;
grant select, insert, update on public.access_requests to anon, authenticated;
grant select, insert on public.audit_log to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
