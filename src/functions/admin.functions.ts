import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checked, requireTransition, readAll, readWindow } from "@/lib/data-result";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const adminMw = [requireSupabaseAuth] as const;

async function assertAdmin(ctx: { supabase: { rpc: (...a: never[]) => unknown }; userId: string }) {
  const sb = ctx.supabase as unknown as { rpc: (fn: string, args: object) => Promise<{ data: boolean | null }> };
  const { data } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export const adminOverview = createServerFn({ method: "POST" })
  .middleware([...adminMw])
  .handler(async ({ context }) => {
    const db = await assertAdmin(context);
    const [users, shops, orders, paid] = await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("shops").select("id, name, status, total_sales, created_at").order("created_at", { ascending: false }).limit(100),
      db.from("orders").select("id", { count: "exact", head: true }),
      db.from("orders").select("total_amount, commission_amount, currency, pay_method, settled_amount, settled_fee, settled_currency").in("escrow_status", ["holding", "released", "frozen"]),
    ]);
    const volume: Record<string, number> = {};
    const fees: Record<string, number> = {};
    checked(users); checked(shops); checked(orders); checked(paid);
    const paidRows = await readAll((offset,end)=>db.from("orders").select("total_amount,commission_amount,currency,pay_method,settled_amount,settled_fee,settled_currency").in("escrow_status",["holding","released","frozen"]).order("id").range(offset,end));
    for (const o of paidRows) {
      const currency = o.pay_method === 'stars' ? o.settled_currency : o.currency;
      if (!currency) continue;
      volume[currency] = (volume[currency] ?? 0) + Number(o.pay_method === 'stars' ? o.settled_amount : o.total_amount);
      fees[currency] = (fees[currency] ?? 0) + Number(o.pay_method === 'stars' ? o.settled_fee : o.commission_amount);
    }
    const withdrawals = checked(await db.from("wallet_transactions").select("*").eq("type", "withdrawal").eq("status", "pending").order("created_at"));
    const disputes = checked(await db.from("disputes").select("*, orders(order_number, product_name, total_amount, currency)").eq("status", "open").order("created_at"));
    const issues = checked(await db.from("orders").select("id,order_number,product_name,fulfillment_state,stars_refund_state").or("fulfillment_state.eq.shortage,stars_refund_state.eq.pending").order("created_at")) ?? [];
    return { issues, users: users.count ?? 0, orders: orders.count ?? 0, shops: shops.data ?? [], volume, fees, withdrawals: withdrawals ?? [], disputes: disputes ?? [] };
  });

export const adminWithdrawal = createServerFn({ method: "POST" })
  .middleware([...adminMw])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), approve: z.boolean(), txHash: z.string().max(200).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    const { error } = await db.rpc('finish_withdrawal', { _actor: context.userId, _id: data.id, _approve: data.approve, _tx_hash: data.txHash ?? '' });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminResolveDispute = createServerFn({ method: "POST" })
  .middleware([...adminMw])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), outcome: z.enum(["refund", "release"]), note: z.string().max(2000).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    const { data: d } = await db.from("disputes").select("order_id, status").eq("id", data.id).single();
    if (!d || d.status !== "open") throw new Error("Dispute is not open");
    const order = checked(await db.from("orders").select("pay_method").eq("id", d.order_id).single());
    if (!order) throw new Error("Order not found");
    let starsRefunded = false;
    if (data.outcome === "refund" && order.pay_method === "stars") {
      const prepared = checked(await db.rpc("prepare_stars_refund", { _actor: context.userId, _dispute: data.id }));
      const payload = z.object({ telegramId: z.string(), paymentId: z.string() }).parse(prepared);
      const { tgApi } = await import("@/server/order-paid.server");
      try { await tgApi("refundStarPayment", { user_id: Number(payload.telegramId), telegram_payment_charge_id: payload.paymentId }); }
      catch (error) { if (!(error instanceof Error) || !error.message.includes("CHARGE_ALREADY_REFUNDED")) throw error; }
      starsRefunded = true;
    }
    requireTransition(await db.rpc("resolve_order_dispute", { _actor: context.userId, _dispute: data.id, _outcome: data.outcome, _note: data.note ?? "", _stars_refunded: starsRefunded }));
    if (data.outcome === "release") {
      const now = new Date().toISOString();
      checked(await db.from("product_codes").update({ received_at: now }).eq("order_id", d.order_id).is("received_at", null).select("id"));
      checked(await db.from("orders").update({ buyer_received_at: now }).eq("id", d.order_id).is("buyer_received_at", null).select("id"));
    }
    return { ok: true };
  });

export const adminShopStatus = createServerFn({ method: "POST" })
  .middleware([...adminMw])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["active", "suspended"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    checked(await db.from("shops").update({ status: data.status }).eq("id", data.id));
    return { ok: true };
  });

