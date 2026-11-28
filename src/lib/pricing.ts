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

export type BulkTier = { minQty: number; percent: number };
/** Parses "3:10\n5:15" (min quantity : percent off) into sorted tiers; ignores bad lines. */
export function parseBulkTiers(text: string | null | undefined): BulkTier[] {
  const out = new Map<number, number>();
  for (const line of (text ?? "").split(/[\n,;]/)) {
    const m = line.trim().match(/^(\d+)\s*[:=]\s*(\d+(?:\.\d+)?)%?$/);
    if (!m) continue;
    const q = Number(m[1]), pct = Number(m[2]);
    if (q >= 2 && pct > 0 && pct <= 90) out.set(q, pct);
  }
  return [...out].map(([minQty, percent]) => ({ minQty, percent })).sort((a, b) => a.minQty - b.minQty);
}
/** Best percent off for a quantity. */
export function bulkPercent(tiers: BulkTier[], qty: number) {
  return tiers.filter((t) => qty >= t.minQty).reduce((m, t) => Math.max(m, t.percent), 0);
}

/** Buy X get Y: free units added on top of the paid quantity. */
export function freeUnits(qty: number, buyX: number | null | undefined, getY: number | null | undefined) {
  if (!buyX || !getY || buyX < 1 || getY < 1) return 0;
  return Math.floor(qty / buyX) * getY;
}
/** Telegram Stars needed for an order total (rounded up, min 1). */
export function starsFor(total: number, currency: string, rates: { stars_per_usdt: number | string; stars_per_ton: number | string }) {
  const rate = Number(currency === "TON" ? rates.stars_per_ton : rates.stars_per_usdt);
  return Math.max(1, Math.ceil(total * rate - 1e-9));
}

/** VND amount for PayOS VietQR checkout (rounded, min 2,000 VND per PayOS rule). */
export function vndFor(total: number, currency: string, rates: { vnd_per_usdt?: number | string | null; vnd_per_ton?: number | string | null }) {
  const fallback = currency === "TON" ? 130000 : 25500;
  const rate = Number((currency === "TON" ? rates.vnd_per_ton : rates.vnd_per_usdt) ?? fallback);
  return Math.max(2000, Math.round(total * rate));
}

export function orderQuote(p: PriceProduct & { bulk_discounts?: string | null }, quantity: number, voucher?: PriceVoucher | null) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new Error("Quantity must be between 1 and 100");
  const unit = effectivePrice(p);
  const gross = round6(unit * quantity);
  const bulkOff = round6(gross * bulkPercent(parseBulkTiers(p.bulk_discounts), quantity) / 100);
  const subtotal = round6(gross - bulkOff);
  const applied = voucher ? voucherDiscount(voucher, subtotal) : null;
  const voucherOff = applied?.ok ? applied.discount : 0;
  return { unit, gross, bulkOff, subtotal, voucherOff, total: round6(subtotal - voucherOff), voucherValid: !applied || applied.ok };
}
