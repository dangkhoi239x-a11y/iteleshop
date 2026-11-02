import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export const saveWithdrawalPolicy=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({currency:z.enum(['USDT','TON']),fee_mode:z.enum(['network','percentage','fixed']),fee_value:z.number().min(0).max(100),minimum:z.number().positive()}).parse(v)).handler(async({data,context})=>{
 const {data:admin}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(!admin)throw new Error('Forbidden');
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 const {error}=await db.from('withdrawal_policies').upsert({...data,enabled:false,updated_at:new Date().toISOString()});if(error)throw new Error(error.message);return {ok:true};
});