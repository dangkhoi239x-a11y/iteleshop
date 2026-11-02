export function isTelegramStart(text: unknown): boolean {
 return typeof text === 'string' && /^\/start(?:@[a-z0-9_]+)?(?:\s|$)/i.test(text);
}
export function telegramStoreUrl(publicUrl = 'https://iteleshop.lovable.app'): string {
 const url = new URL(publicUrl);
 if (url.protocol !== 'https:' || /^(?:id-preview|preview|project)--/.test(url.hostname)) {
  throw new Error('Telegram store requires a published HTTPS app URL');
 }
 return `${url.origin}/`;
}