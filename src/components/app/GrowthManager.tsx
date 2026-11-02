import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Plus, Trash2, Gift, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, EmptyState, errMsg } from './ui-bits';
import { getGrowth, createGrowth, setGrowthStatus } from '@/functions/growth.functions';
import { useGrowthText } from '@/lib/growth-text';
import { useAuth } from '@/lib/auth';
import { campaignSchema } from '@/lib/growth';
import { shortDate } from '@/lib/format';

export function GrowthManager({shopId}:{shopId?:string}){
 const t=useGrowthText();const {userId,isAdmin}=useAuth();const qc=useQueryClient();
 const get=useServerFn(getGrowth),create=useServerFn(createGrowth),status=useServerFn(setGrowthStatus);
 const q=useQuery({queryKey:['growth',userId,'manage',shopId],queryFn:()=>get({data:{manage:true,shopId}})});
 const [busy,setBusy]=useState(false);
 const [form,setForm]=useState({title:'',rules:'',starts:'',ends:'',max:'5',bonus:'1'});
 const [prizes,setPrizes]=useState([{label:'',codes:''},{label:'',codes:''}]);
 const act=async(fn:()=>Promise<unknown>)=>{setBusy(true);try{await fn();toast.success(t.created);await qc.invalidateQueries({queryKey:['growth']})}catch(e){toast.error(errMsg(e))}finally{setBusy(false)}};
 const save=()=>act(async()=>{
  const data=campaignSchema.parse({shopId,title:form.title,rules:form.rules,startsAt:new Date(form.starts).toISOString(),endsAt:new Date(form.ends).toISOString(),maxEntries:Number(form.max),referralEntries:Number(form.bonus),prizes:prizes.map(p=>({label:p.label,codes:p.codes.split('\n').map(s=>s.trim()).filter(Boolean)}))});
  await create({data});setForm({...form,title:'',rules:''});setPrizes([{label:'',codes:''},{label:'',codes:''}]);
 });
 return <div className="space-y-6">
  <section className="flex gap-3 border-b border-border pb-4"><LockKeyhole className="size-5 shrink-0 text-warning"/><div><h2 className="font-semibold">{t.pool}</h2><p className="text-sm text-muted-foreground">{t.blocked}</p></div></section>
  {shopId&&<section className="space-y-4"><h2 className="font-semibold">{t.new}</h2><p className="text-xs text-muted-foreground">{t.createHint}</p>
   <Field label={t.name}><Input maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></Field>
   <Field label={t.rules}><Textarea maxLength={4000} value={form.rules} onChange={e=>setForm({...form,rules:e.target.value})}/></Field>
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label={t.start}><Input type="datetime-local" value={form.starts} onChange={e=>setForm({...form,starts:e.target.value})}/></Field><Field label={t.end}><Input type="datetime-local" value={form.ends} onChange={e=>setForm({...form,ends:e.target.value})}/></Field><Field label={t.max}><Input type="number" min={1} max={100} value={form.max} onChange={e=>setForm({...form,max:e.target.value})}/></Field><Field label={t.bonus}><Input type="number" min={1} max={10} value={form.bonus} onChange={e=>setForm({...form,bonus:e.target.value})}/></Field></div>
   {prizes.map((p,i)=><div key={i} className="space-y-3 border-t border-border pt-3"><div className="flex items-end gap-2"><div className="flex-1"><Field label={`${i+1}. ${t.prize}`}><Input value={p.label} maxLength={100} onChange={e=>setPrizes(prizes.map((x,n)=>n===i?{...x,label:e.target.value}:x))}/></Field></div><Button variant="ghost" size="icon" aria-label={t.delete} disabled={prizes.length<=2} onClick={()=>setPrizes(prizes.filter((_,n)=>n!==i))}><Trash2/></Button></div><Field label={t.codes}><Textarea value={p.codes} onChange={e=>setPrizes(prizes.map((x,n)=>n===i?{...x,codes:e.target.value}:x))}/></Field></div>)}
   <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={prizes.length>=8} onClick={()=>setPrizes([...prizes,{label:'',codes:''}])}><Plus/>{t.add}</Button><Button disabled={busy||!form.title||!form.rules||!form.starts||!form.ends} onClick={save}><Gift/>{t.save}</Button></div>
  </section>}
  <section className="space-y-3"><h2 className="font-semibold">{t.manage}</h2>
   {q.isPending?<p>{t.loading}</p>:q.isError?<EmptyState title={errMsg(q.error)} action={<Button onClick={()=>q.refetch()}>{t.retry}</Button>}/>:!q.data?.campaigns.length?<EmptyState title={t.empty}/>:q.data.campaigns.map(c=><article key={c.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
    <div className="flex justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold break-words">{c.title}</h3><p className="text-xs text-muted-foreground">{c.shops?.name} · {shortDate(c.ends_at)}</p></div><span className="text-xs text-warning">{t[c.status as 'active'|'paused'|'pending']}</span></div>
    <div className="grid grid-cols-3 gap-2 text-xs">{[[t.users,c.stats?.users??0],[t.referrals,c.stats?.referrals??0],[t.spins,c.stats?.spins??0]].map(([label,n])=><div key={label}><p className="text-muted-foreground">{label}</p><p className="font-semibold text-lg">{n}</p></div>)}</div>
    <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{c.rules}</p>
    <div className="text-sm">{c.prizes.map(p=><p key={p.id}>{p.label}: {p.remaining}</p>)}</div>
    <div className="flex flex-wrap gap-2">{isAdmin&&c.status!=='active'&&<Button size="sm" disabled={busy} onClick={()=>act(()=>status({data:{id:c.id,status:'active'}}))}>{t.approve}</Button>}{c.status==='active'&&<><Button size="sm" variant="outline" disabled={busy} onClick={()=>act(()=>status({data:{id:c.id,status:'paused'}}))}>{t.pause}</Button><Button asChild size="sm" variant="outline"><Link to="/growth/$campaignId" params={{campaignId:c.id}}>{t.open}</Link></Button></>}</div>
    <details><summary className="text-xs cursor-pointer">{t.events}</summary>{c.events.map(e=><p key={e.id} className="text-xs text-muted-foreground mt-2">{shortDate(e.created_at)} · {e.event}</p>)}</details>
   </article>)}
  </section>
 </div>;
}