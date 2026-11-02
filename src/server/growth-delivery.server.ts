import { escapeHtml,sendTelegramMessage } from './telegram.server';
export async function deliverGrowthPrize(spinId:string,userId:string){
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 const lock=await db.from('growth_spins').update({telegram_state:'sending'}).eq('id',spinId).eq('user_id',userId).in('telegram_state',['pending','failed']).select('delivered_content,growth_prizes(label)').maybeSingle();
 if(lock.error)throw new Error(lock.error.message);if(!lock.data)return;
 const {data:p}=await db.from('profiles').select('telegram_id').eq('id',userId).single();
 const sent=await sendTelegramMessage(process.env['TELEGRAM_BOT_TOKEN'],p?.telegram_id,`🎁 ${escapeHtml(lock.data.growth_prizes?.label??'Quà TeleShop')}\n<code>${escapeHtml(lock.data.delivered_content)}</code>`,{event:'growth_prize'});
 await db.from('growth_spins').update({telegram_state:sent?'sent':'failed'}).eq('id',spinId).eq('user_id',userId);
}