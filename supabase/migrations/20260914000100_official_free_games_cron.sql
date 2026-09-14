create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'panel-pro-official-free-games') then
    perform cron.schedule('panel-pro-official-free-games','0 */6 * * *',$job$select net.http_post(url := 'https://zrjxlbkbctlapgupktxw.supabase.co/functions/v1/sync-official-free-games',headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'panel_pro_cron_secret' limit 1)),body := '{}'::jsonb);$job$);
  end if;
end $$;
