create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  account_name text not null check (account_name ~ '[^[:space:]]')
);

alter table public.users enable row level security;
revoke all on public.users from public, anon, authenticated;
grant select, insert on public.users to authenticated;
-- Names are editable; application identities are not.
grant update (account_name) on public.users to authenticated;

create policy "Users read their own application User"
  on public.users for select to authenticated
  using (id = (select auth.uid()));

create policy "Users create their own application User"
  on public.users for insert to authenticated
  with check (id = (select auth.uid()));

create policy "Users edit their own application User"
  on public.users for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
