import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const callbackSchema = z.object({
  order_id: z.string().uuid(),
  codes: z.array(z.string().trim().min(1).max(2000)).min(1).max(500),
  buyer_guide: z.string().max(4000).optional().nullable(),
});

export const Route = createFileRoute("/api/public/fulfill-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        let json: unknown;
        try {
          json = JSON.parse(rawBody);
        } catch {
          return new Response("bad json", { status: 400 });
        }
        const parsed = callbackSchema.safeParse(json);
        if (!parsed.success) return new Response("invalid payload", { status: 400 });

        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: order } = await db
          .from("orders")
          .select("id, product_id, quantity, fulfillment_state")
          .eq("id", parsed.data.order_id)
          .maybeSingle();
        if (!order) return new Response("order not found", { status: 404 });

        const { data: product } = await db
          .from("products")
          .select("fulfillment_mode, webhook_secret")
          .eq("id", order.product_id)
          .maybeSingle();
        if (!product || product.fulfillment_mode !== "webhook_api" || !product.webhook_secret) {
          return new Response("webhook not configured", { status: 400 });
        }

        const { verifyWebhookSignature } = await import("@/server/webhook-fulfillment.server");
        const okSig = verifyWebhookSignature(
          product.webhook_secret,
          request.headers.get("x-teleshop-timestamp"),
          request.headers.get("x-teleshop-signature"),
          rawBody,
        );
        if (!okSig) return new Response("invalid signature", { status: 401 });

        if (order.fulfillment_state === "ready") return Response.json({ ok: true, already_ready: true });

        const { error } = await db.rpc("complete_external_fulfillment", {
          _order_id: order.id,
          _codes: parsed.data.codes,
          _buyer_guide: parsed.data.buyer_guide ?? null,
        });
        if (error) return Response.json({ ok: false, error: error.message }, { status: 400 });

        const { sendOrderDelivery } = await import("@/server/order-paid.server");
        await sendOrderDelivery(order.id);
        return Response.json({ ok: true });
      },
    },
  },
});
