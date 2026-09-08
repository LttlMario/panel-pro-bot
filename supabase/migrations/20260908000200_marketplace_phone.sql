alter table if exists public.discovery_marketplace
  add column if not exists telefon text not null default '';

alter table if exists public.discovery_marketplace_illegal
  add column if not exists telefon text not null default '';
