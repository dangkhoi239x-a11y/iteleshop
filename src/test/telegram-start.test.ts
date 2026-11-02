import { describe, expect, it } from 'vitest';
import { isTelegramStart, telegramStoreUrl } from '@/lib/telegram-start';
describe('Telegram Start', () => {
 it('accepts Start and referral arguments', () => {
  expect(isTelegramStart('/start')).toBe(true);
  expect(isTelegramStart('/start referral123')).toBe(true);
  expect(isTelegramStart('/start@iteleshop_bot')).toBe(true);
 });
 it('rejects unrelated messages and lookalike commands', () => {
  expect(isTelegramStart('/starting')).toBe(false);
  expect(isTelegramStart(null)).toBe(false);
 });
 it('opens the public app host instead of the editor login host', () => {
  expect(telegramStoreUrl('https://id-preview--940f544b-e568-4ddc-bad7-5ad08819e404.lovable.app')).toBe('https://project--940f544b-e568-4ddc-bad7-5ad08819e404-dev.lovable.app/');
 });
});