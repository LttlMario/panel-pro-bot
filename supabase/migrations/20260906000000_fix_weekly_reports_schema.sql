-- Complete the persistence schema used by the weekly Discord reports.
alter table public.discovery_organizations
  add column if not exists address text not null default '';

create table if not exists public.discovery_scheduled_report_runs (
  id uuid primary key default gen_random_uuid(),
  report_key text not null,
  organization_id uuid not null references public.discovery_organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'processing',
  error text,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (report_key, organization_id, period_start, period_end)
);

alter table public.discovery_contract_export_batches
  add column if not exists export_type text not null default 'manual',
  add column if not exists row_count integer not null default 0,
  add column if not exists completed_at timestamptz,
  add column if not exists error text;

alter table public.discovery_contract_export_items
  add column if not exists employee_id uuid references public.discovery_employees(id) on delete set null,
  add column if not exists full_name text not null default '';

create index if not exists discovery_scheduled_report_runs_lookup_idx
  on public.discovery_scheduled_report_runs(report_key, organization_id, period_start, period_end);
