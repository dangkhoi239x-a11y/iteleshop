import {describe,it,expect} from 'vitest';
import {checked,requireTransition,readAll} from '@/lib/data-result';
import {orderQuote} from '@/lib/pricing';
const product={price:10,flash_sale_price:null,flash_sale_end:null,bulk_discounts:null};
const voucher={discount_type:'percent',discount_value:10,min_order_amount:20,max_uses:null,used_count:0,expires_at:null,is_active:true};
describe('review regression rules',()=>{
 it('rejects failed persistence before success can be returned',()=>{expect(()=>checked({data:null,error:{message:'save failed'}})).toThrow('save failed');});
 it('rejects a false transition even without a database error',()=>{expect(()=>requireTransition({data:false,error:null})).toThrow('did not complete');});
 it('recomputes a percentage voucher after quantity changes',()=>{expect(orderQuote(product,2,voucher).total).toBe(18);expect(orderQuote(product,3,voucher).total).toBe(27);});
 it('rejects the voucher when quantity no longer meets minimum spend',()=>{expect(orderQuote(product,1,voucher).voucherValid).toBe(false);});
 it('enforces the checkout maximum of 100',()=>{expect(()=>orderQuote(product,101)).toThrow('100');expect(orderQuote(product,100).gross).toBe(1000);});
 it('reads beyond the first database page without losing rows',async()=>{const input=Array.from({length:1201},(_,i)=>i);expect(await readAll(async(a,b)=>({data:input.slice(a,b+1),error:null}))).toEqual(input);});
});