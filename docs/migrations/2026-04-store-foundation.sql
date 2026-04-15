-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MEZU Store — Foundation Migration                                ║
-- ║  Adds all tables + columns needed for the new customer-facing    ║
-- ║  mezu.co.il storefront. All changes are ADDITIVE — safe to run   ║
-- ║  on the existing production database.                             ║
-- ║                                                                    ║
-- ║  Run once on Supabase production after review.                    ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── 1. Extend order_source enum ──────────────────────────────────
-- Adds 'store' value so orders from mezu.co.il can be distinguished
-- from legacy Base44 'site' orders.

alter type order_source add value if not exists 'store';


-- ─── 2. Extend products table with storefront fields ──────────────

alter table products add column if not exists slug             text unique;
alter table products add column if not exists subtitle         text;
alter table products add column if not exists long_description text;
alter table products add column if not exists materials        text;
alter table products add column if not exists care_instructions text;
alter table products add column if not exists display_order    integer default 0;
alter table products add column if not exists tags             text[] default '{}';
alter table products add column if not exists sku              text;
alter table products add column if not exists configurator_type text default 'generic';
-- configurator_type values: 'mezuzah' | 'sign' | 'blessing' | 'generic'

create index if not exists products_slug_idx     on products (slug);
create index if not exists products_display_idx  on products (display_order);


-- ─── 3. Product categories (first-class) ──────────────────────────

create table if not exists product_categories (
  id              uuid primary key default uuid_generate_v4(),
  slug            text unique not null,
  name_he         text not null,
  description     text,
  hero_image      text,
  display_order   integer default 0,
  is_active       boolean default true,
  seo_title       text,
  seo_description text,
  created_at      timestamptz default now()
);

create index if not exists product_categories_active_idx on product_categories (is_active);
create index if not exists product_categories_order_idx  on product_categories (display_order);

-- Later migration will add products.category_id uuid references product_categories(id)
-- Keep existing products.category text column during transition.


-- ─── 4. Sign templates (CRM-managed designs for שלטי בית) ─────────

create table if not exists sign_templates (
  id              uuid primary key default uuid_generate_v4(),
  product_id      uuid references products(id) on delete cascade,
  name            text not null,
  svg_template    text not null,
  preview_image   text,
  allowed_fonts   text[] default '{}',
  allowed_colors  text[] default '{}',
  text_slots      jsonb default '[]',
  base_price      numeric(10,2) not null default 0,
  display_order   integer default 0,
  is_active       boolean default true,
  created_at      timestamptz default now()
);

create index if not exists sign_templates_product_idx on sign_templates (product_id);
create index if not exists sign_templates_active_idx  on sign_templates (is_active);


-- ─── 5. Favorites (wishlist for logged-in customers) ──────────────

create table if not exists favorites (
  customer_id uuid references customers(id) on delete cascade,
  product_id  uuid references products(id)  on delete cascade,
  created_at  timestamptz default now(),
  primary key (customer_id, product_id)
);


-- ─── 6. Content pages (About, Materials, Terms, Privacy, etc.) ────

create table if not exists content_pages (
  slug            text primary key,
  title_he        text not null,
  body_md         text not null,
  seo_description text,
  updated_at      timestamptz default now()
);


-- ─── 7. Blog posts ────────────────────────────────────────────────

create table if not exists blog_posts (
  id              uuid primary key default uuid_generate_v4(),
  slug            text unique not null,
  title_he        text not null,
  excerpt         text,
  body_md         text not null,
  cover_image     text,
  tags            text[] default '{}',
  is_published    boolean default false,
  published_at    timestamptz,
  seo_title       text,
  seo_description text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists blog_posts_published_idx on blog_posts (is_published, published_at desc);
create index if not exists blog_posts_slug_idx      on blog_posts (slug);


-- ─── 8. Order tracking tokens (email magic-link lookup) ───────────

create table if not exists order_tracking_tokens (
  token       text primary key,
  order_id    uuid references orders(id) on delete cascade,
  email       text,
  created_at  timestamptz default now(),
  expires_at  timestamptz
);

create index if not exists order_tracking_tokens_order_idx on order_tracking_tokens (order_id);


-- ─── 9. Link auth users to customers ──────────────────────────────

alter table customers add column if not exists auth_user_id uuid unique;


-- ─── 10. Public-read RLS policies for the storefront ──────────────
-- Store doesn't log users in — it reads catalog anonymously via the
-- Supabase anon key. Writes happen server-side via service role.

-- products: public-read for active products
alter table products enable row level security;
drop policy if exists "public_read_active_products" on products;
create policy "public_read_active_products" on products
  for select using (is_active = true);

-- product_categories
alter table product_categories enable row level security;
drop policy if exists "public_read_active_categories" on product_categories;
create policy "public_read_active_categories" on product_categories
  for select using (is_active = true);

-- sign_templates
alter table sign_templates enable row level security;
drop policy if exists "public_read_active_sign_templates" on sign_templates;
create policy "public_read_active_sign_templates" on sign_templates
  for select using (is_active = true);

-- content_pages
alter table content_pages enable row level security;
drop policy if exists "public_read_content_pages" on content_pages;
create policy "public_read_content_pages" on content_pages
  for select using (true);

-- blog_posts
alter table blog_posts enable row level security;
drop policy if exists "public_read_published_blog" on blog_posts;
create policy "public_read_published_blog" on blog_posts
  for select using (is_published = true);

-- Admin-only (authenticated, same pattern as existing tables) for writes
drop policy if exists "auth_only_write_products"           on products;
drop policy if exists "auth_only_write_categories"         on product_categories;
drop policy if exists "auth_only_write_sign_templates"     on sign_templates;
drop policy if exists "auth_only_write_content"            on content_pages;
drop policy if exists "auth_only_write_blog"               on blog_posts;
drop policy if exists "auth_only_read_favorites"           on favorites;

create policy "auth_only_write_products"           on products
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_only_write_categories"         on product_categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_only_write_sign_templates"     on sign_templates
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_only_write_content"            on content_pages
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_only_write_blog"               on blog_posts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- favorites: owner-only read (authenticated), full access via service role
alter table favorites enable row level security;
create policy "auth_only_read_favorites"           on favorites
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');


-- ─── 11. Updated-at triggers (reuse existing function) ────────────

create trigger if not exists content_pages_updated_at
  before update on content_pages
  for each row execute function update_updated_at();

create trigger if not exists blog_posts_updated_at
  before update on blog_posts
  for each row execute function update_updated_at();
