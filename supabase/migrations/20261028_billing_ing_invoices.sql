-- Faktury z ING Księgowość (2026-10-28): numer, id dokumentu i PDF w prywatnym magazynie.
alter table public.billing_invoices
  add column if not exists ing_doc_id text,
  add column if not exists ing_number text,
  add column if not exists ing_pdf_path text,
  add column if not exists ing_error text,
  add column if not exists ing_attempts int not null default 0,
  add column if not exists ing_raw jsonb,
  add column if not exists ing_issued_at timestamptz;
create index if not exists billing_invoices_ing_todo on public.billing_invoices(status, ing_doc_id) where ing_doc_id is null;
insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false) on conflict (id) do nothing;
