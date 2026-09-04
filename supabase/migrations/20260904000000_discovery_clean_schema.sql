-- Panel Pro Discovery
-- Schema independenta pentru botul Discord instalat prin App Discovery.
-- Nu include tabelele sau sesiunile panelului web.

create extension if not exists pgcrypto;

create table if not exists public.discovery_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_guilds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  guild_id text not null unique check (guild_id ~ '^[0-9]{15,22}$'),
  guild_name text not null default '',
  kind text not null default 'primary' check (kind in ('primary','secondary')),
  enabled boolean not null default true,
  owner_discord_id text check (owner_discord_id is null or owner_discord_id ~ '^[0-9]{15,22}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_settings (
  organization_id uuid primary key references public.discovery_organizations(id) on delete cascade,
  discord_client_id text not null default '',
  discord_channel_routes jsonb not null default '{}'::jsonb,
  updated_by_discord_id text,
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_app_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table if not exists public.discovery_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  discord_id text not null check (discord_id ~ '^[0-9]{15,22}$'),
  panel_role text not null default 'Membru',
  permission_level integer not null default 1,
  active boolean not null default true,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, discord_id)
);

create table if not exists public.discovery_role_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  guild_id text not null check (guild_id ~ '^[0-9]{15,22}$'),
  discord_role_id text not null check (discord_role_id ~ '^[0-9]{15,22}$'),
  panel_role text not null default 'Membru',
  permission_level integer not null default 1,
  priority integer not null default 0,
  enabled boolean not null default true,
  unique (organization_id, guild_id, discord_role_id)
);

create table if not exists public.discovery_bot_installations (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null unique check (guild_id ~ '^[0-9]{15,22}$'),
  guild_name text not null default '',
  installer_discord_id text,
  status text not null default 'active' check (status in ('active','removed')),
  installed_at timestamptz not null default now(),
  removed_at timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_guild_entitlements (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null check (guild_id ~ '^[0-9]{15,22}$'),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  sku_id text not null default '',
  owner_type integer,
  purchaser_user_id text,
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  raw_entitlement jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.discovery_organizations(id) on delete set null,
  actor_discord_id text,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.discovery_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  event_type text not null,
  actor_discord_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.discovery_platform_admins (
  discord_id text primary key check (discord_id ~ '^[0-9]{15,22}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.discovery_shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  discord_id text not null,
  colleague_name text not null default '',
  date text not null,
  shift_type text not null default 'day',
  status text not null default 'active' check (status in ('active','paused','completed','auto_completed')),
  start_time text,
  end_time text,
  duration text not null default '00:00:00',
  duration_ms bigint not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  paused_at timestamptz,
  paused_seconds integer not null default 0,
  auto_stop_at timestamptz,
  stop_reason text,
  discord_log_message_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_shift_selections (
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  discord_id text not null,
  shift_type text not null,
  selected_at timestamptz not null default now(),
  primary key (organization_id, discord_id)
);

create table if not exists public.discovery_absences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  discord_id text not null,
  colleague_name text not null default '',
  request_audience text not null default 'departments' check (request_audience in ('organization','departments')),
  notice_type text not null default 'Învoire',
  start_at timestamptz,
  end_at timestamptz,
  start_date text,
  end_date text,
  reason text not null default '',
  notes text,
  proof_url text,
  status text not null default 'pending',
  discord_log_message_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  full_name text not null,
  cnp text not null default '',
  discord_id text,
  phone text,
  position text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  employee_id uuid references public.discovery_employees(id) on delete set null,
  contract_number text not null default '',
  contract_text text not null default '',
  phone text,
  position text,
  salary text,
  schedule text,
  start_date text,
  created_by_discord_id text,
  discord_message_id text,
  discord_message_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_contract_export_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'created',
  discord_message_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.discovery_contract_export_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.discovery_contract_export_batches(id) on delete cascade,
  employee_name text not null,
  cnp text not null default '',
  contract_id uuid references public.discovery_contracts(id) on delete set null
);

create table if not exists public.discovery_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  title text not null,
  event_type text not null default 'other',
  event_date date not null,
  details text not null default '',
  evidence_url text,
  status text not null default 'active',
  created_by_discord_id text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.discovery_event_reminder_runs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.discovery_events(id) on delete cascade,
  reminder_date date not null,
  status text not null default 'pending',
  sent_at timestamptz,
  unique (event_id, reminder_date)
);

create table if not exists public.discovery_community_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  post_type text not null check (post_type in ('announcement','question','poll','fine')),
  audience text not null check (audience in ('organization','departments')),
  title text not null,
  content text not null,
  author_discord_id text not null,
  author_name text not null default '',
  discord_message_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_poll_options (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.discovery_community_posts(id) on delete cascade,
  option_text text not null,
  position smallint not null default 0
);

create table if not exists public.discovery_poll_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.discovery_community_posts(id) on delete cascade,
  option_id uuid not null references public.discovery_poll_options(id) on delete cascade,
  user_discord_id text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_discord_id)
);

