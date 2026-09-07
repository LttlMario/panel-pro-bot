create table if not exists public.discovery_support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  guild_id text not null,
  channel_id text,
  opened_by_discord_id text not null,
  opened_by_name text not null default '',
  subject text not null default 'Solicitare suport',
  description text not null default '',
  status text not null default 'open' check (status in ('open','claimed','closed')),
  claimed_by_discord_id text,
  claimed_by_name text,
  transcript text not null default '',
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists discovery_support_tickets_lookup on public.discovery_support_tickets (organization_id,guild_id,status,created_at desc);
create unique index if not exists discovery_support_tickets_open_user on public.discovery_support_tickets (organization_id,guild_id,opened_by_discord_id) where status in ('open','claimed');
alter table public.discovery_support_tickets enable row level security;
revoke all on table public.discovery_support_tickets from anon, authenticated;
