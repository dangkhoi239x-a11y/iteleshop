import { createFileRoute } from '@tanstack/react-router';
import { GrowthManager } from '@/components/app/GrowthManager';
import { ShopGate } from '@/components/app/ShopGate';
import { PageHeader } from '@/components/app/ui-bits';
import { useGrowthText } from '@/lib/growth-text';
export const Route=createFileRoute('/_authenticated/dashboard/growth')({head:()=>({meta:[{title:'Shop growth campaigns · TeleShop'},{name:'description',content:'Manage shop referrals, prize stock and promotional gift wheels.'},{property:'og:title',content:'Shop growth campaigns · TeleShop'},{property:'og:description',content:'Create and manage shop acquisition campaigns.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:Page});
function Page(){const t=useGrowthText();return <ShopGate>{shop=><><PageHeader title={t.title}/><div className="p-4"><GrowthManager shopId={shop.id}/></div></>}</ShopGate>}