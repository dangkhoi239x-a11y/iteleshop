import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';

const seller='11111111-1111-4111-8111-111111111111';
const buyer='22222222-2222-4222-8222-222222222222';
let db:PGlite;
let product:string;
let shop:string;
async function order(quantity=1,method='crypto') {
 const r=await db.query<{id:string}>(`INSERT INTO public.orders(buyer_id,shop_id,product_id,product_name,quantity,unit_price,subtotal,total_amount,currency,commission_percent,commission_amount,pay_method,stars_amount) VALUES($1,$2,$3,'Test',$4::integer,1,$4::integer,$4::integer,'USDT',5,$4::integer*0.05,$5,100) RETURNING id`,[buyer,shop,product,quantity,method]);
 return r.rows[0]?.id ?? '';
}
async function pay(id:string){return db.query('SELECT public.mark_order_paid($1,$2,$3)',[id,'charge-'+id,'USDT']);}
async function state(id:string){return (await db.query<{status:string;fulfillment_state:string;escrow_status:string;buyer_received_at:string|null}>('SELECT * FROM public.orders WHERE id=$1',[id])).rows[0];}

describe('actual PostgreSQL order transactions',()=>{
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;`);
  for(const file of readdirSync('drizzle/migrations').filter(f=>f.endsWith('.sql')).sort()) await db.exec(readFileSync('drizzle/migrations/'+file,'utf8'));
  await db.query('INSERT INTO auth.users VALUES($1),($2)',[seller,buyer]);
  await db.query(`INSERT INTO public.profiles(id,telegram_id,referral_code) VALUES($1,'999','seller'),($2,'888','buyer')`,[seller,buyer]);
  await db.query(`INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')`,[seller]);
 },60000);
 afterAll(async()=>{await db.close();});
 beforeEach(async()=>{
  await db.exec('TRUNCATE public.shops CASCADE;');
  shop=(await db.query<{id:string}>(`INSERT INTO public.shops(owner_id,name,slug) VALUES($1,'Test','test') RETURNING id`,[seller])).rows[0]?.id??'';
  product=(await db.query<{id:string}>(`INSERT INTO public.products(shop_id,name,price,stock) VALUES($1,'Test',1,0) RETURNING id`,[shop])).rows[0]?.id??'';
  await db.query(`INSERT INTO public.product_codes(product_id,content) VALUES($1,'CODE-1'),($1,'CODE-2')`,[product]);
 });
 it('competing orders never partially deliver or release an unfulfilled order',async()=>{
  const first=await order(2),second=await order(2);
  await Promise.all([pay(first),pay(second)]);
  expect((await state(first))?.fulfillment_state).toBe('ready');
  expect((await state(second))?.fulfillment_state).toBe('shortage');
  expect((await db.query<{n:number}>('SELECT count(*)::int n FROM public.product_codes WHERE order_id=$1',[second])).rows[0]?.n).toBe(0);
  await expect(db.query('SELECT public.confirm_order_receipt($1,$2)',[buyer,second])).rejects.toThrow('cannot be received');
 });
 it('requires the complete quantity including promotional free units',async()=>{
  const id=await order(3);await pay(id);
  expect((await state(id))?.fulfillment_state).toBe('shortage');
  expect((await db.query<{stock:number}>('SELECT stock FROM public.products WHERE id=$1',[product])).rows[0]?.stock).toBe(2);
 });
 it('refund does not restore disclosed codes into sellable inventory',async()=>{
  const id=await order(2);await pay(id);await db.query('SELECT public.refund_order_escrow($1)',[id]);
  expect((await db.query<{stock:number}>('SELECT stock FROM public.products WHERE id=$1',[product])).rows[0]?.stock).toBe(0);
  expect((await db.query<{n:number}>("SELECT count(*)::int n FROM public.product_codes WHERE status='sold' AND order_id=$1",[id])).rows[0]?.n).toBe(2);
 });
 it('receipt retries create one seller credit and mark the code received',async()=>{
  const id=await order();await pay(id);
  await db.query('SELECT public.confirm_order_receipt($1,$2)',[buyer,id]);
  await db.query('SELECT public.confirm_order_receipt($1,$2)',[buyer,id]);
  expect((await state(id))?.buyer_received_at).not.toBeNull();
  const ledger=await db.query<{amount:string}>("SELECT amount FROM public.wallet_transactions WHERE order_id=$1 AND type='sale'",[id]);
  expect(ledger.rows).toHaveLength(1);expect(Number(ledger.rows[0]?.amount)).toBe(0.95);
 });
 it('receipt-write failure rolls back financial release',async()=>{
  const id=await order();await pay(id);
  await db.exec(`CREATE FUNCTION public.fail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'receipt failed'; END $$; CREATE TRIGGER fail_receipt BEFORE UPDATE OF received_at ON public.product_codes FOR EACH ROW EXECUTE FUNCTION public.fail_receipt();`);
  try{await expect(db.query('SELECT public.confirm_order_receipt($1,$2)',[buyer,id])).rejects.toThrow('receipt failed');expect((await state(id))?.escrow_status).toBe('holding');}
  finally{await db.exec('DROP TRIGGER fail_receipt ON public.product_codes; DROP FUNCTION public.fail_receipt();');}
 });
 it('dispute freezes before confirmation and resolves exactly once',async()=>{
  const id=await order();await pay(id);
  const dispute=(await db.query<{id:string}>("SELECT public.open_order_dispute($1,$2,'not_received','Test issue') id",[buyer,id])).rows[0]?.id;
  await expect(db.query('SELECT public.confirm_order_receipt($1,$2)',[buyer,id])).rejects.toThrow('cannot be received');
  await db.query("SELECT public.resolve_order_dispute($1,$2,'release','resolved')",[seller,dispute]);
  await db.query("SELECT public.resolve_order_dispute($1,$2,'release','resolved')",[seller,dispute]);
  expect((await state(id))?.escrow_status).toBe('released');
 });
 it('Stars receipt never credits an estimated USDT amount',async()=>{
  const id=await order(1,'stars');await pay(id);await db.query('SELECT public.confirm_order_receipt($1,$2)',[buyer,id]);
  expect((await db.query('SELECT * FROM public.wallet_transactions WHERE order_id=$1',[id])).rows).toHaveLength(0);
 });
 it('full ledger balance includes more than 500 signed entries',async()=>{
  await db.query("SELECT set_config('test.user',$1,false)",[buyer]);
  await db.query("INSERT INTO public.reward_points(user_id,amount,source) SELECT $1,CASE WHEN i<=500 THEN 10 ELSE -3 END,'test' FROM generate_series(1,600) i",[buyer]);
  expect(Number((await db.query<{balance:string}>('SELECT public.my_reward_balance() balance')).rows[0]?.balance)).toBe(4700);
 });
 it('redeems reward points for a personal single-use voucher atomically',async()=>{
  await db.query('DELETE FROM public.reward_points WHERE user_id=$1',[buyer]);
  await db.query("INSERT INTO public.reward_points(user_id,amount,source) VALUES($1,120,'test')",[buyer]);
  const r=await db.query<{code:string}>('SELECT public.redeem_points_for_voucher($1,$2,100,10,NULL,30) code',[buyer,shop]);
  const code=r.rows[0]?.code??'';
  expect(code).toMatch(/^PTS-/);
  await expect(db.query('SELECT public.redeem_points_for_voucher($1,$2,100,10,NULL,30)',[buyer,shop])).rejects.toThrow('Not enough reward points');
  const v=await db.query<{audience:string;target_user_id:string;max_uses:number}>('SELECT audience,target_user_id,max_uses FROM public.vouchers WHERE code=$1',[code]);
  expect(v.rows[0]?.audience).toBe('points');
  expect(v.rows[0]?.target_user_id).toBe(buyer);
  expect(v.rows[0]?.max_uses).toBe(1);
 });
 it('allows one verified review per completed order and updates shop rating',async()=>{
  const id=await order();await pay(id);
  await expect(db.query('SELECT public.submit_order_review($1,$2,5,$3)',[buyer,id,'Great'])).rejects.toThrow('Only completed orders');
  await db.query('SELECT public.confirm_order_receipt($1,$2)',[buyer,id]);
  await db.query('SELECT public.submit_order_review($1,$2,5,$3)',[buyer,id,'Fast delivery']);
  await expect(db.query('SELECT public.submit_order_review($1,$2,4,$3)',[buyer,id,'Again'])).rejects.toThrow();
  const s=await db.query<{rating:string}>('SELECT rating FROM public.shops WHERE id=$1',[shop]);
  expect(Number(s.rows[0]?.rating)).toBe(5);
 });
 it('supports external webhook fulfillment lifecycle atomically',async()=>{
  const whProd=(await db.query<{id:string}>(`INSERT INTO public.products(shop_id,name,price,stock,goods_kind,fulfillment_mode,webhook_url,webhook_secret) VALUES($1,'API Coupon',5,10,'digital','webhook_api','https://api.example.com/gen','sec') RETURNING id`,[shop])).rows[0]?.id??'';
  const oId=(await db.query<{id:string}>(`INSERT INTO public.orders(buyer_id,shop_id,product_id,product_name,quantity,unit_price,subtotal,total_amount,currency,commission_percent,commission_amount,pay_method,stars_amount) VALUES($1,$2,$3,'API Coupon',2,5,10,10,'USDT',5,0.5,'stars',100) RETURNING id`,[buyer,shop,whProd])).rows[0]?.id??'';
  await pay(oId);
  expect((await state(oId))?.fulfillment_state).toBe('pending_external');
  await expect(db.query('SELECT public.complete_external_fulfillment($1,$2,$3)',[oId,['ONLY-1'],null])).rejects.toThrow('Expected 2 codes');
  await db.query('SELECT public.complete_external_fulfillment($1,$2,$3)',[oId,['CPN-A','CPN-B'],'Use at checkout']);
  expect((await state(oId))?.fulfillment_state).toBe('ready');
  expect((await state(oId))?.status).toBe('delivered');
  expect((await db.query<{n:number}>("SELECT count(*)::int n FROM public.product_codes WHERE order_id=$1 AND status='sold'",[oId])).rows[0]?.n).toBe(2);
 });
 it('enforces unique codes per product and delivers earliest-expiring non-expired codes (FEFO)',async()=>{
  await expect(db.query(`INSERT INTO public.product_codes(product_id,content) VALUES($1,'CODE-1')`,[product])).rejects.toThrow();
  await db.query(`DELETE FROM public.product_codes WHERE product_id=$1`,[product]);
  await db.query(`INSERT INTO public.product_codes(product_id,content,expires_at) VALUES($1,'EXPIRED',now()-interval '1 day'),($1,'LATER',now()+interval '10 days'),($1,'SOONER',now()+interval '2 days')`,[product]);
  const id=await order(1);await pay(id);
  expect((await state(id))?.fulfillment_state).toBe('ready');
  const delivered=(await db.query<{delivered_content:string}>('SELECT delivered_content FROM public.orders WHERE id=$1',[id])).rows[0]?.delivered_content;
  expect(delivered).toBe('SOONER');
 });
});