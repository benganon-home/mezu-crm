// Look up customer orders for the WhatsApp bot, by order number, phone, or name.
// Read-only, uses the service-role client (no request cookies).

import { createClient } from "@supabase/supabase-js";
import { STATUS_CONFIG, type OrderStatus } from "@/types";
import { getTracking } from "@/lib/run";
import { toLocalPhone } from "@/lib/wa-cloud";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export interface OrderSummary {
  orderNumber: number | null;
  createdAt: string;
  deliveryType: string;
  items: { name: string; status: string; statusHe: string }[];
  trackingNumber: string | null;
  shippingStatus: string | null;
}

export interface CustomerOrders {
  customerName: string | null;
  phone: string | null;
  orders: OrderSummary[];
}

const he = (s: string) => STATUS_CONFIG[s as OrderStatus]?.label ?? s;

interface OrderRow {
  order_number: number | null;
  created_at: string;
  delivery_type: string;
  tracking_number: string | null;
  items: { item_name: string; status: string }[];
}

// Turn raw order rows into summaries, enriching with live K-Express status.
async function summarize(rows: OrderRow[]): Promise<OrderSummary[]> {
  const out: OrderSummary[] = [];
  for (const o of rows) {
    let shippingStatus: string | null = null;
    if (o.tracking_number) {
      try {
        const events = await getTracking(o.tracking_number);
        shippingStatus = events[0]?.desc ?? null; // most recent first
      } catch {
        shippingStatus = null;
      }
    }
    out.push({
      orderNumber: o.order_number,
      createdAt: o.created_at,
      deliveryType: o.delivery_type,
      items: (o.items ?? []).map((it) => ({ name: it.item_name, status: it.status, statusHe: he(it.status) })),
      trackingNumber: o.tracking_number,
      shippingStatus,
    });
  }
  return out;
}

const ORDER_COLS = "order_number, created_at, delivery_type, tracking_number, items:order_items(item_name, status)";

async function ordersForCustomer(db: ReturnType<typeof admin>, customerId: string): Promise<OrderSummary[]> {
  const { data } = await db
    .from("orders")
    .select(ORDER_COLS)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(10);
  return summarize((data ?? []) as OrderRow[]);
}

/**
 * Flexible search by any of: order number, phone, or name. Returns one group
 * per matching customer (name search can match several). Empty array = nothing.
 */
export async function findOrders(opts: { orderNumber?: number | null; phone?: string | null; name?: string | null }): Promise<CustomerOrders[]> {
  const db = admin();

  // 1) By order number — find the order regardless of who is asking.
  if (opts.orderNumber != null) {
    const { data } = await db
      .from("orders")
      .select(`${ORDER_COLS}, customer:customers(name, phone)`)
      .eq("order_number", opts.orderNumber)
      .limit(5);
    type JoinRow = OrderRow & { customer: { name: string | null; phone: string | null } | { name: string | null; phone: string | null }[] | null };
    const rows = (data ?? []) as unknown as JoinRow[];
    if (rows.length === 0) return [];
    const summaries = await summarize(rows);
    return rows.map((r, i) => {
      const c = Array.isArray(r.customer) ? r.customer[0] : r.customer;
      return { customerName: c?.name ?? null, phone: c?.phone ?? null, orders: [summaries[i]] };
    });
  }

  // 2) By phone — exact match on the normalized DB form.
  if (opts.phone) {
    const local = toLocalPhone(opts.phone);
    const { data: customer } = await db.from("customers").select("id, name, phone").eq("phone", local).maybeSingle();
    if (!customer) return [];
    return [{ customerName: customer.name, phone: customer.phone, orders: await ordersForCustomer(db, customer.id) }];
  }

  // 3) By name — fuzzy, may return several customers.
  if (opts.name && opts.name.trim().length >= 2) {
    const { data: customers } = await db
      .from("customers")
      .select("id, name, phone")
      .ilike("name", `%${opts.name.trim()}%`)
      .limit(5);
    const list = customers ?? [];
    if (list.length === 0) return [];
    const groups: CustomerOrders[] = [];
    for (const c of list) {
      groups.push({ customerName: c.name, phone: c.phone, orders: await ordersForCustomer(db, c.id) });
    }
    return groups;
  }

  return [];
}

/**
 * Back-compat helper used by the no-API-key templated fallback: orders for a
 * single phone (already in DB form 0XXXXXXXXX), optionally narrowed to an order.
 */
export async function lookupOrders(localPhone: string, orderNumber?: number | null): Promise<{ customerName: string | null; orders: OrderSummary[] }> {
  const db = admin();
  const { data: customer } = await db.from("customers").select("id, name").eq("phone", localPhone).maybeSingle();
  if (!customer) return { customerName: null, orders: [] };
  let orders = await ordersForCustomer(db, customer.id);
  if (orderNumber != null) orders = orders.filter((o) => o.orderNumber === orderNumber);
  return { customerName: customer.name, orders };
}
