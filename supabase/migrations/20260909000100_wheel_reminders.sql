create table if not exists public.discovery_wheel_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  guild_id text not null,
  discord_id text not null,
  started_at timestamptz not null default now(),
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  notified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists discovery_wheel_reminders_due_idx on public.discovery_wheel_reminders(status, due_at);
create unique index if not exists discovery_wheel_reminders_one_pending_idx on public.discovery_wheel_reminders(organization_id, guild_id, discord_id) where status in ('pending','sending');
alter table public.discovery_wheel_reminders enable row level security;
revoke all on public.discovery_wheel_reminders from anon, authenticated;
grant select, insert, update on table public.discovery_wheel_reminders to service_role;
comment on table public.discovery_wheel_reminders is 'Remindere one-shot pornite explicit prin butonul Am dat la roata.';

create extension if not exists pg_cron;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'panel-pro-wheel-reminders') then
    perform cron.unschedule('panel-pro-wheel-reminders');
  end if;
  perform cron.schedule(
    'panel-pro-wheel-reminders',
    '* * * * *',
    $job$select net.http_post(
      url := 'https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/send-wheel-reminders',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'panel_pro_cron_secret' limit 1)),
      body := '{}'::jsonb
    );$job$
  );
end $$;
