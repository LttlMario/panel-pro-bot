create table if not exists public.discovery_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  guild_id text not null check (guild_id ~ '^[0-9]{15,22}$'),
  audience text not null check (audience in ('organization','departments')),
  title text not null,
  content text not null,
  author_discord_id text not null check (author_discord_id ~ '^[0-9]{15,22}$'),
  author_name text not null default '',
  status text not null default 'new' check (status in ('new','review','accepted','rejected')),
  decision_note text not null default '',
  discord_message_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discovery_proposals_lookup
  on public.discovery_proposals (organization_id, guild_id, audience, created_at desc);

create table if not exists public.discovery_proposal_votes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.discovery_proposals(id) on delete cascade,
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  user_discord_id text not null check (user_discord_id ~ '^[0-9]{15,22}$'),
  display_name text not null default '',
  vote text not null check (vote in ('support','against')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_id, user_discord_id)
);

create index if not exists discovery_proposal_votes_lookup
  on public.discovery_proposal_votes (proposal_id, vote, created_at);

alter table public.discovery_proposals enable row level security;
alter table public.discovery_proposal_votes enable row level security;
revoke all on public.discovery_proposals from anon, authenticated;
revoke all on public.discovery_proposal_votes from anon, authenticated;
grant all on public.discovery_proposals to service_role;
grant all on public.discovery_proposal_votes to service_role;
