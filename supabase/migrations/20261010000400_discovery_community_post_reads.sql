create table if not exists public.discovery_community_post_reads (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.discovery_community_posts(id) on delete cascade,
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  user_discord_id text not null check (user_discord_id ~ '^[0-9]{15,22}$'),
  display_name text not null default '',
  read_at timestamptz not null default now(),
  unique (post_id, user_discord_id)
);

create index if not exists discovery_community_post_reads_lookup
  on public.discovery_community_post_reads (post_id, read_at);

alter table public.discovery_community_post_reads enable row level security;
revoke all on public.discovery_community_post_reads from anon, authenticated;
grant all on public.discovery_community_post_reads to service_role;
