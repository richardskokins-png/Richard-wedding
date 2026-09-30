create extension if not exists pgcrypto;

create table if not exists public.employees (
  id text primary key,
  name text not null,
  role text not null check (role in ('manager', 'salesperson', 'expense_reporter')),
  telegram_user_id bigint unique,
  telegram_chat_id bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  submitted_at timestamptz not null default now(),
  salesperson_id text not null references public.employees(id),
  customer text not null,
  project text not null check (project in ('A', 'B')),
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  proposed_shares jsonb not null,
  final_shares jsonb,
  commission_pool_cents integer not null default 0,
  commission_richard_cents integer not null default 0,
  commission_anastasia_cents integer not null default 0,
  commission_jean_claude_cents integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  origin text not null check (origin in ('website', 'telegram')),
  origin_chat_id bigint,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'failed')),
  sync_error text,
  notification_status text not null default 'not_required' check (notification_status in ('not_required', 'pending', 'delivered', 'failed', 'no_recipient')),
  notification_error text,
  approved_at timestamptz,
  approved_by text references public.employees(id)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  submitted_at timestamptz not null default now(),
  reporter_id text not null references public.employees(id),
  description text not null,
  category text not null check (category in ('Materials', 'Travel', 'Other')),
  amount_cents integer not null check (amount_cents > 0),
  proposed_allocation text not null check (proposed_allocation in ('A', 'B', 'Company overhead')),
  final_allocation text check (final_allocation in ('A', 'B', 'Company overhead')),
  status text not null check (status in ('awaiting_allocation', 'allocated')),
  origin text not null check (origin in ('website', 'telegram')),
  origin_chat_id bigint,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'failed')),
  sync_error text,
  notification_status text not null default 'not_required' check (notification_status in ('not_required', 'pending', 'delivered', 'failed', 'no_recipient')),
  notification_error text,
  allocated_at timestamptz,
  allocated_by text references public.employees(id)
);

create index if not exists sales_salesperson_idx on public.sales(salesperson_id);
create index if not exists expenses_reporter_idx on public.expenses(reporter_id);
create index if not exists sales_status_idx on public.sales(status);
create index if not exists expenses_status_idx on public.expenses(status);

alter table public.employees enable row level security;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;

insert into public.employees (id, name, role) values
  ('svetlana', 'Svetlana de Monte Carlo', 'manager'),
  ('richard', 'Richard “Call Me Dick” Darling', 'salesperson'),
  ('anastasia', 'Anastasia Ferrari', 'salesperson'),
  ('jean-claude', 'Jean-Claude Bērziņš', 'salesperson'),
  ('kevin', 'Kevin von Whatever', 'expense_reporter')
on conflict (id) do update set name = excluded.name, role = excluded.role;
