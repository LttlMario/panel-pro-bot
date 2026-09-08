create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'panel-pro-status-live-sync') then
    perform cron.unschedule('panel-pro-status-live-sync');
  end if;
  perform cron.schedule(
    'panel-pro-status-live-sync',
    '* * * * *',
    $job$
      select net.http_post(
        url := 'https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/status-live-sync',
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'panel_pro_cron_secret' limit 1)),
        body := jsonb_build_object('organization_id', organizations.id)
      )
      from public.discovery_organizations organizations
      where organizations.active = true;
    $job$
  );
end $$;
