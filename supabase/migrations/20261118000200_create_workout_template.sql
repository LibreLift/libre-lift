-- Retry recognition survives template deletion, but is removed with its account.
-- This schema is not exposed through PostgREST's application API schemas.
create schema template_private;
revoke all on schema template_private from public, anon;
grant usage on schema template_private to authenticated;
create table template_private.save_operations (
  user_id uuid not null references public.users(id) on delete cascade,
  operation_id uuid not null,
  template_id uuid not null,
  mode text not null,
  content jsonb not null,
  result jsonb not null,
  primary key (user_id, operation_id)
);
alter table template_private.save_operations enable row level security;
revoke all on template_private.save_operations from public, anon, authenticated;
grant select, insert on template_private.save_operations to authenticated;
create policy "Owners recognize their own saves" on template_private.save_operations
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- The HTTP contract also validates snapshots. RPC callers cannot bypass the
-- complete-aggregate rules or store descriptions that cannot be read back.
create function template_private.validate_content(value jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare e jsonb; s jsonb; snapshot jsonb; part jsonb; field text; n integer;
begin
  if not coalesce(jsonb_typeof(value) = 'object' and jsonb_typeof(value->'title') = 'string'
    and value->>'title' ~ '[^[:space:]]' and jsonb_typeof(value->'description') = 'string'
    and jsonb_typeof(value->'exercises') = 'array' and jsonb_array_length(value->'exercises') > 0, false)
    then raise exception using errcode = '22023', message = 'Invalid template content'; end if;
  if (select count(*) <> count(distinct x->>'id') from jsonb_array_elements(value->'exercises') x)
    then raise exception using errcode = '22023', message = 'Duplicate placements'; end if;
  for e in select * from jsonb_array_elements(value->'exercises') loop
    perform (e->>'id')::uuid;
    if not coalesce(jsonb_typeof(e->'id') = 'string' and jsonb_typeof(e->'catalogId') = 'string'
      and e->>'catalogId' ~ '^[^[:space:]:]+:[^[:space:]]+$'
      and jsonb_typeof(e->'name') = 'string' and e->>'name' ~ '[^[:space:]]'
      and jsonb_typeof(e->'primaryMuscles') = 'array' and jsonb_typeof(e->'secondaryMuscles') = 'array'
      and jsonb_typeof(e->'equipment') = 'object' and (e->'equipment'->>'kind' = 'none'
        or (e->'equipment'->>'kind' = 'required' and jsonb_typeof(e->'equipment'->'name') = 'string'
          and e->'equipment'->>'name' ~ '[^[:space:]]'))
      and jsonb_typeof(e->'sets') = 'array' and jsonb_array_length(e->'sets') > 0, false)
      then raise exception using errcode = '22023', message = 'Invalid exercise'; end if;
    foreach field in array array['primaryMuscles', 'secondaryMuscles', 'instructions'] loop
      if e ? field and (jsonb_typeof(e->field) <> 'array' or exists (
        select 1 from jsonb_array_elements(e->field) x where jsonb_typeof(x) <> 'string'))
        then raise exception using errcode = '22023', message = 'Invalid exercise description'; end if;
    end loop;
    if e ? 'images' then
      snapshot := e->'images';
      if not coalesce(jsonb_typeof(snapshot) = 'object' and (
        (snapshot->>'preferred' = 'main' and jsonb_typeof(snapshot->'main') = 'string' and length(snapshot->>'main') > 0)
        or (snapshot->>'preferred' = 'pair' and jsonb_typeof(snapshot->'pair') = 'object'
          and jsonb_typeof(snapshot->'pair'->'start') = 'string' and length(snapshot->'pair'->>'start') > 0
          and jsonb_typeof(snapshot->'pair'->'peak') = 'string' and length(snapshot->'pair'->>'peak') > 0)), false)
        or (snapshot ? 'main' and (jsonb_typeof(snapshot->'main') <> 'string' or length(snapshot->>'main') = 0))
        then raise exception using errcode = '22023', message = 'Invalid exercise images'; end if;
    end if;
    if e ? 'translations' then
      if jsonb_typeof(e->'translations') <> 'object' then raise exception using errcode = '22023', message = 'Invalid translations'; end if;
      foreach field in array array['de', 'es'] loop
        if e->'translations' ? field then
          part := e->'translations'->field;
          if not coalesce(jsonb_typeof(part) = 'object' and jsonb_typeof(part->'name') = 'string'
            and part->>'name' ~ '[^[:space:]]', false) or (part ? 'instructions' and (
              jsonb_typeof(part->'instructions') <> 'array' or exists (
                select 1 from jsonb_array_elements(part->'instructions') x where jsonb_typeof(x) <> 'string')))
            then raise exception using errcode = '22023', message = 'Invalid translated description'; end if;
        end if;
      end loop;
    end if;
    n := 0;
    for s in select * from jsonb_array_elements(e->'sets') loop
      n := n + 1;
      if not coalesce(jsonb_typeof(s->'setNumber') = 'number' and (s->>'setNumber')::numeric = n
        and jsonb_typeof(s->'targetWeight') = 'number' and (s->>'targetWeight')::numeric >= 0
        and (s->>'targetWeight')::numeric <= 1.7976931348623157e308
        and jsonb_typeof(s->'targetReps') = 'number' and (s->>'targetReps')::numeric > 0
        and (s->>'targetReps')::numeric = trunc((s->>'targetReps')::numeric), false)
        then raise exception using errcode = '22023', message = 'Invalid set targets or ordering'; end if;
    end loop;
  end loop;
end;
$$;
revoke all on function template_private.validate_content(jsonb) from public, anon;
grant execute on function template_private.validate_content(jsonb) to authenticated;

create function public.save_workout_template(p_id uuid, p_operation uuid, p_content jsonb, p_mode text default 'create')
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare previous template_private.save_operations; result jsonb; e jsonb; s jsonb; position integer := 0;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  if p_id is null or p_operation is null or p_mode is distinct from 'create'
    then raise exception using errcode = '22023', message = 'Invalid save request'; end if;
  perform template_private.validate_content(p_content);
  -- All save modes acquire operation first, then the same template lock used by deletion.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('template-operation:' || auth.uid()::text || ':' || p_operation::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('workout-template:' || p_id::text, 0));
  select * into previous from template_private.save_operations where user_id = auth.uid() and operation_id = p_operation;
  if found then
    if previous.template_id <> p_id or previous.mode <> p_mode or previous.content <> p_content
      then raise exception using errcode = '22023', message = 'Save identity already used'; end if;
    if not exists (select 1 from public.workout_templates where id = p_id)
      then raise exception using errcode = 'P0002', message = 'Template not found'; end if;
    return previous.result;
  end if;
  if exists (select 1 from template_private.save_operations where user_id = auth.uid() and template_id = p_id)
    and not exists (select 1 from public.workout_templates where id = p_id)
    then raise exception using errcode = 'P0002', message = 'Template not found'; end if;
  insert into public.workout_templates(id, user_id, title, description)
    values (p_id, auth.uid(), btrim(p_content->>'title'), p_content->>'description');
  for e in select * from jsonb_array_elements(p_content->'exercises') loop
    position := position + 1;
    insert into public.template_exercises(id, template_id, position, catalog_id, snapshot)
      values ((e->>'id')::uuid, p_id, position, e->>'catalogId', e - 'id' - 'catalogId' - 'sets');
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
revoke all on function public.save_workout_template(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.save_workout_template(uuid, uuid, jsonb, text) to authenticated;
