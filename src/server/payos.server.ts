import { hmacHex, safeEqual } from "./crypto.server";

const PAYOS_API = "https://api-merchant.payos.vn/v2/payment-requests";

export function payosDataQueryString(obj: Record<string, unknown>): string {
  return Object.keys(obj)
    .sort()
    .map((k) => {
      const v = obj[k];
      const str = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      return `${k}=${str}`;
    })
    .join("&");
}

export async function signPayosCreate(
  fields: { amount: number; cancelUrl: string; description: string; orderCode: number; returnUrl: string },
  checksumKey: string,
): Promise<string> {
  return hmacHex(checksumKey, payosDataQueryString(fields), "SHA-256");
}

export async function verifyPayosWebhook(
  dataObj: Record<string, unknown>,
  signature: string | null | undefined,
  checksumKeyOverride?: string,
): Promise<boolean> {
  const key = checksumKeyOverride ?? process.env["PAYOS_CHECKSUM_KEY"];
  if (!key || !signature) return false;
  const expected = await hmacHex(key, payosDataQueryString(dataObj), "SHA-256");
  return safeEqual(expected, signature.toLowerCase());
}

export async function createPayosPayment(input: {
  orderId: string;
  orderCode: number;
  amountVnd: number;
  description: string;
  origin: string;
}): Promise<{ invoiceId: string; invoiceUrl: string }> {
  const clientId = process.env["PAYOS_CLIENT_ID"];
  const apiKey = process.env["PAYOS_API_KEY"];
  const checksumKey = process.env["PAYOS_CHECKSUM_KEY"];
  if (!clientId || !apiKey || !checksumKey) {
    throw new Error("PayOS is not configured yet (missing PAYOS_CLIENT_ID / PAYOS_API_KEY / PAYOS_CHECKSUM_KEY).");
  }

  const returnUrl = `${input.origin}/orders/${input.orderId}?paid=1`;
  const cancelUrl = `${input.origin}/orders/${input.orderId}`;
  const description = input.description.slice(0, 25);
  const amount = Math.max(2000, Math.round(input.amountVnd));
  const signature = await signPayosCreate(
    { amount, cancelUrl, description, orderCode: input.orderCode, returnUrl },
    checksumKey,
  );

  const res = await fetch(PAYOS_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      orderCode: input.orderCode,
      amount,
      description,
      returnUrl,
      cancelUrl,
      signature,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    code?: string;
    desc?: string;
    data?: { checkoutUrl?: string; paymentLinkId?: string };
  };
  if (!res.ok || body.code !== "00" || !body.data?.checkoutUrl) {
    throw new Error(`PayOS: ${body.desc ?? res.status}`);
  }
  return {
    invoiceId: String(body.data.paymentLinkId ?? input.orderCode),
    invoiceUrl: body.data.checkoutUrl,
  };
}
