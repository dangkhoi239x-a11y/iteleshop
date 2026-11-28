import { createFileRoute } from "@tanstack/react-router";

// PayOS VietQR webhook: verifies HMAC-SHA256 signature before marking order paid.
export const Route = createFileRoute("/api/public/payos/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as {
          code?: string;
          success?: boolean;
          data?: Record<string, unknown>;
          signature?: string;
        } | null;

        if (!body?.data) return Response.json({ error: 1, message: "bad payload" }, { status: 400 });

        const { verifyPayosWebhook } = await import("@/server/payos.server");
        if (!(await verifyPayosWebhook(body.data, body.signature))) {
          return Response.json({ error: 1, message: "invalid signature" }, { status: 401 });
        }

        if (body.code === "00" && body.success === true) {
          const orderCode = Number(body.data["orderCode"]);
          if (Number.isFinite(orderCode)) {
            const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
            const { data: o } = await db
              .from("orders")
              .select("id, pay_method, fiat_amount_vnd")
              .eq("order_number", orderCode)
              .maybeSingle();
            if (o && o.pay_method === "payos") {
              const paidVnd = Number(body.data["amount"] ?? 0);
              if (!o.fiat_amount_vnd || paidVnd >= Number(o.fiat_amount_vnd)) {
                const { onOrderPaid } = await import("@/server/order-paid.server");
                const ref = String(body.data["reference"] ?? body.data["paymentLinkId"] ?? orderCode);
                await onOrderPaid(o.id, ref, "VND");
              }
            }
          }
        }

        return Response.json({ error: 0, message: "Ok", data: null });
      },
    },
  },
});
