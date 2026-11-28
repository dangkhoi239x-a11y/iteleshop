import { describe, expect, it } from "vitest";
import { vndFor } from "@/lib/pricing";
import { signPayosCreate, verifyPayosWebhook } from "@/server/payos.server";
import { signBinancePay } from "@/server/binancepay.server";

describe("PayOS & Binance Pay helpers", () => {
  it("converts USDT/TON to VND with 2,000 VND minimum", () => {
    const rates = { vnd_per_usdt: 25500, vnd_per_ton: 130000 };
    expect(vndFor(2, "USDT", rates)).toBe(51000);
    expect(vndFor(0.01, "USDT", rates)).toBe(2000);
    expect(vndFor(1.5, "TON", rates)).toBe(195000);
  });

  it("signs PayOS create payload and verifies PayOS webhook signature", async () => {
    const key = "payos_test_checksum_key";
    const sig = await signPayosCreate(
      {
        amount: 51000,
        cancelUrl: "https://iteleshop.onrender.com/orders/1",
        description: "TeleShop #1",
        orderCode: 1,
        returnUrl: "https://iteleshop.onrender.com/orders/1?paid=1",
      },
      key,
    );
    expect(sig).toMatch(/^[0-9a-f]{64}$/);

    const dataObj = { orderCode: 1, amount: 51000, reference: "REF123" };
    const { hmacHex } = await import("@/server/crypto.server");
    const whSig = await hmacHex(key, "amount=51000&orderCode=1&reference=REF123", "SHA-256");
    expect(await verifyPayosWebhook(dataObj, whSig, key)).toBe(true);
    expect(await verifyPayosWebhook(dataObj, "bad_sig", key)).toBe(false);
  });

  it("signs Binance Pay requests with uppercase HMAC-SHA512", async () => {
    const sig = await signBinancePay("1700000000000", "nonce123", '{"orderAmount":10}', "bpay_secret");
    expect(sig).toMatch(/^[0-9A-F]{128}$/);
  });
});
