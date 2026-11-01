// Pure pricing rules shared by checkout UI and server.
export type PriceProduct = { price: number | string; flash_sale_price: number | string | null; flash_sale_end: string | null };
export type PriceVoucher = {
  discount_type: string;
  discount_value: number | string;
  min_order_amount: number | string | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
};
export type Tier = { min_order_amount: number | string; max_order_amount: number | string | null; commission_percent: number | string; is_active: boolean };

const n = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));
export const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

export function isFlashSaleActive(p: PriceProduct, now = new Date()) {
  return p.flash_sale_price != null && p.flash_sale_end != null && new Date(p.flash_sale_end) > now && n(p.flash_sale_price) < n(p.price);
}

export function effectivePrice(p: PriceProduct, now = new Date()) {
  return isFlashSaleActive(p, now) ? n(p.flash_sale_price) : n(p.price);
}

export function voucherDiscount(v: PriceVoucher, subtotal: number, now = new Date()): { ok: true; discount: number } | { ok: false; reason: string } {
  if (!v.is_active) return { ok: false, reason: "inactive" };
  if (v.expires_at && new Date(v.expires_at) <= now) return { ok: false, reason: "expired" };
  if (v.max_uses != null && v.used_count >= v.max_uses) return { ok: false, reason: "used_up" };
  if (v.min_order_amount != null && subtotal < n(v.min_order_amount)) return { ok: false, reason: "min_order" };
  const raw = v.discount_type === "percent" ? (subtotal * n(v.discount_value)) / 100 : n(v.discount_value);
  return { ok: true, discount: round6(Math.min(raw, subtotal)) };
}

/** Platform fee % for an order total; picks the active tier whose range contains the total. */
export function commissionPercent(tiers: Tier[], total: number) {
  const t = tiers
    .filter((x) => x.is_active && total >= n(x.min_order_amount) && (x.max_order_amount == null || total < n(x.max_order_amount)))
    .sort((a, b) => n(b.min_order_amount) - n(a.min_order_amount))[0];
  return t ? n(t.commission_percent) : 0;
}
