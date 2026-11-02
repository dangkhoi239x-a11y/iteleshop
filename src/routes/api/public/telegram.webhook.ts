import { createFileRoute } from "@tanstack/react-router";

// Telegram bot webhook: handles Telegram Stars checkout. Verified via X-Telegram-Bot-Api-Secret-Token.
export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { webhookSecret, tgApi, onOrderPaid } = await import("@/server/order-paid.server");
        const { safeEqual } = await import("@/server/crypto.server");
        if (!process.env["TELEGRAM_BOT_TOKEN"] || !safeEqual(request.headers.get("x-telegram-bot-api-secret-token") ?? "", await webhookSecret())) return new Response("unauthorized", { status: 401 });
        const u = (await request.json().catch(() => null)) as Record<string, any> | null;
        if (!u) return new Response("ok");
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const pcq = u["pre_checkout_query"];
        if (pcq) {
          const { data: o } = await db.from("orders").select("status, stars_amount, pay_method").eq("id", String(pcq.invoice_payload)).maybeSingle();
          const ok = !!o && o.pay_method === "stars" && o.status === "awaiting_payment" && pcq.currency === "XTR" && Number(pcq.total_amount) === o.stars_amount;
          await tgApi("answerPreCheckoutQuery", ok ? { pre_checkout_query_id: pcq.id, ok: true } : { pre_checkout_query_id: pcq.id, ok: false, error_message: "Order is no longer payable" });
          return new Response("ok");
        }
        const sp = u["message"]?.successful_payment;
        if (sp && sp.currency === "XTR") {
          const { data: o } = await db.from("orders").select("id, stars_amount, pay_method").eq("id", String(sp.invoice_payload)).maybeSingle();
          if (o?.pay_method === 'stars' && Number(sp.total_amount) === o.stars_amount) await onOrderPaid(o.id, String(sp.telegram_payment_charge_id), "XTR");
        }
        return new Response("ok");
      },
    },
  },
});
