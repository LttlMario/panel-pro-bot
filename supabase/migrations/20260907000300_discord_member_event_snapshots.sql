-- Snapshot-uri folosite pentru notificări Discord: intrări, plecări și schimbări de rol.
create table if not exists public.discovery_discord_member_snapshots (
  guild_id text not null,
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  discord_id text not null,
  username text not null default '',
  display_name text not null default '',
  role_ids jsonb not null default '[]'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, discord_id)
);
create index if not exists discovery_member_snapshots_org_idx on public.discovery_discord_member_snapshots(organization_id, guild_id);
alter table public.discovery_discord_member_snapshots enable row level security;
revoke all on public.discovery_discord_member_snapshots from anon, authenticated;

create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'panel-pro-discord-member-events') then
    perform cron.schedule(
      'panel-pro-discord-member-events',
      '*/5 * * * *',
      $job$select net.http_post(
        url := 'https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/discord-member-events',
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'panel_pro_cron_secret' limit 1)),
        body := '{}'::jsonb
      );$job$
    );
  end if;
end $$;
