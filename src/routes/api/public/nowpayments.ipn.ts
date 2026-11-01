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
        const orderId = String(payload.order_id ?? "");
        const status = String(payload.payment_status ?? "");
        const { data: o } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
        if (!o) return new Response("ok");

        if (status === "finished" || status === "confirmed") {
          const changed = await db.rpc("mark_order_paid", { _order_id: o.id, _payment_id: String(payload.payment_id ?? ""), _pay_currency: String(payload.pay_currency ?? "") });
          if (changed.data) {
            const { sendTelegramMessage, escapeHtml } = await import("@/server/telegram.server");
            const { data: bot } = await db.from("shop_bots").select("*").eq("shop_id", o.shop_id).maybeSingle();
            const { data: buyer } = await db.from("profiles").select("telegram_id, username").eq("id", o.buyer_id).single();
            const amt = `${Number(o.total_amount).toFixed(2)} ${o.currency}`;
            await sendTelegramMessage(bot?.bot_token, bot?.notification_chat_id, `🛒 <b>New paid order #${o.order_number}</b>\n${escapeHtml(o.product_name)} × ${o.quantity}\n💰 ${amt}\n👤 ${buyer?.username ? "@" + escapeHtml(buyer.username) : "buyer"}${o.delivery_address ? `\n📍 ${escapeHtml(o.delivery_address)}` : ""}`);
            await sendTelegramMessage(process.env["TELEGRAM_BOT_TOKEN"], buyer?.telegram_id, `✅ Payment received for order #${o.order_number} (${amt}). Funds are held in escrow until you confirm receipt.`);
          }
        } else if (o.status === "awaiting_payment") {
          const next = status === "expired" ? "expired" : status === "failed" ? "awaiting_payment" : o.status;
          await db.from("orders").update({ payment_status: status, status: next, updated_at: new Date().toISOString() }).eq("id", o.id);
        }
        return new Response("ok");
      },
    },
  },
});
