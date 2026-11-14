-- Baton Round 3, improvement 1: real accounts and server-enforced trust.
--
-- What changes compared with 001:
--   * Identity comes from Supabase Auth. Postgres reads the signed-in user from the verified JWT
--     (auth.uid()); the x-baton-persona header is no longer read anywhere.
--   * Each workspace has an owner (the signed-in staff user who created it) and a member list.
--     A user's role is per workspace (workspace_members.persona_id). The x-baton-workspace header
--     only *selects* a workspace; baton_ws() returns it only if the signed-in user is a member.
--   * The anonymous role loses every table privilege: without a valid session nothing is readable.
--   * Trust checks that used to live only in the browser are repeated in the database:
--       - an extracted / "Sourced" claim must quote its stored source (exact or close match,
--         with numbers guarded) or the write is refused;
--       - only the reviewer of a workspace can publish a version, never with undecided claims
--         or open disputes, and every published row must be an approved claim, word for word;
--       - the audit log records the real signed-in user id, set by the server.
--
-- Because every 001 policy already goes through baton_ws() / baton_persona() / baton_is_staff() /
-- baton_can_read(), redefining those helpers moves all policies to the authenticated identity
-- at once, without rewriting them.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Accounts and memberships
-- ---------------------------------------------------------------------------
-- Which persona (role) an account plays by default. In this demo the six Meridian team accounts
-- are seeded (supabase/seed/demo_accounts.sql); a production deployment would create profiles
-- through an invite flow.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  persona_id text not null references public.personas(id),
  display_name text not null,
  is_demo boolean not null default true
);
alter table public.profiles enable row level security;
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select to authenticated using (user_id = (select auth.uid()));

alter table public.workspaces add column if not exists owner_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table public.workspaces add column if not exists title text not null default 'Meridian handover';

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  persona_id text not null references public.personas(id),
  added_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
alter table public.workspace_members enable row level security;
drop policy if exists members_self on public.workspace_members;
create policy members_self on public.workspace_members for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Request context helpers, now bound to the authenticated user
-- ---------------------------------------------------------------------------
-- The workspace the request selected, but only if the signed-in user belongs to it.
create or replace function public.baton_ws()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v text := public.baton_header('x-baton-workspace');
begin
  if auth.uid() is null then return null; end if;
  if v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (select 1 from public.workspace_members m where m.workspace_id = v::uuid and m.user_id = auth.uid()) then
    return v::uuid;
  end if;
  return null;
end $$;

-- The signed-in user's role in that workspace. No header is read.
create or replace function public.baton_persona()
returns text language sql stable security definer set search_path = '' as $$
  select m.persona_id from public.workspace_members m
  where m.workspace_id = public.baton_ws() and m.user_id = auth.uid()
$$;

-- Is the signed-in account a staff account (data owner or reviewer)? Used before a workspace exists.
create or replace function public.baton_account_is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p join public.personas x on x.id = p.persona_id
                 where p.user_id = auth.uid() and x.is_staff)
$$;

-- ---------------------------------------------------------------------------
-- Workspaces: created by a signed-in staff account, which becomes the owner
-- ---------------------------------------------------------------------------
drop policy if exists ws_insert on public.workspaces;
drop policy if exists ws_read on public.workspaces;
create policy ws_insert on public.workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.baton_account_is_staff());
create policy ws_read on public.workspaces for select to authenticated
  using (id = public.baton_ws() or owner_id = (select auth.uid()));

-- The owner joins with their own role. For the demo, the rest of the seeded Meridian team joins
-- too, so a reviewer's new workspace has readers to publish to (production: invite by email).
create or replace function public.baton_on_workspace_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.workspace_members (workspace_id, user_id, persona_id)
  select new.id, p.user_id, p.persona_id from public.profiles p
  where p.user_id = new.owner_id or p.is_demo
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists workspace_created on public.workspaces;
create trigger workspace_created after insert on public.workspaces
  for each row execute function public.baton_on_workspace_created();

