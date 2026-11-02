import { useTranslation } from 'react-i18next';
import { Flame, Gift, Layers, Zap } from 'lucide-react';
import { effectivePrice, isFlashSaleActive, parseBulkTiers, type PriceProduct } from '@/lib/pricing';
import { money } from '@/lib/format';
import { storefrontText } from '@/locales/storefront';

export type MerchProduct = PriceProduct & { currency: string; product_type?: string; auto_send_telegram?: boolean; buy_x?: number | null; get_y?: number | null; bulk_discounts?: string | null };
export function ProductBadges({ p }: { p: MerchProduct }) {
 const { t, i18n } = useTranslation(); const text = storefrontText(i18n.language);
 const tiers = parseBulkTiers(p.bulk_discounts);
 return <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
  {isFlashSaleActive(p) && <span className="inline-flex items-center gap-1 rounded bg-flash/15 px-2 py-1 text-flash"><Flame className="size-3" />{text.offer} −{Math.round((1-effectivePrice(p)/Number(p.price))*100)}%</span>}
  {!!p.buy_x && !!p.get_y && <span className="inline-flex items-center gap-1 rounded bg-success/15 px-2 py-1 text-success"><Gift className="size-3" />{t('extra.bxgy',{x:p.buy_x,y:p.get_y})}</span>}
  {tiers.length > 0 && <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-2 py-1 text-warning"><Layers className="size-3" />{text.offer} ≤{Math.max(...tiers.map(b=>b.percent))}%</span>}
  {p.product_type === 'digital' && <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-primary"><Zap className="size-3" />{text.digital}</span>}
 </div>;
}
export function ProductPrice({ p, prominent = false }: { p: MerchProduct; prominent?: boolean }) {
 const flash = isFlashSaleActive(p);
 return <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><span className={`tabular font-display font-bold text-primary ${prominent?'text-2xl':'text-sm'}`}>{money(effectivePrice(p),p.currency)}</span>{flash && <span className="tabular text-xs text-muted-foreground line-through">{money(p.price,p.currency)}</span>}</div>;
}
