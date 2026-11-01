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

import { bulkPercent as bp, parseBulkTiers as pbt } from "@/lib/pricing";
describe("quantity discounts", () => {
  const tiers = pbt("3:10\n5:15\nbad\n1:50");
  it("parses valid tiers only", () => expect(tiers).toEqual([{ minQty: 3, percent: 10 }, { minQty: 5, percent: 15 }]));
  it("no discount below 3", () => expect(bp(tiers, 2)).toBe(0));
  it("10% from 3", () => expect(bp(tiers, 4)).toBe(10));
  it("15% from 5", () => expect(bp(tiers, 7)).toBe(15));
});

import { freeUnits, starsFor } from "@/lib/pricing";
describe("buy X get Y", () => {
  it("buy 2 get 1: 5 bought → 2 free", () => expect(freeUnits(5, 2, 1)).toBe(2));
  it("below X → none", () => expect(freeUnits(1, 2, 1)).toBe(0));
  it("disabled when empty", () => expect(freeUnits(5, null, 1)).toBe(0));
});
describe("Stars conversion", () => {
  const r = { stars_per_usdt: 77, stars_per_ton: 250 };
  it("10 USDT → 770 stars", () => expect(starsFor(10, "USDT", r)).toBe(770));
  it("rounds up", () => expect(starsFor(0.01, "USDT", r)).toBe(1));
  it("2 TON → 500 stars", () => expect(starsFor(2, "TON", r)).toBe(500));
});
