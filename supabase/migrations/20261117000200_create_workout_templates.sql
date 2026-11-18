create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null check (title ~ '[^[:space:]]'),
  description text,
  created_at timestamptz not null default now()
);

alter table public.workout_templates enable row level security;
revoke all on public.workout_templates from public, anon, authenticated;
grant select, insert, delete on public.workout_templates to authenticated;
grant update (title, description) on public.workout_templates to authenticated;
create policy "Users manage their own templates"
  on public.workout_templates for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  position integer not null check (position > 0),
  catalog_id text not null check (catalog_id ~ '^[^[:space:]:]+:[^[:space:]]+$'),
  snapshot jsonb not null check (
    jsonb_typeof(snapshot) = 'object' and
    coalesce(jsonb_typeof(snapshot->'name') = 'string' and snapshot->>'name' ~ '[^[:space:]]', false)
  ),
  unique (template_id, position) deferrable initially immediate
);

alter table public.template_exercises enable row level security;
revoke all on public.template_exercises from public, anon, authenticated;
grant select, insert, delete on public.template_exercises to authenticated;
grant update (position, catalog_id, snapshot) on public.template_exercises to authenticated;
create policy "Users manage their own template exercises"
  on public.template_exercises for all to authenticated
  using (exists (select 1 from public.workout_templates where id = template_id and user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_templates where id = template_id and user_id = (select auth.uid())));

create table public.template_sets (
  template_exercise_id uuid not null references public.template_exercises (id) on delete cascade,
  set_number integer not null check (set_number > 0),
  target_weight numeric not null check (target_weight >= 0 and target_weight < 'Infinity'::numeric),
  target_reps integer not null check (target_reps > 0),
  primary key (template_exercise_id, set_number) deferrable initially immediate
);

alter table public.template_sets enable row level security;
revoke all on public.template_sets from public, anon, authenticated;
grant select, insert, delete on public.template_sets to authenticated;
grant update (set_number, target_weight, target_reps) on public.template_sets to authenticated;
create policy "Users manage their own template sets"
  on public.template_sets for all to authenticated
  using (exists (select 1 from public.template_exercises where id = template_exercise_id))
  with check (exists (select 1 from public.template_exercises where id = template_exercise_id));
