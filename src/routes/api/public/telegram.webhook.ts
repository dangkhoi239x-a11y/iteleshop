import { createFileRoute } from "@tanstack/react-router";
import { extractStartParam, isTelegramStart, telegramStoreUrl } from '@/lib/telegram-start';
import { z } from 'zod';

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
        const message = u['message'];
        if (message?.chat?.type === 'private' && isTelegramStart(message.text)) {
          const startParam = extractStartParam(message.text);
          await tgApi('sendMessage', {
            chat_id: message.chat.id,
            text: '🛍 Chào mừng anh/chị đến TeleShop!\nMở cửa hàng để xem sản phẩm, đặt hàng và nhận mã ngay trong Telegram.',
            reply_markup: { inline_keyboard: [[{ text: '🛍 Mở TeleShop', web_app: { url: telegramStoreUrl(process.env['TELEGRAM_APP_URL'], startParam) } }]] },
          });
          return new Response('ok');
        }
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const acknowledgement=z.object({id:z.string(),data:z.string().regex(/^ack:[0-9a-f-]{36}$/),from:z.object({id:z.number().int()}),message:z.object({message_id:z.number().int(),chat:z.object({id:z.number().int()})})}).safeParse(u['callback_query']);
        if(acknowledgement.success){
          const cb=acknowledgement.data;
          const {data:recipient}=await db.from('profiles').select('id').eq('telegram_id',String(cb.from.id)).maybeSingle();
          if(recipient){const r=await db.from('telegram_delivery_logs').update({acknowledged_at:new Date().toISOString()}).eq('id',cb.data.slice(4)).eq('recipient_user_id',recipient.id).eq('chat_id',String(cb.message.chat.id)).eq('message_id',cb.message.message_id).eq('status','sent').is('acknowledged_at',null);if(r.error)throw new Error(r.error.message);}
          await tgApi('answerCallbackQuery',{callback_query_id:cb.id,text:'Đã ghi nhận xác nhận nhận tin.'});return new Response('ok');
        }
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
