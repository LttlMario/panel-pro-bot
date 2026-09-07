-- Chei de idempotency pentru notificările dintre panel și Discord.
create table if not exists public.discovery_discord_notification_events (
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  event_key text not null,
  event_type text not null,
  guild_id text,
  created_at timestamptz not null default now(),
  primary key (organization_id, event_key)
);
alter table public.discovery_discord_notification_events enable row level security;
revoke all on public.discovery_discord_notification_events from anon, authenticated;

create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'panel-pro-discord-entitlement-reminders') then
    perform cron.schedule(
      'panel-pro-discord-entitlement-reminders',
      '15 * * * *',
      $job$select net.http_post(
        url := 'https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/discord-entitlement-reminders',
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'panel_pro_cron_secret' limit 1)),
        body := '{}'::jsonb
      );$job$
    );
  end if;
end $$;
