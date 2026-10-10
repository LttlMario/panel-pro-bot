alter table public.discovery_tasks
  add column if not exists task_type text not null default 'employee'
  check (task_type in ('employee','organization_weekly'));

alter table public.discovery_task_drafts
  add column if not exists task_type text not null default 'employee'
  check (task_type in ('employee','organization_weekly'));

create index if not exists discovery_tasks_type_lookup
  on public.discovery_tasks (organization_id, guild_id, task_type, status, due_at);
