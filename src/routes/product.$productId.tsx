import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServerFn } from '@tanstack/react-start';
import { ArrowRight, ChevronDown, Flame, Gift, Loader2, Minus, Package, Plus, Send, ShieldCheck, ShoppingBag, Store, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Countdown, EmptyState, ProductCard } from '@/components/app/ui-bits';
import { ProductBadges, ProductPrice } from '@/components/app/ProductMerchandising';
import { ShareActions } from '@/components/app/ShareActions';
import { productQuery, shopQuery } from '@/lib/queries';
import { bulkPercent, effectivePrice, freeUnits, isFlashSaleActive, parseBulkTiers, round6 } from '@/lib/pricing';
import { money } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { createProductReferral } from '@/functions/referrals.functions';
import { shareLink } from '@/lib/telegram';
import { storefrontText } from '@/locales/storefront';

export const Route = createFileRoute('/product/$productId')({
 head: () => ({meta:[{title:'Sản phẩm & ưu đãi · TeleShop'},{name:'description',content:'Xem giá, ưu đãi mua nhiều và mua sản phẩm trên TeleShop.'},{property:'og:title',content:'Sản phẩm & ưu đãi · TeleShop'},{property:'og:description',content:'Sản phẩm, ưu đãi và chia sẻ nhận hoa hồng trên TeleShop.'},{property:'og:type',content:'product'},{name:'twitter:card',content:'summary_large_image'}]}),
 component: ProductPage,
});
function ProductPage() {
 const { productId } = Route.useParams(); const { t, i18n } = useTranslation(); const text = storefrontText(i18n.language);
 const { userId } = useAuth(); const referral = useServerFn(createProductReferral);
 const [qty,setQty] = useState(1); const [busy,setBusy] = useState(false);
 const {data:p,isLoading,isError} = useQuery(productQuery(productId));
 const {data:related} = useQuery({...shopQuery(p?.shop_id??''),enabled:!!p?.shop_id});
 if(isLoading) return <div className="space-y-3 p-4"><Skeleton className="h-32 rounded-lg"/><Skeleton className="h-24 rounded-lg"/></div>;
 if(!p || isError) return <EmptyState title="404"/>;
 const own = p.shops?.owner_id===userId; const tiers = parseBulkTiers(p.bulk_discounts); const flash = isFlashSaleActive(p);
 const free = freeUnits(qty,p.buy_x,p.get_y); const pct = bulkPercent(tiers,qty);
 const total = round6(effectivePrice(p)*qty*(1-pct/100));
 const available = p.status==='active' && qty+free<=p.stock;
 const offers = tiers.length>0 || (!!p.buy_x && !!p.get_y);
 const buy = available ? <Button className="min-w-0 flex-1" asChild><Link to="/checkout" search={{productId:p.id,quantity:qty}}><ShoppingBag/>{t('product.buyNow')}</Link></Button> : <Button className="min-w-0 flex-1" disabled>{p.stock===0?t('product.outOfStock'):text.unavailable}</Button>;
 const affiliate = async()=>{setBusy(true);try{const r=await referral({data:{productId}});shareLink(r.url,`${p.name} · TeleShop`);toast.success(`${r.percent}% · ${text.affiliateNote}`);}catch(e){toast.error(e instanceof Error?e.message:text.referralError);}finally{setBusy(false);}};
 return <div>
  <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
   <div className="flex items-center gap-2.5 px-3 py-2">
    <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">{p.image_url?<img src={p.image_url} alt={p.name} className="h-full w-full object-contain p-1"/>:<Package className="size-5 text-muted-foreground"/>}</div>
    <div className="min-w-0 flex-1">
     <h1 className="truncate text-sm font-semibold leading-tight">{p.name}</h1>
     <ProductPrice p={p}/>
    </div>
    {!own && <div className="flex w-28 shrink-0">{buy}</div>}
   </div>
   <div className="flex items-center gap-2 border-t border-border/60 px-3 py-1.5">
    <ShareActions path={`/product/${p.id}`} name={p.name}/>
    {!own && <Button variant="outline" size="sm" className="h-7 flex-1 gap-1.5 text-[11px]" disabled={busy} onClick={userId?affiliate:undefined} asChild={!userId}>{userId?<>{busy?<Loader2 className="size-3.5 animate-spin"/>:<Users className="size-3.5"/>}{text.referral}</>:<Link to="/auth"><Users className="size-3.5"/>{text.referral}</Link>}</Button>}
   </div>
  </header>
  <div className="space-y-4 p-4">
   <section className="space-y-3">
    <div className="flex items-start gap-3">
     <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">{p.image_url?<img src={p.image_url} alt={p.name} className="h-full w-full object-contain p-1"/>:<Package className="size-6 text-muted-foreground"/>}</div>
     <div className="min-w-0 flex-1"><h2 className="mb-1 break-words font-display text-base font-bold leading-snug">{p.name}</h2><ProductPrice p={p} prominent/><p className="mt-1 text-[11px] text-muted-foreground">{t('product.sold',{n:p.sold_count})} · <span className={p.stock>0?'text-success':''}>{p.stock>0?t('product.stock',{n:p.stock}):t('product.outOfStock')}</span></p></div>
    </div>
    <ProductBadges p={p}/>
    {flash && p.flash_sale_end && <div className="flex flex-wrap items-center justify-between gap-1 border-l-2 border-flash bg-flash/10 px-3 py-2 text-xs"><span className="flex items-center gap-1 font-semibold text-flash"><Flame className="size-3.5"/>{t('home.flashSale')}</span><span>{t('home.endsIn')} <Countdown end={p.flash_sale_end}/></span></div>}
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-success"/>{p.warranty_type==='none'?t('product.warrantyNone',{days:p.escrow_release_days}):t('product.warrantyStandard')}</span>{p.auto_send_telegram && <span className="flex items-center gap-1.5"><Send className="size-3.5 text-primary"/>{text.delivery}</span>}</div>
   </section>
   {offers && <section className="space-y-2 border-y border-border py-3">
    <h2 className="flex items-center gap-2 text-sm font-semibold"><Gift className="size-4 text-warning"/>{text.buyMore}</h2>
    {!!p.buy_x && !!p.get_y && <p className="text-xs font-medium text-success">{t('extra.bxgy',{x:p.buy_x,y:p.get_y})}</p>}
    {tiers.length>0 && <div className="flex flex-wrap gap-2">{tiers.map(b=><Button key={b.minQty} size="sm" variant={qty===b.minQty?'default':'outline'} className="h-auto flex-col gap-0.5 px-3 py-2" disabled={own || b.minQty+freeUnits(b.minQty,p.buy_x,p.get_y)>p.stock} onClick={()=>setQty(b.minQty)}><span>{b.minQty} × · −{b.percent}%</span><span className="tabular text-[10px]">{money(round6(effectivePrice(p)*b.minQty*(1-bulkPercent(tiers,b.minQty)/100)),p.currency)}</span></Button>)}</div>}
   </section>}
   {!own && <section className="space-y-2">
    <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{text.quantity}</span><div className="flex items-center gap-2"><Button variant="secondary" size="icon" className="size-8" aria-label="Decrease quantity" disabled={qty<=1} onClick={()=>setQty(q=>q-1)}><Minus/></Button><span className="tabular w-8 text-center text-sm font-semibold" aria-live="polite">{qty}</span><Button variant="secondary" size="icon" className="size-8" aria-label="Increase quantity" disabled={qty>=100 || qty+1+freeUnits(qty+1,p.buy_x,p.get_y)>p.stock} onClick={()=>setQty(q=>q+1)}><Plus/></Button></div></div>
    {free>0 && <p className="text-xs text-success">{t('extra.freeGot',{n:free})}</p>}
    <div className="flex items-center gap-3"><div className="min-w-0"><p className="text-[10px] text-muted-foreground">{text.total}{pct>0?` · −${pct}%`:''}</p><p className="tabular break-words text-sm font-bold text-primary">{money(total,p.currency)}</p></div>{buy}</div>
   </section>}
   {own && <p className="text-sm text-muted-foreground">{t('product.ownShop')}</p>}
   {p.shops && <Link to="/shop/$shopId" params={{shopId:p.shops.id}} className="flex items-center gap-2.5 border-y border-border py-3">{p.shops.logo_url?<img src={p.shops.logo_url} alt="" className="size-9 rounded-lg object-cover"/>:<Store className="size-5 text-primary"/>}<span className="min-w-0 flex-1"><span className="block text-[10px] text-muted-foreground">{text.shopLabel}</span><span className="block truncate text-sm font-semibold">{p.shops.name}</span></span><ArrowRight className="size-4 text-muted-foreground"/></Link>}
   {(p.description || p.highlights) && <details className="group border-b border-border pb-3"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">{text.details}<ChevronDown className="size-4 transition-transform group-open:rotate-180"/></summary><div className="space-y-3 pt-3 text-sm text-muted-foreground">{p.highlights && <ul className="list-disc space-y-1 pl-4">{p.highlights.split('\n').filter(l=>l.trim()).map((l,i)=><li key={i}>{l}</li>)}</ul>}{p.description && <p className="whitespace-pre-line break-words">{p.description}</p>}</div></details>}
   {!!related?.products.filter(item=>item.id!==p.id).length && <section className="space-y-3"><div><h2 className="text-sm font-semibold">{text.related}</h2><p className="text-[10px] text-muted-foreground">{text.relatedNote}</p></div><div className="grid grid-cols-2 gap-3">{related.products.filter(item=>item.id!==p.id).slice(0,4).map(item=><ProductCard key={item.id} p={item}/>)}</div></section>}
  </div>
 </div>;
}
