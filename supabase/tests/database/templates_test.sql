begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('10000000-0000-4000-8000-000000000001', 'template-one@example.test', 'authenticated', 'authenticated', now()),
  ('10000000-0000-4000-8000-000000000002', 'template-two@example.test', 'authenticated', 'authenticated', now());
insert into public.users values
  ('10000000-0000-4000-8000-000000000001', 'Alex'),
  ('10000000-0000-4000-8000-000000000002', 'Jordan');
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
select lives_ok($$insert into public.workout_templates (id, user_id, title, description)
  values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Strength', 'First plan')$$,
  'an application User can save a template');
select lives_ok($$insert into public.template_exercises (id, template_id, position, catalog_id, snapshot) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 'repdb:bench-press',
    '{"name":"Bench press","primaryMuscles":["pectoralis major"],"secondaryMuscles":["triceps"],"equipment":{"kind":"required","name":"barbell"},"instructions":["Press"],"images":{"preferred":"main","main":"https://example.test/bench.png"},"translations":{"es":{"name":"Press de banca","instructions":["Empuje"]}}}')$$,
  'a template preserves a complete exercise description without importing a catalog');
select lives_ok($$insert into public.template_sets (template_exercise_id, set_number, target_weight, target_reps) values
  ('30000000-0000-4000-8000-000000000001', 1, 0, 8),
  ('30000000-0000-4000-8000-000000000001', 2, 42.125, 6)$$,
  'a placement stores numbered sets with zero and decimal pound targets');
select throws_ok($$update public.template_exercises set snapshot = '{}'$$, '23514', null,
  'an exercise snapshot requires a nonblank name');
select results_eq($$select title, description from public.workout_templates$$,
  $$values ('Strength'::text, 'First plan'::text)$$, 'saved metadata round-trips');
select ok((select created_at between transaction_timestamp() and clock_timestamp() from public.workout_templates),
  'a saved template has its creation timestamp');
select lives_ok($$insert into public.workout_templates (user_id, title)
  values ('10000000-0000-4000-8000-000000000001', 'Strength')$$,
  'templates receive UUIDs and permit duplicate titles');
select is((select snapshot from public.template_exercises),
  '{"name":"Bench press","primaryMuscles":["pectoralis major"],"secondaryMuscles":["triceps"],"equipment":{"kind":"required","name":"barbell"},"instructions":["Press"],"images":{"preferred":"main","main":"https://example.test/bench.png"},"translations":{"es":{"name":"Press de banca","instructions":["Empuje"]}}}'::jsonb,
  'the full saved descriptive snapshot round-trips unchanged');
select lives_ok($$insert into public.template_exercises (id, template_id, position, catalog_id, snapshot)
  select '30000000-0000-4000-8000-000000000002', template_id, 2, catalog_id, snapshot from public.template_exercises$$,
  'repeated catalog exercises have independent placement UUIDs');
insert into public.template_sets values ('30000000-0000-4000-8000-000000000002', 1, 100, 3);
select lives_ok($$set constraints all deferred;
  update public.template_exercises set position = 3 - position;
  set constraints all immediate$$, 'a transaction can swap exercise positions');
select results_eq($$select e.id, s.set_number, s.target_weight, s.target_reps from public.template_exercises e
  join public.template_sets s on s.template_exercise_id = e.id order by e.position, s.set_number$$,
  $$values ('30000000-0000-4000-8000-000000000002'::uuid, 1, 100::numeric, 3),
    ('30000000-0000-4000-8000-000000000001'::uuid, 1, 0::numeric, 8),
    ('30000000-0000-4000-8000-000000000001'::uuid, 2, 42.125::numeric, 6)$$,
  'reordering preserves each placement identity and independent set targets');
select lives_ok($$set constraints all deferred;
  update public.template_sets set set_number = 3 - set_number
    where template_exercise_id = '30000000-0000-4000-8000-000000000001';
  set constraints all immediate$$, 'a transaction can renumber sets without losing targets');
select lives_ok($$update public.workout_templates set title = 'Updated', description = null$$,
  'owners can edit metadata and clear optional descriptions');
select lives_ok($$update public.template_sets set target_reps = 10 where target_weight = 0$$,
  'owners can edit set targets');

