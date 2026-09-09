-- Funcțiile Edge folosesc clientul service-role pentru reminderele pornite din dashboard.
grant select, insert, update on table public.discovery_wheel_reminders to service_role;
