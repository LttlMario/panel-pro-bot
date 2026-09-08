-- Retention policy: Discord messages remain untouched; only database records are purged.
create or replace function public.discovery_purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff_7 timestamptz := now() - interval '7 days';
  cutoff_30 timestamptz := now() - interval '30 days';
  deleted_count bigint := 0;
  n bigint;
begin
  -- Technical/idempotency data (7 days). These rows do not represent Discord messages.
  delete from public.discovery_discord_notification_events where created_at < cutoff_7;
  get diagnostics n = row_count; deleted_count := deleted_count + n;
  delete from public.discovery_audit_log where created_at < cutoff_7;
  get diagnostics n = row_count; deleted_count := deleted_count + n;
  delete from public.discovery_lifecycle_events where created_at < cutoff_7;
  get diagnostics n = row_count; deleted_count := deleted_count + n;
  delete from public.discovery_event_reminder_runs where coalesce(sent_at, reminder_date::timestamptz) < cutoff_7;
  get diagnostics n = row_count; deleted_count := deleted_count + n;

  -- Discord announcements/events/marketplace data (7 days). Discord messages are never touched.
  delete from public.discovery_community_posts where created_at < cutoff_7;
  get diagnostics n = row_count; deleted_count := deleted_count + n;
  delete from public.discovery_events where created_at < cutoff_7 and status in ('completed','cancelled','closed');
  get diagnostics n = row_count; deleted_count := deleted_count + n;
  delete from public.discovery_marketplace where created_at < cutoff_7;
  get diagnostics n = row_count; deleted_count := deleted_count + n;
  delete from public.discovery_marketplace_illegal where created_at < cutoff_7;
  get diagnostics n = row_count; deleted_count := deleted_count + n;
  delete from public.discovery_custom_module_submissions where created_at < cutoff_7 and handler = 'announcement' and status in ('published','closed','rejected');
  get diagnostics n = row_count; deleted_count := deleted_count + n;

  -- Operational records already delivered to Discord (7 days). Keep active/pending work.
  delete from public.discovery_shifts where created_at < cutoff_7 and status in ('completed','auto_completed');
  get diagnostics n = row_count; deleted_count := deleted_count + n;
  delete from public.discovery_absences where created_at < cutoff_7 and status not in ('pending','open');
  get diagnostics n = row_count; deleted_count := deleted_count + n;

  -- Support tickets remain available for 30 days after creation; Discord channels/messages are untouched.
  delete from public.discovery_support_ticket_history h
  using public.discovery_support_tickets t
  where h.ticket_id = t.id and t.created_at < cutoff_30 and t.status = 'closed';
  get diagnostics n = row_count; deleted_count := deleted_count + n;
  delete from public.discovery_support_tickets where created_at < cutoff_30 and status = 'closed';
  get diagnostics n = row_count; deleted_count := deleted_count + n;

  -- Reports/exports are removable only after a successful delivery to Discord.
  delete from public.discovery_scheduled_report_runs where created_at < cutoff_7 and status in ('sent','sent_partial');
  get diagnostics n = row_count; deleted_count := deleted_count + n;
  delete from public.discovery_action_report_runs where created_at < cutoff_7 and status in ('sent','sent_partial');
  get diagnostics n = row_count; deleted_count := deleted_count + n;
  delete from public.discovery_contract_export_batches where created_at < cutoff_7 and status = 'completed';
  get diagnostics n = row_count; deleted_count := deleted_count + n;

  -- Contracts, employees (templates/CNP), routes, entitlements and Discord log message IDs are retained.
  return jsonb_build_object('ok', true, 'deleted_rows', deleted_count, 'cutoff_7_days', cutoff_7, 'cutoff_30_days', cutoff_30);
end;
$$;

revoke all on function public.discovery_purge_expired_data() from public, anon, authenticated;
grant execute on function public.discovery_purge_expired_data() to service_role;

create extension if not exists pg_cron;
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'panel-pro-data-retention-cleanup') then
    perform cron.schedule(
      'panel-pro-data-retention-cleanup',
      '15 3 * * *',
      $job$select public.discovery_purge_expired_data();$job$
    );
  end if;
end $$;
