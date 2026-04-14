# MEZU CRM — Project Context for Claude

## What this is
Internal CRM for MEZU (mezu.co.il) — a business selling custom 3D-printed mezuzot and home design products.
Built by Ben Ganon. Owner: Ben Ganon (benganon-home).
GitHub repo: `benganon-home/mezu-crm` — deployed on Vercel, auto-deploys from `main`.

## Stack
- **Next.js 14** App Router, TypeScript, Tailwind CSS
- **Supabase** — PostgreSQL DB, Auth (email/password), Storage, RLS
- **Vercel** — hosting and CI/CD
- **pdf-lib** — server-side PDF merging for bulk label printing
- **Font**: Heebo (Google Fonts) — RTL Hebrew + Latin

## Brand
- Navy: `#2D2B55` — dark purple, sidebar background
- Cream: `#F8F7FC` — light lavender background
- Gold: `#6C5CE7` — vibrant purple accent, CTAs, highlights
- Direction: RTL (Hebrew), sidebar on the RIGHT (collapsible to 64px icon-only mode)
- Dark mode supported — toggle in sidebar footer

## Order statuses (enum in DB)
- `received`  → התקבלה
- `preparing` → בהכנה
- `ready`     → מוכן
- `shipped`   → נשלח
- `cancelled` → בוטל (edge case)

## Product colors (4 defined — exact hex values)
```typescript
ITEM_COLOR_MAP = {
  'דמוי שיש כהה':      { hex: '#61615F' },
  'דמוי שיש אפור חול': { hex: '#C8C3BA' },
  'דמוי שיש בהיר':     { hex: '#DCDCDC', border: true },
  'לבן שלג':           { hex: '#FFFFFF', border: true },
}
```

## External integrations

### Morning (Green Invoice) — `src/lib/morning.ts`
- Auth: `POST /auth/tokens` with `id` + `secret` from env → JWT token (cached 50min)
- `searchInvoicesByName(name)` — searches invoices by customer name
- Invoice URL fields: `url.he` (Hebrew PDF), `url.origin` (original)
- **Important:** Morning's search API aggregations are unreliable for date-filtered totals.
  Always sum `items[].amount` directly, never use the aggregation fields.
- Env vars: `MORNING_ID`, `MORNING_SECRET`

### K-Express / Run — `src/lib/run.ts`
- `createShipment(params)` — creates shipment, returns `{ shipNum, randId }`
- `buildLabelUrl(shipNum)` — generates PDF label URL from `ship_print_ws` program
- `getTracking(shipNum)` — returns tracking events array
- Env vars: `RUN_USER`, `RUN_TOKEN`, `RUN_SENDER_*` fields

### Make.com automation
- Bridges Base44 ordering site → CRM via webhooks
- Sends new orders to `POST /api/webhooks/new-order`
- Sends pending orders (needing approval) to `POST /api/webhooks/pending-order`

### Base44
- Customer-facing ordering site (app ID: `68c655a4315f6d1a8c30e408`)
- Sends size strings like `"18 ס״מ רגיל"` or `"📏 24 ס״מ מוגדל (+₪30)"` — must be normalized
- Sign type labels mapped via `SIGN_MAP` in webhook to catalog product names

## Key files

### Types & config
- `src/types/index.ts` — all TypeScript interfaces + `STATUS_CONFIG`, `ALL_STATUSES`, `FONTS`, `ITEM_COLOR_MAP`
- `src/lib/utils.ts` — `formatDate`, `formatPrice`, `formatPhone`, `buildWaLink`
- `src/lib/whatsapp.ts` — WhatsApp message templates
- `src/middleware.ts` — Supabase auth session refresh on every request

### Supabase clients
- `src/lib/supabase/client.ts` — browser client (for client components)
- `src/lib/supabase/server.ts` — server client using session cookies (RSC + API routes)
- **Admin pattern** — used in routes that need to bypass RLS:
  ```typescript
  function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (key) return createClient(url, key)
    return createServerClient()
  }
  ```
  Used in: webhooks, labels/ready, any admin-only mutation

### Layout & UI
- `src/styles/globals.css` — design tokens, `.crm-table`, `.badge`, `.drawer`, `.surface`
- `src/components/layout/AppLayout.tsx` — collapsible RTL sidebar + dark mode toggle
- `src/hooks/useDrawerAnimation.ts` — shared drawer open/close animation hook

