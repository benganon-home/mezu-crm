-- ============================================================
-- MEZU CRM — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── CUSTOMERS ───────────────────────────────────────────────
create table if not exists customers (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  phone       text not null,
  email       text,
  address     text,
  notes       text,
  tags        text[] default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Unique phone (dedup key)
create unique index if not exists customers_phone_idx
  on customers (phone);

-- ─── ORDERS ──────────────────────────────────────────────────
create type order_status as enum ('received','preparing','ready','shipped','cancelled');
create type delivery_type as enum ('delivery','pickup');
create type order_source  as enum ('site','email','whatsapp','manual');

create table if not exists orders (
  id               uuid primary key default uuid_generate_v4(),
  customer_id      uuid not null references customers(id) on delete cascade,
  order_group_id   text,
  status           order_status not null default 'received',
  delivery_type    delivery_type not null default 'delivery',
  delivery_address text,
  source           order_source not null default 'site',
  total_price      numeric(10,2) not null default 0,
  is_pinned        boolean default false,
  has_delivery_note boolean default false,
  tracking_number  text,
  invoice_id       text,
  invoice_url      text,
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists orders_customer_idx   on orders (customer_id);
create index if not exists orders_status_idx     on orders (status);
create index if not exists orders_created_idx    on orders (created_at desc);
create unique index if not exists orders_group_dedup_idx
  on orders (order_group_id) where order_group_id is not null;

-- ─── ORDER ITEMS ─────────────────────────────────────────────
create table if not exists order_items (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid not null references orders(id) on delete cascade,
  item_name   text not null,
  model       text,
  color       text,
  sign_text   text,
  font        text,
  sign_type   text,
  size        text,
  price       numeric(10,2) not null default 0,
  status      order_status not null default 'received',
  created_at  timestamptz default now()
);

create index if not exists items_order_idx on order_items (order_id);

-- ─── REMINDERS ───────────────────────────────────────────────
create type reminder_type as enum ('call','whatsapp','task');

create table if not exists reminders (
  id          uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete cascade,
  order_id    uuid references orders(id) on delete set null,
  type        reminder_type not null default 'task',
  content     text not null,
  due_date    date,
  is_done     boolean default false,
  created_at  timestamptz default now()
);

create index if not exists reminders_customer_idx on reminders (customer_id);
create index if not exists reminders_due_idx      on reminders (due_date) where not is_done;

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger orders_updated_at   before update on orders    for each row execute function update_updated_at();
create trigger customers_updated_at before update on customers for each row execute function update_updated_at();

-- ─── RLS (Row Level Security) ────────────────────────────────
-- Enable RLS — only authenticated users can access data
alter table customers  enable row level security;
alter table orders     enable row level security;
alter table order_items enable row level security;
alter table reminders  enable row level security;

create policy "auth_only" on customers  for all using (auth.role() = 'authenticated');
create policy "auth_only" on orders     for all using (auth.role() = 'authenticated');
create policy "auth_only" on order_items for all using (auth.role() = 'authenticated');
create policy "auth_only" on reminders  for all using (auth.role() = 'authenticated');
create policy "auth_only" on sales_rules for all using (auth.role() = 'authenticated');
-- Storefront (anon) needs to read active rules to render bundle savings in cart.
create policy "public_read_active_rules" on sales_rules for select using (is_active = true);

-- ─── PRODUCTS ────────────────────────────────────────────────
create table if not exists products (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  base_price  numeric(10,2) not null default 0,
  unit_cost   numeric(10,2) default 0,  -- material/production cost per unit; used for COGS on /finance
  sizes       jsonb default '[]',   -- array of { label: string, price: number }
  colors      text[] default '{}',
  images      text[] default '{}',
  category    text,
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists products_category_idx on products (category);
create index if not exists products_active_idx   on products (is_active);

create trigger products_updated_at before update on products for each row execute function update_updated_at();

alter table products enable row level security;
create policy "auth_only" on products for all using (auth.role() = 'authenticated');

-- Storage bucket for product images (run separately in Supabase dashboard):
-- insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true);
-- create policy "auth_upload" on storage.objects for insert with check (bucket_id = 'product-images' and auth.role() = 'authenticated');
-- create policy "public_read"  on storage.objects for select using (bucket_id = 'product-images');

-- ─── HELPER VIEW: orders with customer + item count ──────────
create or replace view orders_with_customer as
select
  o.*,
  c.name        as customer_name,
  c.phone       as customer_phone,
  c.email       as customer_email,
  c.address     as customer_default_address,
  count(i.id)   as item_count
from orders o
join customers c on c.id = o.customer_id
left join order_items i on i.order_id = o.id
group by o.id, c.id;

-- ─── EXPENSES (הוצאות עסקיות) ────────────────────────────────
-- CRM is the source of truth. Each row is one invoice/receipt.
-- Historical rows imported from accountant's export (Excel) preserve
-- their external_serial/external_personal_number so re-imports are idempotent.

create table if not exists expense_categories (
  id            uuid primary key default uuid_generate_v4(),
  name_he       text unique not null,
  color         text default '#9490B8',
  display_order int default 100,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

-- Seed core categories (idempotent)
insert into expense_categories (name_he, color, display_order) values
  ('שיווק',         '#E879A6', 10),
  ('טלקום',         '#7AA8E8', 20),
  ('משרד',          '#6C5CE7', 30),
  ('משלוחים',       '#F59E0B', 40),
  ('חשבונות',       '#22C55E', 50),
  ('כלים-תוכנה',    '#06B6D4', 60),
  ('נסיעות',        '#A855F7', 70),
  ('ספקים',         '#EAB308', 80),
  ('אחר',           '#9490B8', 999)
on conflict (name_he) do nothing;

create table if not exists expenses (
  id                       uuid primary key default uuid_generate_v4(),
  document_date            date,                     -- תאריך מסמך — actual invoice date (sort key)
  recorded_at              date,                     -- תאריך יצירה — when the source system received it
  vendor                   text not null,            -- שם ספק
  category_id              uuid references expense_categories(id) on delete set null,
  amount                   numeric(12,2),            -- סכום (nullable for archived/duplicate-suspect)
  vat_amount               numeric(12,2),            -- mp״מ (nullable; can be auto-derived from amount)
  invoice_number           text,                     -- מספר מסמך (real number only)
  status                   text not null default 'active',  -- active | archived | duplicate_suspect
  duplicate_of_serial      text,                     -- when "חשוד ככפול עם מ.ס. X"
  external_serial          text,                     -- מספר סידורי
  external_personal_number text,                     -- מספור אישי
  invoice_url              text,                     -- PDF in Storage
  payment_method           text,                     -- אשראי | העברה | מזומן | הוראת קבע
  notes                    text,                     -- הערות
  sent_to_accountant_at    timestamptz,              -- last time the WA share was triggered
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

create index if not exists expenses_document_date_idx on expenses (document_date desc);
create index if not exists expenses_vendor_idx        on expenses (vendor);
create index if not exists expenses_status_idx        on expenses (status);
create index if not exists expenses_category_idx      on expenses (category_id);
-- idempotent re-import: same external_serial → existing row updates, never duplicates
create unique index if not exists expenses_external_serial_uniq
  on expenses (external_serial) where external_serial is not null;

create trigger expenses_updated_at before update on expenses for each row execute function update_updated_at();

alter table expenses           enable row level security;
alter table expense_categories enable row level security;
create policy "auth_only" on expenses           for all using (auth.role() = 'authenticated');
create policy "auth_only" on expense_categories for all using (auth.role() = 'authenticated');

-- ─── RECURRING EXPENSE TEMPLATES ─────────────────────────────
-- "I expect Y₪ from vendor X every month around day D" → drives the
-- "missing expenses" alert when we hit day D and nothing matched.
create table if not exists recurring_expenses (
  id                     uuid primary key default uuid_generate_v4(),
  vendor                 text not null,
  category_id            uuid references expense_categories(id) on delete set null,
  expected_amount        numeric(12,2),       -- nullable when amount varies
  expected_day_of_month  int,                 -- 1-31, nullable for "monthly, no specific day"
  cadence                text not null default 'monthly',  -- monthly | quarterly | yearly
  active_from            date,
  active_until           date,
  is_active              boolean default true,
  notes                  text,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

create trigger recurring_expenses_updated_at before update on recurring_expenses for each row execute function update_updated_at();

alter table recurring_expenses enable row level security;
create policy "auth_only" on recurring_expenses for all using (auth.role() = 'authenticated');

-- ─── ACCOUNTANT CONTACT (single-row settings) ────────────────
-- Stored in app_settings as a key/value blob to avoid one-off tables.
create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);
alter table app_settings enable row level security;
create policy "auth_only" on app_settings for all using (auth.role() = 'authenticated');

-- Storage bucket for expense PDFs (run separately in Supabase dashboard):
-- insert into storage.buckets (id, name, public) values ('expense-invoices', 'expense-invoices', false);
-- create policy "auth_upload" on storage.objects for insert with check (bucket_id = 'expense-invoices' and auth.role() = 'authenticated');
-- create policy "auth_read"   on storage.objects for select using   (bucket_id = 'expense-invoices' and auth.role() = 'authenticated');
