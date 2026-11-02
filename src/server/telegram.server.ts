import { hmacBytes, hmacHex, safeEqual } from "./crypto.server";

export type TgUser = { id: number; first_name?: string; last_name?: string; username?: string; photo_url?: string; language_code?: string };

/** Validates Telegram Mini App initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app). */
export async function validateInitData(initData: string, botToken: string, maxAgeSec = 86400): Promise<{ user: TgUser; startParam?: string | undefined } | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const check = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = await hmacBytes("WebAppData", botToken);
  const expected = await hmacHex(secret, check);
  if (!safeEqual(expected, hash)) return null;
  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || authDate > Date.now()/1000+30 || Date.now() / 1000 - authDate > maxAgeSec) return null;
  const userStr = params.get("user");
  if (!userStr) return null;
  return { user: JSON.parse(userStr) as TgUser, startParam: params.get("start_param") ?? undefined };
}

export async function sendTelegramMessage(botToken: string | undefined | null, chatId: string | undefined | null, text: string, options: {event?:string} = {}) {
  if (!botToken || !chatId || !/^-?\d+$/.test(chatId)) return false;
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const { data: recipient } = await db.from('profiles').select('id').eq('telegram_id', chatId).maybeSingle();
  const logId=crypto.randomUUID();
  const initial=await db.from('telegram_delivery_logs').insert({id:logId,recipient_user_id:recipient?.id??null,chat_id:chatId,event:options.event??'notification',status:'failed',error_code:'SEND_PENDING'});
  if(initial.error) throw new Error('Unable to reserve notification history');
  let status: 'sent' | 'failed' = 'failed';
  let messageId: number | null = null;
  let errorCode = 'NETWORK_ERROR';
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...(recipient?{reply_markup:{inline_keyboard:[[{text:'✅ Đã nhận',callback_data:`ack:${logId}`}]]}}:{}) }),
    });
    const result = await response.json() as { ok?: boolean; result?: { message_id?: number }; error_code?: number };
    if (response.ok && result.ok) { status = 'sent'; messageId = result.result?.message_id ?? null; }
    else errorCode = String(result.error_code ?? response.status);
  } catch {
    console.warn("Telegram notification could not be delivered");
  }
  const { error } = await db.from('telegram_delivery_logs').update({ status, message_id: messageId, error_code: status === 'sent' ? null : errorCode }).eq('id',logId);
  if (error) console.warn('Telegram delivery history could not be saved');
  return status === 'sent';
}

export const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
