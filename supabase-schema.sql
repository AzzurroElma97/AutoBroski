create table if not exists public.abg_workspaces (
  workspace_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.abg_workspaces enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'abg_workspaces'
      and policyname = 'abg_public_rw'
  ) then
    create policy abg_public_rw
    on public.abg_workspaces
    for all
    to anon, authenticated
    using (true)
    with check (true);
  end if;
end $$;

create index if not exists abg_workspaces_updated_at_idx
  on public.abg_workspaces(updated_at desc);
