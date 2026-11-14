-- Seeded demo accounts for the synthetic Meridian project (Round 3).
-- These are PUBLIC demo credentials: they are printed on Baton's sign-in screen so judges can
-- test every role. They protect synthetic data only. Password for all six: baton-demo-2026
-- Run once with the service role (Supabase SQL editor). Safe to re-run.

do $$
declare
  acct record;
  uid uuid;
begin
  for acct in
    select * from (values
      ('priya@baton.example',  'Priya',     'owner'),
      ('rao@baton.example',    'Prof. Rao', 'reviewer'),
      ('aarav@baton.example',  'Aarav',     'leaver'),
      ('meera@baton.example',  'Meera',     'meera'),
      ('rohan@baton.example',  'Rohan',     'rohan'),
      ('kavya@baton.example',  'Kavya',     'kavya')
    ) as t(email, name, persona)
  loop
    select id into uid from auth.users where email = acct.email;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', acct.email,
        extensions.crypt('baton-demo-2026', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', acct.name, 'demo', true),
        now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text,
        jsonb_build_object('sub', uid::text, 'email', acct.email, 'email_verified', true),
        'email', now(), now(), now());
    end if;
    insert into public.profiles (user_id, persona_id, display_name, is_demo)
    values (uid, acct.persona, acct.name, true)
    on conflict (user_id) do update set persona_id = excluded.persona_id, display_name = excluded.display_name;
  end loop;
end $$;
