import { createFileRoute } from '@tanstack/react-router';
import { ShopGate } from '@/components/app/ShopGate';
import { PageHeader } from '@/components/app/ui-bits';
import { RevenueReport,useFinanceText } from '@/components/app/RevenueReport';
export const Route=createFileRoute('/_authenticated/dashboard/revenue')({head:()=>({meta:[{title:'Shop revenue report · TeleShop'},{name:'description',content:'Daily shop revenue, Stars settlements and crypto proceeds.'},{property:'og:title',content:'Shop revenue report · TeleShop'},{property:'og:description',content:'Track daily Stars and crypto revenue for your shop.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:Page});
function Page(){const text=useFinanceText();return <ShopGate>{()=> <div><PageHeader title={text.title}/><div className="p-4"><RevenueReport/></div></div>}</ShopGate>;}