create table if not exists public.discovery_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.discovery_community_posts(id) on delete cascade,
  user_discord_id text not null,
  reaction text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_discord_id, reaction)
);

create table if not exists public.discovery_marketplace_legal (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.discovery_organizations(id) on delete cascade,
  nume text not null,
  tip_actiune text not null default 'Vânzare',
  categorie text not null default 'General',
  produse text not null default '',
  pret text not null default 'Negociabil',
  created_by_discord_id text not null,
  created_by_name text not null default '',
  discord_message_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_marketplace_illegal (
  id uuid primary key default gen_random_uuid(),
  nume text not null,
  tip_actiune text not null default 'Vânzare',
  categorie text not null default 'General',
  produse text not null default '',
  pret text not null default 'Negociabil',
  created_by_discord_id text not null,
  created_by_name text not null default '',
  discord_message_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  title text not null default '',
  description text not null default '',
  action_type text not null default 'other',
  target_discord_id text,
  target_name text,
  created_by_discord_id text not null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_action_report_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'created',
  created_at timestamptz not null default now()
);

create table if not exists public.discovery_stash_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  title text not null,
  category text not null default 'General',
  quantity numeric(12,2) not null default 1 check (quantity >= 0),
  unit text not null default 'buc.',
  description text not null default '',
  status text not null default 'available' check (status in ('available','reserved','out','archived')),
  source_type text not null default 'manual' check (source_type in ('manual','donation')),
  created_by_discord_id text not null,
  created_by_name text not null default '',
  updated_by_discord_id text not null,
  discord_message_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_stash_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  stash_item_id uuid references public.discovery_stash_items(id) on delete set null,
  item_title text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  note text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected','completed')),
  requested_by_discord_id text not null,
  requested_by_name text not null default '',
  handled_by_discord_id text,
  handled_by_name text,
  handled_at timestamptz,
  discord_message_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_stash_donations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  title text not null,
  category text not null default 'Donație',
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit text not null default 'buc.',
  note text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  donated_by_discord_id text not null,
  donated_by_name text not null default '',
  reviewed_by_discord_id text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  stash_item_id uuid references public.discovery_stash_items(id) on delete set null,
  discord_message_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_stash_withdrawals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  stash_item_id uuid not null references public.discovery_stash_items(id) on delete cascade,
  quantity numeric(12,2) not null check (quantity > 0),
  withdrawn_by_discord_id text not null,
  withdrawn_by_name text not null default '',
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists discovery_guilds_guild_idx on public.discovery_guilds(guild_id, enabled);
create index if not exists discovery_members_org_idx on public.discovery_members(organization_id, active);
create index if not exists discovery_shifts_org_status_idx on public.discovery_shifts(organization_id, status, created_at desc);
create index if not exists discovery_absences_org_idx on public.discovery_absences(organization_id, created_at desc);
create index if not exists discovery_contracts_org_idx on public.discovery_contracts(organization_id, created_at desc);
create index if not exists discovery_events_org_idx on public.discovery_events(organization_id, event_date);
create index if not exists discovery_stash_items_org_idx on public.discovery_stash_items(organization_id, status, created_at desc);
create index if not exists discovery_stash_requests_org_idx on public.discovery_stash_requests(organization_id, status, created_at desc);
create index if not exists discovery_stash_donations_org_idx on public.discovery_stash_donations(organization_id, status, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'discovery_organizations','discovery_guilds','discovery_settings','discovery_app_settings',
    'discovery_members','discovery_role_mappings','discovery_bot_installations','discovery_guild_entitlements',
    'discovery_audit_log','discovery_lifecycle_events','discovery_platform_admins','discovery_shifts',
    'discovery_shift_selections','discovery_absences','discovery_employees','discovery_contracts',
    'discovery_contract_export_batches','discovery_contract_export_items','discovery_events',
    'discovery_event_reminder_runs','discovery_community_posts','discovery_poll_options',
    'discovery_poll_votes','discovery_reactions','discovery_marketplace_legal','discovery_marketplace_illegal',
    'discovery_actions','discovery_action_report_runs','discovery_stash_items','discovery_stash_requests',
    'discovery_stash_donations','discovery_stash_withdrawals'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end $$;
