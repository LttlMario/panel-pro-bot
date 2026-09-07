-- Reduce întârzierea notificărilor pentru intrări, plecări și roluri noi.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'panel-pro-discord-member-events') then
    perform cron.unschedule('panel-pro-discord-member-events');
  end if;
  perform cron.schedule(
    'panel-pro-discord-member-events',
    '* * * * *',
    $job$select net.http_post(
      url := 'https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/discord-member-events',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'panel_pro_cron_secret' limit 1)),
      body := '{}'::jsonb
    );$job$
  );
end $$;
