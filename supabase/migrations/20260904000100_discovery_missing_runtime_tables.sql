-- Runtime tables required by the Discovery interaction and scheduled-report functions.
-- These are intentionally isolated from the original Panel Pro schema.

create table if not exists public.discovery_scheduled_report_runs (
  id uuid primary key default gen_random_uuid(),
  report_key text not null,
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'processing',
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_key, organization_id, period_start, period_end)
);

create table if not exists public.discovery_platform_user_bans (
  discord_id text primary key,
  reason text not null default 'Blocat de administrator',
  active boolean not null default true,
  banned_by_discord_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_disciplinary_warnings (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  target_scope text not null, target_discord_id text, target_name text not null, reason text not null, notes text not null default '', evidence_url text,
  discord_message_id text, status text not null default 'active', issued_by_discord_id text not null, issued_by_name text not null,
  resolved_at timestamptz, resolved_by_discord_id text, resolution_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.discovery_disciplinary_sanctions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  target_scope text not null, target_discord_id text, target_name text not null, warning_count_snapshot integer not null default 3, amount numeric(12,2) not null,
  currency text not null default 'USD', reason text not null, notes text not null default '', evidence_url text, discord_message_id text,
  status text not null default 'issued', due_at timestamptz, issued_by_discord_id text not null, issued_by_name text not null,
  resolved_at timestamptz, resolved_by_discord_id text, resolution_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.discovery_action_drafts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  guild_id text not null, created_by_discord_id text not null, created_by_name text not null default '', action_type text not null, action_label text not null,
  description text not null default '', notes text not null default '', expires_at timestamptz not null, created_at timestamptz not null default now()
);

alter table public.discovery_scheduled_report_runs enable row level security;
alter table public.discovery_platform_user_bans enable row level security;
alter table public.discovery_disciplinary_warnings enable row level security;
alter table public.discovery_disciplinary_sanctions enable row level security;
alter table public.discovery_action_drafts enable row level security;

revoke all on table public.discovery_scheduled_report_runs, public.discovery_platform_user_bans, public.discovery_disciplinary_warnings, public.discovery_disciplinary_sanctions, public.discovery_action_drafts from anon, authenticated;
grant all on table public.discovery_scheduled_report_runs, public.discovery_platform_user_bans, public.discovery_disciplinary_warnings, public.discovery_disciplinary_sanctions, public.discovery_action_drafts to service_role;

-- Compatibility fields used by the Discovery handlers.
alter table public.discovery_organizations add column if not exists access_mode text not null default 'discord_only';
alter table public.discovery_organizations add column if not exists lifecycle_status text not null default 'active';
alter table public.discovery_organizations add column if not exists deactivation_reason text;
alter table public.discovery_organizations add column if not exists deactivated_at timestamptz;
alter table public.discovery_organizations add column if not exists deactivated_by_discord_id text;
alter table public.discovery_settings add column if not exists panel_public_url text not null default '';
alter table public.discovery_settings add column if not exists webhook_routes jsonb not null default '{}'::jsonb;

create table if not exists public.discovery_sessions (
  id uuid primary key default gen_random_uuid(), token_hash text not null unique,
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  discord_id text not null, permission_level integer not null default 1,
  discord_role_ids text[] not null default '{}', is_platform_admin boolean not null default false,
  expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now()
);
alter table public.discovery_sessions enable row level security;
revoke all on table public.discovery_sessions from anon, authenticated;
grant all on table public.discovery_sessions to service_role;