export const adminSaveTier = createServerFn({ method: "POST" })
  .middleware([...adminMw])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid().optional(), min_order_amount: z.number().min(0), max_order_amount: z.number().positive().nullable(), commission_percent: z.number().min(0).max(50), remove: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    const { id, remove, ...row } = data;
    if (id && remove) checked(await db.from("commission_tiers").delete().eq("id", id));
    else if (id) checked(await db.from("commission_tiers").update(row).eq("id", id));
    else checked(await db.from("commission_tiers").insert(row));
    return { ok: true };
  });

const term = (s?: string) => (s ?? "").replace(/[%_,()]/g, "").trim();

export const adminLists = createServerFn({ method: "POST" })
  .middleware([...adminMw])
  .inputValidator((i: unknown) => z.object({ kind: z.enum(["users", "orders", "products"]), q: z.string().max(100).optional(), pages:z.number().int().min(1).max(1000).default(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    const q = term(data.q);
    if (data.kind === "users") {
      let r = db.from("profiles").select("id, username, first_name, telegram_id, created_at").order("created_at", { ascending: false }).order("id").range(0,data.pages*100-1);
      if (q) r = r.or(`username.ilike.%${q}%,first_name.ilike.%${q}%,telegram_id.ilike.%${q}%`);
      const users = await readWindow((a,b)=>r.range(a,b),data.pages*100);
      const roles = checked(await db.from("user_roles").select("user_id").eq("role", "admin"));
      const admins = new Set((roles ?? []).map((x) => x.user_id));
      return { users: (users ?? []).map((u) => ({ ...u, isAdmin: admins.has(u.id) })), orders: [], products: [] };
    }
    if (data.kind === "orders") {
      let r = db.from("orders").select("id, order_number, product_name, total_amount, currency, status, created_at, shops(name)").order("created_at", { ascending: false }).order("id").range(0,data.pages*100-1);
      if (q) r = /^\d+$/.test(q) ? r.eq("order_number", Number(q)) : r.ilike("product_name", `%${q}%`);
      return { users: [], orders: await readWindow((a,b)=>r.range(a,b),data.pages*100), products: [] };
    }
    let r = db.from("products").select("id, name, price, currency, stock, status, sold_count, shops(name)").neq("status", "archived").order("created_at", { ascending: false }).order("id").range(0,data.pages*100-1);
    if (q) r = r.ilike("name", `%${q}%`);
    return { users: [], orders: [], products: await readWindow((a,b)=>r.range(a,b),data.pages*100) };
  });

export const adminProductStatus = createServerFn({ method: "POST" })
  .middleware([...adminMw])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["active", "suspended"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    checked(await db.from("products").update({ status: data.status }).eq("id", data.id));
    return { ok: true };
  });

export const adminSetAdmin = createServerFn({ method: "POST" })
  .middleware([...adminMw])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid(), admin: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot change your own admin role");
    if (data.admin) checked(await db.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true }));
    else checked(await db.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin"));
    return { ok: true };
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([...adminMw])
  .inputValidator((i: unknown) => z.object({ stars_enabled: z.boolean(), crypto_enabled: z.boolean(), stars_per_usdt: z.number().positive().max(100000), stars_per_ton: z.number().positive().max(100000) }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    if (!data.stars_enabled && !data.crypto_enabled) throw new Error("Keep at least one payment method on");
    checked(await db.from("platform_settings").upsert({ id: true, ...data, updated_at: new Date().toISOString() }));
    return { ok: true };
  });

export const adminRegisterWebhook = createServerFn({ method: "POST" })
  .middleware([...adminMw])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { getRequest } = await import("@tanstack/react-start/server");
    const { tgApi, webhookSecret } = await import("@/server/order-paid.server");
    const origin = new URL(getRequest().url).origin.replace("id-preview--", "project--").replace(/(project--[0-9a-f-]+)(\.)/, (m, a, b) => (a.endsWith("-dev") ? m : `${a}-dev${b}`));
    const url = `${origin}/api/public/telegram/webhook`;
    await tgApi("setWebhook", { url, secret_token: await webhookSecret(), allowed_updates: ["message", "pre_checkout_query", "callback_query"] });
    return { url };
  });

export const retryOrderFulfillment = createServerFn({method:"POST"}).middleware([...adminMw]).inputValidator((i:unknown)=>z.object({id:z.string().uuid()}).parse(i)).handler(async({data,context})=>{
 const db=await assertAdmin(context);
 const {data:ord}=await db.from("orders").select("product_id, products(fulfillment_mode)").eq("id",data.id).maybeSingle();
 if(ord?.products?.fulfillment_mode==="webhook_api"){
  const {dispatchOrderWebhook}=await import("@/server/webhook-fulfillment.server");
  const state=await dispatchOrderWebhook(data.id);
  if(state==="shortage")throw new Error("Webhook fulfillment failed");
 }else{
  requireTransition(await db.rpc("fulfill_paid_order",{_order_id:data.id}));
 }
 const {sendOrderDelivery}=await import("@/server/order-paid.server");
 await sendOrderDelivery(data.id);
 return {ok:true};
});
