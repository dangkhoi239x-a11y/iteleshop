import { escapeHtml,sendTelegramMessage } from './telegram.server';
export async function deliverGrowthPrize(spinId:string,userId:string){
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 const lock=await db.from('growth_spins').update({telegram_state:'sending'}).eq('id',spinId).eq('user_id',userId).in('telegram_state',['pending','failed']).select('delivered_content,growth_prizes(label)').maybeSingle();
 if(lock.error)throw new Error(lock.error.message);if(!lock.data)return;
 const {data:p}=await db.from('profiles').select('telegram_id').eq('id',userId).single();
 const sent=await sendTelegramMessage(process.env['TELEGRAM_BOT_TOKEN'],p?.telegram_id,`🎁 ${escapeHtml(lock.data.growth_prizes?.label??'Quà TeleShop')}\n<code>${escapeHtml(lock.data.delivered_content)}</code>`,{event:'growth_prize'});
 await db.from('growth_spins').update({telegram_state:sent?'sent':'failed'}).eq('id',spinId).eq('user_id',userId);
}export async function deliverQuizReward(rewardId:string,userId:string){
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 const lock=await db.from('shop_quiz_rewards').update({telegram_state:'sending'}).eq('id',rewardId).eq('user_id',userId).in('telegram_state',['pending','failed']).select('kind,delivered_content,shop_quizzes(title),shops(name)').maybeSingle();
 if(lock.error)throw new Error(lock.error.message);if(!lock.data?.delivered_content)return;
 const {data:p}=await db.from('profiles').select('telegram_id').eq('id',userId).single();
 const label=lock.data.kind==='voucher'?'Voucher':'Mã quà';
 const sent=await sendTelegramMessage(process.env['TELEGRAM_BOT_TOKEN'],p?.telegram_id,`🎮 ${escapeHtml(lock.data.shop_quizzes?.title??'Minigame')} · ${escapeHtml(lock.data.shops?.name??'TeleShop')}\n${label}: <code>${escapeHtml(lock.data.delivered_content)}</code>`,{event:'growth_prize'});
 await db.from('shop_quiz_rewards').update({telegram_state:sent?'sent':'failed'}).eq('id',rewardId).eq('user_id',userId);
}
