import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
const filters=z.object({shopId:z.string().uuid().optional(),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).refine(v=>v.from<=v.to,'Invalid date range');
export const getRevenue=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>filters.parse(i)).handler(async({data,context})=>{
 const {data:isAdmin,error:roleError}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
 if(roleError)throw new Error(roleError.message);
 let shopId=data.shopId;
 if(!isAdmin){const {data:shop,error}=await context.supabase.from('shops').select('id').eq('owner_id',context.userId).maybeSingle();if(error||!shop||(shopId&&shopId!==shop.id))throw new Error('Forbidden');shopId=shop.id;}
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 const {summarizeRevenue}=await import('@/lib/revenue');
 let shopsQuery=db.from('shops').select('id,name').order('name');
 if(!isAdmin && shopId)shopsQuery=shopsQuery.eq('id',shopId);
 const {data:shops,error:shopError}=await shopsQuery;if(shopError)throw new Error(shopError.message);
 const orders=[];
 for(let offset=0;;offset+=500){let q=db.from('orders').select('id,shop_id,paid_at,pay_method,currency,total_amount,commission_amount,affiliate_percent,affiliate_user_id,escrow_status,stars_amount,settled_amount,settled_currency,settled_fee,settled_affiliate,settled_net').gte('paid_at',`${data.from}T00:00:00+07:00`).lte('paid_at',`${data.to}T23:59:59.999999+07:00`).order('id').range(offset,offset+499);if(shopId)q=q.eq('shop_id',shopId);const {data:page,error}=await q;if(error)throw new Error(error.message);orders.push(...(page??[]));if(!page||page.length<500)break;}
 return {rows:summarizeRevenue(orders),shops:shops??[]};
});
export const getStarsSettlementQueue=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {data:admin}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(!admin)throw new Error('Forbidden');
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const orders=[];
 for(let offset=0;;offset+=500){const {data,error}=await db.from('orders').select('id,order_number,stars_amount,paid_at,shops(name)').eq('pay_method','stars').is('stars_settlement_id',null).in('escrow_status',['holding','frozen','released']).order('id').range(offset,offset+499);if(error)throw new Error(error.message);orders.push(...(data??[]));if(!data||data.length<500)break;}
 const {data:history,error}=await db.from('stars_settlements').select('*').order('created_at',{ascending:false}).limit(50);if(error)throw new Error(error.message);return {orders,history:history??[]};
});
export const confirmStarsSettlement=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({orderIds:z.array(z.string().uuid()).min(1).max(500),amount:z.number().positive().max(1e10).refine(v=>Math.abs(v*1e6-Math.round(v*1e6))<0.001,'Maximum 6 decimals'),currency:z.enum(['USDT','TON']),reference:z.string().trim().min(6).max(200)}).parse(i)).handler(async({data,context})=>{
 const {data:admin}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(!admin)throw new Error('Forbidden');const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const {data:id,error}=await db.rpc('settle_stars_orders',{_actor:context.userId,_orders:data.orderIds,_amount:data.amount,_currency:data.currency,_reference:data.reference});if(error)throw new Error(error.message);return {id};
});