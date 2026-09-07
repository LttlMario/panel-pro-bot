-- The ticket tables are intentionally private. Edge Functions use service_role,
-- so grant it table access while keeping anon/authenticated revoked.
grant usage on schema public to service_role;
grant all on table public.discovery_support_tickets to service_role;
grant all on table public.discovery_support_ticket_events to service_role;
grant all on table public.discovery_support_ticket_history to service_role;
grant execute on function public.discovery_support_ticket_backup() to service_role;