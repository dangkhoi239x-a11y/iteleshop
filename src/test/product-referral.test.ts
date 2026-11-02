import { describe,it,expect } from 'vitest';
import { parseProductRef,productReferralLink,quizSchema } from '@/lib/product-referral';
import { summarizeReferralCosts } from '@/lib/referral-report';
import type { RevenueOrder } from '@/lib/revenue';
const o:RevenueOrder={id:'a',shop_id:'s',paid_at:'2026-11-02T20:00:00Z',pay_method:'crypto',currency:'TON',total_amount:10,commission_amount:.5,affiliate_percent:10,affiliate_user_id:'r',escrow_status:'holding',stars_amount:null,settled_amount:null,settled_currency:null,settled_fee:null,settled_affiliate:null,settled_net:null};
describe('product attribution and cost rules',()=>{
 it('round trips product referral parameters',()=>expect(parseProductRef(productReferralLink('12345678-1234-1234-1234-1234567890ab').split('=')[1])).toBe('12345678-1234-1234-1234-1234567890ab'));
 it('rejects forged malformed identifiers',()=>expect(parseProductRef('prod_bad')).toBeNull());
 it('reports commission and UTC+7 payment day',()=>{const r=summarizeReferralCosts([o])[0];expect(r?.day).toBe('2026-11-03');expect(r?.cost).toBe(1);expect(r?.net).toBe(8.5)});
 it('does not mix currencies',()=>expect(summarizeReferralCosts([o,{...o,id:'b',currency:'USDT'}])).toHaveLength(2));
 it('unsettled Stars never creates estimated money',()=>{const r=summarizeReferralCosts([{...o,pay_method:'stars',stars_amount:100}])[0];expect(r?.gross).toBe(0);expect(r?.cost).toBe(0);expect(r?.pendingStars).toBe(100)});
 it('settled Stars uses actual commission',()=>expect(summarizeReferralCosts([{...o,pay_method:'stars',settled_currency:'TON',settled_amount:2,settled_affiliate:.2,settled_fee:.1,settled_net:1.7}])[0]?.cost).toBe(.2));
 it('does not count refunded proceeds as profit',()=>expect(summarizeReferralCosts([{...o,escrow_status:'refunded'}])[0]?.net).toBe(0));
 it('quiz cannot name a non-existent correct answer',()=>expect(quizSchema.safeParse({campaignId:'12345678-1234-1234-1234-1234567890ab',title:'Test quiz',question:'Question?',options:['A','B'],correct:3,points:10,entries:1}).success).toBe(false));
});
