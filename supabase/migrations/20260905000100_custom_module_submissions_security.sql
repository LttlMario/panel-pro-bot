alter table public.discovery_custom_module_submissions enable row level security;

revoke all on table public.discovery_custom_module_submissions from anon, authenticated;

comment on table public.discovery_custom_module_submissions is
  'Submissions for universal custom modules; accessed by trusted Edge Functions only.';
