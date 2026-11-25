import { z } from 'zod';

export const giftSchema = z.object({ label: z.string().trim().min(1).max(100), codes: z.array(z.string().trim().min(1).max(4000)).min(1).max(500) });
export const campaignSchema = z.object({ shopId: z.string().uuid(), title: z.string().trim().min(3).max(120), rules: z.string().trim().min(10).max(4000), startsAt: z.string().datetime(), endsAt: z.string().datetime(), maxEntries: z.number().int().min(1).max(100), referralEntries: z.number().int().min(1).max(10), prizes: z.array(giftSchema).min(2).max(8) }).refine(d => Date.parse(d.endsAt) > Date.parse(d.startsAt), { message: 'End must follow start' });
export function parseGrowthInvite(value: string | undefined) {
  const m = /^grow_([0-9a-f]{32})$/i.exec(value ?? '');
  if (!m) return null;
  const s = m[1];
  if (!s) return null;
  return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
}
import { BOT_USERNAME } from './telegram';
export const growthLink = (code: string) => `https://t.me/${BOT_USERNAME}?startapp=grow_${code.replaceAll('-', '')}`;
export function prizeChance(count: number, total: number) { return total > 0 ? count / total * 100 : 0; }