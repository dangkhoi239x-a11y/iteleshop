import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Send, Store, ChevronDown } from 'lucide-react';
import { EmptyState, PageHeader, ProductCard } from '@/components/app/ui-bits';
import { ShareActions } from '@/components/app/ShareActions';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { shopQuery } from '@/lib/queries';
import { openExternal } from '@/lib/telegram';
import { effectivePrice, isFlashSaleActive, parseBulkTiers } from '@/lib/pricing';
import { AiRecommendations } from '@/components/app/AiRecommendations';
import { Button } from '@/components/ui/button';
import { storefrontText } from '@/locales/storefront';

export const Route = createFileRoute('/shop/$shopId')({
 head:()=>({meta:[{title:'Cửa hàng & danh mục · TeleShop'},{name:'description',content:'Khám phá sản phẩm, giá và ưu đãi của cửa hàng trên TeleShop.'},{property:'og:title',content:'Cửa hàng & danh mục · TeleShop'},{property:'og:description',content:'Tìm sản phẩm, ưu đãi mua nhiều và liên hệ cửa hàng qua Telegram.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:ShopPage,
});
function ShopPage() {
 const {shopId}=Route.useParams(); const {t,i18n}=useTranslation(); const text=storefrontText(i18n.language);
 const [q,setQ]=useState(''); const [mode,setMode]=useState('all'); const [sort,setSort]=useState('newest');
 const {data,isLoading,isError}=useQuery(shopQuery(shopId));
 if(isLoading)return <div className="space-y-3 p-4"><Skeleton className="h-24 rounded-lg"/><Skeleton className="h-60 rounded-lg"/></div>;
 if(!data?.shop || isError)return <EmptyState icon={Store} title="404"/>;
 const s=data.shop;
 const hasOffer=(p:typeof data.products[number])=>isFlashSaleActive(p)||parseBulkTiers(p.bulk_discounts).length>0||!!(p.buy_x&&p.get_y);
 const products=data.products.filter(p=>p.name.toLocaleLowerCase().includes(q.toLocaleLowerCase().trim())&&(mode!=='offers'||hasOffer(p))&&(mode!=='stock'||p.stock>0)).sort((a,b)=>sort==='popular'?b.sold_count-a.sold_count:sort==='price'?a.currency.localeCompare(b.currency)||effectivePrice(a)-effectivePrice(b):new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
 return <div>
  <PageHeader title={t('shop.products')} action={<ShareActions path={`/shop/${shopId}`} name={s.name}/>}/>
  {s.banner_url && <div className="h-20 overflow-hidden bg-muted"><img src={s.banner_url} alt={s.name} className="h-full w-full object-cover"/></div>}
  <section className="space-y-3 border-b border-border p-4">
   <div className="flex items-center gap-3"><div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary">{s.logo_url?<img src={s.logo_url} alt="" className="h-full w-full object-cover"/>:<Store className="size-6 text-primary"/>}</div><div className="min-w-0 flex-1"><h1 className="break-words font-display text-lg font-bold">{s.name}</h1><p className="mt-0.5 text-[11px] text-muted-foreground">{data.products.length} {t('shop.products').toLowerCase()} · {t('shop.sales')}: {s.total_sales}</p></div></div>
   {s.description && <details className="group"><summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-muted-foreground"><span className="line-clamp-1 flex-1 group-open:hidden">{s.description}</span><span className="hidden flex-1 group-open:block">{text.details}</span><ChevronDown className="size-3.5 shrink-0 group-open:rotate-180"/></summary><p className="mt-2 whitespace-pre-line break-words text-xs text-muted-foreground">{s.description}</p></details>}
   {s.telegram_channel && <Button variant="outline" size="sm" onClick={()=>openExternal(`https://t.me/${s.telegram_channel?.replace(/^@|https?:\/\/t\.me\//g,'')}`)}><Send/>{s.telegram_channel}</Button>}
  </section>
  <section className="space-y-3 p-4">
   <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground"/><Input aria-label={text.search} value={q} onChange={e=>setQ(e.target.value)} placeholder={text.search} className="pl-9"/></div>
   <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-1">{[['all',text.all],['offers',text.offers],['stock',text.available]].map(([value,label])=><Button key={value} size="sm" variant={mode===value?'secondary':'ghost'} aria-pressed={mode===value} onClick={()=>setMode(value)} className={mode===value?'text-primary':''}>{label}</Button>)}</div><select aria-label={text.choose} value={sort} onChange={e=>setSort(e.target.value)} className="h-8 max-w-full rounded-md border border-input bg-background px-2 text-xs"><option value="newest">{text.newest}</option><option value="popular">{text.popular}</option><option value="price">{text.price}</option></select></div>
   <div className="flex items-baseline justify-between"><h2 className="text-sm font-semibold">{t('shop.products')}</h2><span className="text-xs text-muted-foreground">{products.length}</span></div>
   {products.length?<div className="grid grid-cols-2 gap-3">{products.map(p=><ProductCard key={p.id} p={p}/>)}</div>:<EmptyState title={data.products.length?text.noMatch:t('shop.empty')}/>}
  </section>
  <details className="mx-4 mb-4 border-t border-border py-3"><summary className="cursor-pointer text-sm font-semibold text-primary">{t('ai.title')}</summary><AiRecommendations shopId={shopId}/></details>
 </div>;
}
