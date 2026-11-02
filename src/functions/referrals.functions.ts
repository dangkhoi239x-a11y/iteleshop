import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { productReferralLink } from '@/lib/product-referral';
export const createProductReferral=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({productId:z.string().uuid()}).parse(v)).handler(async({data,context})=>{
 const {data:affiliate}=await context.supabase.from('affiliates').select('status').eq('user_id',context.userId).maybeSingle();
 const {data:product}=await context.supabase.from('products').select('id,shops(owner_id,affiliate_percent)').eq('id',data.productId).eq('status','active').maybeSingle();
 if(affiliate?.status!=='active')throw new Error('Join the affiliate program first');
 if(!product||product.shops?.owner_id===context.userId)throw new Error('Product referral unavailable');
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 const r=await db.from('product_referrals').upsert({product_id:product.id,affiliate_user_id:context.userId},{onConflict:'product_id,affiliate_user_id'}).select('id').single();if(r.error)throw new Error(r.error.message);
 return {url:productReferralLink(r.data.id),percent:Number(product.shops?.affiliate_percent??0)};
});
export const captureProductReferral=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({initData:z.string().min(1).max(4096)}).parse(v)).handler(async({data,context})=>{
 const {validateInitData}=await import('@/server/telegram.server');const {parseProductRef}=await import('@/lib/product-referral');
 const token=process.env['TELEGRAM_BOT_TOKEN'];if(!token)throw new Error('Telegram unavailable');
 const verified=await validateInitData(data.initData,token);if(!verified)throw new Error('Invalid Telegram session');
 const {data:profile}=await context.supabase.from('profiles').select('telegram_id').eq('id',context.userId).single();if(profile?.telegram_id!==String(verified.user.id))throw new Error('Telegram identity mismatch');
 const id=parseProductRef(verified.startParam);if(!id)return {productId:null};
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const r=await db.rpc('bind_product_referral',{_buyer:context.userId,_referral:id});if(r.error)throw new Error(r.error.message);return {productId:r.data};
});
export const getReferralReport=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({shopId:z.string().uuid().optional(),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).refine(v=>v.from<=v.to).parse(v)).handler(async({data,context})=>{
 const {data:admin}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
 const {data:own}=await context.supabase.from('shops').select('id').eq('owner_id',context.userId).maybeSingle();
 if(!admin&&(!own||(data.shopId&&data.shopId!==own.id)))throw new Error('Forbidden');const shopId=admin?data.shopId:own?.id;
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const {summarizeReferralCosts}=await import('@/lib/referral-report');const rows=[];
 for(let offset=0;;offset+=500){let q=db.from('orders').select('*').not('affiliate_user_id','is',null).gte('paid_at',`${data.from}T00:00:00+07:00`).lte('paid_at',`${data.to}T23:59:59.999999+07:00`).order('id').range(offset,offset+499);if(shopId)q=q.eq('shop_id',shopId);const r=await q;if(r.error)throw new Error(r.error.message);rows.push(...(r.data??[]));if(!r.data||r.data.length<500)break;}
 let shops=db.from('shops').select('id,name');if(shopId)shops=shops.eq('id',shopId);const s=await shops;
 return {rows:summarizeReferralCosts(rows),shops:s.data??[]};
});