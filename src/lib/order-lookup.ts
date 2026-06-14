// Look up a customer's orders by phone and summarize status + shipping, for the
// WhatsApp bot. Read-only, uses the service-role client (no request cookies).

import { createClient } from "@supabase/supabase-js";
import { STATUS_CONFIG, type OrderStatus } from "@/types";
import { getTracking } from "@/lib/run";

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

const he = (s: string) => STATUS_CONFIG[s as OrderStatus]?.label ?? s;

/** Orders for a phone (DB form 0XXXXXXXXX). If orderNumber given, narrows to it. */
export async function lookupOrders(localPhone: string, orderNumber?: number | null): Promise<{ customerName: string | null; orders: OrderSummary[] }> {
  const db = admin();

  const { data: customer } = await db.from("customers").select("id, name").eq("phone", localPhone).maybeSingle();
  if (!customer) return { customerName: null, orders: [] };

  let q = db
    .from("orders")
    .select("order_number, created_at, delivery_type, tracking_number, items:order_items(item_name, status)")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (orderNumber != null) q = q.eq("order_number", orderNumber);

  const { data: orders } = await q;
  const list = (orders ?? []) as Array<{
    order_number: number | null;
    created_at: string;
    delivery_type: string;
    tracking_number: string | null;
    items: { item_name: string; status: string }[];
  }>;

  const summaries: OrderSummary[] = [];
  for (const o of list) {
    let shippingStatus: string | null = null;
    if (o.tracking_number) {
      try {
        const events = await getTracking(o.tracking_number);
        shippingStatus = events[0]?.desc ?? null; // most recent first
      } catch {
        shippingStatus = null;
      }
    }
    summaries.push({
      orderNumber: o.order_number,
      createdAt: o.created_at,
      deliveryType: o.delivery_type,
      items: (o.items ?? []).map((it) => ({ name: it.item_name, status: it.status, statusHe: he(it.status) })),
      trackingNumber: o.tracking_number,
      shippingStatus,
    });
  }

  return { customerName: customer.name, orders: summaries };
}
