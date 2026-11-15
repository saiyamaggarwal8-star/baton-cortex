-- Baton Round 3: workspace isolation.
--
-- Before: a new workspace automatically added EVERY demo account as a member, even a workspace
-- created by a real (non-demo) account. After:
--   * every account belongs to a team (profiles.team);
--   * a new workspace adds its owner, plus the other demo accounts of the owner's own team only;
--   * a workspace created by a non-demo account gets its owner and nobody else (others must be
--     invited explicitly; there is no client-side way to add members).
-- A second, separate demo team ("lumen", one reviewer account) exists only so the security probes
-- can show that a member of workspace A cannot read or write workspace B and vice versa.

alter table public.profiles add column if not exists team text not null default 'meridian';

create or replace function public.baton_on_workspace_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_team text;
begin
  -- The owner's team, only if the owner is a demo account.
  select o.team into owner_team from public.profiles o where o.user_id = new.owner_id and o.is_demo;
  insert into public.workspace_members (workspace_id, user_id, persona_id)
  select new.id, p.user_id, p.persona_id from public.profiles p
  where p.user_id = new.owner_id
     or (owner_team is not null and p.is_demo and p.team = owner_team)
  on conflict do nothing;
  return new;
end $$;

revoke execute on function public.baton_on_workspace_created() from public, anon, authenticated;
