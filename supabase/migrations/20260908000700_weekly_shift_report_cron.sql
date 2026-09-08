create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'panel-pro-weekly-shift-report') then
    perform cron.unschedule('panel-pro-weekly-shift-report');
  end if;
  perform cron.schedule(
    'panel-pro-weekly-shift-report',
    '0 16 * * 0',
    $job$select net.http_post(
      url := 'https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/send-weekly-shift-report',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'panel_pro_cron_secret' limit 1)),
      body := '{}'::jsonb
    );$job$
  );
end $$;
