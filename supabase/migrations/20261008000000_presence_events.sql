create table if not exists public.discovery_event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.discovery_events(id) on delete cascade,
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  guild_id text not null,
  discord_id text not null,
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  unique (event_id, discord_id)
);
create index if not exists discovery_event_participants_event_idx on public.discovery_event_participants(event_id, joined_at);
alter table public.discovery_events add column if not exists guild_id text;
alter table public.discovery_events add column if not exists source_channel_id text;
alter table public.discovery_events add column if not exists discord_channel_id text;
alter table public.discovery_events add column if not exists discord_message_id text;
alter table public.discovery_events add column if not exists closed_at timestamptz;