### Orders
- `src/components/orders/OrderRow.tsx` — order + item rows in the table
- `src/components/orders/OrderDrawer.tsx` — right-side order detail panel (no order-level status — item status only)
- `src/components/orders/NewOrderDrawer.tsx` — manual order creation drawer
- `src/components/orders/BulkStatusBar.tsx` — bottom bar for bulk status changes
- `src/components/orders/ItemStatusDropdown.tsx` — inline per-item status picker
- `src/components/orders/PendingOrdersBanner.tsx` — pending approval queue above orders table
- `src/components/orders/ExportModal.tsx` — CSV export modal

### Customers & Products
- `src/components/customers/CustomerDrawer.tsx` — customer detail panel
- `src/components/products/ProductDrawer.tsx` — product create/edit panel
- `src/components/products/ProductCard.tsx` — product grid card
- `src/components/products/ProductListRow.tsx` — product list row
- `src/components/settings/SalesRulesSection.tsx` — sales rule management UI

### UI components
- `src/components/ui/StatusBadge.tsx` — reusable status pill
- `src/components/ui/StatCard.tsx` — analytics stat card
- `src/components/ui/CopyButton.tsx` — copy-to-clipboard button
- `src/components/ui/ColorPicker.tsx` — color swatch picker
- `src/components/ui/UndoToast.tsx` — undo notification toast

### Other
- `docs/schema.sql` — full Supabase schema
- `scripts/migrate-from-base44.ts` — one-time migration script (done)

## DB tables
- `customers` — id, name, phone (UNIQUE), email, address, notes, tags
- `orders` — id, customer_id FK, status (enum), delivery_type, total_price, source, tracking_number, invoice_id, invoice_url, delivery_address
- `order_items` — id, order_id FK, item_name, model, color, sign_text, font, size, price, product_id FK, status
- `products` — id, name, category, base_price, sizes (JSONB array of `{label, price}`), images (JSONB), is_active
- `sales_rules` — id, name, conditions (JSONB), discount_type (`percent` | `fixed_total`), discount_value, is_active
- `pending_orders` — id, key (UNIQUE), raw payload (JSONB), created_at — orders awaiting manual approval
- `reminders` — id, customer_id, order_id, type, content, due_date, is_done

## Sales rules logic
Rules are evaluated in the webhook when an order arrives:
1. A rule matches if ALL its conditions are met (`model` + optional `size` + `min_qty`)
2. For `fixed_total`: discount applies ONLY to the bundle items (min qty per condition). Extra items (e.g. 5× 16cm mezuzot at ₪60 each) keep their full price. Final total = bundle discount + extras sum.
3. For `percent`: discount applies to all items proportionally.
4. Bundle item prices are distributed proportionally from the discount value.

Example: 18cm mezuzah + sign bundle rule = ₪139.90 fixed total. Order with 5 extra 16cm → total = ₪139.90 + 5×₪60 = ₪439.90.

## Webhook: new-order flow (`POST /api/webhooks/new-order`)
Auth: `x-webhook-secret` header checked against `WEBHOOK_SECRET` env var.

1. Parse body fields from Base44/Make
2. **Normalize size** — Base44 sends `"18 ס״מ רגיל"` → extract leading digits → `"18"`
3. Find or create customer by phone
4. Load active products for price lookup (by name + size label)
5. Build items array: main mezuzah, door sign (via `SIGN_MAP`), extra 16cm mezuzot (always ₪60)
6. Apply sales rules (bundle-aware fixed_total logic)
7. Create order + order_items in DB
8. Auto-link Morning invoice by customer name (best-effort, only if exactly 1 match)
9. Return full order

## API routes

### Orders
- `GET    /api/orders` — paginated orders list with filters
- `POST   /api/orders/new` — create manual order
- `PATCH  /api/orders/[id]` — update order fields/status
- `POST   /api/orders/bulk` — bulk status update
- `POST   /api/orders/link-invoice` — search Morning by name and link invoice to order
- `GET    /api/orders/[id]/invoice` — fetch Morning invoice details for an order

### Order items
- `PATCH  /api/order-items/[id]` — update single item
- `POST   /api/order-items/bulk` — bulk item status update
- `POST   /api/order-items` — add item to order

