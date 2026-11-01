import { hmacHex, safeEqual } from "./crypto.server";

const API = "https://api.nowpayments.io/v1";

export async function createInvoice(input: {
  orderId: string;
  amount: number;
  currency: "USDT" | "TON";
  description: string;
  origin: string;
}) {
  const key = process.env["NOWPAYMENTS_API_KEY"];
  if (!key) throw new Error("Crypto payments are not configured yet (missing NOWPayments API key).");
  const res = await fetch(`${API}/invoice`, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      // USDT is priced 1:1 in USD; TON orders are priced in TON.
      price_amount: input.amount,
      price_currency: input.currency === "USDT" ? "usd" : "ton",
      pay_currency: input.currency === "TON" ? "ton" : undefined,
      order_id: input.orderId,
      order_description: input.description.slice(0, 200),
      ipn_callback_url: `${input.origin}/api/public/nowpayments/ipn`,
      success_url: `${input.origin}/orders/${input.orderId}?paid=1`,
      cancel_url: `${input.origin}/orders/${input.orderId}`,
      is_fee_paid_by_user: false,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string | number; invoice_url?: string; message?: string };
  if (!res.ok || !body.invoice_url) throw new Error(`NOWPayments: ${body.message ?? res.status}`);
  return { invoiceId: String(body.id), invoiceUrl: body.invoice_url };
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    return Object.keys(v as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortDeep((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
}

/** IPN signature = HMAC-SHA512(JSON of key-sorted payload, IPN secret). */
export async function verifyIpn(payload: unknown, signature: string | null) {
  const secret = process.env["NOWPAYMENTS_IPN_SECRET"];
  if (!secret || !signature) return false;
  const expected = await hmacHex(secret, JSON.stringify(sortDeep(payload)), "SHA-512");
  return safeEqual(expected, signature.toLowerCase());
}
