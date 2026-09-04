alter table public.discovery_custom_module_submissions
  add column if not exists values_json jsonb not null default '{}'::jsonb,
  add column if not exists action_key text not null default '',
  add column if not exists source_message_id text not null default '',
  add column if not exists source_channel_id text not null default '',
  add column if not exists attachment_urls jsonb not null default '[]'::jsonb;

create index if not exists discovery_custom_module_submissions_status_lookup
  on public.discovery_custom_module_submissions (organization_id, guild_id, module_key, status, created_at desc);
