import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { Download, RefreshCw, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field } from './ui-bits';
import { ProductRevenueReport } from './ProductRevenueReport';
import { getRevenue } from '@/functions/revenue.functions';
import { financeText } from '@/locales/finance';
import { revenueText } from '@/locales/revenue';
import { filterRevenue, revenueDay, type RevenueFilters } from '@/lib/revenue';
import { money } from '@/lib/format';
import { useAuth } from '@/lib/auth';
export function useFinanceText() { const { i18n } = useTranslation(); return financeText[i18n.language.slice(0, 2) as keyof typeof financeText] ?? financeText.vi; }
export function useRevenueText() { const { i18n } = useTranslation(); return revenueText[i18n.language.slice(0, 2) as keyof typeof revenueText] ?? revenueText.vi; }
export function RevenueReport({ admin = false }: { admin?: boolean }) {
 const text = useFinanceText(), labels = useRevenueText(), fetchReport = useServerFn(getRevenue);
 const { userId } = useAuth();
 const [from, setFrom] = useState(() => revenueDay(new Date().toISOString()).slice(0, 8) + '01');
 const [to, setTo] = useState(() => revenueDay(new Date().toISOString()));
 const [shop, setShop] = useState('all');
 const [method, setMethod] = useState<RevenueFilters['method']>('all');
 const [currency, setCurrency] = useState<RevenueFilters['currency']>('all');
 const valid = !!from && !!to && from <= to;
 const { data, isPending, isFetching, isError, refetch, dataUpdatedAt } = useQuery({ queryKey: ['revenue', userId, admin, from, to, shop], queryFn: () => fetchReport({ data: { from, to, ...(shop === 'all' ? {} : { shopId: shop }) } }), enabled: valid && !!userId });
 const rows = filterRevenue(data?.rows ?? [], { method, currency });
 const totals = rows.reduce<Record<string, { gross: number; fee: number; affiliate: number; net: number; held: number; released: number; refunded: number }>>((a, r) => {
  const c = a[r.currency] ??= { gross: 0, fee: 0, affiliate: 0, net: 0, held: 0, released: 0, refunded: 0 };
  c.gross += r.gross; c.fee += r.fee; c.affiliate += r.affiliate; c.net += r.net; c.held += r.held; c.released += r.released; c.refunded += r.refunded; return a;
 }, {});
 const name = (id: string) => data?.shops.find(s => s.id === id)?.name ?? id;
 const download = () => {
  const headers = [text.day, text.shop, text.method, labels.currency, text.orders, text.stars, text.pending, text.gross, text.fee, text.affiliate, text.net, text.held, text.released, text.refund];
  const csv = [headers, ...rows.map(r => [r.day, name(r.shopId), r.method, r.currency, r.orders, r.stars, r.pendingStars, r.gross, r.fee, r.affiliate, r.net, r.held, r.released, r.refunded])].map(r => r.map(v => '"' + String(v).replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"').join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `TeleShop-revenue-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url);
 };
 return <div className="space-y-6">
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
   <Field label={text.from}><Input aria-label={text.from} type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></Field>
   <Field label={text.to}><Input aria-label={text.to} type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></Field>
   {admin && <Field label={text.shop}><Select value={shop} onValueChange={setShop}><SelectTrigger aria-label={text.shop} className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{text.all}</SelectItem>{data?.shops.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></Field>}
   <Field label={text.method}><Select value={method} onValueChange={v => setMethod(v as RevenueFilters['method'])}><SelectTrigger aria-label={text.method} className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{text.both}</SelectItem><SelectItem value="stars">Stars</SelectItem><SelectItem value="crypto">Crypto</SelectItem></SelectContent></Select></Field>
   <Field label={labels.currency}><Select value={currency} onValueChange={v => setCurrency(v as RevenueFilters['currency'])}><SelectTrigger aria-label={labels.currency} className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{labels.allCurrency}</SelectItem><SelectItem value="USDT">USDT</SelectItem><SelectItem value="TON">TON</SelectItem><SelectItem value="XTR">{labels.pendingCurrency}</SelectItem></SelectContent></Select></Field>
  </div>
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
   <span className="text-xs text-muted-foreground">{dataUpdatedAt > 0 && `${labels.updated}: ${new Date(dataUpdatedAt).toLocaleTimeString()}`}</span>
   <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void refetch()} disabled={!valid || isFetching}><RefreshCw className={isFetching ? 'animate-spin motion-reduce:animate-none' : ''} />{labels.refresh}</Button><Button variant="outline" size="sm" onClick={download} disabled={!valid || isFetching || isError || !rows.length}><Download />{text.export}</Button></div>
  </div>
  {!valid ? <p role="alert" className="text-sm text-destructive">{labels.invalid}</p> : isError ? <div role="alert" className="space-y-3 py-6"><p className="text-destructive">{labels.failed}</p><Button variant="outline" onClick={() => void refetch()}>{labels.retry}</Button></div> : isPending ? <p role="status" className="py-8 text-muted-foreground">{labels.loading}</p> : <>
   <section aria-label={labels.summary} className="space-y-4">
    <h2 className="text-base font-semibold">{labels.summary}</h2>
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">{Object.entries(totals).filter(([c]) => c !== 'XTR').map(([c, v]) => <div key={c} className="space-y-3 border-l-2 border-primary pl-4">
     <h3 className="text-sm font-semibold text-primary">{c}</h3><div><p className="text-xs text-muted-foreground">{text.gross}</p><p className="break-words text-2xl font-semibold tabular-nums">{money(v.gross, c)}</p></div>
     <dl className="space-y-2 text-sm">{[[text.net,v.net],[text.fee,v.fee],[text.affiliate,v.affiliate],[text.held,v.held],[text.released,v.released],[text.refund,v.refunded]].map(([label, amount]) => <div key={String(label)} className="flex flex-wrap justify-between gap-x-3"><dt className="text-muted-foreground">{label}</dt><dd className="tabular-nums">{money(Number(amount), c)}</dd></div>)}</dl>
    </div>)}</div>
    <div className="flex flex-wrap gap-x-8 gap-y-4 border-y border-border py-4 text-sm">
     <div><p className="text-muted-foreground">{text.orders}</p><p className="text-xl font-semibold tabular-nums">{rows.reduce((s,r)=>s+r.orders,0)}</p></div>
     <div><p className="text-muted-foreground">{text.stars}</p><p className="flex items-center gap-1.5 text-xl font-semibold tabular-nums"><Star className="h-4 w-4 text-warning" />{rows.reduce((s,r)=>s+r.stars,0)}</p></div>
     <div><p className="text-muted-foreground">{text.pending}</p><p className="text-xl font-semibold tabular-nums text-warning">{rows.reduce((s,r)=>s+r.pendingStars,0)} ⭐</p></div>
    </div>
   </section>
   <section className="space-y-3"><h2 className="text-base font-semibold">{labels.details}</h2>
    {!rows.length ? <p className="py-8 text-center text-muted-foreground">{text.empty}</p> : <div className="overflow-x-auto" role="region" aria-label={labels.details} tabIndex={0}><table className="w-full min-w-[1200px] text-left text-xs"><thead className="border-b border-border text-muted-foreground"><tr>{[text.day,text.shop,text.method,labels.currency,text.orders,text.stars,text.pending,text.gross,text.fee,text.affiliate,text.net,text.held,text.released,text.refund].map(h=><th key={h} scope="col" className="px-2 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={[r.day,r.shopId,r.method,r.currency].join('|')} className="border-b border-border hover:bg-muted/40"><td className="px-2 py-3 whitespace-nowrap">{r.day}</td><td className="max-w-48 break-words px-2">{name(r.shopId)}</td><td className="px-2">{r.method==='stars'?'Stars':'Crypto'}</td><td className="px-2">{r.currency==='XTR'?text.unsettled:r.currency}</td><td className="px-2 tabular-nums">{r.orders}</td><td className="px-2 tabular-nums">{r.stars}</td><td className="px-2 tabular-nums text-warning">{r.pendingStars}</td>{[r.gross,r.fee,r.affiliate,r.net,r.held,r.released,r.refunded].map((v,i)=><td key={i} className="whitespace-nowrap px-2 tabular-nums">{r.currency==='XTR'?'—':money(v,r.currency)}</td>)}</tr>)}</tbody></table></div>}
   </section>
  </>}
 {valid && <ProductRevenueReport from={from} to={to} shopId={shop === 'all' ? undefined : shop} />}
 </div>;
}
