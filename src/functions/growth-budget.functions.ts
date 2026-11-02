import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const getGrowthBudget = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
 .inputValidator((v: unknown) => z.object({ shopId: z.string().uuid() }).parse(v))
 .handler(async ({ data, context }) => {
  const shop = await context.supabase.from('shops').select('id').eq('id', data.shopId).eq('owner_id', context.userId).maybeSingle();
  if (!shop.data) throw new Error('Forbidden');
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const camps = await db.from('growth_campaigns').select('id,title,status,budget_ton,starts_at,ends_at,growth_prizes(id)').eq('shop_id', data.shopId).order('created_at', { ascending: false });
  if (camps.error) throw new Error(camps.error.message);
  return Promise.all((camps.data ?? []).map(async c => {
   const prizeIds = c.growth_prizes.map(p => p.id);
   const quizzes = await db.from('shop_quizzes').select('id').eq('campaign_id', c.id);
   const qIds = (quizzes.data ?? []).map(q => q.id);
   const count = async (table: 'growth_prize_secrets' | 'shop_quiz_codes', col: 'prize_id' | 'quiz_id', ids: string[], awarded: boolean) => {
    if (!ids.length) return 0;
    let q = db.from(table).select('id', { count: 'exact', head: true }).in(col, ids);
    q = awarded ? q.not('awarded_to', 'is', null) : q.is('awarded_to', null);
    return (await q).count ?? 0;
   };
   const vouchers = qIds.length ? (await db.from('shop_quiz_rewards').select('id', { count: 'exact', head: true }).in('quiz_id', qIds).eq('kind', 'voucher')).count ?? 0 : 0;
   return { id: c.id, title: c.title, status: c.status, budgetTon: Number(c.budget_ton), startsAt: c.starts_at, endsAt: c.ends_at,
    delivered: await count('growth_prize_secrets', 'prize_id', prizeIds, true) + await count('shop_quiz_codes', 'quiz_id', qIds, true),
    remaining: await count('growth_prize_secrets', 'prize_id', prizeIds, false) + await count('shop_quiz_codes', 'quiz_id', qIds, false),
    vouchers };
  }));
 });
