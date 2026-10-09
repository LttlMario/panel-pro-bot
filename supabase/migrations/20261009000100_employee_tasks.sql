create table if not exists public.discovery_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  guild_id text not null check (guild_id ~ '^[0-9]{15,22}$'),
  title text not null check (char_length(title) between 2 and 160),
  description text not null default '',
  due_at timestamptz,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','cancelled','declined')),
  assignee_discord_id text check (assignee_discord_id is null or assignee_discord_id ~ '^[0-9]{15,22}$'),
  assignee_discord_ids text[] not null default '{}',
  recipient_statuses jsonb not null default '{}'::jsonb,
  created_by_discord_id text not null check (created_by_discord_id ~ '^[0-9]{15,22}$'),
  claimed_by_discord_id text check (claimed_by_discord_id is null or claimed_by_discord_id ~ '^[0-9]{15,22}$'),
  discord_channel_id text,
  discord_message_id text,
  discord_dm_channel_id text,
  discord_dm_message_id text,
  discord_dm_message_ids jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists discovery_tasks_org_status_idx on public.discovery_tasks (organization_id, status, due_at);
create index if not exists discovery_tasks_assignee_idx on public.discovery_tasks (organization_id, assignee_discord_id, status);
alter table public.discovery_tasks enable row level security;
revoke all on public.discovery_tasks from anon, authenticated;
