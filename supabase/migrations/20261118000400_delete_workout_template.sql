-- Use the save transaction's lock even when the template row does not exist.
-- Successful-save recognition deliberately survives this aggregate's deletion.
create function public.delete_workout_template(p_id uuid)
returns void language plpgsql volatile security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  if p_id is null then raise exception using errcode = '22023', message = 'Invalid template identity'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('workout-template:' || p_id::text, 0));
  delete from public.workout_templates where id = p_id;
end;
$$;
revoke all on function public.delete_workout_template(uuid) from public, anon;
grant execute on function public.delete_workout_template(uuid) to authenticated;
