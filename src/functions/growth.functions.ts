import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {checked,readAll} from '@/lib/data-result';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { campaignSchema } from '@/lib/growth';
import { quizSchema } from '@/lib/product-referral';

export const getGrowth = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
 .inputValidator((i: unknown) => z.object({ shopId: z.string().uuid().optional(), manage: z.boolean().default(false), campaignId:z.string().uuid().optional() }).parse(i))
 .handler(async ({ data, context }) => {
  const role=checked(await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}));
  const ownShop=checked(await context.supabase.from('shops').select('id').eq('owner_id',context.userId).maybeSingle());
  let q=context.supabase.from('growth_campaigns').select('*,shops(name),growth_prizes(*)').order('created_at',{ascending:false}).order('id');
  if(data.shopId) q=q.eq('shop_id',data.shopId);
  if(data.campaignId) q=q.eq('id',data.campaignId);
  if(!data.manage)q=q.eq('status','active');
  else if(!role){if(!ownShop)throw new Error('Forbidden');q=q.eq('shop_id',ownShop.id);}
  const rows=checked(await q)??[];
  const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
  const ids=rows.map(c=>c.id);
  const own=ids.length?checked(await context.supabase.from('growth_members').select('*').eq('user_id',context.userId).in('campaign_id',ids))??[]:[];
  const campaigns=await Promise.all(rows.map(async c=>{
   const manager=!!role||ownShop?.id===c.shop_id;
   const counts=await Promise.all(c.growth_prizes.map(async p=>{const count=await db.from('growth_prize_secrets').select('id',{count:'exact',head:true}).eq('prize_id',p.id).is('awarded_to',null);checked(count);return {...p,remaining:count.count??0};}));
   const members=manager?await readAll((a,b)=>db.from('growth_members').select('referrer_id,used_entries').eq('campaign_id',c.id).order('user_id').range(a,b)):[];
   const events=manager?checked(await context.supabase.from('growth_events').select('id,event,created_at').eq('campaign_id',c.id).order('created_at',{ascending:false}).limit(30))??[]:[];
   return {...c,prizes:counts.sort((a,b)=>a.position-b.position),own:own.find(m=>m.campaign_id===c.id)??null,stats:manager?{users:members.length,referrals:members.filter(m=>m.referrer_id).length,spins:members.reduce((n,m)=>n+m.used_entries,0)}:null,events};
  }));
  let historyQuery=context.supabase.from('growth_spins').select('*,growth_prizes(label)').eq('user_id',context.userId).order('created_at',{ascending:false}).limit(50);
  let quizQuery=context.supabase.from('shop_quizzes').select('*');
  if(data.campaignId){historyQuery=historyQuery.eq('campaign_id',data.campaignId);quizQuery=quizQuery.eq('campaign_id',data.campaignId);}
  const [history,quizzes,points,rewards]=await Promise.all([historyQuery,quizQuery,context.supabase.from('shop_points').select('*').eq('user_id',context.userId),context.supabase.from('shop_quiz_rewards').select('*,shop_quizzes(title),shops(name)').eq('user_id',context.userId).order('created_at',{ascending:false}).limit(50)]);
  return {campaigns,history:checked(history)??[],quizzes:checked(quizzes)??[],points:checked(points)??[],rewards:checked(rewards)??[]};
 });
export const createGrowth = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>campaignSchema.parse(i)).handler(async({data,context})=>{
 const {data:shop} = await context.supabase.from('shops').select('owner_id').eq('id',data.shopId).maybeSingle();
 const {data:isAdmin} = await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
 if(shop?.owner_id!==context.userId && !isAdmin) throw new Error('Forbidden');
 const {supabaseAdmin:db} = await import('@/integrations/supabase/client.server');
 const r=await db.rpc('create_growth_campaign',{_actor:context.userId,_shop:data.shopId,_title:data.title,_rules:data.rules,_starts:data.startsAt,_ends:data.endsAt,_max:data.maxEntries,_bonus:data.referralEntries,_prizes:data.prizes});
 if(r.error) throw new Error(r.error.message); return r.data;
});
export const setGrowthStatus = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({id:z.string().uuid(),status:z.enum(['active','paused'])}).parse(i)).handler(async({data,context})=>{
 const {supabaseAdmin:db} = await import('@/integrations/supabase/client.server');
 const r=await db.rpc('set_growth_status',{_actor:context.userId,_campaign:data.id,_status:data.status}); if(r.error) throw new Error(r.error.message); return {ok:true};
});
export const joinGrowth = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({id:z.string().uuid()}).parse(i)).handler(async({data,context})=>{
 const {supabaseAdmin:db} = await import('@/integrations/supabase/client.server');
 const r=await db.rpc('join_growth_campaign',{_user:context.userId,_campaign:data.id}); if(r.error) throw new Error(r.error.message); return {ok:true};
});
export const spinGrowth = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({id:z.string().uuid(),requestId:z.string().uuid()}).parse(i)).handler(async({data,context})=>{
 const {supabaseAdmin:db} = await import('@/integrations/supabase/client.server');
 const random=crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
 const r=await db.rpc('spin_growth_campaign',{_user:context.userId,_campaign:data.id,_request:data.requestId,_random:random/4294967296}); if(r.error) throw new Error(r.error.message);
 const prize=await context.supabase.from('growth_spins').select('*,growth_prizes(label)').eq('id',r.data).single(); if(prize.error) throw new Error(prize.error.message);
 const {deliverGrowthPrize}=await import('@/server/growth-delivery.server');await deliverGrowthPrize(prize.data.id,context.userId);
 return prize.data;
});
export const resendGrowthPrize=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({id:z.string().uuid(),quiz:z.boolean().optional()}).parse(v)).handler(async({data,context})=>{const m=await import('@/server/growth-delivery.server');if(data.quiz)await m.deliverQuizReward(data.id,context.userId);else await m.deliverGrowthPrize(data.id,context.userId);return {ok:true};});
export const createQuiz=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>quizSchema.parse(v)).handler(async({data,context})=>{
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const r=await db.rpc('create_shop_quiz',{_actor:context.userId,_campaign:data.campaignId,_title:data.title,_question:data.question,_options:data.options,_correct:data.correct,_points:data.points,_entries:data.entries});if(r.error)throw new Error(r.error.message);const cfg=await db.rpc('configure_quiz_reward',{_actor:context.userId,_quiz:r.data,_kind:data.rewardKind,_voucher:data.voucherCode??'',_codes:data.codes});if(cfg.error)throw new Error(cfg.error.message);return r.data;
});
export const playQuiz=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({id:z.string().uuid(),answer:z.number().int().min(0).max(3)}).parse(v)).handler(async({data,context})=>{const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const r=await db.rpc('play_shop_quiz_reward',{_user:context.userId,_quiz:data.id,_answer:data.answer});if(r.error)throw new Error(r.error.message);const out=r.data as {id:string;kind:string;points:number;entries:number;content:string|null};if(out.content){const {deliverQuizReward}=await import('@/server/growth-delivery.server');await deliverQuizReward(out.id,context.userId);}return out;});
export const configureGrowth=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({id:z.string().uuid(),budget:z.number().nonnegative().max(1e6),claim:z.string().datetime(),fees:z.string().trim().min(10).max(1000)}).parse(v)).handler(async({data,context})=>{const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const r=await db.rpc('configure_growth_terms',{_actor:context.userId,_campaign:data.id,_budget:data.budget,_claim:data.claim,_fees:data.fees});if(r.error)throw new Error(r.error.message);return {ok:true};});