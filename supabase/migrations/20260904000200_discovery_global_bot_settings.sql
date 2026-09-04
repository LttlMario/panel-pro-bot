create table if not exists public.discovery_bot_global_settings (
  id text primary key default 'global',
  modules jsonb not null default '{}'::jsonb,
  updated_by_discord_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discovery_bot_global_settings_singleton check (id = 'global')
);
alter table public.discovery_bot_global_settings enable row level security;
revoke all on public.discovery_bot_global_settings from anon, authenticated;
grant all on public.discovery_bot_global_settings to service_role;
