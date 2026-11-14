-- Cache of model responses (Round 3, improvement 2). Written by the /api/ai Vercel Function under the
-- caller's own token. Keyed by sha256(model + task + input), so the same sources always get the same
-- answer and a re-run costs nothing. Only staff accounts (data owner, reviewer) can read or write it;
-- readers never see raw model output.
create table if not exists public.ai_cache (
  key text primary key check (char_length(key) = 64),
  task text not null check (task in ('extract', 'support', 'conflicts', 'interview')),
  model text not null,
  response jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.ai_cache enable row level security;
drop policy if exists ai_cache_staff_read on public.ai_cache;
drop policy if exists ai_cache_staff_write on public.ai_cache;
create policy ai_cache_staff_read on public.ai_cache for select to authenticated using (public.baton_account_is_staff());
create policy ai_cache_staff_write on public.ai_cache for insert to authenticated with check (public.baton_account_is_staff());
grant select, insert on public.ai_cache to authenticated;
