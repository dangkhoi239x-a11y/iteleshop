import { proceeds, revenueDay, type RevenueOrder } from './revenue';
import { round6 } from './pricing';
export function summarizeReferralCosts(orders:RevenueOrder[]){
 const groups=new Map<string,{day:string;shopId:string;currency:string;orders:number;referrers:Set<string>;buyers:Set<string>;gross:number;cost:number;fees:number;net:number;pendingStars:number;refunded:number}>();
 for(const o of orders){if(!o.paid_at||!o.affiliate_user_id)continue;const p=proceeds(o);const day=revenueDay(o.paid_at),key=[day,o.shop_id,p.currency].join('|');const r=groups.get(key)??{day,shopId:o.shop_id,currency:p.currency,orders:0,referrers:new Set<string>(),buyers:new Set<string>(),gross:0,cost:0,fees:0,net:0,pendingStars:0,refunded:0};
 r.orders++;r.referrers.add(o.affiliate_user_id);if(o.escrow_status==='refunded')r.refunded+=p.gross;else{r.gross+=p.gross;r.cost+=p.affiliate;r.fees+=p.fee;r.net+=p.net;if(o.pay_method==='stars'&&!o.settled_currency)r.pendingStars+=o.stars_amount??0;}groups.set(key,r);}
 return [...groups.values()].map(({referrers,buyers,...r})=>({...r,referrers:referrers.size,gross:round6(r.gross),cost:round6(r.cost),fees:round6(r.fees),net:round6(r.net)})).sort((a,b)=>b.day.localeCompare(a.day));
}