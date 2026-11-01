import { createFileRoute } from "@tanstack/react-router";

// NOWPayments IPN webhook. Verified with HMAC-SHA512 (x-nowpayments-sig) before any write.
export const Route = createFileRoute("/api/public/nowpayments/ipn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyIpn } = await import("@/server/nowpayments.server");
        const raw = await request.text();
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("bad json", { status: 400 });
        }
        if (!(await verifyIpn(payload, request.headers.get("x-nowpayments-sig")))) return new Response("invalid signature", { status: 401 });

        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const orderId = String(payload["order_id"] ?? "");
        const status = String(payload["payment_status"] ?? "");
        const { data: o } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
        if (!o) return new Response("ok");

        if (status === "finished" || status === "confirmed") {
          const { onOrderPaid } = await import("@/server/order-paid.server");
          await onOrderPaid(o.id, String(payload["payment_id"] ?? ""), String(payload["pay_currency"] ?? ""));
        } else if (o.status === "awaiting_payment") {
          const next = status === "expired" ? "expired" : status === "failed" ? "awaiting_payment" : o.status;
          await db.from("orders").update({ payment_status: status, status: next, updated_at: new Date().toISOString() }).eq("id", o.id);
        }
        return new Response("ok");
      },
    },
  },
});
