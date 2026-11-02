import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import { Field } from './ui-bits';
import { getRevenue } from '@/functions/revenue.functions';
import { financeText } from '@/locales/finance';
import { revenueDay } from '@/lib/revenue';
import { money } from '@/lib/format';
export function useFinanceText(){const {i18n}=useTranslation();return financeText[i18n.language.slice(0,2) as keyof typeof financeText]??financeText.vi;}
export function RevenueReport({admin=false}:{admin?:boolean}){
 const text=useFinanceText(),fetchReport=useServerFn(getRevenue);
 const [from,setFrom]=useState(()=>revenueDay(new Date().toISOString()).slice(0,8)+'01'),[to,setTo]=useState(()=>revenueDay(new Date().toISOString()));
 const [shop,setShop]=useState('all'),[method,setMethod]=useState('all');
 const {data,isPending,error}=useQuery({queryKey:['revenue',from,to,shop],queryFn:()=>fetchReport({data:{from,to,...(shop==='all'?{}:{shopId:shop})}}),enabled:from<=to&&!!from&&!!to});
 const rows=(data?.rows??[]).filter(r=>method==='all'||r.method===method);
 const totals=rows.reduce<Record<string,{gross:number;net:number;held:number;released:number}>>((a,r)=>{const c=a[r.currency]??={gross:0,net:0,held:0,released:0};c.gross+=r.gross;c.net+=r.net;c.held+=r.held;c.released+=r.released;return a;},{});
 const name=(id:string)=>data?.shops.find(s=>s.id===id)?.name??id;
 const download=()=>{const headers=[text.day,text.shop,text.method,'Currency',text.orders,text.stars,text.pending,text.gross,text.fee,text.affiliate,text.net,text.held,text.released,text.refund];const csv=[headers,...rows.map(r=>[r.day,name(r.shopId),r.method,r.currency,r.orders,r.stars,r.pendingStars,r.gross,r.fee,r.affiliate,r.net,r.held,r.released,r.refunded])].map(r=>r.map(v=>'"'+String(v).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`TeleShop-revenue-${from}-${to}.csv`;a.click();URL.revokeObjectURL(url);};
 return <div className="space-y-5"><div className="grid grid-cols-2 gap-3">
 <Field label={text.from}><Input aria-label={text.from} type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></Field><Field label={text.to}><Input aria-label={text.to} type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></Field>
 {admin&&<Field label={text.shop}><Select value={shop} onValueChange={setShop}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">{text.all}</SelectItem>{data?.shops.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></Field>}
 <Field label={text.method}><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">{text.both}</SelectItem><SelectItem value="stars">Stars</SelectItem><SelectItem value="crypto">Crypto</SelectItem></SelectContent></Select></Field></div>
 {error&&<p role="alert" className="text-sm text-destructive">{error.message}</p>}
 {isPending?<p className="text-muted-foreground">…</p>:<><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{Object.entries(totals).filter(([c])=>c!=='XTR').map(([c,v])=><div key={c} className="space-y-2 border-l-2 border-primary pl-3"><h3 className="font-semibold">{c}</h3><p className="text-sm text-muted-foreground">{text.gross} <strong className="text-foreground">{money(v.gross,c)}</strong></p><p className="text-sm">{text.net}: {money(v.net,c)}</p><p className="text-xs text-muted-foreground">{text.held}: {money(v.held,c)} · {text.released}: {money(v.released,c)}</p></div>)}</div>
 <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{text.stars}: <strong>{rows.reduce((s,r)=>s+r.stars,0)} ⭐</strong><br/><span className="text-muted-foreground">{text.pending}: {rows.reduce((s,r)=>s+r.pendingStars,0)} ⭐</span></p><Button variant="outline" onClick={download} disabled={!rows.length}><Download/>{text.export}</Button></div>
 {!rows.length?<p className="py-6 text-center text-muted-foreground">{text.empty}</p>:<div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="border-b border-border text-muted-foreground"><tr>{[text.day,text.shop,text.method,text.orders,text.stars,text.gross,text.fee,text.affiliate,text.net,text.held,text.released,text.refund].map(h=><th key={h} className="px-2 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={[r.day,r.shopId,r.method,r.currency].join('|')} className="border-b border-border"><td className="px-2 py-3">{r.day}</td><td className="px-2">{name(r.shopId)}</td><td className="px-2">{r.method==='stars'?'Stars':'Crypto'} · {r.currency==='XTR'?text.unsettled:r.currency}</td><td className="px-2">{r.orders}</td><td className="px-2">{r.stars}</td>{[r.gross,r.fee,r.affiliate,r.net,r.held,r.released,r.refunded].map((v,i)=><td key={i} className="px-2 tabular-nums">{r.currency==='XTR'?'—':money(v,r.currency)}</td>)}</tr>)}</tbody></table></div>}</>}
 </div>;
}