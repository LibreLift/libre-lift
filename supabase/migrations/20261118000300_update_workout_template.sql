-- Extend the shared whole-save boundary without rewriting deployed creation history.
create or replace function public.save_workout_template(p_id uuid, p_operation uuid, p_content jsonb, p_mode text default 'create')
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare previous template_private.save_operations; result jsonb; e jsonb; s jsonb;
  position integer := 0; present boolean; created_before boolean;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  if p_id is null or p_operation is null or p_mode is null or p_mode not in ('create', 'update')
    then raise exception using errcode = '22023', message = 'Invalid save request'; end if;
  perform template_private.validate_content(p_content);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('template-operation:' || auth.uid()::text || ':' || p_operation::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('workout-template:' || p_id::text, 0));
  select exists (select 1 from public.workout_templates where id = p_id) into present;
  select * into previous from template_private.save_operations where user_id = auth.uid() and operation_id = p_operation;
  if found then
    if previous.template_id <> p_id or previous.mode <> p_mode or previous.content <> p_content
      then raise exception using errcode = '22023', message = 'Save identity already used'; end if;
    if not present then raise exception using errcode = 'P0002', message = 'Template not found'; end if;
    return previous.result;
  end if;
  select exists (select 1 from template_private.save_operations
    where user_id = auth.uid() and template_id = p_id and mode = 'create') into created_before;
  if (p_mode = 'update' and not present) or (p_mode = 'create' and created_before and not present)
    then raise exception using errcode = 'P0002', message = 'Template not found'; end if;
  if p_mode = 'create' and present and not created_before
    then raise exception using errcode = '22023', message = 'Template already exists'; end if;
  -- RLS protects other owners; this also rejects another template of the SAME owner.
  if exists (select 1 from public.template_exercises e
    join jsonb_array_elements(p_content->'exercises') x on e.id = (x->>'id')::uuid
    where e.template_id <> p_id)
    then raise exception using errcode = '22023', message = 'Placement belongs to another template'; end if;
  set constraints all deferred;
  if present then
    update public.workout_templates set title = btrim(p_content->>'title'), description = p_content->>'description' where id = p_id;
    delete from public.template_sets where template_exercise_id in (select id from public.template_exercises where template_id = p_id);
    delete from public.template_exercises where template_id = p_id and id not in
      (select (x->>'id')::uuid from jsonb_array_elements(p_content->'exercises') x);
  else
    insert into public.workout_templates(id, user_id, title, description)
      values (p_id, auth.uid(), btrim(p_content->>'title'), p_content->>'description');
  end if;
  for e in select * from jsonb_array_elements(p_content->'exercises') loop
    position := position + 1;
    insert into public.template_exercises(id, template_id, position, catalog_id, snapshot)
      values ((e->>'id')::uuid, p_id, position, e->>'catalogId', e - 'id' - 'catalogId' - 'sets')
      on conflict (id) do update set position = excluded.position, catalog_id = excluded.catalog_id, snapshot = excluded.snapshot;
    -- The set key is deferrable and cannot be an ON CONFLICT arbiter.
    for s in select * from jsonb_array_elements(e->'sets') loop
      insert into public.template_sets(template_exercise_id, set_number, target_weight, target_reps)
        values ((e->>'id')::uuid, (s->>'setNumber')::integer, (s->>'targetWeight')::numeric, (s->>'targetReps')::integer);
    end loop;
  end loop;
  result := public.read_workout_templates(p_id)->0;
  insert into template_private.save_operations values (auth.uid(), p_operation, p_id, p_mode, p_content, result);
  return result;
end;
$$;
