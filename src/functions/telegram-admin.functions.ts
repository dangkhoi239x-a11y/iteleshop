import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export const telegramAdmin = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({action:z.enum(['read','save','test']),id:z.string().uuid().optional(),name:z.string().trim().min(2).max(100).optional(),chatId:z.string().regex(/^-?\d+$/).optional(),enabled:z.boolean().optional()}).parse(v)).handler(async({data,context})=>{
 const {data:allowed}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
 if(!allowed)throw new Error('Forbidden');
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 if(data.action==='save'){
  if(!data.name||!data.chatId)throw new Error('Name and chat ID required');
  const {error}=await db.from('telegram_channels').upsert({...(data.id?{id:data.id}:{}),name:data.name,chat_id:data.chatId,enabled:data.enabled??true},{onConflict:'chat_id'});if(error)throw new Error(error.message);
 }
 if(data.action==='test'){
  if(!data.id)throw new Error('Channel required');
  const {data:channel}=await db.from('telegram_channels').select('chat_id').eq('id',data.id).eq('enabled',true).single();if(!channel)throw new Error('Channel unavailable');
  const {sendTelegramMessage}=await import('@/server/telegram.server');
  const sent=await sendTelegramMessage(process.env['TELEGRAM_BOT_TOKEN'],channel.chat_id,'✅ TeleShop: kết nối thông báo thành công.');if(!sent)throw new Error('Telegram chưa gửi được; kiểm tra quyền bot trong kênh');
 }
 const [channels,logs]=await Promise.all([db.from('telegram_channels').select('*').order('created_at'),db.from('telegram_delivery_logs').select('*').order('created_at',{ascending:false}).limit(100)]);
 if(channels.error||logs.error)throw new Error('Unable to load Telegram history');
 return {channels:channels.data??[],logs:logs.data??[]};
});