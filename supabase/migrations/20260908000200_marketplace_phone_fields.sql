-- Marketplace keeps text-only listings. Store the phone entered in the form;
-- image fields are intentionally not part of either table.
alter table if exists public.discovery_marketplace
  add column if not exists telefon text not null default '';

alter table if exists public.discovery_marketplace_illegal
  add column if not exists telefon text not null default '';

alter table if exists public.discovery_marketplace_illegal
  add column if not exists subcategorie text;
