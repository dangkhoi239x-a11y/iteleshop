import { escapeHtml, sendTelegramMessage } from "./telegram.server";

/** Marks an order paid (idempotent) and runs notifications + auto-delivery. Returns true if it changed. */
export async function onOrderPaid(orderId: string, paymentId: string, payCurrency: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const changed = await db.rpc("mark_order_paid", { _order_id: orderId, _payment_id: paymentId, _pay_currency: payCurrency });
  if (changed.error) throw new Error(changed.error.message);
  if (!changed.data) return false;
  const { data: o } = await db.from("orders").select("*").eq("id", orderId).single();
  if (!o) return true;
  const tok = process.env["TELEGRAM_BOT_TOKEN"];
  const { data: bot } = await db.from("shop_bots").select("*").eq("shop_id", o.shop_id).maybeSingle();
  const { data: buyer } = await db.from("profiles").select("telegram_id, username").eq("id", o.buyer_id).single();
  const amt = o.pay_method === "stars" ? `${o.stars_amount} ⭐` : `${Number(o.total_amount).toFixed(2)} ${o.currency}`;
  await sendTelegramMessage(bot?.bot_token, bot?.notification_chat_id, `🛒 <b>New paid order #${o.order_number}</b>\n${escapeHtml(o.product_name)} × ${o.quantity}\n💰 ${amt}\n👤 ${buyer?.username ? "@" + escapeHtml(buyer.username) : "buyer"}${o.delivery_address ? `\n📍 ${escapeHtml(o.delivery_address)}` : ""}`);
  await sendTelegramMessage(tok, buyer?.telegram_id, `✅ Payment received for order #${o.order_number} (${amt}). Funds are held in escrow until you confirm receipt.`);
  const { data: prod } = await db.from("products").select("auto_send_telegram, buyer_guide").eq("id", o.product_id).maybeSingle();
  if (prod?.buyer_guide) await db.from("orders").update({ buyer_guide: prod.buyer_guide }).eq("id", o.id);
  const guide = prod?.buyer_guide ? `\n\n📘 ${escapeHtml(prod.buyer_guide)}` : "";
  if (o.delivered_content && prod?.auto_send_telegram !== false) await sendTelegramMessage(tok, buyer?.telegram_id, `🎁 Your item (#${o.order_number}):\n<code>${escapeHtml(o.delivered_content)}</code>${guide}`);
  else if (guide) await sendTelegramMessage(tok, buyer?.telegram_id, `📦 Order #${o.order_number} is ready in the app.${guide}`);
  return true;
}

export async function tgApi<T = unknown>(method: string, body: object): Promise<T> {
  const tok = process.env["TELEGRAM_BOT_TOKEN"];
  if (!tok) throw new Error("Telegram bot token is not configured");
  const r = await fetch(`https://api.telegram.org/bot${tok}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json()) as { ok: boolean; result: T; description?: string };
  if (!j.ok) throw new Error(`Telegram ${method} failed: ${j.description ?? r.status}`);
  return j.result;
}

export async function webhookSecret() {
  const { hmacHex } = await import("./crypto.server");
  return (await hmacHex(process.env["TELEGRAM_BOT_TOKEN"] ?? "", "teleshop-webhook")).slice(0, 64);
}
