import { describe, expect, it } from "vitest";
import { signWebhookPayload, validateWebhookUrl, verifyWebhookSignature } from "@/server/webhook-fulfillment.server";

describe("webhook fulfillment security", () => {
  it("accepts valid HTTPS public webhook URLs and blocks private/HTTP URLs", () => {
    expect(validateWebhookUrl("https://bot.myshop.com/fulfill")).toBe("https://bot.myshop.com/fulfill");
    expect(() => validateWebhookUrl("http://bot.myshop.com/fulfill")).toThrow("HTTPS");
    expect(() => validateWebhookUrl("https://localhost:3000/hook")).toThrow();
    expect(() => validateWebhookUrl("https://127.0.0.1/hook")).toThrow();
    expect(() => validateWebhookUrl("https://169.254.169.254/latest")).toThrow();
    expect(() => validateWebhookUrl("https://192.168.1.10/hook")).toThrow();
  });

  it("verifies HMAC-SHA256 webhook signatures and rejects expired or tampered requests", () => {
    const secret = "sec_123456";
    const body = JSON.stringify({ order_id: "abc", codes: ["C1"] });
    const now = 1700000000;
    const sig = `sha256=${signWebhookPayload(secret, now, body)}`;
    expect(verifyWebhookSignature(secret, String(now), sig, body, now + 10)).toBe(true);
    expect(verifyWebhookSignature(secret, String(now - 500), sig, body, now)).toBe(false);
    expect(verifyWebhookSignature(secret, String(now), sig, body + " ", now)).toBe(false);
  });
});
