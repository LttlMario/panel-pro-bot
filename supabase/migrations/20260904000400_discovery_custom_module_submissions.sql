create table if not exists public.discovery_custom_module_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  guild_id text not null check (guild_id ~ '^[0-9]{15,22}$'),
  module_key text not null check (module_key ~ '^custom_[a-z0-9_]{2,36}$'),
  submitted_by_discord_id text not null check (submitted_by_discord_id ~ '^[0-9]{15,22}$'),
  submitted_by_name text not null default '',
  handler text not null default 'request',
  subject text not null default '',
  details text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected','published','closed')),
  reviewed_by_discord_id text,
  review_note text not null default '',
  discord_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discovery_custom_module_submissions_lookup
  on public.discovery_custom_module_submissions (organization_id, guild_id, module_key, created_at desc);
