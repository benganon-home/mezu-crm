# MEZU CRM — Project Context for Claude

## What this is
Internal CRM for MEZU (mezu.co.il) — a business selling custom 3D-printed mezuzot and home design products.
Built by Ben Ganon. Owner: Ben Ganon (benganon-home).

## Stack
- **Next.js 14** App Router, TypeScript, Tailwind CSS
- **Supabase** — PostgreSQL DB, Auth, Storage
- **Vercel** — hosting and CI/CD
- **Font**: Heebo (Google Fonts) — RTL Hebrew + Latin

## Brand
- Navy: `#2D2B55` — dark purple, sidebar background
- Cream: `#F8F7FC` — light lavender background
- Gold: `#6C5CE7` — vibrant purple accent, CTAs, highlights
- Direction: RTL (Hebrew), sidebar on the RIGHT (collapsible to 64px icon-only mode)

## Order statuses (4 only)
- `received`  → התקבלה
- `preparing` → בהכנה
- `ready`     → מוכן
- `shipped`   → נשלח
- `cancelled` → בוטל (edge case)

## Key files
- `src/types/index.ts`                    — all TypeScript types and STATUS_CONFIG
- `src/lib/utils.ts`                      — formatDate, formatPrice, formatPhone, buildWaLink
- `src/lib/whatsapp.ts`                   — WA message templates
- `src/lib/supabase/`                     — client.ts (browser) + server.ts (Next.js RSC)
- `src/styles/globals.css`                — design tokens, .crm-table, .badge, .drawer, .surface
- `src/components/layout/AppLayout.tsx`   — collapsible RTL sidebar + dark mode toggle
- `src/components/orders/OrderRow.tsx`    — order + item rows in the table
- `src/components/orders/BulkStatusBar.tsx` — bottom bar for bulk status changes
- `src/components/orders/ItemStatusDropdown.tsx` — inline per-item status picker
- `src/components/orders/OrderDrawer.tsx` — right-side order detail panel
- `src/components/ui/StatusBadge.tsx`     — reusable status pill
- `src/components/ui/StatCard.tsx`        — analytics stat card
- `src/components/ui/CopyButton.tsx`      — copy-to-clipboard button
- `docs/schema.sql`                       — full Supabase schema
- `scripts/migrate-from-base44.ts`        — one-time migration script

## DB tables
- `customers`   — id, name, phone (UNIQUE), email, address, notes, tags
- `orders`      — id, customer_id FK, status, delivery_type, total_price, ...
- `order_items` — id, order_id FK, item_name, model, color, sign_text, font, size, price
- `reminders`   — id, customer_id, order_id, type, content, due_date, is_done

## UI conventions
- `surface` class = white card with border and rounded corners
- `btn-primary` = purple (gold) background, navy text
- `btn-secondary` = transparent with border
- `btn-ghost` = no background, hover only
- `input` class = standard form input
- `label` class = uppercase muted label
- `crm-table` class = RTL table with hover rows; order rows have `.order-header-row` + `.order-items-row`
- `drawer` class = right-side panel, use `.open` to show
- `badge` + `badge-dot` = status pill
- `chip-btn` / `chip-btn-active` = filter chips (status filter bar)
- `page-header` = flex header with bottom border, used at top of each page
- `ltr` = direction override for phone numbers / numeric values

## API routes
- `PATCH /api/orders/[id]` — update order status/fields
- `POST  /api/orders/bulk` — bulk status update
- `PATCH /api/order-items/[id]` — update single item status
- `POST  /api/order-items/bulk` — bulk item status update
- `GET/POST/PATCH/DELETE /api/customers/[id]` — customer CRUD
- `GET/POST /api/reminders` — reminders

## Architecture rules
1. Server components fetch data directly from Supabase server client
2. Client components use `/api/*` routes for mutations
3. Always import from `@/types`, `@/lib/utils`, `@/lib/supabase/client`
4. Phone numbers: always use `formatPhone()` for display, `phoneToWa()` for WA links
5. Prices: always use `formatPrice()` — formats as ₪1,234
6. AppLayout wraps all pages — sidebar width exposed as `--app-sidebar-width` CSS var

## Migration note
Source data: Base44 app `68c655a4315f6d1a8c30e408`
- 500 raw records → 173 logical orders → 153 unique customers
- Run: `npm run migrate` (needs SUPABASE_SERVICE_ROLE_KEY in .env.local)

## Current phase
Phase 1 — Orders table + Customer cards + Auth ✓
- Orders table with per-item rows, inline status dropdowns, bulk status bar
- Collapsible RTL sidebar, dark mode, purple theme
Phase 2 — Reminders, Gmail import via Make.com (in progress)
Phase 3 — Analytics dashboard, Kanban
