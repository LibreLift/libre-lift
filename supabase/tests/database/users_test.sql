begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- Auth accounts are fixture setup; application operations below run without bypassing RLS.
insert into auth.users (id, email, aud, role, email_confirmed_at)
values
  ('00000000-0000-4000-8000-000000000001', 'user-one@example.test', 'authenticated', 'authenticated', now()),
  ('00000000-0000-4000-8000-000000000002', 'user-two@example.test', 'authenticated', 'authenticated', now());

set local role anon;
select throws_ok($$select * from public.users$$, '42501', null,
  'anonymous requests cannot read application Users');
select throws_ok($$insert into public.users values ('00000000-0000-4000-8000-000000000001', 'Alex')$$,
  '42501', null, 'anonymous requests cannot create application Users');
select throws_ok($$update public.users set account_name = 'Changed'$$, '42501', null,
  'anonymous requests cannot edit application Users');
select throws_ok($$delete from public.users$$, '42501', null,
  'anonymous requests cannot delete application Users');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
select is_empty($$select * from public.users$$,
  'an Auth account has no application User before submitting its name');
select lives_ok(
  $$insert into public.users (id, account_name)
    values ('00000000-0000-4000-8000-000000000001', 'Alex')$$,
  'a verified account can create its application User with an account name'
);
select results_eq($$select account_name from public.users$$, array['Alex'],
  'an account can reload its own saved name');
select results_eq($$update public.users set account_name = 'Jordan' returning account_name$$,
  array['Jordan'], 'an account can edit its saved name');
select throws_ok($$update public.users set account_name = E' \t\n '$$, '23514', null,
  'an account name cannot consist only of whitespace');
select throws_ok($$update public.users set account_name = ''$$, '23514', null,
  'an account name cannot be empty');
select throws_ok($$update public.users set account_name = null$$, '23502', null,
  'an account name is required');
select throws_ok($$update public.users set id = '00000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'an account cannot change its application User identity');
select throws_ok($$insert into public.users values ('00000000-0000-4000-8000-000000000002', 'Alex')$$,
  '42501', null, 'an account cannot create another account''s application User');
select throws_ok($$insert into public.users values ('00000000-0000-4000-8000-000000000001', 'Duplicate')$$,
  '23505', null, 'repeated creation cannot duplicate an application User');
select throws_ok($$delete from public.users$$, '42501', null,
  'application User deletion requires administrative Auth-account deletion');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
select is_empty($$select * from public.users$$,
  'a second account cannot see the first account''s User');
select lives_ok($$insert into public.users values ('00000000-0000-4000-8000-000000000002', 'Jordan')$$,
  'different accounts can choose the same account name');
select results_eq($$select id from public.users$$,
  array['00000000-0000-4000-8000-000000000002'::uuid], 'only the current account''s User is visible');
select is_empty($$update public.users set account_name = 'Stolen'
  where id = '00000000-0000-4000-8000-000000000001' returning id$$,
  'another account cannot change the first account''s name');

reset role;
select throws_ok($$insert into public.users values ('00000000-0000-4000-8000-000000000003', 'Missing account')$$,
  '23503', null, 'an application User must reference an existing Auth account');
delete from auth.users where id = '00000000-0000-4000-8000-000000000001';
select is_empty($$select * from public.users where id = '00000000-0000-4000-8000-000000000001'$$,
  'deleting an Auth account removes its application User');
set local role authenticated;
select results_eq($$select account_name from public.users$$, array['Jordan'],
  'deleting another Auth account preserves the current account''s name');

select * from finish();
rollback;