select throws_ok(command, code, null, description) from (values
  ($$update public.workout_templates set title = E' \t\n '$$, '23514', 'whitespace template names are rejected'),
  ($$update public.workout_templates set title = null$$, '23502', 'a template name is required'),
  ($$update public.template_exercises set position = null$$, '23502', 'exercise positions are required'),
  ($$update public.template_exercises set position = 0$$, '23514', 'exercise positions are positive'),
  ($$update public.template_exercises set catalog_id = 'unnamespaced'$$, '23514', 'catalog identities are namespaced'),
  ($$update public.template_exercises set snapshot = '{"name":42}'$$, '23514', 'snapshot names are text'),
  ($$update public.template_exercises set snapshot = '[]'$$, '23514', 'snapshots are descriptive objects'),
  ($$update public.template_exercises set snapshot = 'null'$$, '23514', 'snapshot JSON null is rejected'),
  ($$update public.template_exercises set snapshot = null$$, '23502', 'a snapshot is required'),
  ($$update public.template_sets set target_weight = -1$$, '23514', 'negative target weights are rejected'),
  ($$update public.template_sets set target_weight = 'NaN'$$, '23514', 'NaN target weights are rejected'),
  ($$update public.template_sets set target_weight = 'Infinity'$$, '23514', 'infinite target weights are rejected'),
  ($$update public.template_sets set target_weight = '-Infinity'$$, '23514', 'negative infinite target weights are rejected'),
  ($$update public.template_sets set target_weight = null$$, '23502', 'target weights are required'),
  ($$update public.template_sets set target_reps = 0$$, '23514', 'target repetitions are positive'),
  ($$update public.template_sets set target_reps = '1.5'$$, '22P02', 'fractional target repetitions are rejected'),
  ($$update public.template_sets set target_reps = null$$, '23502', 'target repetitions are required'),
  ($$update public.template_sets set set_number = 0$$, '23514', 'set numbers are positive'),
  ($$update public.template_exercises set position = 1$$, '23505', 'exercise positions cannot repeat within a template'),
  ($$update public.template_sets set set_number = 1$$, '23505', 'set numbers cannot repeat within a placement')
) as cases(command, code, description);

set local role anon;
select throws_ok(format('%s public.%I %s', operation, relation, suffix), '42501', null,
  format('anonymous requests cannot %s %s', verb, relation))
from (values ('workout_templates'), ('template_exercises'), ('template_sets')) as tables(relation)
cross join (values ('select * from', '', 'read'), ('delete from', '', 'delete'),
  ('insert into', 'default values', 'insert')) as operations(operation, suffix, verb);
select throws_ok($$update public.workout_templates set title = 'Anonymous'$$, '42501', null,
  'anonymous requests cannot update templates');
select throws_ok($$update public.template_exercises set position = 5$$, '42501', null,
  'anonymous requests cannot update placements');
select throws_ok($$update public.template_sets set target_reps = 5$$, '42501', null,
  'anonymous requests cannot update sets');

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
select is_empty(format('select * from public.%I', relation), format('another account cannot read %s', relation))
  from (values ('workout_templates'), ('template_exercises'), ('template_sets')) as tables(relation);
select is_empty(command, description) from (values
  ($$update public.workout_templates set title = 'Stolen' returning id$$, 'another account cannot edit templates'),
  ($$update public.template_exercises set snapshot = '{"name":"Stolen"}' returning id$$, 'another account cannot edit placements'),
  ($$update public.template_sets set target_reps = 99 returning set_number$$, 'another account cannot edit sets'),
  ($$delete from public.workout_templates returning id$$, 'another account cannot delete templates'),
  ($$delete from public.template_exercises returning id$$, 'another account cannot delete placements'),
  ($$delete from public.template_sets returning set_number$$, 'another account cannot delete sets')
) as cases(command, description);
select throws_ok(command, '42501', null, description) from (values
  ($$insert into public.workout_templates (user_id, title) values ('10000000-0000-4000-8000-000000000001', 'Spoofed')$$,
    'an account cannot create another User''s template'),
  ($$insert into public.template_exercises (template_id, position, catalog_id, snapshot)
    values ('20000000-0000-4000-8000-000000000001', 3, 'repdb:squat', '{"name":"Squat"}')$$,
    'an account cannot attach a placement to another User''s template'),
  ($$insert into public.template_sets values ('30000000-0000-4000-8000-000000000001', 3, 10, 5)$$,
    'an account cannot attach a set to another User''s placement')
) as cases(command, description);
insert into public.workout_templates (id, user_id, title)
  values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Jordan plan');
