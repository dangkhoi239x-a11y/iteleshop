import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Search, Store } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/app/ui-bits';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { shopsQuery } from '@/lib/queries';
import { storefrontText } from '@/locales/storefront';
export const Route=createFileRoute('/shops')({head:()=>({meta:[{title:'Khám phá cửa hàng · TeleShop'},{name:'description',content:'Tìm cửa hàng, mã số, coupon và ưu đãi trên TeleShop.'},{property:'og:title',content:'Khám phá cửa hàng · TeleShop'},{property:'og:description',content:'Danh sách cửa hàng và sản phẩm trên TeleShop.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:Shops});
function Shops(){
 const {t,i18n}=useTranslation();const text=storefrontText(i18n.language);const [q,setQ]=useState('');const [pages,setPages]=useState(1);const {data,isLoading,error}=useQuery(shopsQuery(q,pages));
 const shops=data?.filter(s=>`${s.name} ${s.description??''} ${s.category??''}`.toLocaleLowerCase().includes(q.trim().toLocaleLowerCase()));
 return <div><PageHeader title={t('shop.list')} back={false}/><div className="space-y-4 p-4">
  <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground"/><Input aria-label={text.searchShops} placeholder={text.searchShops} value={q} onChange={e=>{setQ(e.target.value);setPages(1)}} className="pl-9"/></div>
  <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">{text.shopLabel}</h2><span className="text-xs text-muted-foreground">{shops?.length??0}</span></div>
  {error&&<p role="alert" className="text-destructive">{error.message}</p>}<div className="space-y-3">{isLoading&&[1,2,3].map(i=><Skeleton key={i} className="h-28 rounded-lg"/>)}
   {shops?.length===0&&<EmptyState icon={Store} title={q?text.noMatch:t('shop.noShops')}/>}
   {shops?.map(s=><Link key={s.id} to="/shop/$shopId" params={{shopId:s.id}} className="group block overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50">
    <div className="flex items-start gap-3 p-3.5"><div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary">{s.logo_url?<img src={s.logo_url} alt={s.name} className="h-full w-full object-cover"/>:<Store className="size-6 text-primary"/>}</div><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold">{s.name}</h3>{s.description&&<p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{s.description}</p>}</div><ArrowUpRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"/></div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3.5 py-2 text-[11px]"><span className="text-muted-foreground">{t('shop.sales')}: <span className="tabular text-foreground">{s.total_sales}</span></span>{s.category&&<span className="rounded bg-secondary px-2 py-0.5 text-secondary-foreground">{s.category}</span>}<span className="font-medium text-primary">{text.view} →</span></div>
   </Link>)}
  </div>{data?.length===pages*100&&<Button variant="outline" className="w-full" onClick={()=>setPages(x=>x+1)}>Tải thêm</Button>}</div></div>;
}