### Customers
- `GET/POST /api/customers` — list / create
- `GET/PATCH/DELETE /api/customers/[id]` — single customer CRUD

### Products & rules
- `GET/POST /api/products` — list / create products
- `GET/PATCH/DELETE /api/products/[id]` — single product CRUD
- `GET/POST /api/sales-rules` — list / create rules
- `GET/PATCH/DELETE /api/sales-rules/[id]` — single rule CRUD

### Pending orders
- `GET    /api/pending-orders` — list pending approval queue
- `DELETE /api/pending-orders/[key]` — dismiss pending order
- `POST   /api/webhooks/pending-order` — receive from Make (stores by phone or UUID key)

### Shipments & labels
- `POST   /api/shipments` — create K-Express shipment, stores tracking_number on order (does NOT auto-change order status)
- `GET    /api/shipments/[shipNum]/label` — single label PDF from K-Express
- `GET    /api/shipments/[shipNum]/tracking` — tracking events
- `GET    /api/labels/ready` — merge all K-Express label PDFs for `ready` orders with tracking numbers into one PDF (uses service role client)

### Analytics & webhooks
- `GET    /api/analytics` — DB stats (orders, revenue, colors, fonts, sign types, day-of-week, delivery breakdown) + Morning monthly revenue (last 6 months)
- `POST   /api/webhooks/new-order` — auto-create order from Base44 via Make
- `GET    /api/reminders` — reminders list
- `POST   /api/reminders` — create reminder

## UI conventions
- `surface` — white card with border and rounded corners
- `btn-primary` — purple (gold) background, white text
- `btn-secondary` — transparent with border
- `btn-ghost` — no background, hover only
- `input` — standard form input
- `label` — uppercase muted label
- `crm-table` — RTL table with hover rows; order rows use `.order-header-row` + `.order-items-row`
- `drawer` — right-side panel, use `.open` to show; mobile = `100vw` width
- `badge` + `badge-dot` — status pill
- `chip-btn` / `chip-btn-active` — filter chips (status filter bar)
- `page-header` — flex header with bottom border, used at top of each page
- `ltr` — direction override for phone numbers / numeric values

## Architecture rules
1. Server components fetch data directly via Supabase server client
2. Client components use `/api/*` routes for mutations
3. Admin routes (bypassing RLS) use `getSupabaseAdmin()` with `SUPABASE_SERVICE_ROLE_KEY`
4. Always import types from `@/types`, utilities from `@/lib/utils`, Supabase from `@/lib/supabase/client` or `@/lib/supabase/server`
5. Phone numbers: `formatPhone()` for display, `buildWaLink()` for WhatsApp links
6. Prices: always `formatPrice()` → formats as ₪1,234
7. AppLayout wraps all pages — sidebar width exposed as `--app-sidebar-width` CSS var
8. No order-level status in the UI — status is per item only (OrderDrawer shows item statuses, not order status)

## Pages
- `/orders` — main orders table with filters, bulk actions, pending orders banner, labels button
- `/customers` — customer list with search
- `/products` — product catalog management
- `/analytics` — revenue charts, top colors/fonts/signs, day-of-week activity, delivery breakdown
- `/reminders` — reminders list
- `/settings` — sales rules management
- `/auth/login` — login page

## What's built (current state)
- ✅ Orders table — per-item rows, inline status dropdowns, bulk status bar, filters
- ✅ Customer cards with order history
- ✅ Product catalog management with sizes and pricing
- ✅ Sales rules with bundle-aware discount logic
- ✅ Pending orders approval queue (from Make/Base44)
- ✅ Auto-order creation from Base44 via Make webhook
- ✅ Morning invoice auto-linking on order creation
- ✅ K-Express shipment creation from CRM
- ✅ Bulk label printing (all מוכן orders with tracking numbers → merged PDF)
- ✅ Analytics dashboard — Morning revenue, DB stats, charts
- ✅ Collapsible RTL sidebar, dark mode
- ✅ Mobile responsive — drawer full-width, table horizontal scroll, toolbar stacks
- ⬜ Reminders page (UI exists, full workflow incomplete)
- ⬜ Customer-facing website (planning phase — considering Next.js store vs staying on Base44)
