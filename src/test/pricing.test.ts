import { describe, expect, it } from "vitest";
import { commissionPercent, effectivePrice, voucherDiscount } from "@/lib/pricing";

const now = new Date("2026-11-01T00:00:00Z");
const tiers = [
  { min_order_amount: 0, max_order_amount: 100, commission_percent: 5, is_active: true },
  { min_order_amount: 100, max_order_amount: 1000, commission_percent: 3, is_active: true },
  { min_order_amount: 1000, max_order_amount: null, commission_percent: 2, is_active: true },
];
const v = { discount_type: "percent", discount_value: 10, min_order_amount: null, max_uses: null, used_count: 0, expires_at: null, is_active: true };

describe("pricing rules", () => {
  it("uses flash price only while the sale is running", () => {
    expect(effectivePrice({ price: 20, flash_sale_price: 15, flash_sale_end: "2026-11-02T00:00:00Z" }, now)).toBe(15);
    expect(effectivePrice({ price: 20, flash_sale_price: 15, flash_sale_end: "2026-10-31T00:00:00Z" }, now)).toBe(20);
  });
  it("platform fee: 5% under 100, 3% from 100, 2% from 1000", () => {
    expect(commissionPercent(tiers, 50)).toBe(5);
    expect(commissionPercent(tiers, 100)).toBe(3);
    expect(commissionPercent(tiers, 5000)).toBe(2);
  });
  it("percent voucher discounts subtotal", () => {
    expect(voucherDiscount(v, 200, now)).toEqual({ ok: true, discount: 20 });
  });
  it("fixed voucher never exceeds subtotal", () => {
    expect(voucherDiscount({ ...v, discount_type: "fixed", discount_value: 50 }, 30, now)).toEqual({ ok: true, discount: 30 });
  });
  it("rejects expired, used-up and below-minimum vouchers", () => {
    expect(voucherDiscount({ ...v, expires_at: "2026-10-01T00:00:00Z" }, 100, now)).toEqual({ ok: false, reason: "expired" });
    expect(voucherDiscount({ ...v, max_uses: 3, used_count: 3 }, 100, now)).toEqual({ ok: false, reason: "used_up" });
    expect(voucherDiscount({ ...v, min_order_amount: 150 }, 100, now)).toEqual({ ok: false, reason: "min_order" });
  });
});
