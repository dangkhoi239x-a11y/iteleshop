/* Thin wrapper around the Telegram Mini App SDK (loaded via telegram-web-app.js). */
type WebApp = {
  initData: string;
  initDataUnsafe?: { start_param?: string; user?: { language_code?: string } };
  ready: () => void;
  expand: () => void;
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  HapticFeedback?: { impactOccurred: (s: "light" | "medium") => void; notificationOccurred: (t: "success" | "error") => void };
};
declare global {
  interface Window {
    Telegram?: { WebApp: WebApp };
  }
}

// Set to your bot's username (without @) and Mini App short name to build t.me deep links.
export const BOT_USERNAME = "TeleShopMarketBot";
export const MINI_APP_NAME = "app";

export const tg = () => (typeof window !== "undefined" ? window.Telegram?.WebApp : undefined);
export const inTelegram = () => !!tg()?.initData;

export function openExternal(url: string) {
  const w = tg();
  if (w?.initData) w.openLink(url);
  else window.open(url, "_blank", "noopener");
}

export function haptic(kind: "success" | "error" | "light" = "light") {
  const w = tg();
  const h = w?.initData ? w.HapticFeedback : undefined;
  if (!h) return;
  if (kind === "light") h.impactOccurred("light");
  else h.notificationOccurred(kind);
}

export function referralLink(code: string) {
  return `https://t.me/${BOT_USERNAME}/${MINI_APP_NAME}?startapp=ref_${code}`;
}

export function shareLink(url: string, text: string) {
  const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  const w = tg();
  if (w?.initData) w.openTelegramLink(share);
  else window.open(share, "_blank", "noopener");
}
