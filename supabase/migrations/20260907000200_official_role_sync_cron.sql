-- Rulează reconcilierea rolurilor oficiale la fiecare 15 minute.
-- Înainte de aplicare, salvează în Supabase Vault un secret numit
-- panel_pro_cron_secret, cu aceeași valoare ca secretul CRON_SECRET al funcției.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'panel-pro-official-role-sync') then
    perform cron.schedule(
      'panel-pro-official-role-sync',
      '*/15 * * * *',
      $job$select net.http_post(
        url := 'https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/sync-official-roles',
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'panel_pro_cron_secret' limit 1)),
        body := '{}'::jsonb
      );$job$
    );
  end if;
end $$;
