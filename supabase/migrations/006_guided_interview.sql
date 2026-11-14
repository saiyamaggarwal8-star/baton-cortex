-- Guided gap interview (Round 3, improvement 2). The reviewer sends ranked questions to the departing
-- lead; the departing lead answers from their own account; the reviewer imports answers as
-- "Stated by" claims. Readers can see neither table.
create table if not exists public.interview_questions (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  gap_key text not null check (char_length(gap_key) <= 40),
  rank int not null check (rank between 1 and 50),
  question text not null check (char_length(question) <= 400),
  why text check (char_length(why) <= 300),
  readers text[] not null default '{}',
  sent_at timestamptz not null default now(),
  primary key (workspace_id, gap_key)
);
alter table public.interview_questions enable row level security;
drop policy if exists iq_read on public.interview_questions;
drop policy if exists iq_write on public.interview_questions;
create policy iq_read on public.interview_questions for select to authenticated
  using (workspace_id = public.baton_ws() and (public.baton_is_staff() or public.baton_persona() = 'leaver'));
create policy iq_write on public.interview_questions for all to authenticated
  using (workspace_id = public.baton_ws() and public.baton_is_staff())
  with check (workspace_id = public.baton_ws() and public.baton_is_staff());

create table if not exists public.interview_answers (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  gap_key text not null,
  answer text not null check (char_length(answer) between 1 and 2000),
  access text not null check (access in ('all_members', 'core_team', 'treasurer_only')),
  answered_by text not null default 'leaver',
  user_id uuid default auth.uid(),
  answered_at timestamptz not null default now(),
  primary key (workspace_id, gap_key),
  foreign key (workspace_id, gap_key) references public.interview_questions(workspace_id, gap_key) on delete cascade
);
alter table public.interview_answers enable row level security;
drop policy if exists ia_read on public.interview_answers;
drop policy if exists ia_insert on public.interview_answers;
drop policy if exists ia_update on public.interview_answers;
create policy ia_read on public.interview_answers for select to authenticated
  using (workspace_id = public.baton_ws() and (public.baton_is_staff() or public.baton_persona() = 'leaver'));
create policy ia_insert on public.interview_answers for insert to authenticated
  with check (workspace_id = public.baton_ws() and public.baton_persona() = 'leaver');
create policy ia_update on public.interview_answers for update to authenticated
  using (workspace_id = public.baton_ws() and public.baton_persona() = 'leaver')
  with check (workspace_id = public.baton_ws() and public.baton_persona() = 'leaver');

-- The server records who answered and when.
create or replace function public.baton_stamp_answer()
returns trigger language plpgsql set search_path = '' as $$
begin new.answered_by := coalesce(public.baton_persona(), 'unknown'); new.user_id := auth.uid(); new.answered_at := now(); return new; end $$;
drop trigger if exists answer_stamp on public.interview_answers;
create trigger answer_stamp before insert or update on public.interview_answers
  for each row execute function public.baton_stamp_answer();
revoke execute on function public.baton_stamp_answer() from public, anon, authenticated;

grant select, insert, update, delete on public.interview_questions to authenticated;
grant select, insert, update on public.interview_answers to authenticated;
