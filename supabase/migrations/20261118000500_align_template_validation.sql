-- Preserve existing records and grants while aligning direct save RPC validation
-- with the canonical wire model; shared migration history remains unchanged.
create or replace function template_private.validate_content(value jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare
  e jsonb; s jsonb; snapshot jsonb; part jsonb; field text; n integer;
  -- Match String.trim's whitespace set used by the shared nonblank wire contract.
  trim_chars constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680'
    || U&'\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A'
    || U&'\2028\2029\202F\205F\3000\FEFF';
begin
  if not coalesce(jsonb_typeof(value) = 'object' and jsonb_typeof(value->'title') = 'string'
    and length(btrim(value->>'title', trim_chars)) > 0 and jsonb_typeof(value->'description') = 'string'
    and jsonb_typeof(value->'exercises') = 'array' and jsonb_array_length(value->'exercises') > 0, false)
    then raise exception using errcode = '22023', message = 'Invalid template content'; end if;
  if (select count(*) <> count(distinct x->>'id') from jsonb_array_elements(value->'exercises') x)
    then raise exception using errcode = '22023', message = 'Duplicate placements'; end if;
  for e in select * from jsonb_array_elements(value->'exercises') loop
    perform (e->>'id')::uuid;
    if not coalesce(jsonb_typeof(e->'id') = 'string' and jsonb_typeof(e->'catalogId') = 'string'
      and e->>'catalogId' ~ '^[^[:space:]:]+:[^[:space:]]+$'
      and jsonb_typeof(e->'name') = 'string' and length(btrim(e->>'name', trim_chars)) > 0
      and jsonb_typeof(e->'primaryMuscles') = 'array' and jsonb_typeof(e->'secondaryMuscles') = 'array'
      and jsonb_typeof(e->'equipment') = 'object' and (e->'equipment'->>'kind' = 'none'
        or (e->'equipment'->>'kind' = 'required' and jsonb_typeof(e->'equipment'->'name') = 'string'
          and length(btrim(e->'equipment'->>'name', trim_chars)) > 0))
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
        (snapshot->>'preferred' = 'main' and jsonb_typeof(snapshot->'main') = 'string' and length(btrim(snapshot->>'main', trim_chars)) > 0)
        or (snapshot->>'preferred' = 'pair' and jsonb_typeof(snapshot->'pair') = 'object'
          and jsonb_typeof(snapshot->'pair'->'start') = 'string' and length(btrim(snapshot->'pair'->>'start', trim_chars)) > 0
          and jsonb_typeof(snapshot->'pair'->'peak') = 'string' and length(btrim(snapshot->'pair'->>'peak', trim_chars)) > 0)), false)
        or (snapshot ? 'main' and (jsonb_typeof(snapshot->'main') <> 'string' or length(btrim(snapshot->>'main', trim_chars)) = 0))
        then raise exception using errcode = '22023', message = 'Invalid exercise images'; end if;
    end if;
    if e ? 'translations' then
      if jsonb_typeof(e->'translations') <> 'object' then raise exception using errcode = '22023', message = 'Invalid translations'; end if;
      foreach field in array array['de', 'es'] loop
        if e->'translations' ? field then
          part := e->'translations'->field;
          if not coalesce(jsonb_typeof(part) = 'object' and jsonb_typeof(part->'name') = 'string'
            and length(btrim(part->>'name', trim_chars)) > 0, false) or (part ? 'instructions' and (
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