-- ---------------------------------------------------------------------------
-- Server-side quote check on the claim ledger
-- ---------------------------------------------------------------------------
create or replace function public.baton_norm(t text)
returns text language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(lower(translate(coalesce(t, ''), '‘’‛′“”‟″‐‑‒–—―−', '''''''''""""-------')), '\s+', ' ', 'g'))
$$;

-- Does `quote` occur in `body`? Exact (normalised) match, or a close match (trigram word
-- similarity >= 0.8) in which every number in the quote still appears in the source.
create or replace function public.baton_quote_in_source(quote text, body text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare q text; b text; n text;
begin
  q := regexp_replace(public.baton_norm(quote), '^[\s"''(\[{]+|[\s"''.,;:!?)\]}]+$', '', 'g');
  b := public.baton_norm(body);
  if q = '' then return false; end if;
  if position(q in b) > 0 then return true; end if;
  if extensions.word_similarity(q, b) < 0.8 then return false; end if;
  for n in select (regexp_matches(q, '\d+', 'g'))[1] loop
    if b !~ ('(^|[^0-9])' || n || '([^0-9]|$)') then return false; end if;
  end loop;
  return true;
end $$;

-- Every number in the statement must appear in the quote (server copy of the token guard's core).
create or replace function public.baton_numbers_guarded(statement text, quote text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare n text;
begin
  for n in select (regexp_matches(coalesce(statement, ''), '\d+', 'g'))[1] loop
    if coalesce(quote, '') !~ ('(^|[^0-9])' || n || '([^0-9]|$)') then return false; end if;
  end loop;
  return true;
end $$;

create or replace function public.baton_check_claim()
returns trigger language plpgsql security definer set search_path = '' as $$
declare body text;
begin
  if new.review_state = 'rejected' then return new; end if;
  if new.origin = 'extracted' or new.label = 'Sourced' then
    if new.quote is null or new.source_ext_id is null then
      raise exception 'Claim % refused: an extracted claim needs a source and a quote', new.ext_id using errcode = 'check_violation';
    end if;
    select s.body into body from public.sources s where s.workspace_id = new.workspace_id and s.ext_id = new.source_ext_id;
    if body is null then
      raise exception 'Claim % refused: source % is not in this workspace', new.ext_id, new.source_ext_id using errcode = 'check_violation';
    end if;
    if not public.baton_quote_in_source(new.quote, body) then
      raise exception 'Claim % refused: its quote was not found in source %', new.ext_id, new.source_ext_id using errcode = 'check_violation';
    end if;
    if not public.baton_numbers_guarded(new.statement, new.quote) then
      raise exception 'Claim % refused: the statement has a number its quote does not', new.ext_id using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists claims_check on public.claims;
create trigger claims_check before insert or update on public.claims
  for each row execute function public.baton_check_claim();

-- ---------------------------------------------------------------------------
-- Publish gate in the database
-- ---------------------------------------------------------------------------
create or replace function public.baton_check_version()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p text := public.baton_persona(); undecided int; disputes int;
begin
  if p is distinct from 'reviewer' then
    raise exception 'Only the reviewer of this workspace can approve and publish a version' using errcode = 'insufficient_privilege';
  end if;
  select count(*) into undecided from public.claims c where c.workspace_id = new.workspace_id and c.review_state = 'proposed';
  if undecided > 0 then
    raise exception 'Publish refused: % claim(s) are still undecided', undecided using errcode = 'check_violation';
  end if;
  select count(*) into disputes from public.claims c where c.workspace_id = new.workspace_id and c.dispute ->> 'status' = 'open';
  if disputes > 0 then
    raise exception 'Publish refused: % leaver dispute(s) have no ruling', disputes using errcode = 'check_violation';
  end if;
  -- The server, not the browser, records who approved and when.
  new.approved_by := (select x.name || ' (' || x.role || ')' from public.personas x where x.id = p);
  new.approved_at := now();
  return new;
end $$;
drop trigger if exists versions_check on public.versions;
create trigger versions_check before insert on public.versions
  for each row execute function public.baton_check_version();

-- A published row must be an approved claim of the same workspace, with the same words and tag.
create or replace function public.baton_check_item()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.claims c
    where c.workspace_id = new.workspace_id and c.ext_id = new.claim_ext_id
      and c.review_state in ('accepted', 'edited')
      and c.statement = new.statement and c.access = new.access
      and coalesce(c.dispute ->> 'status', '') <> 'open'
  ) then
    raise exception 'Publish refused: % is not an approved claim with this exact text and access tag', new.claim_ext_id using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists items_check on public.handover_items;
create trigger items_check before insert on public.handover_items
  for each row execute function public.baton_check_item();

-- Versions are immutable apart from retraction.
create or replace function public.baton_check_version_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.state <> 'retracted' or old.state <> 'approved'
     or new.ver <> old.ver or new.content_hash <> old.content_hash or new.approved_by <> old.approved_by or new.approved_at <> old.approved_at then
    raise exception 'Approved versions are immutable; they can only be retracted' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists versions_update_check on public.versions;
create trigger versions_update_check before update on public.versions
  for each row execute function public.baton_check_version_update();

-- ---------------------------------------------------------------------------
-- Audit log: the server records the real account
-- ---------------------------------------------------------------------------
alter table public.audit_log add column if not exists user_id uuid default auth.uid();
create or replace function public.baton_stamp_audit()
returns trigger language plpgsql set search_path = '' as $$
begin new.user_id := auth.uid(); new.at := now(); return new; end $$;
drop trigger if exists audit_stamp on public.audit_log;
create trigger audit_stamp before insert on public.audit_log
  for each row execute function public.baton_stamp_audit();

-- ---------------------------------------------------------------------------
-- Privileges: nothing for anonymous callers
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on public.reader_handover from anon;
grant select on public.profiles, public.workspace_members to authenticated;
grant select, insert on public.workspaces to authenticated;

-- Helper functions are for policies, not for direct calls by anonymous users.
revoke execute on function public.baton_ws(), public.baton_persona(), public.baton_account_is_staff() from public, anon;
grant execute on function public.baton_ws(), public.baton_persona(), public.baton_account_is_staff() to authenticated;
revoke execute on function public.baton_on_workspace_created(), public.baton_check_claim(), public.baton_check_version(),
  public.baton_check_item(), public.baton_check_version_update(), public.baton_stamp_audit() from public, anon, authenticated;
