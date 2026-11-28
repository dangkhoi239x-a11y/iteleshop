import { createFileRoute } from "@tanstack/react-router";

// Binance Pay webhook: confirms payment status directly via signed Binance Pay order query API.
export const Route = createFileRoute("/api/public/binancepay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as {
          bizType?: string;
          bizIdStr?: string;
          bizStatus?: string;
          data?: string | { merchantTradeNo?: string };
        } | null;

        if (!body) return Response.json({ returnCode: "FAIL", returnMessage: "bad json" }, { status: 400 });

        if (body.bizType === "PAY" && body.bizStatus === "PAY_SUCCESS") {
          let parsedData: { merchantTradeNo?: string } = {};
          if (typeof body.data === "string") {
            try {
              parsedData = JSON.parse(body.data) as { merchantTradeNo?: string };
            } catch {
              parsedData = {};
            }
          } else if (body.data && typeof body.data === "object") {
            parsedData = body.data;
          }

          const tradeNo = parsedData.merchantTradeNo;
          if (tradeNo && /^[0-9a-f]{32}$/i.test(tradeNo)) {
            const orderId = `${tradeNo.slice(0, 8)}-${tradeNo.slice(8, 12)}-${tradeNo.slice(12, 16)}-${tradeNo.slice(16, 20)}-${tradeNo.slice(20)}`;
            const { queryBinancePayOrder } = await import("@/server/binancepay.server");
            const verified = await queryBinancePayOrder(tradeNo).catch(() => null);
            if (verified?.status === "PAID") {
              const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
              const { data: o } = await db.from("orders").select("id, pay_method, currency").eq("id", orderId).maybeSingle();
              if (o && o.pay_method === "binance_pay") {
                const { onOrderPaid } = await import("@/server/order-paid.server");
                await onOrderPaid(o.id, String(verified.transactionId || body.bizIdStr || tradeNo), String(verified.currency || o.currency));
              }
            }
          }
        }

        return Response.json({ returnCode: "SUCCESS", returnMessage: null });
      },
    },
  },
});
