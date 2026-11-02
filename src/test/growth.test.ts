import { describe, it, expect } from 'vitest';
import { campaignSchema, growthLink, parseGrowthInvite, prizeChance } from '@/lib/growth';
describe('growth rules',()=>{
 it('accepts signed start parameters in compact referral form',()=>expect(parseGrowthInvite('grow_123456781234123412341234567890ab')).toBe('12345678-1234-1234-1234-1234567890ab'));
 it('rejects malformed referral parameters',()=>expect(parseGrowthInvite('grow_not-a-valid-id')).toBeNull());
 it('builds invitation for the configured public bot',()=>expect(growthLink('12345678-1234-1234-1234-1234567890ab')).toBe('https://t.me/iteleshop_bot?startapp=grow_123456781234123412341234567890ab'));
 it('computes odds from remaining prizes without inventing stock',()=>{expect(prizeChance(2,10)).toBe(20);expect(prizeChance(0,0)).toBe(0)});
 const valid={shopId:'12345678-1234-1234-1234-1234567890ab',title:'Test campaign',rules:'Free campaign rules',startsAt:'2026-11-02T00:00:00Z',endsAt:'2026-11-03T00:00:00Z',maxEntries:5,referralEntries:1,prizes:[{label:'Coupon',codes:['A']},{label:'Gift',codes:['B']}]};
 it('rejects empty prize stock',()=>expect(campaignSchema.safeParse({...valid,prizes:[{label:'Gift',codes:[]}]}).success).toBe(false));
 it('rejects entries below one',()=>expect(campaignSchema.safeParse({...valid,maxEntries:0}).success).toBe(false));
 it('rejects campaigns ending before they start',()=>expect(campaignSchema.safeParse({...valid,endsAt:'2026-11-01T00:00:00Z'}).success).toBe(false));
});