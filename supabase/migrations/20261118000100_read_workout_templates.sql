-- One JSON result avoids PostgREST row limits truncating any nested aggregate.
-- All tables remain subject to the caller's existing ownership policies.
create function public.read_workout_templates(p_id uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(template order by created_at, id), '[]'::jsonb)
  from (
    select t.id, t.created_at, jsonb_build_object(
      'id', t.id, 'title', t.title, 'description', coalesce(t.description, ''), 'createdAt', t.created_at,
      'exercises', coalesce((
        select jsonb_agg(e.snapshot || jsonb_build_object(
          'id', e.id, 'catalogId', e.catalog_id,
          'sets', coalesce((
            select jsonb_agg(jsonb_build_object(
              'setNumber', s.set_number, 'targetWeight', s.target_weight, 'targetReps', s.target_reps
            ) order by s.set_number)
            from public.template_sets s where s.template_exercise_id = e.id
          ), '[]'::jsonb)
        ) order by e.position)
        from public.template_exercises e where e.template_id = t.id
      ), '[]'::jsonb)
    ) as template
    from public.workout_templates t
    where auth.uid() is not null and (p_id is null or t.id = p_id)
  ) templates;
$$;
revoke all on function public.read_workout_templates(uuid) from public, anon;
grant execute on function public.read_workout_templates(uuid) to authenticated;
