import { useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import { Field,errMsg } from './ui-bits';
import { useFinanceText } from './RevenueReport';
import { confirmStarsSettlement,getStarsSettlementQueue } from '@/functions/revenue.functions';
import { money,shortDate } from '@/lib/format';
export function StarsSettlement(){
 const text=useFinanceText(),qc=useQueryClient(),load=useServerFn(getStarsSettlementQueue),confirm=useServerFn(confirmStarsSettlement);
 const {data,error}=useQuery({queryKey:['starsSettlement'],queryFn:()=>load()});
 const [ids,setIds]=useState<string[]>([]),[amount,setAmount]=useState(''),[reference,setReference]=useState(''),[currency,setCurrency]=useState<'USDT'|'TON'>('TON'),[busy,setBusy]=useState(false);
 const stars=(data?.orders??[]).filter(o=>ids.includes(o.id)).reduce((s,o)=>s+(o.stars_amount??0),0);
 const submit=async()=>{if(!window.confirm(text.confirmPrompt))return;setBusy(true);try{await confirm({data:{orderIds:ids,amount:Number(amount),currency,reference}});setIds([]);setAmount('');setReference('');await qc.invalidateQueries();toast.success(text.success);}catch(e){toast.error(errMsg(e));}finally{setBusy(false);}};
 return <section className="space-y-4 border-t border-border pt-5"><h2 className="font-semibold">{text.settlement}</h2>{error&&<p role="alert" className="text-destructive">{error.message}</p>}<div className="max-h-72 space-y-2 overflow-y-auto">{data?.orders.map(o=><label key={o.id} className="flex items-center gap-3 border-b border-border py-3 text-sm"><Checkbox checked={ids.includes(o.id)} disabled={busy} onCheckedChange={checked=>setIds(v=>checked?[...v,o.id]:v.filter(id=>id!==o.id))}/><span className="min-w-0 flex-1 break-words">#{o.order_number} · {o.shops?.name}<span className="block text-xs text-muted-foreground">{shortDate(o.paid_at)}</span></span><strong>{o.stars_amount} ⭐</strong></label>)}{data?.orders.length===0&&<p className="text-sm text-muted-foreground">{text.empty}</p>}</div>
 <p className="text-sm">{text.selected}: <strong>{stars} ⭐</strong></p><div className="grid grid-cols-2 gap-3"><Field label={text.amount} hint={text.receipt}><Input aria-label={text.amount} type="number" min="0.000001" step="0.000001" value={amount} onChange={e=>setAmount(e.target.value)}/></Field><Field label="USDT / TON"><Select value={currency} onValueChange={v=>{if(v==='USDT'||v==='TON')setCurrency(v);}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="TON">TON</SelectItem><SelectItem value="USDT">USDT</SelectItem></SelectContent></Select></Field></div>
 <Field label={text.reference}><Input aria-label={text.reference} value={reference} onChange={e=>setReference(e.target.value)} maxLength={200}/></Field>{stars>0&&Number(amount)>0&&<p className="text-xs text-muted-foreground">{text.rate}: {(Number(amount)/stars).toFixed(8)} {currency}</p>}<Button onClick={submit} disabled={busy||ids.length===0||ids.length>500||!(Number(amount)>0)||reference.trim().length<6}>{text.confirm}</Button>
 <h3 className="pt-3 text-sm font-semibold">{text.history}</h3>{data?.history.map(h=><div key={h.id} className="border-b border-border py-3 text-sm"><p>{h.stars_amount} ⭐ → <strong>{money(h.received_amount,h.currency)}</strong></p><p className="break-all text-xs text-muted-foreground">{h.reference} · {shortDate(h.created_at)}</p></div>)}</section>;
}