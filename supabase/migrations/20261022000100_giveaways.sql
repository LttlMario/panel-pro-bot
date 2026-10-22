create table if not exists public.discovery_giveaways (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  guild_id text not null, title text not null, prize text not null, description text not null default '', ends_at timestamptz not null,
  winners_count integer not null default 1 check (winners_count between 1 and 25), status text not null default 'active' check (status in ('active','completed','cancelled')),
  discord_channel_id text not null, discord_message_id text, created_by_discord_id text not null, created_by_name text not null default '', winner_ids text[] not null default '{}',
  completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists discovery_giveaways_due_idx on public.discovery_giveaways(status, ends_at);
create table if not exists public.discovery_giveaway_entries (
  id uuid primary key default gen_random_uuid(), giveaway_id uuid not null references public.discovery_giveaways(id) on delete cascade,
  discord_id text not null, display_name text not null default '', joined_at timestamptz not null default now(), unique(giveaway_id, discord_id)
);
create index if not exists discovery_giveaway_entries_giveaway_idx on public.discovery_giveaway_entries(giveaway_id, joined_at);
alter table public.discovery_giveaways enable row level security;
alter table public.discovery_giveaway_entries enable row level security;
revoke all on public.discovery_giveaways from anon, authenticated;
revoke all on public.discovery_giveaway_entries from anon, authenticated;

create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
begin
  perform cron.unschedule('panel-pro-process-giveaways');
exception when others then null;
end $$;
do $$
begin
  perform cron.schedule('panel-pro-process-giveaways','* * * * *',$job$select net.http_post(url := 'https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/process-giveaways', headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'panel_pro_cron_secret' limit 1)), body := '{}'::jsonb);$job$);
exception when others then null;
end $$;
