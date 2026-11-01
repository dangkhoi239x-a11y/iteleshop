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
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;
  const userStr = params.get("user");
  if (!userStr) return null;
  return { user: JSON.parse(userStr) as TgUser, startParam: params.get("start_param") ?? undefined };
}

export async function sendTelegramMessage(botToken: string | undefined | null, chatId: string | undefined | null, text: string) {
  if (!botToken || !chatId || !/^-?\d+$/.test(chatId)) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch (e) {
    console.warn("Telegram notify failed", e);
  }
}

export const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
