alter table public.discovery_bot_global_settings
  add column if not exists custom_modules jsonb not null default '{}'::jsonb;

comment on column public.discovery_bot_global_settings.custom_modules is
  'Module Panel Pro Bot create de administratorul global, cu embed, butoane, handler și rută de log.';
