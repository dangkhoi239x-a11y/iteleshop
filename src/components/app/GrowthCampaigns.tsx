import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Gift, Share2, Copy, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, errMsg } from '@/components/app/ui-bits';
import { getGrowth, joinGrowth, spinGrowth,playQuiz,resendGrowthPrize } from '@/functions/growth.functions';
import { useAuth } from '@/lib/auth';
import { growthLink, prizeChance } from '@/lib/growth';
import { useGrowthText } from '@/lib/growth-text';
import { shareLink } from '@/lib/telegram';
import { shortDate } from '@/lib/format';
import { PrizeWheel } from './PrizeWheel';

export function GrowthCampaigns({campaignId}:{campaignId?:string}){
 const t=useGrowthText();const {userId,profile}=useAuth();const qc=useQueryClient();
 const get=useServerFn(getGrowth),join=useServerFn(joinGrowth),spin=useServerFn(spinGrowth);
 const quiz=useServerFn(playQuiz),resend=useServerFn(resendGrowthPrize);
 const query=useQuery({queryKey:['growth',userId],queryFn:()=>get({data:{manage:false}}),enabled:!!userId});
 const [busy,setBusy]=useState(false),[rotation,setRotation]=useState(0),[result,setResult]=useState<{label:string;content:string}|null>(null);
 const [request,setRequest]=useState<string|null>(null);
 const c=query.data?.campaigns.find(x=>x.id===campaignId);
 const refresh=()=>qc.invalidateQueries({queryKey:['growth']});
 const action=async(fn:()=>Promise<unknown>)=>{setBusy(true);try{await fn();await refresh()}catch(e){toast.error(errMsg(e))}finally{setBusy(false)}};
 const play=async()=>{
  if(!c)return;setBusy(true);setResult(null);const requestId=request??crypto.randomUUID();setRequest(requestId);
  try{const win=await spin({data:{id:c.id,requestId}});const index=c.prizes.findIndex(p=>p.id===win.prize_id);const target=360-(index+.5)*360/c.prizes.length;
   setRotation(r=>Math.ceil(r/360)*360+1080+target);
   await new Promise(resolve=>setTimeout(resolve,2100));setResult({label:win.growth_prizes?.label??t.winner,content:win.delivered_content});setRequest(null);await refresh();
  }catch(e){toast.error(errMsg(e))}finally{setBusy(false)}
 };
 if(query.isPending)return <EmptyState title={t.loading}/>;
 if(query.isError)return <EmptyState title={errMsg(query.error)} action={<Button onClick={()=>query.refetch()}>{t.retry}</Button>}/>;
 if(campaignId&&!c)return <EmptyState title={t.empty}/>;
 const history=(query.data?.history??[]).filter(h=>!campaignId||h.campaign_id===campaignId);
 const total=c?.prizes.reduce((s,p)=>s+p.remaining,0)??0;
 const open=c&&Date.parse(c.starts_at)<=Date.now()&&Date.parse(c.ends_at)>Date.now();
 return <div><PageHeader title={c?.title??t.title}/><div className="p-4 space-y-6">
  {!c&&<div className="space-y-3">{query.data?.campaigns.length?query.data.campaigns.map(x=><Link to="/growth/$campaignId" params={{campaignId:x.id}} key={x.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"><Gift className="text-accent size-7 shrink-0"/><div className="min-w-0"><h2 className="font-semibold break-words">{x.title}</h2><p className="text-sm text-muted-foreground">{x.shops?.name} · {t.free}</p><p className="text-xs text-muted-foreground">{shortDate(x.ends_at)}</p></div></Link>):<EmptyState icon={Gift} title={t.empty}/>}</div>}
  {c&&<>
   <div className="flex justify-between text-sm gap-2"><span className="text-accent">{t.free}</span><span>{t.remaining}: {total}</span></div>
   <PrizeWheel prizes={c.prizes} rotation={rotation}/>
   <div className="grid grid-cols-2 gap-2 text-sm">{c.prizes.map((p,i)=><div key={p.id} className="border-b border-border py-2"><span className="font-semibold">{i+1}. {p.label}</span><p className="text-xs text-muted-foreground">{p.remaining} · {prizeChance(p.remaining,total).toFixed(1)}%</p></div>)}</div>
   <p className="text-xs text-muted-foreground">{t.odds}</p>
   {result&&<div role="status" className="border-l-4 border-accent bg-accent/10 p-4 space-y-2"><p className="text-accent font-semibold">{t.received}: {result.label}</p><p className="font-mono text-sm break-all whitespace-pre-wrap">{result.content}</p><Button variant="outline" size="sm" onClick={()=>navigator.clipboard.writeText(result.content).then(()=>toast.success(t.copied))}><Copy/>{t.copy}</Button></div>}
   {!open?<p className="text-warning">{t.ended}</p>:!/^\d+$/.test(profile?.telegram_id??'')?<p className="text-warning">{t.telegram}</p>:!c.own?<Button className="w-full" disabled={busy||total===0} onClick={()=>action(()=>join({data:{id:c.id}}))}><Gift/>{t.join}</Button>:<>
    <div className="flex items-center justify-between"><span>{t.entries}: <strong>{c.own.entries-c.own.used_entries}</strong></span><Button disabled={busy||!total||c.own.entries<=c.own.used_entries} onClick={play}><RotateCw className={busy?'animate-spin':''}/>{t.spin}</Button></div>
    <div className="border-t border-border pt-4 space-y-3"><h2 className="font-semibold">{t.invite}</h2><p className="text-sm text-muted-foreground">{t.guide}</p><p className="text-xs break-all font-mono">{growthLink(c.own.invite_code)}</p><div className="flex gap-2"><Button variant="outline" onClick={()=>shareLink(growthLink(c.own?.invite_code??''),c.title)}><Share2/>{t.invite}</Button><Button variant="outline" onClick={()=>navigator.clipboard.writeText(growthLink(c.own?.invite_code??'')).then(()=>toast.success(t.copied))}><Copy/>{t.copy}</Button></div></div>
   </>}
   <section className="space-y-2 border-t border-border pt-4"><h2 className="font-semibold">{t.rules}</h2><p className="text-sm whitespace-pre-wrap break-words">{c.rules}</p><p className="text-xs text-muted-foreground">{shortDate(c.starts_at)} → {shortDate(c.ends_at)} · {t.max}: {c.max_entries} · {t.bonus}: {c.referral_entries}</p></section>
   <p className="text-xs text-muted-foreground">{c.fee_terms} · Hạn nhận: {shortDate(c.claim_until??c.ends_at)}</p>
   <section className="space-y-3"><h2 className="font-semibold">Quiz · Điểm shop: {query.data?.points.filter(p=>p.shop_id===c.shop_id).reduce((s,p)=>s+p.amount,0)??0}</h2>{query.data?.quizzes.filter(q=>q.campaign_id===c.id).map(q=><div className="border-t border-border pt-3 space-y-2" key={q.id}><h3 className="font-semibold">{q.title}</h3><p className="text-sm">{q.question}</p><p className="text-xs text-accent">+{q.points} điểm · +{q.entries} lượt quay</p>{(q.options as string[]).map((answer,i)=><Button key={i} variant="outline" className="w-full h-auto whitespace-normal text-left justify-start" disabled={busy||!c.own||!!query.data?.points.some(p=>p.quiz_id===q.id)} onClick={()=>action(()=>quiz({data:{id:q.id,answer:i}}))}>{answer}</Button>)}</div>)}</section>
  </>}
  {!!history.length&&<section className="space-y-2"><h2 className="font-semibold">{t.history}</h2>{history.map(h=><div key={h.id} className="border-b border-border py-3 space-y-2"><p className="text-sm font-semibold">{h.growth_prizes?.label} · {shortDate(h.created_at)}</p><p className="text-sm font-mono break-all whitespace-pre-wrap">{h.delivered_content}</p><p className="text-xs text-muted-foreground">Telegram: {h.telegram_state}</p>{['pending','failed'].includes(h.telegram_state)&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>action(()=>resend({data:{id:h.id}}))}>Gửi quà Telegram</Button>}</div>)}</section>}
 </div></div>;
}