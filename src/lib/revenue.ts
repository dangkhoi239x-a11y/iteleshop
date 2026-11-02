import { round6 } from './pricing';
export type RevenueFilters = { method: 'all' | 'stars' | 'crypto'; currency: 'all' | 'USDT' | 'TON' | 'XTR' };
export function filterRevenue<T extends { method: string; currency: string }>(rows: T[], filters: RevenueFilters) {
 return rows.filter(row => (filters.method === 'all' || row.method === filters.method) && (filters.currency === 'all' || row.currency === filters.currency));
}
export type RevenueOrder = { id: string; shop_id: string; paid_at: string | null; pay_method: string; currency: string; total_amount: number; commission_amount: number; affiliate_percent: number; affiliate_user_id: string | null; escrow_status: string; stars_amount: number | null; settled_amount: number | null; settled_currency: string | null; settled_fee: number | null; settled_affiliate: number | null; settled_net: number | null };
export function revenueDay(iso: string) { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(iso)); }
export function proceeds(o: RevenueOrder) {
 if(o.pay_method==='stars') return {currency:o.settled_currency??'XTR',gross:o.settled_amount??0,fee:o.settled_fee??0,affiliate:o.settled_affiliate??0,net:o.settled_net??0};
 const affiliate=o.affiliate_user_id?round6(o.total_amount*o.affiliate_percent/100):0;
 return {currency:o.currency,gross:o.total_amount,fee:o.commission_amount,affiliate,net:round6(o.total_amount-o.commission_amount-affiliate)};
}
export function summarizeRevenue(orders: RevenueOrder[]) {
 const groups=new Map<string,{day:string;shopId:string;method:string;currency:string;orders:number;stars:number;pendingStars:number;gross:number;fee:number;affiliate:number;net:number;held:number;released:number;refunded:number}>();
 for(const o of orders){
  if(!o.paid_at)continue;
  const p=proceeds(o),day=revenueDay(o.paid_at),key=[day,o.shop_id,o.pay_method,p.currency].join('|');
  const r=groups.get(key)??{day,shopId:o.shop_id,method:o.pay_method,currency:p.currency,orders:0,stars:0,pendingStars:0,gross:0,fee:0,affiliate:0,net:0,held:0,released:0,refunded:0};
  r.orders++;
  if(o.escrow_status==='refunded')r.refunded+=p.gross;
  else{r.stars+=o.stars_amount??0;if(o.pay_method==='stars'&&!o.settled_currency)r.pendingStars+=o.stars_amount??0;r.gross+=p.gross;r.fee+=p.fee;r.affiliate+=p.affiliate;r.net+=p.net;if(o.escrow_status==='released')r.released+=p.net;else r.held+=p.net;}
  groups.set(key,r);
 }
 return [...groups.values()].sort((a,b)=>b.day.localeCompare(a.day)).map(r=>({...r,gross:round6(r.gross),fee:round6(r.fee),affiliate:round6(r.affiliate),net:round6(r.net),held:round6(r.held),released:round6(r.released),refunded:round6(r.refunded)}));
}