export function isTelegramStart(text: unknown): boolean {
 return typeof text === 'string' && /^\/start(?:@[a-z0-9_]+)?(?:\s|$)/i.test(text);
}
export function telegramStoreUrl(origin: string): string {
 const url = new URL(origin);
 url.hostname = url.hostname.replace(/^id-preview--([0-9a-f-]+)\./, 'project--$1-dev.');
 return `${url.origin}/`;
}