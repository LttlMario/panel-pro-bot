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

create table if not exists public.discovery_support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.discovery_support_tickets(id) on delete cascade,
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  guild_id text not null,
  actor_discord_id text not null,
  event_type text not null check (event_type in ('created','claimed','closed','message','error')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists discovery_support_ticket_events_lookup on public.discovery_support_ticket_events (ticket_id, created_at desc);
alter table public.discovery_support_ticket_events enable row level security;
revoke all on table public.discovery_support_ticket_events from anon, authenticated;

create table if not exists public.discovery_support_ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null,
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  guild_id text not null,
  snapshot jsonb not null,
  changed_at timestamptz not null default now()
);
create index if not exists discovery_support_ticket_history_lookup on public.discovery_support_ticket_history (ticket_id, changed_at desc);
alter table public.discovery_support_ticket_history enable row level security;
revoke all on table public.discovery_support_ticket_history from anon, authenticated;

create or replace function public.discovery_support_ticket_backup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.discovery_support_ticket_history(ticket_id, organization_id, guild_id, snapshot)
  values (old.id, old.organization_id, old.guild_id, to_jsonb(old));
  return new;
end;
$$;
drop trigger if exists discovery_support_ticket_backup on public.discovery_support_tickets;
create trigger discovery_support_ticket_backup before update on public.discovery_support_tickets
for each row execute function public.discovery_support_ticket_backup();
