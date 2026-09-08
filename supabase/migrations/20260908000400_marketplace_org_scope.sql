alter table if exists public.discovery_marketplace_illegal add column if not exists organization_id uuid references public.discovery_organizations(id) on delete cascade;