insert into public.template_exercises (id, template_id, position, catalog_id, snapshot)
  values ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 1,
    'repdb:squat', '{"name":"Squat","primaryMuscles":[],"secondaryMuscles":[],"equipment":{"kind":"none"}}');
insert into public.template_sets values ('30000000-0000-4000-8000-000000000003', 1, 20, 5);
select throws_ok(command, '42501', null, description) from (values
  ($$update public.workout_templates set user_id = '10000000-0000-4000-8000-000000000001'$$,
    'template ownership cannot transfer'),
  ($$update public.workout_templates set id = gen_random_uuid()$$, 'template UUID identity cannot change'),
  ($$update public.template_exercises set id = gen_random_uuid()$$, 'placement UUID identity cannot change'),
  ($$update public.template_exercises set template_id = '20000000-0000-4000-8000-000000000001'$$,
    'a placement cannot move to another User''s template'),
  ($$update public.template_sets set template_exercise_id = '30000000-0000-4000-8000-000000000001'$$,
    'a set cannot move to another User''s placement')
) as cases(command, description);

reset role;
select throws_ok(command, '23503', null, description) from (values
  ($$insert into public.workout_templates (user_id, title) values ('10000000-0000-4000-8000-000000000099', 'Orphan')$$,
    'templates require an existing application User'),
  ($$insert into public.template_exercises (template_id, position, catalog_id, snapshot)
    values ('20000000-0000-4000-8000-000000000099', 1, 'repdb:squat', '{"name":"Squat"}')$$,
    'placements require an existing template'),
  ($$insert into public.template_sets values ('30000000-0000-4000-8000-000000000099', 1, 20, 5)$$,
    'sets require an existing placement')
) as cases(command, description);
set local role authenticated;
select lives_ok($$delete from public.template_sets$$, 'owners can remove individual sets');
insert into public.template_sets values ('30000000-0000-4000-8000-000000000003', 1, 20, 5);
select lives_ok($$delete from public.template_exercises$$, 'owners can remove individual placements');
select is_empty($$select * from public.template_sets$$, 'removing a placement removes its sets');
insert into public.template_exercises (id, template_id, position, catalog_id, snapshot)
  values ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 1,
    'repdb:squat', '{"name":"Squat"}');
insert into public.template_sets values ('30000000-0000-4000-8000-000000000003', 1, 20, 5);
select lives_ok($$delete from public.workout_templates$$, 'owners can delete templates');
select is_empty($$select * from public.template_exercises$$, 'template deletion removes its placements');
select is_empty($$select * from public.template_sets$$, 'template deletion removes its sets');
reset role;
select is((select count(*) from public.workout_templates), 2::bigint,
  'another User''s template deletion preserves the first User''s templates');
set local role authenticated;
insert into public.workout_templates (id, user_id, title)
  values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Retained');
insert into public.template_exercises (id, template_id, position, catalog_id, snapshot)
  values ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 1,
    'repdb:squat', '{"name":"Squat","primaryMuscles":[],"secondaryMuscles":[],"equipment":{"kind":"none"}}');
insert into public.template_sets values ('30000000-0000-4000-8000-000000000003', 1, 20, 5);
reset role;
delete from auth.users where id = '10000000-0000-4000-8000-000000000001';
select results_eq($$select title from public.workout_templates$$, array['Retained'],
  'Auth-account deletion removes owned templates and preserves another User''s template');
select results_eq($$select id from public.template_exercises$$,
  array['30000000-0000-4000-8000-000000000003'::uuid],
  'Auth-account deletion removes owned placements and preserves another User''s placement');
select results_eq($$select target_weight from public.template_sets$$, array[20::numeric],
  'Auth-account deletion removes owned sets and preserves another User''s set');
select results_eq($$select account_name from public.users$$, array['Jordan'],
  'Auth-account deletion preserves another User');
select * from finish();
rollback;
