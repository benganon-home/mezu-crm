-- Applied 2026-10-06. Structured shipping address; delivery_address / address
-- stay as the formatted display string, these columns feed courier labels.
alter table public.orders
  add column if not exists delivery_city      text,
  add column if not exists delivery_street    text,
  add column if not exists delivery_building  text,
  add column if not exists delivery_entrance  text,
  add column if not exists delivery_floor     text,
  add column if not exists delivery_apartment text;

alter table public.customers
  add column if not exists address_city      text,
  add column if not exists address_street    text,
  add column if not exists address_building  text,
  add column if not exists address_entrance  text,
  add column if not exists address_floor     text,
  add column if not exists address_apartment text;
