import crypto from "node:crypto";
import { checked } from "@/lib/data-result";

const BLOCKED_HOSTS = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[::1\]|::1|172\.(1[6-9]|2\d|3[01])\.)/i;

export function validateWebhookUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error("Invalid webhook URL");
  }
  if (u.protocol !== "https:") throw new Error("Webhook URL must use HTTPS");
  if (BLOCKED_HOSTS.test(u.hostname) || u.hostname.endsWith(".local") || u.hostname.endsWith(".internal")) {
    throw new Error("Webhook host is not allowed");
  }
  return u.toString();
}

export function signWebhookPayload(secret: string, timestamp: number, rawBody: string): string {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function verifyWebhookSignature(
  secret: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
  rawBody: string,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !timestampHeader || !signatureHeader) return false;
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > 300) return false;
  const sig = signatureHeader.replace(/^sha256=/i, "").trim();
  const expected = signWebhookPayload(secret, ts, rawBody);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function postFulfillWebhook(
  url: string,
  secret: string,
  payload: Record<string, unknown>,
  idempotencyKey: string,
): Promise<{ status: number; data: { codes?: unknown; buyer_guide?: unknown; status?: unknown } | null }> {
  const rawBody = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  const sig = signWebhookPayload(secret, ts, rawBody);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-TeleShop-Signature": `sha256=${sig}`,
      "X-TeleShop-Timestamp": String(ts),
      "Idempotency-Key": idempotencyKey,
    },
    body: rawBody,
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => null)) as { codes?: unknown; buyer_guide?: unknown; status?: unknown } | null;
  return { status: res.status, data };
}

export async function dispatchOrderWebhook(orderId: string): Promise<"ready" | "pending_external" | "shortage"> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const o = checked(await db.from("orders").select("*").eq("id", orderId).single());
  if (!o) throw new Error("Order not found");
  if (o.fulfillment_state === "ready") return "ready";

  const p = checked(
    await db
      .from("products")
      .select("id, fulfillment_mode, webhook_url, webhook_secret, external_sku, buyer_guide")
      .eq("id", o.product_id)
      .single(),
  );
  if (!p || p.fulfillment_mode !== "webhook_api" || !p.webhook_url || !p.webhook_secret) {
    await db.rpc("fail_external_fulfillment", { _order_id: orderId, _reason: "Product webhook is not configured" });
    return "shortage";
  }

  const { data: buyer } = await db.from("profiles").select("telegram_id").eq("id", o.buyer_id).maybeSingle();

  try {
    const safeUrl = validateWebhookUrl(p.webhook_url);
    const { status, data } = await postFulfillWebhook(
      safeUrl,
      p.webhook_secret,
      {
        event: "order.fulfill",
        idempotency_key: o.id,
        order_id: o.id,
        order_number: o.order_number,
        product_id: o.product_id,
        external_sku: p.external_sku ?? null,
        quantity: o.quantity,
        buyer_telegram_id: buyer?.telegram_id ?? null,
        paid_amount: Number(o.total_amount),
        currency: o.currency,
      },
      o.id,
    );

    if (status === 202) {
      return "pending_external";
    }

    if (status >= 200 && status < 300 && Array.isArray(data?.codes)) {
      const codes = data.codes.map((c) => String(c).trim()).filter(Boolean);
      if (codes.length !== o.quantity) {
        await db.rpc("fail_external_fulfillment", {
          _order_id: o.id,
          _reason: `Webhook returned ${codes.length} codes, expected ${o.quantity}`,
        });
        return "shortage";
      }
      const guide = typeof data.buyer_guide === "string" ? data.buyer_guide : null;
      const r = await db.rpc("complete_external_fulfillment", {
        _order_id: o.id,
        _codes: codes,
        _buyer_guide: guide,
      });
      if (r.error) throw new Error(r.error.message);
      return "ready";
    }

    await db.rpc("fail_external_fulfillment", { _order_id: o.id, _reason: `Webhook HTTP ${status}` });
    return "shortage";
  } catch (e) {
    await db.rpc("fail_external_fulfillment", {
      _order_id: o.id,
      _reason: e instanceof Error ? e.message : "Webhook call failed",
    });
    return "shortage";
  }
}

export async function testProductWebhook(webhookUrl: string, secret: string, externalSku?: string | null) {
  const safeUrl = validateWebhookUrl(webhookUrl);
  const { status, data } = await postFulfillWebhook(
    safeUrl,
    secret,
    {
      event: "order.test",
      idempotency_key: `test-${Date.now()}`,
      external_sku: externalSku ?? null,
      quantity: 1,
    },
    `test-${Date.now()}`,
  );
  if (status === 202) return { ok: true, mode: "async" as const, sampleCount: 0 };
  if (status >= 200 && status < 300 && Array.isArray(data?.codes) && data.codes.length > 0) {
    return { ok: true, mode: "sync" as const, sampleCount: data.codes.length };
  }
  throw new Error(`Webhook returned HTTP ${status} without valid codes array`);
}
