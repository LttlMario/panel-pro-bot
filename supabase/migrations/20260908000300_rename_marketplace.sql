do $$
begin
  if to_regclass('public.discovery_marketplace_legal') is not null and to_regclass('public.discovery_marketplace') is null then
    alter table public.discovery_marketplace_legal rename to discovery_marketplace;
  end if;
end $$;

alter table if exists public.discovery_marketplace
  add column if not exists telefon text not null default '';
