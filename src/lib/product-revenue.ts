import { revenueDay } from '@/lib/revenue';
export type ProductRevenueOrder = { id: string; product_id: string; paid_at: string | null; currency: string; total_amount: number | string; quantity: number; free_quantity?: number | null; escrow_status: string; settled_net?: number | string | null; commission_amount?: number | string | null };
export type ProductRevenueCode = { order_id: string | null; received_at: string | null };
export type ProductRevenueRow = { day: string; productId: string; currency: string; orders: number; units: number; gross: number; net: number; codes: number; received: number; disputed: number; disputedOrders: number };
/** Groups paid orders by UTC+7 day, product and currency; counts delivered codes, received codes and codes on frozen (disputed) orders. */
export function summarizeProductRevenue(orders: ProductRevenueOrder[], codes: ProductRevenueCode[]): ProductRevenueRow[] {
  const byOrder = new Map<string, { total: number; received: number }>();
  for (const c of codes) { if (!c.order_id) continue; const v = byOrder.get(c.order_id) ?? { total: 0, received: 0 }; v.total++; if (c.received_at) v.received++; byOrder.set(c.order_id, v); }
  const rows = new Map<string, ProductRevenueRow>();
  for (const o of orders) {
    if (!o.paid_at) continue;
    const day = revenueDay(o.paid_at), key = `${day}|${o.product_id}|${o.currency}`;
    const r = rows.get(key) ?? { day, productId: o.product_id, currency: o.currency, orders: 0, units: 0, gross: 0, net: 0, codes: 0, received: 0, disputed: 0, disputedOrders: 0 };
    const gross = Number(o.total_amount) || 0, c = byOrder.get(o.id) ?? { total: 0, received: 0 };
    r.orders++; r.units += o.quantity + (o.free_quantity ?? 0); r.gross += gross;
    r.net += o.settled_net != null ? Number(o.settled_net) : gross - (Number(o.commission_amount) || 0);
    r.codes += c.total; r.received += c.received;
    if (o.escrow_status === 'frozen') { r.disputed += c.total; r.disputedOrders++; }
    rows.set(key, r);
  }
  return [...rows.values()].sort((a, b) => b.day.localeCompare(a.day) || b.gross - a.gross);
}
