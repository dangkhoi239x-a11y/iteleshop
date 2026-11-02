import { describe,it,expect } from 'vitest';
import { proceeds,revenueDay,summarizeRevenue,type RevenueOrder } from '@/lib/revenue';
const order:RevenueOrder={id:'1',shop_id:'shop',paid_at:'2026-11-01T18:00:00Z',pay_method:'stars',currency:'USDT',total_amount:10,commission_amount:0.5,affiliate_percent:10,affiliate_user_id:'aff',escrow_status:'released',stars_amount:770,settled_amount:null,settled_currency:null,settled_fee:null,settled_affiliate:null,settled_net:null};
describe('actual Stars proceeds',()=>{
 it('never credits estimated USDT for unsettled Stars',()=>{expect(proceeds(order)).toEqual({currency:'XTR',gross:0,fee:0,affiliate:0,net:0});expect(summarizeRevenue([order])[0]?.pendingStars).toBe(770);});
 it('uses actual received TON instead of checkout USDT',()=>{const o={...order,settled_amount:2,settled_currency:'TON',settled_fee:0.1,settled_affiliate:0.2,settled_net:1.7};expect(proceeds(o)).toEqual({currency:'TON',gross:2,fee:0.1,affiliate:0.2,net:1.7});expect(summarizeRevenue([o])[0]?.released).toBe(1.7);});
 it('groups day in Saigon UTC+7',()=>expect(revenueDay('2026-11-01T18:00:00Z')).toBe('2026-11-02'));
 it('separates shop, payment method and currency',()=>{const rows=summarizeRevenue([order,{...order,id:'2',pay_method:'crypto'},{...order,id:'3',pay_method:'crypto',currency:'TON'},{...order,id:'4',shop_id:'other'}]);expect(rows).toHaveLength(4);});
 it('deducts platform and affiliate fees for crypto',()=>expect(proceeds({...order,pay_method:'crypto'}).net).toBe(8.5));
 it('does not count refunded orders as earned revenue',()=>{const row=summarizeRevenue([{...order,pay_method:'crypto',escrow_status:'refunded'}])[0];expect(row?.gross).toBe(0);expect(row?.released).toBe(0);expect(row?.refunded).toBe(10);});
});