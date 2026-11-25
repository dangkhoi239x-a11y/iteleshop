export function isTelegramStart(text: unknown): boolean {
 return typeof text === 'string' && /^\/start(?:@[a-z0-9_]+)?(?:\s|$)/i.test(text);
}
export function extractStartParam(text: unknown): string | null {
 if (typeof text !== 'string') return null;
 const m = text.trim().match(/^\/start(?:@[a-z0-9_]+)?\s+([A-Za-z0-9_-]{1,64})/i);
 return m?.[1] ?? null;
}
export function telegramStoreUrl(publicUrl = 'https://iteleshop.lovable.app', startParam?: string | null): string {
 const url = new URL(publicUrl);
 if (url.protocol !== 'https:' || /^(?:id-preview|preview|project)--/.test(url.hostname)) {
  throw new Error('Telegram store requires a published HTTPS app URL');
 }
 const cleanParam = startParam && /^[A-Za-z0-9_-]{1,64}$/.test(startParam) ? startParam : null;
 return cleanParam ? `${url.origin}/?ref=${encodeURIComponent(cleanParam)}` : `${url.origin}/`;
}