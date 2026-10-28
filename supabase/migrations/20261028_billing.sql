-- Sprzedaż online (2026-10-28): plany, zamówienia, klienci, subskrypcje, faktury.
-- Wszystko tylko przez edge `billing` (service role). Anon/authenticated: brak dostępu.

create table if not exists public.billing_plans (
  key text primary key,
  product_key text not null references public.fiq_products(key),
  name text not null,
  monthly_net numeric(10,2) not null,
  setup_net numeric(10,2) not null default 0,
  vat_rate numeric(4,2) not null default 23,
  active boolean not null default true,
  lines jsonb not null default '[]'
);
insert into public.billing_plans (key, product_key, name, monthly_net, setup_net) values
  ('start', 'advisor', 'AI Doradca — abonament', 490, 0),
  ('wdrozenie', 'advisor', 'AI Doradca — abonament z wdrożeniem', 490, 1490)
on conflict (key) do update set monthly_net = excluded.monthly_net, setup_net = excluded.setup_net, name = excluded.name;

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid unique references public.brain_workspaces(id) on delete set null,
  email text not null,
  contact_name text,
  phone text,
  nip text not null,
  company_name text not null,
  street text, postal_code text, city text, country text not null default 'PL',
  regon text,
  invoice_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  plan_key text not null references public.billing_plans(key),
  email text not null,
  customer jsonb not null,
  consents jsonb not null default '{}',
  net numeric(10,2) not null, vat numeric(10,2) not null, gross numeric(10,2) not null,
  status text not null default 'new' check (status in ('new','pending','paid','failed','expired','canceled')),
  provider text, provider_ref text, provider_payload jsonb,
  fulfilled_at timestamptz, fulfill_error text,
  workspace_id uuid references public.brain_workspaces(id) on delete set null,
  user_id uuid references public.brain_users(id) on delete set null,
  reminders jsonb not null default '{}',
  source text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists billing_orders_status_idx on public.billing_orders(status, created_at);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.brain_workspaces(id) on delete cascade,
  customer_id uuid not null references public.billing_customers(id),
  plan_key text not null references public.billing_plans(key),
  status text not null default 'active' check (status in ('active','past_due','paused','canceled')),
  period_start date not null,
  period_end date not null,
  cancel_at_period_end boolean not null default false,
  provider text, provider_token text, card_label text,
  past_due_since timestamptz,
  dunning jsonb not null default '{}',
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists billing_subs_due_idx on public.billing_subscriptions(status, period_end);

create sequence if not exists public.billing_invoice_seq;
create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  workspace_id uuid references public.brain_workspaces(id) on delete set null,
  subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  order_id uuid references public.billing_orders(id) on delete set null,
  seller jsonb not null,
  buyer jsonb not null,
  items jsonb not null,
  net numeric(10,2) not null, vat numeric(10,2) not null, gross numeric(10,2) not null,
  issue_date date not null default current_date,
  sale_date date not null default current_date,
  due_date date not null default current_date,
  status text not null default 'unpaid' check (status in ('unpaid','paid','void')),
  paid_at timestamptz,
  pay_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  ksef_status text,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.billing_invoices(id) on delete set null,
  order_id uuid references public.billing_orders(id) on delete set null,
  subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  kind text not null check (kind in ('checkout','renewal','manual')),
  amount numeric(10,2) not null,
  status text not null check (status in ('pending','paid','failed')),
  provider text, provider_ref text, error text,
  created_at timestamptz not null default now()
);

alter table public.brain_users add column if not exists must_change_password boolean not null default false;
alter table public.brain_users add column if not exists onboarding jsonb not null default '{}';
alter table public.brain_workspaces add column if not exists billing_blocked_at timestamptz;

alter table public.billing_plans enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_orders enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_payments enable row level security;
revoke all on public.billing_customers, public.billing_orders, public.billing_subscriptions, public.billing_invoices, public.billing_payments from anon, authenticated;
-- plany są publiczne (cena na stronie)
create policy billing_plans_read on public.billing_plans for select to anon, authenticated using (active);
