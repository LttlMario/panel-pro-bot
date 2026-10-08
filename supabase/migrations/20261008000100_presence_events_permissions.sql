-- The events table is written only by the Discord interaction worker.
-- Keep it private from browser roles and explicitly grant the worker role.
grant usage on schema public to service_role;

revoke all on table public.discovery_event_participants from anon, authenticated;
grant select, insert, update, delete on table public.discovery_event_participants to service_role;

alter table public.discovery_event_participants enable row level security;
