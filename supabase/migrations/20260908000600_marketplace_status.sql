alter table if exists public.discovery_marketplace
  add column if not exists status text not null default 'active';

alter table if exists public.discovery_marketplace_illegal
  add column if not exists status text not null default 'active';
